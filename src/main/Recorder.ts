import { BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import * as osn from 'obs-studio-node';
import { IInput, IScene, ISettings } from 'obs-studio-node';
import WaitQueue from 'wait-queue';
import { ERecordingFormat } from './obsEnums';
import { deleteVideo, getSortedVideos } from './util';
import {
  EDeviceType,
  IOBSDevice,
  RecStatus,
  IDevice,
  TAudioSourceType,
} from './types';
import { VideoCategory } from '../types/VideoCategory';
import Activity from '../activitys/Activity';
import VideoProcessQueue from './VideoProcessQueue';
import ConfigService from './ConfigService';
import { obsResolutions } from './constants';

const { v4: uuidfn } = require('uuid');

export default class Recorder {
  // if this is not static it all goes wrong idk why
  // saw some really weird behaviour from waitQueue returning events in the wrong order
  private static waitQueue = new WaitQueue<osn.EOutputSignal>();

  private _isRecording: boolean = false;

  private _isRecordingBuffer: boolean = false;

  private _bufferRestartIntervalID?: NodeJS.Timer;

  private _bufferStartTimeoutID?: NodeJS.Timer;

  private _recorderStartDate = new Date();

  private _mainWindow: BrowserWindow;

  private obsRecordingFactory: osn.IAdvancedRecording;

  private videoProcessQueue: VideoProcessQueue;

  private cfg: ConfigService;

  private bufferStorageDir: string;

  private minEncounterDuration: number;

  private uuid: string = uuidfn();

  obsInitialized = false;

  constructor(mainWindow: BrowserWindow) {
    console.info('[Recorder] Constructing recorder:', this.uuid);
    this.cfg = ConfigService.getInstance();
    this.bufferStorageDir = this.cfg.getPath('bufferStoragePath');
    this.minEncounterDuration = this.cfg.get<number>('minEncounterDuration');
    this._mainWindow = mainWindow;
    this.videoProcessQueue = new VideoProcessQueue(mainWindow);
    this.createRecordingDirs();
    this.initializeOBS();
    this.obsRecordingFactory = this.configureOBS();
    this.configureVideoOBS();
    this.configureAudioOBS();
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

  /**
   * Start recorder buffer. This starts OBS and records in 5 min chunks
   * to the buffer location.
   */
  startBuffer = async () => {
    console.info('[Recorder] Start recording buffer', this.uuid);

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
   * Stop recorder buffer. Called when WoW is closed.
   */
  stopBuffer = async () => {
    this.cancelBufferTimers(true, true);

    if (this._isRecordingBuffer) {
      console.info('[Recorder] Stop recording buffer', this.uuid);
      this._isRecordingBuffer = false;
      await this.stopOBS();
    } else {
      console.error('[Recorder] No buffer recording to stop', this.uuid);
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
    console.log('[Recorder] Restart recording buffer', this.uuid);
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
      console.info('[Recorder] Buffer restart interval cleared', this.uuid);
      clearInterval(this._bufferRestartIntervalID);
    }

    if (cancelStartTimeout && this._bufferStartTimeoutID) {
      console.info('[Recorder] Buffer start timeout cleared', this.uuid);
      clearInterval(this._bufferStartTimeoutID);
    }
  };

  /**
   * Start recording for real, this basically just cancels pending
   * buffer recording restarts. We don't need to actually start OBS
   * recording as it's should already be running (or just about to
   * start if we hit this in the 2s restart window).
   */
  start = async () => {
    console.info(
      '[Recorder] Start recording by cancelling buffer restart',
      this.uuid
    );
    this.cancelBufferTimers(true, false);
    this._isRecordingBuffer = false;
    this._isRecording = true;
    this.mainWindow.webContents.send('updateRecStatus', RecStatus.Recording);
  };

  /**
   * Stop recording, no-op if not already recording. Quite a bit happens in
   * this function, so I've included lots of comments. The ordering is also
   * important.
   *
   * @param {Metadata} metadata the details of the recording
   * @param {number} overrun how long to continue recording after stop is called
   * @param {boolean} closedWow if wow has just been closed
   */
  stop = (activity: Activity, closedWow = false) => {
    console.log('[Recorder] Stop recording after overrun', this.uuid);
    console.info('[Recorder] Overrun:', activity.overrun);

    // Wait for a delay specificed by overrun. This lets us
    // capture the boss death animation/score screens.
    setTimeout(async () => {
      // Take the actions to stop the recording.
      if (!this._isRecording) return;
      await this.stopOBS();
      this._isRecording = false;
      this._isRecordingBuffer = false;

      const isRaid = activity.category === VideoCategory.Raids;
      const { duration } = activity;

      if (duration === null || duration === undefined) {
        throw new Error('[Recorder] Null or undefined duration');
      }

      // @@@ This logic would be better in the VideoProcessQueue
      const isLongEnough =
        duration - activity.overrun >= this.minEncounterDuration;

      if (isRaid && !isLongEnough) {
        console.info('[Recorder] Raid encounter was too short, discarding');
      } else {
        const bufferFile = this.obsRecordingFactory.lastFile();
        const metadata = activity.getMetadata();
        const relativeStart =
          (activity.startDate.getTime() - this._recorderStartDate.getTime()) /
          1000;

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
    }, activity.overrun * 1000);
  };

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
    // Sort newest to oldest
    const videosToDelete = await getSortedVideos(this.bufferStorageDir);
    if (!videosToDelete || videosToDelete.length === 0) return;

    videosToDelete.slice(filesToLeave).forEach((v) => deleteVideo(v.name));
  };

  private createRecordingDirs() {
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
        path.join(__dirname, '../../', 'node_modules', 'obs-studio-node')
      );

      const initResult = osn.NodeObs.OBS_API_initAPI(
        'en-US',
        path.join(path.normalize(__dirname), 'osn-data'),
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
    console.info('[Recorder] Configuring OBS', this.uuid);

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
    recFactory.path = path.join(path.normalize(bufferPath));

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
    console.info('[Recorder] Configuring OBS video', this.uuid);

    const settings: ISettings = {
      allow_transparency: true,
      anti_cheat_hook: true,
      auto_capture_rules_path: '',
      auto_fit_to_output: true,
      auto_placeholder_image: '',
      auto_placeholder_message: 'Looking for a game to capture',
      capture_cursor: true,
      capture_mode: 'window',
      capture_overlays: false,
      force_scaling: false,
      hook_rate: 1,
      limit_framerate: false,
      priority: 2,
      rgb10a2_space: 'srgb',
      scale_res: '0x0',
      sli_compatibility: false,
      user_placeholder_image: '',
      user_placeholder_use: false,
      window: 'World of Warcraft:GxWindowClass:Wow.exe',
    };

    const videoSource = osn.InputFactory.create(
      'game_capture',
      'input',
      settings
    );

    const scene: IScene = osn.SceneFactory.create('main');
    scene.add(videoSource);
    osn.Global.setOutputSource(1, scene);
  }

  private configureAudioOBS() {
    console.info('[Recorder] Configuring OBS audio', this.uuid);

    const track1 = osn.AudioTrackFactory.create(160, 'track1');
    osn.AudioTrackFactory.setAtIndex(track1, 1);

    const audioInputDevice = this.createOBSAudioSource(
      this.cfg.get<string>('audioInputDevice'),
      TAudioSourceType.input
    );

    const audioOutputDevice = this.createOBSAudioSource(
      this.cfg.get<string>('audioOutputDevice'),
      TAudioSourceType.output
    );

    this.addOBSAudioSource(audioInputDevice, 2);
    this.addOBSAudioSource(audioOutputDevice, 3);
  }

  async shutdownOBS() {
    console.info('[Recorder] OBS shutting down', this.uuid);

    try {
      osn.NodeObs.InitShutdownSequence();
      osn.NodeObs.RemoveSourceCallback();
      osn.NodeObs.OBS_service_removeCallback();
      osn.NodeObs.IPC.disconnect();
    } catch (e) {
      throw new Error(`Exception shutting down OBS process: ${e}`);
    }

    this.obsInitialized = false;
    console.info('[Recorder] OBS shut down successfully');
  }

  private async startOBS() {
    this.obsRecordingFactory.start();
    await this.assertNextOBSSignal('start');
  }

  private async stopOBS() {
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
      TAudioSourceType.input ? 'mic-audio' : 'desktop-audio',
      { device_id: id }
    );
  }

  private addOBSAudioSource(obsInput: IInput, channel: number) {
    console.info(
      '[Recorder] Adding OBS audio source',
      obsInput.name,
      obsInput.id
    );

    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    if (channel <= 1 || channel >= 6) {
      throw new Error(`[Recorder] Invalid channel number ${channel}`);
    }

    osn.Global.setOutputSource(channel, obsInput);
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