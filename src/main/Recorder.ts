import { BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import WaitQueue from 'wait-queue';

import {
  UiohookKeyboardEvent,
  UiohookMouseEvent,
  uIOhook,
  EventType,
} from 'uiohook-napi';
import { EventEmitter } from 'stream';
import Queue from 'queue-promise';
import {
  EOBSOutputSignal,
  ERecordingState,
  ESupportedEncoders,
  QualityPresets,
} from './obsEnums';

import {
  deferredPromiseHelper,
  fixPathWhenPackaged,
  getAssetPath,
  getSortedVideos,
  isPushToTalkHotkey,
  convertUioHookEvent,
  tryUnlink,
  getPromiseBomb,
  takeOwnershipBufferDir,
  exists,
} from './util';

import {
  AudioSourcePrefix,
  CrashData,
  MicStatus,
  ObsAudioConfig,
  ObsBaseConfig,
  ObsOverlayConfig,
  ObsSourceCallbackInfo,
  ObsVideoConfig,
  ObsVolmeterCallbackInfo,
  TAudioSourceType,
  VideoSourceName,
} from './types';
import ConfigService from '../config/ConfigService';
import { obsResolutions } from './constants';
import { getOverlayConfig } from '../utils/configUtils';
import { v4 as uuidv4 } from 'uuid';

import noobs, { ObsData, SceneItemPosition, Signal, SourceDimensions } from 'noobs';

const devMode = process.env.NODE_ENV === 'development';

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
export default class Recorder extends EventEmitter {
  /**
   * Date the buffer recording started.
   */
  public startDate = new Date();

  /**
   * Reference back to the mainWindow object for updating the app status icon.
   */
  private mainWindow: BrowserWindow;

  /**
   * ConfigService instance.
   */
  private cfg: ConfigService = ConfigService.getInstance();

  /**
   * On creation of the recorder we generate a UUID to identify the OBS
   * server. On a change of settings, we destroy the recorder object and
   * create a new one, with a different UUID.
   */
  private uuid: string = uuidv4();

  /**
   * Timer for latching onto a window for either game capture or
   * window capture. Often this does not appear immediately on
   * the WoW process starting.
   */
  private findWindowInterval?: NodeJS.Timeout;

  /**
   * We wait 5s between each attempt to latch on to game or window
   * capture sources.
   */
  private findWindowIntervalDuration = 5000;

  /**
   * The current number of attempts to find a window to capture.
   */
  private findWindowAttempts = 0;

  /**
   * The maximum number of attempts to find a window to capture.
   */
  private findWindowAttemptLimit = 10;

  /**
   * Resolution selected by the user in settings. Defaults to 1920x1080 for
   * no good reason other than avoiding undefined. It quickly gets set to
   * what the user configured.
   */
  private resolution: keyof typeof obsResolutions = '1920x1080';

  /**
   * Array of input devices we are including in the source. This is not an
   * array of all the devices we know about.
   */
  private audioInputDevices: any[] = [];

  /**
   * Gets toggled if push to talk is enabled and when the hotkey for push to
   * talk is held down.
   */
  private inputDevicesMuted = false;

  /**
   * WaitQueue object for storing signalling from OBS. We only care about
   * start signals here which indicate the recording has started.
   */
  private startQueue = new WaitQueue<any>();

  /**
   * WaitQueue object for storing signalling from OBS. We only care about
   * wrote signals here which indicate the video file has been written.
   */
  private wroteQueue = new WaitQueue<any>();

  /**
   * Volmeters are used to monitor the audio levels of an input source. We
   * keep a list of them here as we need a volmeter per audio source, and
   * it's handy to have a list for cleaning them up.
   */
  private volmeters: Record<string, number> = {};

  /**
   * The state of the recorder, typically used to tell if OBS is recording
   * or not.
   */
  public obsState: ERecordingState = ERecordingState.Offline;

  /**
   * The state of the recorder in regards to input devices, i.e. what are we
   * doing with the mic currently.
   */
  public obsMicState: MicStatus = MicStatus.NONE;

  /**
   * For easy checking if OBS has been initialized.
   */
  public obsInitialized = false;

  /**
   * For easy checking if OBS has been configured.
   */
  public obsConfigured = false;

  /**
   * Action queue, used to ensure we do not make concurrent stop/start
   * requests to OBS. That's complication we can do without.
   */
  private actionQueue = new Queue({
    concurrent: 1,
    interval: 100,
  });

  /**
   * The last file output by OBS.
   */
  public lastFile: string | null = null;

  /**
   * Timer that keeps the mic on briefly after you release the Push To Talk key.
   */
  private pttReleaseDelayTimer?: NodeJS.Timeout;

  private sourceDebounceTimer?: NodeJS.Timeout;

  /**
   * Contructor.
   */
  constructor(mainWindow: BrowserWindow) {
    super();
    console.info('[Recorder] Constructing recorder:', this.uuid);
    this.mainWindow = mainWindow;
    this.initializeOBS();
  }

  /**
   * Publicly accessible method to start recording, handles all the gory internals
   * to make sure we only attempt one recorder action at once, and to handle if OBS
   * misbehaves.
   */
  public async startBuffer() {
    console.info('[Recorder] Queued start');
    const { resolveHelper, rejectHelper, promise } = deferredPromiseHelper();

    this.actionQueue.enqueue(async () => {
      try {
        await this.startObsBuffer();
        resolveHelper(null);
      } catch (error) {
        console.error('[Recorder] Crash on start call', String(error));

        const crashData: CrashData = {
          date: new Date(),
          reason: String(error),
        };

        this.emit('crash', crashData);
        rejectHelper(error);
      }
    });

    await promise;
  }

  /**
   * Publicly accessible method to start recording, handles all the gory internals
   * to make sure we only attempt one recorder action at once, and to handle if OBS
   * misbehaves.
   */
  public async startRecording(offset: number) {
    console.info('[Recorder] Queued start rec');
    const { resolveHelper, rejectHelper, promise } = deferredPromiseHelper();

    this.actionQueue.enqueue(async () => {
      try {
        await this.convertObsBuffer(offset);
        resolveHelper(null);
      } catch (error) {
        console.error('[Recorder] Crash on start call', String(error));

        const crashData: CrashData = {
          date: new Date(),
          reason: String(error),
        };

        this.emit('crash', crashData);
        rejectHelper(error);
      }
    });

    await promise;
  }

  /**
   * Publicly accessible method to stop recording, handles all the gory internals
   * to make sure we only attempt one recorder action at once, and to handle if OBS
   * misbehaves.
   */
  public async stop(force: boolean) {
    console.info('[Recorder] Queued stop', force);
    const { resolveHelper, rejectHelper, promise } = deferredPromiseHelper();

    this.actionQueue.enqueue(async () => {
      try {
        await this.stopObsRecording(force);
        resolveHelper(null);
      } catch (error) {
        console.error('[Recorder] Crash on stop call', String(error));

        const crashData: CrashData = {
          date: new Date(),
          reason: String(error),
        };

        this.emit('crash', crashData);
        rejectHelper(error);
      }
    });

    await promise;
  }

  /**
   * Configures OBS. This does a bunch of things that we need the
   * user to have setup their config for, which is why it's split out.
   */
  public async configureBase(config: ObsBaseConfig) {
    const { obsFPS, obsRecEncoder, obsQuality, obsOutputResolution, obsPath } =
      config;

    if (this.obsState !== ERecordingState.Offline) {
      throw new Error('[Recorder] OBS must be offline to do this');
    }

    this.resolution = obsOutputResolution as keyof typeof obsResolutions;
    const { height, width } = obsResolutions[this.resolution];

    console.info('[Recorder] Reconfigure OBS video context');
    noobs.ResetVideoContext(obsFPS, width, height);

    const outputPath = path.normalize(obsPath);
    await this.cleanup(outputPath);
    await Recorder.createRecordingDirs(outputPath);
    noobs.SetRecordingDir(outputPath);

    const settings = Recorder.getEncoderSettings(obsRecEncoder, obsQuality);
    noobs.SetVideoEncoder(obsRecEncoder, settings);
  }

  private static getEncoderSettings(encoder: string, quality: string) {
    // Specify a 1 sec interval for the I-frames. This allows us to round to
    // the nearest second later when cutting and always land on a keyframe.
    //   - This is part of the strategy to avoid re-encoding the videos while
    //     enabling a reasonable cutting accuracy.
    //   - We won't ever be off by more than 0.5 sec with this approach, which
    //     I think is an acceptable error.
    //   - Obviously this is a trade off in file size, where the default keyframe
    //     interval appears to be around 4s.
    const settings: ObsData = { keyint_sec: 1 };

    switch (encoder) {
      case ESupportedEncoders.OBS_X264:
        // CRF and CPQ are so similar in configuration that we can just treat
        // the CRF configuration the same as CQP configuration.
        settings.rate_control = 'CRF';
        settings.crf = Recorder.getCqpFromQuality(encoder, quality);
        break;

      case ESupportedEncoders.AMD_AMF_H264:
      case ESupportedEncoders.JIM_NVENC:
      case ESupportedEncoders.JIM_AV1_NVENC:
      case ESupportedEncoders.AMD_AMF_AV1:
        // These settings are identical for AMD and NVENC encoders.
        settings.rate_control = 'CQP';
        settings.cqp = Recorder.getCqpFromQuality(encoder, quality);
        break;

      default:
        console.error('[Recorder] Unrecognised encoder type', encoder);
        throw new Error('Unrecognised encoder type');
    }

    return settings;
  }

  /**
   * Configures the video source in OBS.
   */
  public configureVideoSources(config: ObsVideoConfig, isWowRunning: boolean) {
    const {
      obsCaptureMode,
      monitorIndex,
      captureCursor,
      forceSdr,
      videoSourceScale,
      videoSourceXPosition,
      videoSourceYPosition,
    } = config;
    console.log('Called configureVideoSources');

    // Clear any existing video capture sources.
    [
      VideoSourceName.WINDOW, 
      VideoSourceName.GAME, 
      VideoSourceName.MONITOR
    ].forEach(
      (s) => {
        noobs.RemoveSourceFromScene(s);
        noobs.DeleteSource(s);
      },
    );

    if (obsCaptureMode === 'monitor_capture') {
      // We don't care if WoW is running or not for monitor capture.
      this.configureMonitorCaptureSource(monitorIndex, forceSdr);
    }

    if (!isWowRunning) {
      // Don't try to configure game or window capture sources if WoW isn't
      // running. We won't be able to find them.
      console.info("[Recorder] WoW isn't running");
    } else {
      console.info('[Recorder] WoW is running');

      if (obsCaptureMode === 'game_capture') {
        this.configureGameCaptureSource(
          captureCursor,
          forceSdr,
          videoSourceScale,
          videoSourceXPosition,
          videoSourceYPosition,
        );
      } else if (obsCaptureMode === 'window_capture') {
        this.configureWindowCaptureSource(
          captureCursor,
          forceSdr,
          videoSourceScale,
          videoSourceXPosition,
          videoSourceYPosition,
        );
      }
    }

    const overlayCfg = getOverlayConfig(this.cfg);
    this.configureOverlayImageSource(overlayCfg);
  }

  /**
   * Hides the scene preview.
   */
  public hidePreview() {
    noobs.HidePreview();
  }

  /**
   * Configure and add the chat overlay to the scene.
   */
  private async configureOwnOverlay(config: ObsOverlayConfig) {
    console.info('[Recorder] Configure own image as chat overlay');

    const {
      chatOverlayScale,
      chatOverlayXPosition,
      chatOverlayYPosition,
      chatOverlayOwnImagePath,
    } = config;
    noobs.CreateSource(VideoSourceName.OVERLAY, 'image_source');

    const settings = noobs.GetSourceSettings(VideoSourceName.OVERLAY);

    noobs.SetSourceSettings(VideoSourceName.OVERLAY, {
      ...settings,
      file: chatOverlayOwnImagePath,
    });

    noobs.AddSourceToScene(VideoSourceName.OVERLAY);

    noobs.SetSourcePos(VideoSourceName.OVERLAY, {
      x: chatOverlayXPosition,
      y: chatOverlayYPosition,
      scaleX: chatOverlayScale,
      scaleY: chatOverlayScale,
    });
  }

  /**
   * Configure and add the default chat overlay to the scene.
   */
  private configureDefaultOverlay(config: ObsOverlayConfig) {
    console.info('[Recorder] Configure default image as chat overlay');

    const {
      chatOverlayWidth,
      chatOverlayHeight,
      chatOverlayXPosition,
      chatOverlayYPosition,
      chatOverlayScale,
    } = config;

    noobs.CreateSource(VideoSourceName.OVERLAY, 'image_source');

    const settings = noobs.GetSourceSettings(VideoSourceName.OVERLAY);

    noobs.SetSourceSettings(VideoSourceName.OVERLAY, {
      ...settings,
      file: getAssetPath('poster', 'image.png'),
    });

    noobs.AddSourceToScene(VideoSourceName.OVERLAY);

    noobs.SetSourcePos(VideoSourceName.OVERLAY, {
      x: chatOverlayXPosition,
      y: chatOverlayYPosition,
      scaleX: chatOverlayScale,
      scaleY: chatOverlayScale,
    });
  }

  /**
   * Add the configured audio sources to the OBS scene. This is public
   * so it can be called externally when WoW is opened.
   */
  public configureAudioSources(config: ObsAudioConfig) {
    this.removeAudioSources();
    uIOhook.removeAllListeners();

    noobs.CreateSource(AudioSourcePrefix.MIC, 'wasapi_input_capture');
    noobs.CreateSource(AudioSourcePrefix.SPEAKER, 'wasapi_output_capture');

    noobs.AddSourceToScene(AudioSourcePrefix.MIC);
    noobs.AddSourceToScene(AudioSourcePrefix.SPEAKER);

    // Just for muted state for now. TODO: Remove this?
    this.audioInputDevices = ['default'];

    if (this.audioInputDevices.length !== 0 && config.pushToTalk) {
      this.obsMicState = MicStatus.MUTED;
      this.emit('state-change');
    } else if (this.audioInputDevices.length !== 0) {
      this.obsMicState = MicStatus.LISTENING;
      this.emit('state-change');
    }

    if (config.pushToTalk) {
      this.inputDevicesMuted = true;

      uIOhook.on('keydown', (e: UiohookKeyboardEvent) =>
        this.pushToTalkHandler(e, config),
      );

      uIOhook.on('mousedown', (e: UiohookMouseEvent) =>
        this.pushToTalkHandler(e, config),
      );

      uIOhook.on('keyup', (e: UiohookKeyboardEvent) =>
        this.pushToTalkHandler(e, config),
      );

      uIOhook.on('mouseup', (e: UiohookMouseEvent) =>
        this.pushToTalkHandler(e, config),
      );
    }
  }

  /**
   * Remove all audio sources from the OBS scene. This is public
   * so it can be called externally when WoW is closed.
   */
  public removeAudioSources() {
    // TODO handle prefixing
    noobs.RemoveSourceFromScene(AudioSourcePrefix.MIC);
    noobs.RemoveSourceFromScene(AudioSourcePrefix.SPEAKER);

    noobs.DeleteSource(AudioSourcePrefix.MIC);
    noobs.DeleteSource(AudioSourcePrefix.SPEAKER);
  }

  /**
   * Cancel the find window interval timer.
   */
  public clearFindWindowInterval() {
    this.findWindowAttempts = 0;

    if (this.findWindowInterval) {
      clearInterval(this.findWindowInterval);
      this.findWindowInterval = undefined;
    }
  }

  /**
   * Release all OBS resources and shut it down.
   */
  public shutdownOBS() {
    console.info('[Recorder] OBS shutting down', this.uuid);

    if (!this.obsInitialized) {
      console.info('[Recorder] OBS not initialized so not attempting shutdown');
      return;
    }

    noobs.Shutdown();
    this.obsInitialized = false;
    this.obsConfigured = false;
    console.info('[Recorder] OBS shut down successfully');
  }

  /**
   * Get a list of the audio input devices. Used by the settings to populate
   * the list of devices for user selection.
   */
  public getInputAudioDevices() {
    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    // const inputDevices =
    //   osn.NodeObs.OBS_settings_getInputAudioDevices() as IOBSDevice[];

    return [];
  }

  /**
   * Get a list of the audio output devices. Used by the settings to populate
   * the list of devices for user selection.
   */
  public getOutputAudioDevices() {
    return [];
  }

  /**
   * Return an array of all the windows for audio process capture available to OBS.
   */
  public getProcessAudioDevices(): {
    name: string; // Display name.
    value: string | number; // Value to configure OBS with.
  }[] {
    return [];
  }

  /**
   * Return an array of all the encoders available to OBS.
   */
  public getAvailableEncoders(): string[] {
    console.info('[Recorder] Getting available encoders');

    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    const encoders = noobs.ListVideoEncoders();
    console.info('[Recorder] Encoders:', encoders);
    return encoders;
  }

  /**
   * Show the scene preview on the UI, taking the location and dimensions as
   * input.
   */
  public showPreview(width: number, height: number, x: number, y: number) {
    noobs.ShowPreview(x, y, width, height);
  }

  /**
   * Clean-up the recording directory.
   * @params Number of files to leave.
   */
  public async cleanup(obsPath: string) {
    console.info('[Recorder] Clean out buffer');
    const videos = await getSortedVideos(obsPath); // TODO remove this sorting, its redundant
    const files = videos.map((f) => f.name);
    const promises = files.map(tryUnlink);
    await Promise.all(promises);
  }

  /**
   * Start OBS, no-op if already started.
   */
  private async startObsBuffer() {
    console.info('[Recorder] Start');

    if (!this.obsInitialized) {
      console.error('[Recorder] OBS not initialized');
      throw new Error('OBS not initialized');
    }

    if (this.obsState === ERecordingState.Recording) {
      console.info('[Recorder] Already started');
      return;
    }

    // Sleep for a second, without this sometimes OBS does not respond at all.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    this.startQueue.empty();
    noobs.StartBuffer();

    console.log('START WAITING FOR START QUEUE');

    await Promise.race([
      this.startQueue.shift(),
      getPromiseBomb(30, 'OBS timeout waiting for start'),
    ]);

    this.startQueue.empty();

    // I think this causes a very slight offset in the video - i.e. we set the
    // start to just after we receive the signal from OBS that recording has
    // started, and not when it has actually started. Very minor though so probably
    // fine to live with this forever.
    this.startDate = new Date();
  }

  /**
   * Conver the buffer recording to a a real recording.
   */
  private async convertObsBuffer(offset: number) {
    console.info('[Recorder] Convert buffer with offset:', offset);

    if (!this.obsInitialized) {
      console.error('[Recorder] OBS not initialized');
      throw new Error('OBS not initialized');
    }

    // if (this.obsState === ERecordingState.Recording) {
    //   console.info('[Recorder] Already started');
    //   return;
    // }

    // // Sleep for a second, without this sometimes OBS does not respond at all.
    // await new Promise((resolve) => setTimeout(resolve, 1000));

    this.startQueue.empty();

    // The native code expects an integer.
    const rounded = Math.round(offset);
    noobs.StartRecording(rounded);

    // await Promise.race([
    //   this.startQueue.shift(),
    //   getPromiseBomb(30, 'OBS timeout waiting for start'),
    // ]);

    this.startQueue.empty();

    // I think this causes a very slight offset in the video - i.e. we set the
    // start to just after we receive the signal from OBS that recording has
    // started, and not when it has actually started. Very minor though so probably
    // fine to live with this forever.
    this.startDate = new Date();
  }

  /**
   * Stop OBS, no-op if already stopped.
   */
  private async stopObsRecording(force: boolean) {
    console.info('[Recorder] Stop');

    if (!this.obsInitialized) {
      console.error('[Recorder] OBS not initialized');
      throw new Error('OBS not initialized');
    }

    if (this.obsState === ERecordingState.Offline) {
      console.info('[Recorder] Already stopped');
      return;
    }

    this.wroteQueue.empty();

    if (force) {
      console.info('[Recorder] Force stop recording');
      noobs.ForceStopRecording();
    } else {
      console.info('[Recorder] Stop recording');
      noobs.StopRecording();
    }

    const wrote = this.wroteQueue.shift();
    await Promise.race([wrote, getPromiseBomb(60, 'OBS timeout on stop')]);

    if (force) {
      this.lastFile = '';
    } else {
      this.lastFile = noobs.GetLastRecording();
    }

    console.info('[Recorder] Set last file:', this.lastFile);
  }

  // /**
  //  * Force stop OBS, no-op if already stopped. Optionally pass in a wrote
  //  * promise to await instead of shifting from the queue ourselves. That's
  //  * useful in the case we've failed to stop and are now force stopping.
  //  */
  // private async forceStopOBS(wrote: Promise<any> | undefined = undefined) {
  //   console.info('[Recorder] Force stop');

  //   if (!this.obsInitialized) {
  //     console.error('[Recorder] OBS not initialized');
  //     throw new Error('OBS not initialized');
  //   }

  //   // if (this.obsState === ERecordingState.Offline) {
  //   //   console.info('[Recorder] Already stopped');
  //   //   return;
  //   // }

  //   this.wroteQueue.empty();
  //   noobs.StopRecording(); // TODO should be force

  //   // If we were passed a wrote promise, use that instead of shifting from
  //   // the queue as a previously created promise will get the result first.
  //   wrote = wrote || this.wroteQueue.shift();
  //   // const bomb = getPromiseBomb(3, 'OBS timeout on force stop');
  //   // await Promise.race([wrote, bomb]);
  //   this.lastFile = null;
  // }

  /**
   * Create the obsPath directory if it doesn't already exist. Also
   * cleans it out for good measure.
   */
  private static async createRecordingDirs(obsPath: string) {
    const dirExists = await exists(obsPath);

    if (!dirExists) {
      console.info('[Recorder] Creating dir:', obsPath);
      await fs.promises.mkdir(obsPath);
      await takeOwnershipBufferDir(obsPath);
    }
  }

  /**
   * Call through OSN to initialize OBS. This is slow and synchronous,
   * so use sparingly - it will block the main thread.
   */
  private initializeOBS() {
    console.info('[Recorder] Initializing OBS', this.uuid);
    const cb = this.handleSignal.bind(this);

    let logPath = devMode
      ? path.resolve(__dirname, './logs')
      : path.resolve(__dirname, '../../dist/main/logs');

    let noobsPath = devMode
      ? path.resolve(__dirname, '../../release/app/node_modules/noobs/dist')
      : path.resolve(__dirname, '../../node_modules/noobs/dist');

    logPath = fixPathWhenPackaged(logPath);
    noobsPath = fixPathWhenPackaged(noobsPath);

    const recordingPath =
      'D:/checkouts/warcraft-recorder-obs-engine/recordings';

    console.log('[Recorder] Noobs path:', noobsPath);
    console.log('[Recorder] Log path:', logPath);
    console.log('[Recorder] Recording path:', recordingPath);

    noobs.Init(noobsPath, logPath, recordingPath, cb);
    noobs.SetBuffering(true);

    const hwnd = this.mainWindow.getNativeWindowHandle();
    noobs.InitPreview(hwnd);
    noobs.SetDrawSourceOutline(true);

    this.obsInitialized = true;
    console.info('[Recorder] OBS initialized successfully');
  }

  /**
   * Handle a signal from OBS.
   */
  private handleSignal(signal: Signal) {
    if (signal.type === 'volmeter' && signal.value !== undefined) {
      this.volmeters[signal.id] = signal.value;
      this.mainWindow.webContents.send('volmeter', this.volmeters);
      return;
    }

    console.info('[Recorder] Got signal:', signal);

    // if (obsSignal.type !== 'recording') {
    //   console.info('[Recorder] No action needed on this signal');
    //   return;
    // }

    // This code was previously here catching any non-zero return signals,
    // but it seems that is not a good criteria to consider it a crash as
    // seen several instances of non-zero return codes that have been
    // non-fatal.
    //
    // For example when I use my NVENC encoder on my non-default
    // GPU we get a -4 RC despite everything being otherwise fine; suspect
    // caused by the fact that it tries the AMD GPU first which doesn't work.
    //
    // I spent alot of time trying to work out what was wrong only to find that
    // the difference in streamlabs desktop is that they don't crash on a non-zero
    // RC.
    //
    // So we do what we can by checking wrote signals non-zero and ignoring
    // other non-zero signals. If something goes wrong earlier, we will hit a
    // timeout anyway which will cover our backs.
    // if (signal.code !== 0 && signal.signal === 'wrote') {
    //   console.error('[Recorder] Non-zero wrote signal');

    //   const crashData: CrashData = {
    //     date: new Date(),
    //     reason: obsSignal.error,
    //   };

    //   this.emit('crash', crashData);
    //   return;
    // }

    switch (signal.id) {
      case EOBSOutputSignal.Start:
        console.log('Push to start queue', signal);
        this.startQueue.push(signal);
        this.obsState = ERecordingState.Recording;
        break;

      case EOBSOutputSignal.Stop:
        console.log('Push to wrote queue', signal);
        this.wroteQueue.push(signal);
        this.obsState = ERecordingState.Offline;
        break;

      default:
        console.info('[Recorder] No action needed on this signal');
        break;
    }

    this.emit('state-change');
    console.info('[Recorder] State is now: ', this.obsState);
  }

  /**
   * Creates a window capture source. In TWW, the retail and classic Window names
   * diverged slightly, so while this was previously a hardcoded string, now we
   * search for it in the OSN sources API.
   */
  private configureWindowCaptureSource(
    captureCursor: boolean,
    forceSdr: boolean,
    videoSourceScale: number,
    videoSourceXPosition: number,
    videoSourceYPosition: number,
  ) {
    console.info('[Recorder] Configuring OBS for Window Capture');

    this.findWindowInterval = setInterval(
      () =>
        this.tryAttachWindowCaptureSource(
          captureCursor,
          forceSdr,
          videoSourceScale,
          videoSourceXPosition,
          videoSourceYPosition,
        ),
      this.findWindowIntervalDuration,
    );

    // Call immediately to avoid the first interval delay. Will clear
    // the interval if it is successful. Common case is that WoW has
    // been open for a while and this immediately succeeds.
    this.tryAttachWindowCaptureSource(
      captureCursor,
      forceSdr,
      videoSourceScale,
      videoSourceXPosition,
      videoSourceYPosition,
    );
  }

  /**
   * Configures the game capture source.
   */
  private configureGameCaptureSource(
    captureCursor: boolean,
    forceSdr: boolean,
    videoSourceScale: number,
    videoSourceXPosition: number,
    videoSourceYPosition: number,
  ) {
    console.info('[Recorder] Configuring OBS for Game Capture');

    this.findWindowInterval = setInterval(
      () =>
        this.tryAttachGameCaptureSource(
          captureCursor,
          forceSdr,
          videoSourceScale,
          videoSourceXPosition,
          videoSourceYPosition,
        ),
      this.findWindowIntervalDuration,
    );

    // Call immediately to avoid the first interval delay. Will clear
    // the interval if it is successful. Common case is that WoW has
    // been open for a while and this immediately succeeds.
    this.tryAttachGameCaptureSource(
      captureCursor,
      forceSdr,
      videoSourceScale,
      videoSourceXPosition,
      videoSourceYPosition,
    );
  }

  /**
   * Creates a monitor capture source. Monitor capture always shows the cursor.
   */
  private configureMonitorCaptureSource(
    monitorIndex: number,
    forceSdr: boolean,
  ) {
    console.info('[Recorder] Configuring OBS for Monitor Capture');

    noobs.CreateSource(VideoSourceName.MONITOR, 'monitor_capture');
    const settings = noobs.GetSourceSettings(VideoSourceName.MONITOR);
    const p = noobs.GetSourceProperties(VideoSourceName.MONITOR);
    console.log(p);
    console.log('method', p[0].items);
    console.log('ids', p[1].items);
    console.log(settings);

    noobs.SetSourceSettings(VideoSourceName.MONITOR, {
      ...settings,
      method: 0,
      monitor_id: p[1].items[monitorIndex].value,
      force_sdr: forceSdr,
    });

    const settings2 = noobs.GetSourceSettings(VideoSourceName.MONITOR);
    console.log(settings2);

    noobs.AddSourceToScene(VideoSourceName.MONITOR);
  }

  /**
   * Configure the chat overlay image source.
   */
  public configureOverlayImageSource(config: ObsOverlayConfig) {
    const { chatOverlayEnabled, chatOverlayOwnImage } = config;
    console.info('[Recorder] Configure image source for chat overlay');

    // Safe to call both of these even if the source doesn't exist.
    noobs.RemoveSourceFromScene(VideoSourceName.OVERLAY);
    noobs.DeleteSource(VideoSourceName.OVERLAY);

    if (!chatOverlayEnabled) {
      console.info('[Recorder] Chat overlay is disabled, not configuring');
      return;
    }

    if (chatOverlayOwnImage && this.cfg.get('cloudStorage')) {
      this.configureOwnOverlay(config);
    } else {
      this.configureDefaultOverlay(config);
    }
  }

  /**
   * Mute the mic audio sources.
   */
  private muteInputDevices() {
    if (this.inputDevicesMuted) {
      return;
    }

    noobs.SetMuteAudioInputs(true);

    this.inputDevicesMuted = true;
    this.obsMicState = MicStatus.MUTED;
    this.emit('state-change');
  }

  /**
   * Unmute the mic audio sources.
   */
  private unmuteInputDevices() {
    if (!this.inputDevicesMuted) {
      return;
    }

    noobs.SetMuteAudioInputs(false);

    this.inputDevicesMuted = false;
    this.obsMicState = MicStatus.LISTENING;
    this.emit('state-change');
  }

  private pushToTalkHandler(
    event: UiohookKeyboardEvent | UiohookMouseEvent,
    audioConfig: ObsAudioConfig,
  ) {
    const converted = convertUioHookEvent(event);
    const isKeybindMatch = isPushToTalkHotkey(audioConfig, converted);

    if (!isKeybindMatch) {
      return;
    }

    const isPress =
      event.type === EventType.EVENT_KEY_PRESSED ||
      event.type === EventType.EVENT_MOUSE_PRESSED;

    if (isPress) {
      if (this.pttReleaseDelayTimer) {
        clearTimeout(this.pttReleaseDelayTimer);
        this.pttReleaseDelayTimer = undefined;
      }

      this.unmuteInputDevices();
      return;
    }

    const delay = this.cfg.get<number>('pushToTalkReleaseDelay');

    this.pttReleaseDelayTimer = setTimeout(() => {
      this.muteInputDevices();
      this.pttReleaseDelayTimer = undefined;
    }, delay);
  }

  /**
   * Convert the quality setting to an appropriate CQP/CRF value based on encoder type.
   */
  private static getCqpFromQuality(encoder: string, quality: string) {
    if (
      encoder === ESupportedEncoders.JIM_AV1_NVENC ||
      encoder === ESupportedEncoders.AMD_AMF_AV1
    ) {
      // AV1 typically needs lower CQP values for similar quality
      switch (quality) {
        case QualityPresets.ULTRA:
          return 20;
        case QualityPresets.HIGH:
          return 24;
        case QualityPresets.MODERATE:
          return 28;
        case QualityPresets.LOW:
          return 32;
        default:
          console.error('[Recorder] Unrecognised quality', quality);
          throw new Error('Unrecognised quality');
      }
    }

    // Original values for x264 CRF and other encoders' CQP
    switch (quality) {
      case QualityPresets.ULTRA:
        return 22;
      case QualityPresets.HIGH:
        return 26;
      case QualityPresets.MODERATE:
        return 30;
      case QualityPresets.LOW:
        return 34;
      default:
        console.error('[Recorder] Unrecognised quality', quality);
        throw new Error('Unrecognised quality');
    }
  }

  /**
   * Apply a setting to OBS.
   */
  private static applySetting(
    category: string,
    parameter: string,
    value: string | number,
  ) {
    console.info('[Recorder] Apply setting', category, parameter, value);

    // let old;
    // const settings = osn.NodeObs.OBS_settings_getSettings(category).data;

    // settings.forEach((subcategory: ISettingsSubCategory) => {
    //   subcategory.parameters.forEach((param: IObsInput<TObsValue>) => {
    //     if (param.name === parameter) {
    //       old = param.currentValue;
    //       param.currentValue = value;
    //     }
    //   });
    // });

    // if (value !== old) {
    //   osn.NodeObs.OBS_settings_saveSettings(category, settings);
    // }
  }

  /**
   * Get the allowed values for a specific setting.
   */
  private static getAvailableValues(
    category: string,
    subcategory: string,
    parameter: string,
  ) {
    console.info(
      '[Recorder] Get available values for',
      category,
      subcategory,
      parameter,
    );

    // const categorySettings =
    //   osn.NodeObs.OBS_settings_getSettings(category).data;

    // if (!categorySettings) {
    //   throw new Error(`No category found: ${category}`);
    // }

    // const subcategorySettings = categorySettings.find(
    //   (sub: ISettingsSubCategory) => sub.nameSubCategory === subcategory,
    // );

    // if (!subcategorySettings) {
    //   throw new Error(`No subcategory found: ${subcategory} in ${category}`);
    // }

    // const parameterSettings = subcategorySettings.parameters.find(
    //   (param: IObsInput<TObsValue>) => param.name === parameter,
    // );

    // if (!parameterSettings) {
    //   throw new Error(
    //     `No parameter found: ${parameter} in ${category} -> ${subcategory}`,
    //   );
    // }

    // return parameterSettings.values.map(
    //   (value: TObsValue) => Object.values(value)[0],
    // );
    return [];
  }

  /**
   * Type guard for an OBS list property.
   */
  private static isObsListProperty(property: any): property is any {
    return property.type === 6;
  }

  /**
   * Check if the name of the window matches one of the known WoW window names.
   */
  private static windowMatch(item: { name: string; value: string | number }) {
    return (
      item.name.startsWith('[Wow.exe]: ') ||
      item.name.startsWith('[WowT.exe]: ') ||
      item.name.startsWith('[WowB.exe]: ') ||
      item.name.startsWith('[WowClassic.exe]: ')
    );
  }

  /**
   * Try to attach to a game capture source for WoW. If the window is not
   * found, do nothing.
   */
  private tryAttachGameCaptureSource(
    captureCursor: boolean,
    forceSdr: boolean,
    videoSourceScale: number,
    videoSourceXPosition: number,
    videoSourceYPosition: number,
  ) {
    this.findWindowAttempts++;

    if (this.findWindowAttempts > this.findWindowAttemptLimit) {
      console.error('[Recorder] Exceeded find window attempts, giving up');
      this.clearFindWindowInterval();
      return;
    }

    console.info(
      '[Recorder] Looking for game capture source, attempt',
      this.findWindowAttempts,
    );

    let window = false;

    try {
      noobs.CreateSource(VideoSourceName.GAME, 'game_capture');
      const p = noobs.GetSourceProperties(VideoSourceName.GAME);
      console.log('AHKKKK');
      console.log(p);
      console.log(p[1].items);

      const s = noobs.GetSourceSettings(VideoSourceName.GAME);

      noobs.SetSourceSettings(VideoSourceName.GAME, {
        ...s,
        capture_mode: 'window',
        window: 'World of Warcraft:waApplication Window:WowClassic.exe', // TODO handle all names classic, chinese, use windowMatch();
        force_sdr: forceSdr,
        cursor: captureCursor,
      });

      const s1 = noobs.GetSourceSettings(VideoSourceName.GAME);
      console.log('s1', s1);

      noobs.AddSourceToScene(VideoSourceName.GAME);

      noobs.SetSourcePos(VideoSourceName.GAME, {
        x: videoSourceXPosition,
        y: videoSourceYPosition,
        scaleX: videoSourceScale,
        scaleY: videoSourceScale,
      });
      window = true;
    } catch (ex) {
      console.error('[Recorder] Exception when trying to find window:', ex);
      // TODO release source'?
    }

    if (!window) {
      console.info('[Recorder] Game capture window not found, will retry');
      return;
    }

    console.info('[Recorder] Game capture window found', window);

    console.info('[Recorder] Game capture source configured');
    this.clearFindWindowInterval();
  }

  /**
   * Try to attach to a window capture source for WoW. If the window is not
   * found, do nothing.
   */
  private tryAttachWindowCaptureSource(
    captureCursor: boolean,
    forceSdr: boolean,
    videoSourceScale: number,
    videoSourceXPosition: number,
    videoSourceYPosition: number,
  ) {
    this.findWindowAttempts++;

    if (this.findWindowAttempts > this.findWindowAttemptLimit) {
      console.error('[Recorder] Exceeded find window attempts, giving up');
      this.clearFindWindowInterval();
      return;
    }

    console.info(
      '[Recorder] Looking for window capture source, attempt',
      this.findWindowAttempts,
    );

    let window = false;

    noobs.DeleteSource(VideoSourceName.WINDOW);
    noobs.RemoveSourceFromScene(VideoSourceName.WINDOW);

    try {
      noobs.CreateSource(VideoSourceName.WINDOW, 'window_capture');
      const p = noobs.GetSourceProperties(VideoSourceName.WINDOW);
      console.log('Window capture src ---');
      console.log(p);
      console.log(p[0].items);
      console.log(p[1].items);
      const s = noobs.GetSourceSettings(VideoSourceName.WINDOW);

      noobs.SetSourceSettings(VideoSourceName.WINDOW, {
        ...s,
        method: 2, // WGC: Windows Graphics Capture
        window: 'World of Warcraft:waApplication Window:WowClassic.exe', // TODO handle all names classic, chinese
        compatibility: true,
        force_sdr: forceSdr,
        cursor: captureCursor,
      });

      const s1 = noobs.GetSourceSettings(VideoSourceName.WINDOW);
      console.log('s1', s1);

      console.log("SETTING POSITION TO", videoSourceXPosition, videoSourceYPosition, videoSourceScale);

      noobs.AddSourceToScene(VideoSourceName.WINDOW);

      noobs.SetSourcePos(VideoSourceName.WINDOW, {
        x: videoSourceXPosition,
        y: videoSourceYPosition,
        scaleX: videoSourceScale,
        scaleY: videoSourceScale,
      });
      window = true;
    } catch (ex) {
      console.error('[Recorder] Exception when trying to find window:', ex);
    }

    if (!window) {
      console.info('[Recorder] Game capture window not found, will retry');
      return;
    }

    console.info('[Recorder] Window capture source configured');
    this.clearFindWindowInterval();
  }

  /**
   * Get the current dimensions of the display preview. This includes the 
   * base canvas size (unscaled) and the current display size (scaled).
   */
  public getDisplayInfo(): {
    canvasWidth: number;
    canvasHeight: number;
    previewWidth: number;
    previewHeight: number;
  } {
    return noobs.GetPreviewInfo();
  }

  /**
   * Get the current position and dimensions of a source. Width and height are
   * before scaling. This is the real size on the canvas, not the size in the 
   * preview.
   */
  public getSourcePosition(src: VideoSourceName) {
    const previewInfo = this.getDisplayInfo(); // Could be cached
    const sfx = previewInfo.previewWidth / previewInfo.canvasWidth;
    const sfy = previewInfo.previewHeight / previewInfo.canvasHeight;
    const sf = Math.min(sfx, sfy);

    const current = noobs.GetSourcePos(src);

    const position: SceneItemPosition & SourceDimensions = {
      x: current.x * sf,
      y: current.y * sf,
      scaleX: current.scaleX,
      scaleY: current.scaleY,
      width: current.width * sf * current.scaleX,
      height: current.height * sf * current.scaleY,
    };

    return position;
  }


  /**
   * Sets the position of a source in the OBS scene.
   */
  public setSourcePosition(
    src: VideoSourceName, 
    target: { x: number; y: number; width: number; height: number }
  ) {
    const previewInfo = noobs.GetPreviewInfo(); // Could be cached?
    const current = noobs.GetSourcePos(src);

    // This is confusing because there are two forms of scaling at play 
    // that we need to account for. 
    //   1. The source scaling. The current.width might be 1000px but 
    //      if it's scaled by 0.5 the real width is 500px. 
    //   2. The preview scaling. The preview is reduced to fit the div
    //      based on the aspect ratio.
    const sfx = previewInfo.previewWidth / previewInfo.canvasWidth;
    const sfy = previewInfo.previewHeight / previewInfo.canvasHeight;
    const sf = Math.min(sfx, sfy);

    // We only allow one scale factor to retail the aspect ratio of
    // the source so just use the X.
    const scaledWidth = current.width * current.scaleX * sf;
    const ratioX = target.width / scaledWidth;
    let scale = ratioX * current.scaleX;

    const updated: SceneItemPosition = {
      x: target.x / sf,
      y: target.y / sf,
      scaleX: scale,
      scaleY: scale,
    };

    noobs.SetSourcePos(src, updated);

    if (this.sourceDebounceTimer) {
      clearTimeout(this.sourceDebounceTimer);
    }

    this.sourceDebounceTimer = setTimeout(() => {
      this.saveSourcePosition(src, updated.x, updated.y, scale);
      this.sourceDebounceTimer = undefined;
    }, 1000);
  }

  /**
   * Reset the source position to 0, 0 and unscaled.
   */
  public resetSourcePosition(src: VideoSourceName) {
    console.info('[Recorder] Reset source position', src);
    
    const updated: SceneItemPosition = {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
    };

    noobs.SetSourcePos(src, updated);
    this.saveSourcePosition(src, 0, 0, 1);
  }

  /**
   * Save a video source position in the config.
   */
  private saveSourcePosition(src: VideoSourceName, x: number, y: number, scale: number) {
    console.info('[Recorder] Saving src position', src, { x, y, scale });

    if (src === VideoSourceName.OVERLAY) {
      this.cfg.set('chatOverlayXPosition', x);
      this.cfg.set('chatOverlayYPosition', y);
      this.cfg.set('chatOverlayScale', scale);
    } else {
      this.cfg.set('videoSourceXPosition', x);
      this.cfg.set('videoSourceYPosition', y);
      this.cfg.set('videoSourceScale', scale);
    }
  }
}    
