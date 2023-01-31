import { BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import * as osn from 'obs-studio-node';
import { IInput, IScene, ISceneItem, ISource } from 'obs-studio-node';
import WaitQueue from 'wait-queue';
import {
  EOBSOutputSignal,
  ERecordingFormat,
  ERecordingState,
} from './obsEnums';

import {
  deferredPromiseHelper,
  deleteVideo,
  fixPathWhenPackaged,
  getSortedVideos,
} from './util';

import { IOBSDevice, Metadata, RecStatus, TAudioSourceType } from './types';
import Activity from '../activitys/Activity';
import VideoProcessQueue from './VideoProcessQueue';
import ConfigService from './ConfigService';
import { obsResolutions } from './constants';

const { v4: uuidfn } = require('uuid');

/**
 * Class for handing the interface between Warcraft Recorder and OBS.
 *
 * This works by constantly recording a "buffer" whenever WoW is open. If an
 * interesting event is spotted in the combatlog (e.g. an ENCOUNTER_START
 * event), the buffer becomes a real recording.
 *
 * This ensures we catch the start of activities, the fundamental problem
 * here being that the combatlog doesn't write in real time, and we might
 * actually see the ENCOUNTER_START event 20 seconds after it occured in
 * game.
 */
export default class Recorder {
  /**
   * For quickly checking if we're recording an activity or not. This is
   * not the same as the OBS state.
   */
  private _isRecording: boolean = false;

  /**
   * If we are currently overruning or not. Overrun is defined as the
   * final seconds where an activity has ended, but we're deliberatly
   * continuing the recording to catch the score screen, kill moments,
   * etc.
   */
  private isOverruning = false;

  /**
   * Promise we can await on to take actions after the overrun has completed.
   * This is undefined if isOverruning is false.
   */
  private overrunPromise: Promise<void> | undefined;

  /**
   * Timer object to trigger a restart of the buffer. We do this on a 5
   * minute interval so we aren't building up massive files.
   */
  private _bufferRestartIntervalID?: NodeJS.Timer;

  /**
   * Date the recording started.
   */
  private _recorderStartDate = new Date();

  /**
   * Reference back to the mainWindow object for updating the app status icon.
   */
  private mainWindow: BrowserWindow;

  /**
   * Shiny new OSN API object for controlling OBS.
   */
  private obsRecordingFactory: osn.IAdvancedRecording | undefined;

  /**
   * ConfigService instance.
   */
  private cfg: ConfigService = ConfigService.getInstance();

  /**
   * Location to write all recording to. This is not the final location of
   * the finalized video files.
   */
  private bufferStorageDir: string | undefined;

  /**
   * Once we have completed a recording, we throw it onto the
   * VideoProcessQueue to handle cutting it to size, writing accompanying
   * metadata and saving it to the final location for display in the GUI.
   */
  private videoProcessQueue: VideoProcessQueue;

  /**
   * On creation of the recorder we generate a UUID to identify the OBS
   * server. On a change of settings, we destroy the recorder object and
   * create a new one, with a different UUID.
   */
  private uuid: string = uuidfn();

  /**
   * OBS IScene object.
   */
  private scene: IScene | undefined;

  /**
   * ISceneItem object, useful to have handy for rescaling.
   */
  private sceneItem: ISceneItem | undefined;

  /**
   * Object representing the video source.
   */
  private videoSource: IInput | undefined;

  /**
   * Resolution selected by the user in settings. Defaults to 1920x1080 for
   * no good reason other than avoiding undefined. It quickly gets set to
   * what the user configured.
   */
  private resolution: keyof typeof obsResolutions = '1920x1080';

  /**
   * Scale factor for resizing the video source if a user is running
   * windowed mode and decides to resize their game. We can handle
   * this cleanly, even mid-recording.
   */
  private videoScaleFactor: number = 1;

  /**
   * Timer object for checking the size of the game window and rescaling if
   * required.
   */
  private videoSourceSizeInterval?: NodeJS.Timer;

  /**
   * Arbritrarily chosen channel numbers for video input. We only ever
   * include one video source.
   */
  private videoChannel = 1;

  /**
   * Some arbritrarily chosen channel numbers we can use for adding input
   * devices to the OBS scene. That is, adding microphone audio to the
   * recordings.
   */
  private audioInputChannels = [2, 3, 4];

  /**
   * Array of input devices we are including in the source. This is not an
   * array of all the devices we know about.
   */
  private audioInputDevices: IInput[] = [];

  /**
   * Some arbritrarily chosen channel numbers we can use for adding output
   * devices to the OBS scene. That is, adding speaker audio to the
   * recordings.
   */
  private audioOutputChannels = [5, 6, 7, 8, 9];

  /**
   * Array of output devices we are including in the source. This is not an
   * array of all the devices we know about.
   */
  private audioOutputDevices: IInput[] = [];

  /**
   * WaitQueue object for storing signalling from OBS. We only care about
   * start signals here which indicate the recording has started.
   */
  private startQueue = new WaitQueue<osn.EOutputSignal>();

  /**
   * WaitQueue object for storing signalling from OBS. We only care about
   * wrote signals here which indicate the video file has been written.
   */
  private wroteQueue = new WaitQueue<osn.EOutputSignal>();

  /**
   * The state of OBS according to its signalling.
   */
  public obsState: ERecordingState = ERecordingState.Offline;

  /**
   * For easy checking if OBS has been initialized.
   */
  public obsInitialized = false;

  /**
   * For easy checking if OBS has been configured.
   */
  public obsConfigured = false;

  constructor(mainWindow: BrowserWindow) {
    console.info('[Recorder] Constructing recorder:', this.uuid);
    this.mainWindow = mainWindow;
    this.videoProcessQueue = new VideoProcessQueue(mainWindow);
    this.initializeOBS();
  }

  async reconfigure(mainWindow: BrowserWindow) {
    console.info('[Recorder] Reconfigure recorder');

    // Stop and shutdown the old instance.
    await this.stopBuffer();
    this.removeAudioSourcesOBS();
    this.shutdownOBS();

    // Create a new uuid and re-initialize OBS.
    this.uuid = uuidfn();
    this.mainWindow = mainWindow;
    this.videoProcessQueue = new VideoProcessQueue(mainWindow);
    this.initializeOBS();
  }

  get isRecording() {
    return this._isRecording;
  }

  set isRecording(value) {
    this._isRecording = value;
  }

  /**
   * Configure OBS. This is split out of the constructor so that we can always
   * initialize OBS upfront (without requiring any configuration from the
   * user). That lets us populate all the options in settings that we depend
   * on OBS to inform us of (encoders, audio devices). This doesn't attach
   * audio devices, that's done seperately.
   */
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
    this.obsConfigured = true;
  }

  /**
   * Create the bufferStorageDir if it doesn't already exist. Also
   * cleans it out for good measure.
   */
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

  /**
   * Call through OSN to initialize OBS. This is slow and synchronous,
   * so use sparingly - it will block the main thread.
   */
  private initializeOBS() {
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

  /**
   * Configures OBS. This does a bunch of things that we need the
   * user to have setup their config for, which is why it's split out.
   */
  private configureOBS() {
    console.info('[Recorder] Configuring OBS');

    this.resolution = this.cfg.get<string>(
      'obsOutputResolution'
    ) as keyof typeof obsResolutions;

    const { height, width } = obsResolutions[this.resolution];
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
      this.handleSignal(signal);
    };

    return recFactory;
  }

  private handleSignal(obsSignal: osn.EOutputSignal) {
    console.info('[Recorder] Got signal:', obsSignal);

    if (obsSignal.type !== 'recording') {
      console.info('[Recorder] No action needed on this signal');
      return;
    }

    if (obsSignal.code !== 0) {
      console.error('[Recorder] OBS returned an error signal:', obsSignal);

      throw new Error(
        `[Recorder] OBS returned an error signal${obsSignal.error}`
      );
    }

    switch (obsSignal.signal) {
      case EOBSOutputSignal.Start:
        this.startQueue.push(obsSignal);
        this.obsState = ERecordingState.Recording;
        this.updateStatusIcon(RecStatus.ReadyToRecord);
        break;

      case EOBSOutputSignal.Starting:
        this.obsState = ERecordingState.Starting;
        this.updateStatusIcon(RecStatus.ReadyToRecord);
        break;

      case EOBSOutputSignal.Stop:
        this.obsState = ERecordingState.Offline;
        this.updateStatusIcon(RecStatus.WaitingForWoW);
        break;

      case EOBSOutputSignal.Stopping:
        this.obsState = ERecordingState.Stopping;
        this.updateStatusIcon(RecStatus.WaitingForWoW);
        break;

      case EOBSOutputSignal.Wrote:
        this.wroteQueue.push(obsSignal);
        break;

      default:
        console.info('[Recorder] No action needed on this signal');
        break;
    }

    console.info('[Recorder] State is now: ', this.obsState);
  }

  /**
   * Configures the video source in OBS. Also creates the scene.
   */
  private configureVideoOBS() {
    console.info('[Recorder] Configuring OBS video');

    const captureMode = this.cfg.get<string>('obsCaptureMode');

    switch (captureMode) {
      case 'monitor_capture':
        this.videoSource = this.createMonitorCaptureSource();
        break;

      case 'game_capture':
        this.videoSource = this.createGameCaptureSource();
        break;

      default:
        throw new Error('[Recorder] Unexpected default case hit');
    }

    this.scene = osn.SceneFactory.create('WR Scene');
    this.sceneItem = this.scene.add(this.videoSource);
    osn.Global.setOutputSource(this.videoChannel, this.scene);

    if (captureMode === 'game_capture') {
      this.watchVideoSourceSize();
    }
  }

  /**
   * Creates a monitor capture source.
   */
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

  /**
   * Creates a game capture source.
   */
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

  /**
   * Add the configured audio sources ot the OBS scene. This is public
   * so it can be called externally when WoW is opened - see the Poller
   * class.
   */
  public addAudioSourcesOBS() {
    console.info('[Recorder] Configuring OBS audio sources');

    const track1 = osn.AudioTrackFactory.create(160, 'track1');
    osn.AudioTrackFactory.setAtIndex(track1, 1);

    this.cfg
      .get<string>('audioInputDevices')
      .split(',')
      .filter((id) => id)
      .forEach((id) => {
        console.info('[Recorder] Adding input source', id);
        const obsSource = this.createOBSAudioSource(id, TAudioSourceType.input);
        this.audioInputDevices.push(obsSource);
      });

    if (this.audioInputDevices.length > this.audioInputChannels.length) {
      throw new Error('[Recorder] Too many audio input devices');
    }

    this.audioInputDevices.forEach((device) => {
      const index = this.audioInputDevices.indexOf(device);
      const channel = this.audioInputChannels[index];
      this.addAudioSourceOBS(device, channel);
    });

    this.cfg
      .get<string>('audioOutputDevices')
      .split(',')
      .filter((id) => id)
      .forEach((id) => {
        console.info('[Recorder] Adding output source', id);

        const obsSource = this.createOBSAudioSource(
          id,
          TAudioSourceType.output
        );

        this.audioOutputDevices.push(obsSource);
      });

    if (this.audioOutputDevices.length > this.audioOutputChannels.length) {
      throw new Error('[Recorder] Too many audio output devices');
    }

    this.audioOutputDevices.forEach((device) => {
      const index = this.audioOutputDevices.indexOf(device);
      const channel = this.audioOutputChannels[index];
      this.addAudioSourceOBS(device, channel);
    });
  }

  /**
   * Remove all audio sources from the OBS scene. This is public
   * so it can be called externally when WoW is closed.
   */
  public removeAudioSourcesOBS() {
    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    this.audioInputDevices.forEach((device) => {
      const index = this.audioInputDevices.indexOf(device);
      const channel = this.audioInputChannels[index];
      this.removeAudioSourceOBS(device, channel);
      this.audioInputDevices.splice(index, 1);
    });

    this.audioOutputDevices.forEach((device) => {
      const index = this.audioOutputDevices.indexOf(device);
      const channel = this.audioOutputChannels[index];
      this.removeAudioSourceOBS(device, channel);
      this.audioOutputDevices.splice(index, 1);
    });
  }

  /**
   * Add a single audio source to the OBS scene.
   */
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

  /**
   * Remove a single audio source to the OBS scene.
   */
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

  shutdownOBS() {
    console.info('[Recorder] OBS shutting down', this.uuid);

    if (!this.obsInitialized) {
      console.info('[Recorder] OBS not initialized so not attempting shutdown');
    }

    if (this.videoSourceSizeInterval) {
      clearInterval(this.videoSourceSizeInterval);
    }

    if (this.videoSource) {
      osn.Global.setOutputSource(1, null as unknown as ISource);
      this.videoSource.release();
      this.videoSource.remove();
    }

    this.wroteQueue.empty();
    this.wroteQueue.clearListeners();
    this.startQueue.empty();
    this.startQueue.clearListeners();

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

    await this.startOBS();
    this._recorderStartDate = new Date();

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
    console.info('[Recorder] Stop recording buffer');
    this.cancelBufferTimers();
    await this.stopOBS();
    this.cleanupBuffer(1);
  };

  /**
   * Restarts the buffer recording. Cleans the temp dir between stop/start.
   * We wait 5s here between the stop start. I don't know why, but if we
   * don't then OBS becomes unresponsive.
   *
   * I spent a lot of time on this, trying all sorts of other solutions
   * don't fuck with it unless you have to; here be dragons.
   */
  restartBuffer = async () => {
    console.log('[Recorder] Restart recording buffer');
    await this.stopOBS();
    await this.startOBS();
    this._recorderStartDate = new Date();
    this.cleanupBuffer(1);
  };

  /**
   * Cancel buffer timers. This can include any combination of:
   *  - _bufferRestartIntervalID: the interval on which we periodically restart the buffer
   */
  cancelBufferTimers = () => {
    if (this._bufferRestartIntervalID) {
      console.info('[Recorder] Buffer restart interval cleared');
      clearInterval(this._bufferRestartIntervalID);
    }
  };

  /**
   * Start recording for real, this basically just cancels pending
   * buffer recording restarts. We don't need to actually start OBS
   * recording as it's should already be running (or just about to
   * start if we hit this in the restart window).
   */
  async start() {
    console.info('[Recorder] Start called');

    if (this.isOverruning) {
      console.info('[Recorder] Overrunning from last game');
      await this.overrunPromise;
      console.info('[Recorder] Finished with last game overrun');
    }

    const ready =
      !this.isRecording && this.obsState === ERecordingState.Recording;

    if (!ready) {
      console.warn(
        '[LogHandler] Not ready to record an activity, no-op',
        this.isRecording,
        this.obsState
      );

      return;
    }

    console.info('[Recorder] Start recording by cancelling buffer restart');
    this.updateStatusIcon(RecStatus.Recording);
    this.cancelBufferTimers();
    this._isRecording = true;
  }

  /**
   * Stop recording, no-op if not already recording.
   *
   * @param {Activity} activity the details of the recording
   * @param {boolean} closedWow if wow has just been closed
   */
  async stop(activity: Activity, closedWow = false) {
    console.info('[Recorder] Stop called');

    if (!this._isRecording) {
      console.warn('[Recorder] Stop recording called but not recording');
      return;
    }

    if (!this.obsRecordingFactory) {
      console.warn('[Recorder] Stop called but no recording factory');
      return;
    }

    // Set-up some state in preparating for awaiting out the overrun. This is
    // all to allow us to asynchronous delay an incoming start() call until we
    // are finished with the previous recording.
    const { overrun } = activity;
    console.info(`[Recorder] Stop recording after overrun: ${overrun}s`);
    const { promise, resolveHelper } = deferredPromiseHelper<void>();
    this.overrunPromise = promise;
    this.isOverruning = true;

    // Await for the specified overrun.
    await new Promise((resolve, _reject) =>
      setTimeout(resolve, 1000 * overrun)
    );

    // The ordering is crucial here, we don't want to call stopOBS more
    // than once in a row else we will crash the app. See issue 291.
    this._isRecording = false;
    await this.stopOBS();

    // Grab some details now before we start OBS again and they are forgotten.
    const bufferFile = this.obsRecordingFactory.lastFile();
    const relativeStart =
      (activity.startDate.getTime() - this._recorderStartDate.getTime()) / 1000;

    // Restart the buffer, it's important that we do this before we resolve the
    // overrun promise else we'll fail to start the following recording.
    if (!closedWow) {
      console.info('[Recorder] WoW not closed, so starting buffer');
      await this.startBuffer();
    }

    // Finally we can resolve the overrunPromise and allow any pending calls to
    // start() to go ahead by resolving the overrun promise.
    resolveHelper();
    this.isOverruning = false;

    // The remaining logic in this function adds the video to the process
    // queue. This should probably be run async so we can allow a pending
    // recording to start first, but it's a minor benefit so not bothering
    // just now.
    let metadata: Metadata | undefined;

    try {
      metadata = activity.getMetadata();
    } catch (error) {
      // We've failed to get the Metadata from the activity. Throw away the
      // video and log why. Example of when we hit this is on raid resets
      // where we don't have long enough to get a GUID for the player.
      let message;

      if (error instanceof Error) {
        message = error.message;
      } else {
        message = String(error);
      }

      console.warn(
        '[Recorder] Discarding video as failed to get Metadata:',
        message
      );
    }

    if (metadata !== undefined) {
      if (!bufferFile) {
        console.error(
          "[Recorder] Unable to get the last recording from OBS. Can't process video."
        );
        return;
      }

      this.videoProcessQueue.queueVideo(
        bufferFile,
        metadata,
        activity.getFileName(),
        relativeStart
      );
    }
  }

  /**
   * Force stop a recording, throwing it away entirely.
   */
  async forceStop() {
    if (!this._isRecording) return;
    await this.stopOBS();
    this._isRecording = false;

    // Restart the buffer recording ready for next game.
    await this.startBuffer();
  }

  /**
   * Clean-up the buffer directory.
   * @params Number of files to leave.
   */
  async cleanupBuffer(filesToLeave: number) {
    if (!this.bufferStorageDir) {
      console.info('[Recorder] Not attempting to clean-up');
      return;
    }

    // Sort newest to oldest
    const videosToDelete = await getSortedVideos(this.bufferStorageDir);
    if (!videosToDelete || videosToDelete.length === 0) return;

    videosToDelete.slice(filesToLeave).forEach((v) => deleteVideo(v.name));
  }

  /**
   * Tell OBS to start recording, and assert it signals that it has.
   */
  private async startOBS() {
    console.info('[Recorder] Start OBS called');

    if (!this.obsRecordingFactory) {
      console.warn('[Recorder] StartOBS called but no recording factory');
      return;
    }

    if (this.obsState !== ERecordingState.Offline) {
      console.warn(
        `[Recorder] OBS can't start, current state is: ${this.obsState}`
      );
      return;
    }

    this.obsRecordingFactory.start();

    // Wait up to 30 seconds for OBS to signal it has started recording.
    await Promise.race([
      this.startQueue.shift(),
      new Promise((_resolve, reject) =>
        setTimeout(reject, 30000, '[Recorder] OBS timeout waiting for start')
      ),
    ]);

    // Empty the queue for good measure.
    this.startQueue.empty();
  }

  /**
   * Tell OBS to stop recording, and assert it signals that it has.
   */
  private async stopOBS() {
    console.info('[Recorder] Stop OBS called');

    if (!this.obsRecordingFactory) {
      console.warn('[Recorder] stopOBS called but no recording factory');
      return;
    }

    if (this.obsState !== ERecordingState.Recording) {
      console.warn(
        `[Recorder] OBS can't stop, current state is: ${this.obsState}`
      );
      return;
    }

    this.obsRecordingFactory.stop();

    // Wait up to 30 seconds for OBS to signal it has wrote the file,
    // otherwise, throw an exception.
    await Promise.race([
      this.wroteQueue.shift(),
      new Promise((_resolve, reject) =>
        setTimeout(
          reject,
          30000,
          '[Recorder] OBS timeout waiting for video file'
        )
      ),
    ]);

    // Empty the queue for good measure.
    this.wroteQueue.empty();

    console.info('[Recorder] Wrote signal received from signal queue');
  }

  /**
   * Get a list of the audio input devices. Used by the settings to populate
   * the list of devices for user selection.
   */
  public getInputAudioDevices() {
    console.info('[Recorder] Getting available input devices');

    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    const inputDevices =
      osn.NodeObs.OBS_settings_getInputAudioDevices() as IOBSDevice[];

    return inputDevices.filter((v) => v.id !== 'default');
  }

  /**
   * Get a list of the audio output devices. Used by the settings to populate
   * the list of devices for user selection.
   */
  getOutputAudioDevices() {
    console.info('[Recorder] Getting available output devices');

    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    const outputDevices =
      osn.NodeObs.OBS_settings_getOutputAudioDevices() as IOBSDevice[];

    return outputDevices.filter((v) => v.id !== 'default');
  }

  /**
   * Create an OBS audio source.
   */
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

  /**
   * Return an array of all the encoders available to OBS.
   */
  public getAvailableEncoders() {
    console.info('[Recorder] Getting available encoders');

    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    const encoders = osn.VideoEncoderFactory.types();
    console.info('[Recorder]', encoders);

    return encoders;
  }

  /**
   * Set up an interval to run the scaleVideoSourceSize function.
   */
  private watchVideoSourceSize() {
    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    if (this.videoSourceSizeInterval) {
      clearInterval(this.videoSourceSizeInterval);
    }

    this.videoSourceSizeInterval = setInterval(() => {
      this.scaleVideoSourceSize();
    }, 5000);
  }

  /**
   * Watch the video input source for size changes. This only matters for
   * doing game capture on a windowed instance of WoW, such that we'll scale
   * it to the size of the output video if it's resized by the player.
   */
  private scaleVideoSourceSize() {
    if (!this.videoSource) {
      throw new Error('[Recorder] videoSource was undefined');
    }

    if (!this.sceneItem) {
      throw new Error('[Recorder] sceneItem was undefined');
    }

    if (this.videoSource.width === 0) {
      // This happens often, suspect it's before OBS gets a hook into a game capture process.
      return;
    }

    const { width } = obsResolutions[this.resolution];

    const scaleFactor =
      Math.round((width / this.videoSource.width) * 100) / 100;

    if (scaleFactor !== this.videoScaleFactor) {
      console.info(
        '[Recorder] Rescaling OBS video from',
        this.videoScaleFactor,
        'to',
        scaleFactor
      );

      this.videoScaleFactor = scaleFactor;
      this.sceneItem.scale = { x: scaleFactor, y: scaleFactor };
    }
  }

  private updateStatusIcon(status: RecStatus) {
    this.mainWindow.webContents.send('updateRecStatus', status);
  }
}
