import { BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import * as osn from 'obs-studio-node';
import { IInput, IScene } from 'obs-studio-node';
import WaitQueue from 'wait-queue';
import { ISource } from 'obs-studio-node';
import { ERecordingFormat } from './obsEnums';
import { deleteVideo, fixPathWhenPackaged, getSortedVideos } from './util';
import { IOBSDevice, RecStatus, TAudioSourceType } from './types';
import Activity from '../activitys/Activity';
import VideoProcessQueue from './VideoProcessQueue';
import ConfigService from './ConfigService';
import { obsResolutions } from './constants';

const { v4: uuidfn } = require('uuid');

export default class Recorder {
  /**
   * If this is not static the signalling goes wrong, I've no idea why. The
   * symptom is OBS assertions failing because waitQueue returns things in the
   * wrong order. This is fine to be static so long as we only have one recorder
   * object in use at a time, which is the design.
   */
  private static waitQueue = new WaitQueue<osn.EOutputSignal>();

  private _isRecording: boolean = false;

  private _isRecordingBuffer: boolean = false;

  private _bufferRestartIntervalID?: NodeJS.Timer;

  private _bufferStartTimeoutID?: NodeJS.Timer;

  private _recorderStartDate = new Date();

  private _mainWindow: BrowserWindow;

  private obsRecordingFactory: osn.IAdvancedRecording | undefined;

  private videoProcessQueue: VideoProcessQueue;

  private cfg: ConfigService = ConfigService.getInstance();

  private bufferStorageDir: string | undefined;

  private uuid: string = uuidfn();

  private videoChannel = 1;

  private audioInputChannel = 2;

  private audioInputDevice: IInput | undefined;

  private audioOutputChannel = 3;

  private audioOutputDevice: IInput | undefined;

  public obsInitialized = false;

  public obsConfigured = false;

  constructor(mainWindow: BrowserWindow) {
    console.info('[Recorder] Constructing recorder:', this.uuid);
    this._mainWindow = mainWindow;
    this.videoProcessQueue = new VideoProcessQueue(mainWindow);
    this.initializeOBS();
  }

  get mainWindow() {
    return this._mainWindow;
  }

  get isRecording() {
    return this._isRecording;
  }

  set isRecording(value) {
    this._isRecording = value;
  }

  get isRecordingBuffer() {
    return this._isRecordingBuffer;
  }

  set isRecordingBuffer(value) {
    this._isRecordingBuffer = value;
  }

  configure() {
    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    try {
      this.cfg.validate();
    } catch (error) {
      throw new Error('[Recorder] Configure called but config invalid');
    }

    this.bufferStorageDir = this.cfg.getPath('bufferStoragePath');
    this.createRecordingDirs();
    this.obsRecordingFactory = this.configureOBS();
    this.configureVideoOBS();
    // this.addAudioSourcesOBS();
    this.obsConfigured = true;
  }

  /**
   * Start recorder buffer. This starts OBS and records in 5 min chunks
   * to the buffer location.
   */
  startBuffer = async () => {
    console.info('[Recorder] Start recording buffer');

    if (!this.obsInitialized) {
      console.error('[Recorder] OBS not initialized');
      return;
    }

    if (this.isRecordingBuffer) {
      console.error('[Recorder] Already recording a buffer');
      return;
    }

    await this.startOBS();
    this.isRecordingBuffer = true;
    this._recorderStartDate = new Date();

    this.mainWindow.webContents.send(
      'updateRecStatus',
      RecStatus.ReadyToRecord
    );

    // We store off this timer as a member variable as we will cancel
    // it when a real game is detected.
    this._bufferRestartIntervalID = setInterval(() => {
      this.restartBuffer();
    }, 5 * 60 * 1000); // Five mins
  };

  /**
   * Stop recorder buffer.
   */
  stopBuffer = async () => {
    this.cancelBufferTimers(true, true);

    if (this._isRecordingBuffer) {
      console.info('[Recorder] Stop recording buffer');
      this._isRecordingBuffer = false;
      await this.stopOBS();
    } else {
      console.error('[Recorder] No buffer recording to stop');
    }

    this.mainWindow.webContents.send(
      'updateRecStatus',
      RecStatus.WaitingForWoW
    );

    this.cleanupBuffer(1);
  };

  /**
   * Restarts the buffer recording. Cleans the temp dir between stop/start.
   * We wait 5s here between the stop start. I don't know why, but if we
   * don't then OBS becomes unresponsive. I spent a lot of time on this,
   * trying all sorts of other solutions don't fuck with it unless you have
   * to; here be dragons.
   */
  restartBuffer = async () => {
    console.log('[Recorder] Restart recording buffer');
    this.isRecordingBuffer = false;
    await this.stopOBS();

    this._bufferStartTimeoutID = setTimeout(async () => {
      await this.startOBS();
      this.isRecordingBuffer = true;
      this._recorderStartDate = new Date();
    }, 5000);

    this.cleanupBuffer(1);
  };

  /**
   * Cancel buffer timers. This can include any combination of:
   *  - _bufferRestartIntervalID: the interval on which we periodically restart the buffer
   *  - _bufferStartTimeoutID: the timer we use during buffer restart to start the recorder again.
   */
  cancelBufferTimers = (
    cancelRestartInterval: boolean,
    cancelStartTimeout: boolean
  ) => {
    if (cancelRestartInterval && this._bufferRestartIntervalID) {
      console.info('[Recorder] Buffer restart interval cleared');
      clearInterval(this._bufferRestartIntervalID);
    }

    if (cancelStartTimeout && this._bufferStartTimeoutID) {
      console.info('[Recorder] Buffer start timeout cleared');
      clearInterval(this._bufferStartTimeoutID);
    }
  };

  /**
   * Start recording for real, this basically just cancels pending
   * buffer recording restarts. We don't need to actually start OBS
   * recording as it's should already be running (or just about to
   * start if we hit this in the 2s restart window).
   */
  async start() {
    console.info('[Recorder] Start recording by cancelling buffer restart');
    this.cancelBufferTimers(true, false);
    this._isRecordingBuffer = false;
    this._isRecording = true;
    this.mainWindow.webContents.send('updateRecStatus', RecStatus.Recording);
  }

  /**
   * Stop recording, no-op if not already recording. Quite a bit happens in
   * this function, so I've included lots of comments. The ordering is also
   * important.
   *
   * @param {Activity} activity the details of the recording
   * @param {boolean} closedWow if wow has just been closed
   */
  async stop(activity: Activity, closedWow = false) {
    console.info('[Recorder] Stop called');

    if (!this._isRecording) {
      console.error('[Recorder] Stop recording called but not recording');
      return;
    }

    const metadata = activity.getMetadata();
    console.info('[Recorder] Over-running by', metadata.overrun, 'seconds');

    if (!this.obsRecordingFactory) {
      throw new Error(
        '[Recorder] Stop recording called but no recording factory'
      );
    }

    await new Promise((resolve) =>
      setTimeout(resolve, metadata.overrun * 1000)
    );

    await this.stopOBS();
    this._isRecording = false;
    this._isRecordingBuffer = false;

    const bufferFile = this.obsRecordingFactory.lastFile();
    const relativeStart =
      (activity.startDate.getTime() - this._recorderStartDate.getTime()) / 1000;

    if (bufferFile) {
      this.videoProcessQueue.queueVideo(
        bufferFile,
        metadata,
        activity.getFileName(),
        relativeStart
      );
    } else {
      console.error(
        "[Recorder] Unable to get the last recording from OBS. Can't process video."
      );
    }

    // Refresh the GUI
    this.mainWindow.webContents.send('refreshState');
    this.mainWindow.webContents.send(
      'updateRecStatus',
      RecStatus.WaitingForWoW
    );

    // Restart the buffer recording ready for next game. If this function
    // has been called due to the wow process ending, don't start the buffer.
    if (!closedWow) {
      setTimeout(async () => {
        this.startBuffer();
      }, 5000);
    }
  }

  /**
   * Force stop a recording, throwing it away entirely.
   */
  forceStop = async () => {
    if (!this._isRecording) return;
    await this.stopOBS();
    this._isRecording = false;
    this._isRecordingBuffer = false;

    // Refresh the GUI
    this.mainWindow.webContents.send('refreshState');
    this.mainWindow.webContents.send(
      'updateRecStatus',
      RecStatus.WaitingForWoW
    );

    // Restart the buffer recording ready for next game.
    setTimeout(async () => {
      this.startBuffer();
    }, 5000);
  };

  /**
   * Clean-up the buffer directory.
   * @params Number of files to leave.
   */
  cleanupBuffer = async (filesToLeave: number) => {
    if (!this.bufferStorageDir) {
      console.info('[Recorder] Not attempting to clean-up');
      return;
    }

    // Sort newest to oldest
    const videosToDelete = await getSortedVideos(this.bufferStorageDir);
    if (!videosToDelete || videosToDelete.length === 0) return;

    videosToDelete.slice(filesToLeave).forEach((v) => deleteVideo(v.name));
  };

  private createRecordingDirs() {
    if (!this.bufferStorageDir) {
      throw new Error('[Recorder] bufferStorageDir not set');
    }

    if (!fs.existsSync(this.bufferStorageDir)) {
      console.info('[Recorder] Creating dir:', this.bufferStorageDir);
      fs.mkdirSync(this.bufferStorageDir);
    } else {
      console.info('[Recorder] Clean out buffer');
      this.cleanupBuffer(0);
    }
  }

  initializeOBS() {
    console.info('[Recorder] Initializing OBS', this.uuid);

    try {
      osn.NodeObs.IPC.host(this.uuid);

      osn.NodeObs.SetWorkingDirectory(
        fixPathWhenPackaged(
          path.join(__dirname, '../../', 'node_modules', 'obs-studio-node')
        )
      );

      const initResult = osn.NodeObs.OBS_API_initAPI(
        'en-US',
        fixPathWhenPackaged(path.join(path.normalize(__dirname), 'osn-data')),
        '1.0.0',
        ''
      );

      if (initResult !== 0) {
        throw new Error(
          `OBS process initialization failed with code ${initResult}`
        );
      }
    } catch (e) {
      throw new Error(`Exception when initializing OBS process: ${e}`);
    }

    this.obsInitialized = true;
    console.info('[Recorder] OBS initialized successfully');
  }

  private configureOBS() {
    console.info('[Recorder] Configuring OBS');

    const resolution = this.cfg.get<string>(
      'obsOutputResolution'
    ) as keyof typeof obsResolutions;

    const { height, width } = obsResolutions[resolution];
    const fps = this.cfg.get<number>('obsFPS');

    osn.VideoFactory.videoContext = {
      fpsNum: fps,
      fpsDen: 1,
      baseWidth: width,
      baseHeight: height,
      outputWidth: width,
      outputHeight: height,
      outputFormat: 2,
      colorspace: 2,
      range: 2,
      scaleType: 3,
      fpsType: 2,
    };

    const recFactory = osn.AdvancedRecordingFactory.create();
    const bufferPath = this.cfg.getPath('bufferStoragePath');
    recFactory.path = path.normalize(bufferPath);

    recFactory.format = ERecordingFormat.MP4;
    recFactory.useStreamEncoders = false;

    recFactory.videoEncoder = osn.VideoEncoderFactory.create(
      this.cfg.get<string>('obsRecEncoder'),
      'video-encoder'
    );

    recFactory.videoEncoder.update({
      rate_control: 'VBR',
      bitrate: 1000 * this.cfg.get<number>('obsKBitRate'),
    });

    recFactory.overwrite = false;
    recFactory.noSpace = false;

    recFactory.signalHandler = (signal) => {
      Recorder.waitQueue.push(signal);
    };

    return recFactory;
  }

  private configureVideoOBS() {
    console.info('[Recorder] Configuring OBS video');

    let videoSource: IInput;
    const captureMode = this.cfg.get<string>('obsCaptureMode');

    switch (captureMode) {
      case 'monitor_capture':
        videoSource = this.createMonitorCaptureSource();
        break;

      case 'game_capture':
        videoSource = this.createGameCaptureSource();
        break;

      default:
        throw new Error('[Recorder] Unexpected default case hit');
    }

    const scene: IScene = osn.SceneFactory.create('WR Scene');
    scene.add(videoSource);
    osn.Global.setOutputSource(this.videoChannel, scene);
  }

  private createMonitorCaptureSource() {
    console.info('[Recorder] Configuring OBS for Monitor Capture');

    const monitorCaptureSource = osn.InputFactory.create(
      'monitor_capture',
      'WR Monitor Capture'
    );

    const { settings } = monitorCaptureSource;
    settings.monitor = this.cfg.get<number>('monitorIndex') - 1;

    monitorCaptureSource.update(settings);
    monitorCaptureSource.save();

    return monitorCaptureSource;
  }

  private createGameCaptureSource() {
    console.info('[Recorder] Configuring OBS for Game Capture');

    const gameCaptureSource = osn.InputFactory.create(
      'game_capture',
      'WR Game Capture'
    );

    const { settings } = gameCaptureSource;
    settings.capture_cursor = true;
    settings.capture_mode = 'window';
    settings.allow_transparency = true;
    settings.priority = 1;
    settings.window = 'World of Warcraft:GxWindowClass:Wow.exe';

    gameCaptureSource.update(settings);
    gameCaptureSource.save();

    return gameCaptureSource;
  }

  public addAudioSourcesOBS() {
    console.info('[Recorder] Configuring OBS audio');

    const track1 = osn.AudioTrackFactory.create(160, 'track1');
    osn.AudioTrackFactory.setAtIndex(track1, 1);

    this.audioInputDevice = this.createOBSAudioSource(
      this.cfg.get<string>('audioInputDevice'),
      TAudioSourceType.input
    );

    this.audioOutputDevice = this.createOBSAudioSource(
      this.cfg.get<string>('audioOutputDevice'),
      TAudioSourceType.output
    );

    this.addAudioSourceOBS(this.audioInputDevice, this.audioInputChannel);
    this.addAudioSourceOBS(this.audioOutputDevice, this.audioOutputChannel);
  }

  public removeAudioSourcesOBS() {
    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    if (this.audioInputDevice) {
      this.removeAudioSourceOBS(this.audioInputDevice, this.audioInputChannel);
    }

    if (this.audioOutputDevice) {
      this.removeAudioSourceOBS(this.audioOutputDevice, this.audioOutputChannel);
    }
  }

  private addAudioSourceOBS(obsInput: IInput, channel: number) {
    console.info(
      '[Recorder] Adding OBS audio source',
      obsInput.name,
      obsInput.id
    );

    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    if (channel <= 1 || channel >= 64) {
      throw new Error(`[Recorder] Invalid channel number ${channel}`);
    }

    osn.Global.setOutputSource(channel, obsInput);
  }

  private removeAudioSourceOBS(obsInput: IInput, channel: number) {
    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    console.info(
      '[Recorder] Removing OBS audio source',
      obsInput.name,
      obsInput.id
    );

    osn.Global.setOutputSource(channel, null as unknown as ISource);
    obsInput.release();
    obsInput.remove();
  }

  async shutdownOBS() {
    console.info('[Recorder] OBS shutting down', this.uuid);

    if (!this.obsInitialized) {
      console.info('[Recorder] OBS not initialized so not attempting shutdown');
    }

    try {
      osn.NodeObs.InitShutdownSequence();
      osn.NodeObs.RemoveSourceCallback();
      osn.NodeObs.OBS_service_removeCallback();
      osn.NodeObs.IPC.disconnect();
    } catch (e) {
      throw new Error(`Exception shutting down OBS process: ${e}`);
    }

    this.obsInitialized = false;
    this.obsConfigured = false;
    console.info('[Recorder] OBS shut down successfully');
  }

  private async startOBS() {
    if (!this.obsRecordingFactory) {
      throw new Error('[Recorder] StartOBS called but no recording factory');
    }

    this.obsRecordingFactory.start();
    await this.assertNextOBSSignal('start');
  }

  private async stopOBS() {
    if (!this.obsRecordingFactory) {
      throw new Error('[Recorder] stopOBS called but no recording factory');
    }

    this.obsRecordingFactory.stop();
    await this.assertNextOBSSignal('stopping');
    await this.assertNextOBSSignal('stop');
    await this.assertNextOBSSignal('wrote');
  }

  private assertNextOBSSignal = async (value: string) => {
    // Don't wait more than 5 seconds for the signal.
    const signalInfo = (await Promise.race([
      Recorder.waitQueue.shift(),
      new Promise((_resolve, reject) => {
        setTimeout(reject, 5000, `OBS didn't signal ${value} in time`);
      }),
    ])) as osn.EOutputSignal;

    if (signalInfo.type !== 'recording') {
      console.error(
        '[Recorder] OBS signal type unexpected, got:',
        signalInfo.signal,
        'but expected:',
        value
      );

      throw new Error('OBS behaved unexpectedly (2)');
    }

    if (signalInfo.signal !== value) {
      console.error(
        '[Recorder] OBS signal value unexpected, got:',
        signalInfo.signal,
        'but expected:',
        value
      );

      throw new Error('OBS behaved unexpectedly (3)');
    }

    console.debug('[Recorder] Asserted OBS signal:', value);
  };

  getInputAudioDevices() {
    console.info('[Recorder] Getting available input devices');

    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    const inputDevices =
      osn.NodeObs.OBS_settings_getInputAudioDevices() as IOBSDevice[];

    return inputDevices.filter((v) => v.id !== 'default');
  }

  getOutputAudioDevices() {
    console.info('[Recorder] Getting available output devices');

    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    const outputDevices =
      osn.NodeObs.OBS_settings_getOutputAudioDevices() as IOBSDevice[];

    return outputDevices.filter((v) => v.id !== 'default');
  }

  private createOBSAudioSource(id: string, type: TAudioSourceType) {
    console.info('[Recorder] Creating OBS audio source', id, type);

    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    return osn.InputFactory.create(
      type,
      type === TAudioSourceType.input ? 'mic-audio' : 'desktop-audio',
      { device_id: id }
    );
  }

  getAvailableEncoders() {
    console.info('[Recorder] Getting available encoders');

    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    const encoders = osn.VideoEncoderFactory.types();
    console.info('[Recorder]', encoders);

    return encoders;
  }
}
