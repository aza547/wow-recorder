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
  CrashData,
  MicStatus,
  ObsAudioConfig,
  ObsBaseConfig,
  ObsOverlayConfig,
  ObsSourceCallbackInfo,
  ObsVideoConfig,
  ObsVolmeterCallbackInfo,
  TAudioSourceType,
} from './types';
import ConfigService from '../config/ConfigService';
import { obsResolutions } from './constants';
import { getOverlayConfig } from '../utils/configUtils';
import { v4 as uuidv4 } from 'uuid';

import noobs, { ObsData, Signal } from 'noobs';

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

  /**
   * Sensible defaults for the video context.
   */
  // private defaultVideoContext: any = {
  //   fpsNum: 60,
  //   fpsDen: 1,
  //   baseWidth: 1920,
  //   baseHeight: 1080,
  //   outputWidth: 1920,
  //   outputHeight: 1080,

  //   // Bit of a mess here to keep typescript happy and make this readable.
  //   // See https://github.com/stream-labs/obs-studio-node/issues/1260.
  //   outputFormat: EVideoFormat.NV12 as unknown,
  //   colorspace: EColorSpace.CS709 as unknown,
  //   scaleType: EScaleType.Bicubic as unknown,
  //   fpsType: EFPSType.Fractional as unknown,

  //   // The AMD encoder causes recordings to get much darker if using the full
  //   // color range setting. So swap that to partial here. See Issue 446.
  //   range: ERangeType.Partial as unknown,
  // };

  /**
   * Contructor.
   */
  constructor(mainWindow: BrowserWindow) {
    super();
    console.info('[Recorder] Constructing recorder:', this.uuid);
    this.mainWindow = mainWindow;
    this.initializeOBS();

    // The video context is an OBS construct used to control many features of
    // recording, including the dimensions and FPS.
    // this.context = osn.VideoFactory.create();
    // this.context = {};
    // this.context.video = this.defaultVideoContext;

    // We create all the sources we might need to use here, as the source API
    // provided by OSN provides mechanisms for retrieving valid settings; it's
    // useful to always be able to access them even if we never enable the sources.
    // this.windowCaptureSource = osn.InputFactory.create(
    //   'window_capture',
    //   'WCR Window Capture',
    // );

    // this.gameCaptureSource = osn.InputFactory.create(
    //   'game_capture',
    //   'WCR Game Capture',
    // );

    // this.monitorCaptureSource = osn.InputFactory.create(
    //   'monitor_capture',
    //   'WCR Monitor Capture',
    // );

    // this.dummyWindowCaptureSource = osn.InputFactory.create(
    //   'window_capture',
    //   'WCR Dummy Window Capture',
    // );

    // this.dummyGameCaptureSource = osn.InputFactory.create(
    //   'game_capture',
    //   'WCR Dummy Game Capture',
    // );

    // // In theory having this created so early isn't required, but may as well
    // // and avoid a bunch of undefined checks. We will reconfigure it as required.
    // this.overlayImageSource = osn.InputFactory.create(
    //   'image_source',
    //   'WCR Chat Overlay',
    //   { file: getAssetPath('poster', 'chat-cover.png') },
    // );

    // // Connects the signal handler, we get feedback from OBS by way of
    // // signals, so this is how we know it's doing the right thing after
    // // we ask it to start/stop.
    // osn.NodeObs.OBS_service_connectOutputSignals((s: osn.EOutputSignal) => {
    //   this.handleSignal(s);
    // });

    // // The source callback is OBS's way of informing us of changes to the
    // // sources. Used for dynamic resizing.
    // osn.NodeObs.RegisterSourceCallback((d: ObsSourceCallbackInfo[]) => {
    //   this.handleSourceCallback(d);
    // });

    // // The volmeter callback is OBS's way of communicating the state of audio
    // // sources. Used for monitoring audio levels.
    // osn.NodeObs.RegisterVolmeterCallback((d: ObsVolmeterCallbackInfo[]) => {
    //   this.handleVolmeterCallback(d);
    // });

    // The scene is an OBS construct that holds the sources, think of it as a
    // blank canvas we can add sources to. We could create it later but we can
    // once again avoid a bunch of undefined checks by doing it here.
    // this.scene = osn.SceneFactory.create('WCR Scene');
    // osn.Global.setOutputSource(this.videoChannel, this.scene);

    // It might seem a bit weird that we add all the sources, but we disable
    // them all by default. That way we can avoid undefined checks on all the
    // variables set here, as we need the scene item references for scaling.
    // this.windowCaptureSceneItem = this.scene.add(this.windowCaptureSource);
    // this.gameCaptureSceneItem = this.scene.add(this.gameCaptureSource);
    // this.monitorCaptureSceneItem = this.scene.add(this.monitorCaptureSource);
    // this.overlayImageSceneItem = this.scene.add(this.overlayImageSource);
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
    ['WCR Monitor Capture', 'WCR Window Capture', 'WCR Game Capture'].forEach(
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
    // this.scaleVideoSourceSize();
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
    console.log("CREATE2  WCR Overlay");
    noobs.CreateSource('WCR Overlay', 'image_source');

    const settings = noobs.GetSourceSettings('WCR Overlay');

    noobs.SetSourceSettings('WCR Overlay', {
      ...settings,
      file: chatOverlayOwnImagePath,
    });

    noobs.AddSourceToScene('WCR Overlay');

    noobs.SetSourcePos('WCR Overlay', {
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

    console.log("CREATE1  WCR Overlay");
    noobs.CreateSource('WCR Overlay', 'image_source');

    const settings = noobs.GetSourceSettings('WCR Overlay');

    noobs.SetSourceSettings('WCR Overlay', {
      ...settings,
      file: getAssetPath('poster', 'image.png'),
    });

    noobs.AddSourceToScene('WCR Overlay');

    noobs.SetSourcePos('WCR Overlay', {
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

    noobs.CreateSource('WCR Mic Source', 'wasapi_input_capture');
    noobs.CreateSource('WCR Speaker Source', 'wasapi_output_capture');

    noobs.AddSourceToScene('WCR Mic Source');
    noobs.AddSourceToScene('WCR Speaker Source');

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
    noobs.RemoveSourceFromScene('WCR Mic Source');
    noobs.RemoveSourceFromScene('WCR Speaker Source');

    noobs.DeleteSource('WCR Mic Source');
    noobs.DeleteSource('WCR Speaker Source');
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
    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    // const outputDevices =
    //   osn.NodeObs.OBS_settings_getOutputAudioDevices() as IOBSDevice[];

    return [];
  }

  /**
   * Return an array of all the windows for audio process capture available to OBS.
   */
  public getProcessAudioDevices(): {
    name: string; // Display name.
    value: string | number; // Value to configure OBS with.
  }[] {
    console.info('[Recorder] Getting available windows for audio capture');

    // if (!this.obsInitialized) {
    //   throw new Error('[Recorder] OBS not initialized');
    // }

    // const src = osn.InputFactory.create(
    //   TAudioSourceType.process,
    //   'WCR Dummy Process Audio Source',
    // );

    // let prop = src.properties.first();

    // while (prop && prop.name !== 'window') {
    //   prop = prop.next();
    // }

    // const windows = [];

    // if (prop.name === 'window' && Recorder.isObsListProperty(prop)) {
    //   const unique = Array.from(
    //     new Map(prop.details.items.map((item) => [item.value, item])).values(),
    //   );

    //   windows.push(...unique);
    // }

    // src.release();
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
   * Show the preview on the UI, only if we already know the location and
   * dimensions.
   */
  public showPreviewMemory() {
    // if (this.previewLocation !== undefined) {
    //   const { width, height, xPos, yPos } = this.previewLocation;
    //   this.showPreview(width, height, xPos, yPos);
    // }
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
   * Handle a source callback from OBS.
   */
  private handleSourceCallback(data: ObsSourceCallbackInfo[]) {
    console.info('[Recorder] Got source callback:', data);
    this.scaleVideoSourceSize();
  }

  /**
   * Handle a volmeter callback from OBS. Deliberatly no logs in here
   * as it's extremely frequently.
   */
  private handleVolmeterCallback(data: ObsVolmeterCallbackInfo[]) {
    this.mainWindow.webContents.send('volmeter', data);
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

    noobs.CreateSource('WCR Monitor Capture', 'monitor_capture');
    const settings = noobs.GetSourceSettings('WCR Monitor Capture');
    const p = noobs.GetSourceProperties('WCR Monitor Capture');
    console.log(p);
    console.log('method', p[0].items);
    console.log('ids', p[1].items);
    console.log(settings);

    noobs.SetSourceSettings('WCR Monitor Capture', {
      ...settings,
      method: 0,
      monitor_id: p[1].items[monitorIndex].value,
      force_sdr: forceSdr,
    });

    const settings2 = noobs.GetSourceSettings('WCR Monitor Capture');
    console.log(settings2);

    noobs.AddSourceToScene('WCR Monitor Capture');
  }

  /**
   * Configure the chat overlay image source.
   */
  public configureOverlayImageSource(config: ObsOverlayConfig) {
    const { chatOverlayEnabled, chatOverlayOwnImage } = config;
    console.info('[Recorder] Configure image source for chat overlay');

    // Safe to call both of these even if the source doesn't exist.
    console.log("REMOVE  WCR Overlay");
    noobs.RemoveSourceFromScene('WCR Overlay');
    noobs.DeleteSource('WCR Overlay');

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
   * Add a single audio source to the OBS scene.
   */
  private addAudioSource(obsInput: any, channel: number) {
    console.info(
      '[Recorder] Adding OBS audio source',
      obsInput.name,
      obsInput.id,
    );

    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    if (channel < 1 || channel >= 64) {
      throw new Error(`[Recorder] Invalid channel number ${channel}`);
    }

    // osn.Global.setOutputSource(channel, obsInput);
  }

  /**
   * Remove a single audio source from the OBS scene.
   */
  private removeAudioSource(source: any, channel: number) {
    if (!this.obsInitialized) {
      throw new Error('OBS not initialized');
    }

    console.info(
      '[Recorder] Removing OBS audio source',
      source.name,
      source.id,
    );

    // osn.Global.setOutputSource(channel, null as unknown as ISource);
    source.release();
  }

  /**
   * Create an OBS audio source.
   */
  private createOBSAudioSource(
    id: string,
    idx: number,
    type: TAudioSourceType,
  ) {
    console.info('[Recorder] Creating OBS audio source', id, idx, type);

    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    let name = '';

    if (type === TAudioSourceType.output) {
      name = `WCR Speaker Source ${idx}`;
    } else if (type === TAudioSourceType.input) {
      name = `WCR Mic Source ${idx}`;
    } else if (type === TAudioSourceType.process) {
      name = `WCR Process Source ${idx}`;
    } else {
      // Programmer error, should never happen.
      throw new Error('Invalid audio source type');
    }

    const settings = TAudioSourceType.process
      ? // Priority 2: "Match title, otherwise find window of same executable".
        { window: id, priority: 2 }
      : { device_id: id };

    // return osn.InputFactory.create(type, name, settings);
  }

  /**
   * Watch the video input source for size changes, and rescale to fill the
   * canvas.
   */
  private scaleVideoSourceSize() {
    let src;
    let item;

    // if (this.windowCaptureSource.enabled) {
    //   src = this.windowCaptureSource;
    //   item = this.windowCaptureSceneItem;
    // } else if (this.gameCaptureSource.enabled) {
    //   src = this.gameCaptureSource;
    //   item = this.gameCaptureSceneItem;
    // } else if (this.monitorCaptureSource.enabled) {
    //   src = this.monitorCaptureSource;
    //   item = this.monitorCaptureSceneItem;
    // } else {
    //   // No log here as as may be frequent.
    //   return;
    // }

    // if (src.width === 0 || src.height === 0) {
    //   // This happens often, suspect it's before OBS gets a hook into a game
    //   // capture process.
    //   return;
    // }

    // const { width, height } = obsResolutions[this.resolution];

    // const newScaleFactor = {
    //   x: width / src.width,
    //   y: height / src.height,
    // };

    // const closeEnough =
    //   Math.round(item.scale.x * 100) / 100 ===
    //     Math.round(newScaleFactor.x * 100) / 100 &&
    //   Math.round(item.scale.y * 100) / 100 ===
    //     Math.round(newScaleFactor.y * 100) / 100;

    // if (closeEnough) {
    //   // Don't rescale if things are within a rounding error. I think the
    //   // OSN library does some internal rounding and we don't want to spam
    //   // trigger rescaling when it isn't required. See Issue 586.
    //   return;
    // }

    // console.info('[Recorder] Rescaling from', item.scale, 'to', newScaleFactor);
    // item.scale = newScaleFactor;
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
      noobs.CreateSource('WCR Game Capture', 'game_capture');
      const p = noobs.GetSourceProperties('WCR Game Capture');
      console.log('AHKKKK');
      console.log(p);
      console.log(p[1].items);

      const s = noobs.GetSourceSettings('WCR Game Capture');

      noobs.SetSourceSettings('WCR Game Capture', {
        ...s,
        capture_mode: 'window',
        window: 'World of Warcraft:waApplication Window:WowClassic.exe', // TODO handle all names classic, chinese, use windowMatch();
        force_sdr: forceSdr,
        cursor: captureCursor,
      });

      const s1 = noobs.GetSourceSettings('WCR Game Capture');
      console.log('s1', s1);

      noobs.AddSourceToScene('WCR Game Capture');

      noobs.SetSourcePos('WCR Game Capture', {
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

    noobs.DeleteSource('WCR Window Capture');
    noobs.RemoveSourceFromScene('WCR Window Capture');

    try {
      noobs.CreateSource('WCR Window Capture', 'window_capture');
      const p = noobs.GetSourceProperties('WCR Window Capture');
      console.log('Window capture src ---');
      console.log(p);
      console.log(p[0].items);
      console.log(p[1].items);
      const s = noobs.GetSourceSettings('WCR Window Capture');

      noobs.SetSourceSettings('WCR Window Capture', {
        ...s,
        method: 2, // WGC: Windows Graphics Capture
        window: 'World of Warcraft:waApplication Window:WowClassic.exe', // TODO handle all names classic, chinese
        compatibility: true,
        force_sdr: forceSdr,
        cursor: captureCursor,
      });

      const s1 = noobs.GetSourceSettings('WCR Window Capture');
      console.log('s1', s1);

      console.log("SETTING POSITION TO", videoSourceXPosition, videoSourceYPosition, videoSourceScale);

      noobs.AddSourceToScene('WCR Window Capture');

      noobs.SetSourcePos('WCR Window Capture', {
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
}
