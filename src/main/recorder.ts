import { BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import * as osn from 'obs-studio-node';
import { IScene, ISettings } from 'obs-studio-node';
import WaitQueue from 'wait-queue';
import { ERecordingFormat } from './obsEnums';
import { deleteVideo, addColor, getSortedVideos } from './util';
import { RecStatus } from './types';
import { VideoCategory } from '../types/VideoCategory';
import Activity from '../activitys/Activity';
import VideoProcessQueue from './VideoProcessQueue';

const { v4: uuidfn } = require('uuid');

type RecorderOptionsType = {
  storageDir: string;
  bufferStorageDir: string;
  maxStorage: number;
  monitorIndex: number;
  audioInputDeviceId: string;
  audioOutputDeviceId: string;
  minEncounterDuration: number;
  obsBaseResolution: string;
  obsOutputResolution: string;
  obsFPS: number;
  obsKBitRate: number;
  obsCaptureMode: string;
  obsRecEncoder: string;
};

class Recorder {
  private _isRecording: boolean = false;

  private _isRecordingBuffer: boolean = false;

  private _bufferRestartIntervalID?: any;

  private _bufferStartTimeoutID?: any;

  private _options: RecorderOptionsType;

  private _recorderStartDate = new Date();

  private _mainWindow: BrowserWindow;

  private obsFactory: osn.IAdvancedRecording | undefined;

  private waitQueue = new WaitQueue<any>();

  private videoProcessQueue;

  private obsInitialized = false;

  constructor(mainWindow: BrowserWindow, options: RecorderOptionsType) {
    console.info('[Recorder] Constructing recorder with: ', options);
    this._mainWindow = mainWindow;
    this.videoProcessQueue = new VideoProcessQueue(mainWindow);
    this._options = options;
    this.createRecordingDirs();
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
   * to the temp buffer location. Called on start-up of application when
   * WoW is open.
   */
  startBuffer = async () => {
    // Guard against multiple buffer timers.
    if (this.isRecordingBuffer) {
      console.error('[Recorder] Already recording a buffer');
      return;
    }

    if (!this.obsInitialized) {
      console.error('[Recorder] Need to initialize OBS before starting buffer');
      this.initializeOBS();
    }

    console.log(addColor('[Recorder] Start recording buffer', 'cyan'));
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
      console.log(addColor('[Recorder] Stop recording buffer', 'cyan'));
      this._isRecordingBuffer = false;
      await this.stopOBS();
    } else {
      console.error('[Recorder] No buffer recording to stop.');
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
    console.log(addColor('[Recorder] Restart recording buffer', 'cyan'));
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
      console.log(
        addColor('[Recorder] Buffer restart interval cleared', 'green')
      );
      clearInterval(this._bufferRestartIntervalID);
    }

    if (cancelStartTimeout && this._bufferStartTimeoutID) {
      console.log(addColor('[Recorder] Buffer start timeout cleared', 'green'));
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
    console.log(
      addColor(
        '[Recorder] Start recording by cancelling buffer restart',
        'green'
      )
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
    console.log(addColor('[Recorder] Stop recording after overrun', 'green'));
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
        console.error('[Recorder] Null or undefined duration');
        return;
      }

      const isLongEnough =
        duration - activity.overrun >= this._options.minEncounterDuration;

      if (isRaid && !isLongEnough) {
        console.info('[Recorder] Raid encounter was too short, discarding');
      } else {
        const bufferFile = this.obsFactory.lastFile();
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
    const videosToDelete = await getSortedVideos(
      this._options.bufferStorageDir
    );
    if (!videosToDelete || videosToDelete.length === 0) return;

    videosToDelete.slice(filesToLeave).forEach((v) => deleteVideo(v.name));
  };

  private createRecordingDirs() {
    if (!fs.existsSync(this._options.bufferStorageDir)) {
      console.info('[Recorder] Creating dir:', this._options.bufferStorageDir);
      fs.mkdirSync(this._options.bufferStorageDir);
    } else {
      console.info('[Recorder] Clean out buffer');
      this.cleanupBuffer(0);
    }
  }

  private initializeOBS() {
    console.info('[Recorder] Initializing OBS');

    try {
      osn.NodeObs.IPC.host(uuidfn());

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

    osn.VideoFactory.videoContext = {
      fpsNum: 60,
      fpsDen: 1,
      baseWidth: 1920,
      baseHeight: 1080,
      outputWidth: 1920,
      outputHeight: 1080,
      outputFormat: 2,
      colorspace: 2,
      range: 2,
      scaleType: 3,
      fpsType: 2,
    };

    this.obsFactory = osn.AdvancedRecordingFactory.create();
    this.obsFactory.path = path.join(
      path.normalize('D:/wow-recorder-files/.temp')
    );

    this.obsFactory.format = ERecordingFormat.MP4;
    this.obsFactory.useStreamEncoders = false;

    this.obsFactory.videoEncoder = osn.VideoEncoderFactory.create(
      'obs_x264',
      'video-encoder'
    );

    this.obsFactory.overwrite = false;
    this.obsFactory.noSpace = false;
    const track1 = osn.AudioTrackFactory.create(160, 'track1');
    osn.AudioTrackFactory.setAtIndex(track1, 1);

    this.obsFactory.signalHandler = (signal) => {
      this.waitQueue.push(signal);
    };

    this.obsFactory.outputWidth = 1920;
    this.obsFactory.outputHeight = 1080;

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

    console.info(
      `[Recorder] VideoSource is ${videoSource.width}x${videoSource.height}`
    );

    this.obsInitialized = true;
    console.info('OBS initialized successfully');
  }

  async shutdownOBS() {
    console.info('[Recorder] OBS shutting down');

    try {
      osn.NodeObs.InitShutdownSequence();
      osn.NodeObs.RemoveSourceCallback();
      osn.NodeObs.OBS_service_removeCallback();
      osn.NodeObs.IPC.disconnect();
    } catch (e) {
      throw new Error(`Exception when shutting down OBS process: ${e}`);
    }

    this.obsInitialized = false;
    console.info('[Recorder] OBS shut down successfully');
  }

  private async startOBS() {
    this.obsFactory.start();
    await this.assertNextOBSSignal('start');
  }

  private async stopOBS() {
    this.obsFactory.stop();
    await this.assertNextOBSSignal('stopping');
    await this.assertNextOBSSignal('stop');
    await this.assertNextOBSSignal('wrote');
  }

  private assertNextOBSSignal = async (value: string) => {
    // Don't wait more than 5 seconds for the signal.
    const signalInfo = await Promise.race([
      this.waitQueue.shift(),
      new Promise((_resolve, reject) => {
        setTimeout(reject, 5000, `OBS didn't signal ${value} in time`);
      }),
    ]);

    // Assert the type is as expected.
    if (signalInfo.type !== 'recording') {
      console.error(`[OBS] ${signalInfo}`);
      console.error(
        '[OBS] OBS signal type unexpected',
        signalInfo.signal,
        value
      );
      throw new Error('OBS behaved unexpectedly (2)');
    }

    // Assert the signal value is as expected.
    if (signalInfo.signal !== value) {
      console.error(`[OBS] ${signalInfo}`);
      console.error(
        '[OBS] OBS signal value unexpected',
        signalInfo.signal,
        value
      );
      throw new Error('OBS behaved unexpectedly (3)');
    }

    console.debug('[OBS] Asserted OBS signal:', value);
  };
}

export { Recorder, RecorderOptionsType };
