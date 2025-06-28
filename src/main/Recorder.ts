import { BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import * as osn from 'obs-studio-node';
import { IFader, IInput, IScene, ISceneItem, ISource } from 'obs-studio-node';
import WaitQueue from 'wait-queue';

import { UiohookKeyboardEvent, UiohookMouseEvent, uIOhook } from 'uiohook-napi';
import { EventEmitter } from 'stream';
import Queue from 'queue-promise';
import {
  EColorSpace,
  EFPSType,
  EOBSOutputSignal,
  ERangeType,
  ERecordingState,
  EScaleType,
  ESourceFlags,
  ESupportedEncoders,
  EVideoFormat,
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
  IOBSDevice,
  IObsInput,
  ISettingsSubCategory,
  MicStatus,
  ObsAudioConfig,
  ObsBaseConfig,
  ObsOverlayConfig,
  ObsSourceCallbackInfo,
  ObsVideoConfig,
  ObsVolmeterCallbackInfo,
  TAudioSourceType,
  TObsValue,
  TPreviewPosition,
} from './types';
import ConfigService from '../config/ConfigService';
import { obsResolutions } from './constants';
import { getOverlayConfig } from '../utils/configUtils';
import { v4 as uuidv4 } from 'uuid';

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
   * Location to write all recording to. This is not the final location of
   * the finalized video files.
   */
  private obsPath: string | undefined;

  /**
   * On creation of the recorder we generate a UUID to identify the OBS
   * server. On a change of settings, we destroy the recorder object and
   * create a new one, with a different UUID.
   */
  private uuid: string = uuidv4();

  /**
   * OBS IScene object.
   */
  private scene: IScene;

  /**
   * Window capture item within the scene.
   */
  private windowCaptureSceneItem: ISceneItem;

  /**
   * Game capture item within the scene.
   */
  private gameCaptureSceneItem: ISceneItem;

  /**
   * Monitor capture item within the scene.
   */
  private monitorCaptureSceneItem: ISceneItem;

  /**
   * Overlay image item within the scene.
   */
  private overlayImageSceneItem: ISceneItem;

  /**
   * The window capture source.
   */
  private windowCaptureSource: IInput;

  /**
   * The game capture source.
   */
  private gameCaptureSource: IInput;

  /**
   * The monitor capture source.
   */
  private monitorCaptureSource: IInput;

  /**
   * The dummy window capture source.
   */
  private dummyWindowCaptureSource: IInput;

  /**
   * The dummy game capture source.
   */
  private dummyGameCaptureSource: IInput;

  /**
   * The image source to be used for the overlay, we create this
   * ahead of time regardless of if the user has the overlay enabled.
   */
  private overlayImageSource: IInput;

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
   * Arbritrarily chosen channel numbers for video input. We only ever
   * include one video source.
   */
  private videoChannel = 0;

  /**
   * Some arbritrarily chosen channel numbers we can use for adding input
   * devices to the OBS scene. That is, adding microphone audio to the
   * recordings.
   */
  private audioInputChannels = [1, 2, 3];

  /**
   * Array of input devices we are including in the source. This is not an
   * array of all the devices we know about.
   */
  private audioInputDevices: IInput[] = [];

  /**
   * Gets toggled if push to talk is enabled and when the hotkey for push to
   * talk is held down.
   */
  private inputDevicesMuted = false;

  /**
   * Some arbritrarily chosen channel numbers we can use for adding output
   * devices to the OBS scene. That is, adding speaker audio to the
   * recordings.
   */
  private audioOutputChannels = [4, 5, 6, 7, 8];

  /**
   * Array of output devices we are including in the source. This is not an
   * array of all the devices we know about.
   */
  private audioOutputDevices: IInput[] = [];

  /**
   * Some arbritrarily chosen channel numbers we can use for adding process
   * capture devices to the OBS scene. That is, adding application audio to the
   * recordings.
   */
  private audioProcessChannels = [9, 10, 11, 12, 13];

  /**
   * Array of process capture devices we are including in the source. This is
   * not an array of all the devices we know about.
   */
  private audioProcessDevices: IInput[] = [];

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
   * Name we use to create and reference the preview display.
   */
  private previewName = 'preview';

  /**
   * Has the preview been created yet.
   */
  private previewCreated = false;

  /**
   * Exists across a reconfigure.
   */
  private previewLocation: TPreviewPosition = {
    width: 0,
    height: 0,
    xPos: 0,
    yPos: 0,
  };

  /**
   * Volmeters are used to monitor the audio levels of an input source. We
   * keep a list of them here as we need a volmeter per audio source, and
   * it's handy to have a list for cleaning them up.
   */
  private volmeters: osn.IVolmeter[] = [];

  /**
   * Faders are used to modify the volume of an input source. We keep a list
   * of them here as we need a fader per audio source so it's handy to have a
   * list for cleaning them up.
   */
  private faders: IFader[] = [];

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
   * The video context.
   */
  private context: osn.IVideo;

  /**
   * Sensible defaults for the video context.
   */
  private defaultVideoContext: osn.IVideoInfo = {
    fpsNum: 60,
    fpsDen: 1,
    baseWidth: 1920,
    baseHeight: 1080,
    outputWidth: 1920,
    outputHeight: 1080,

    // Bit of a mess here to keep typescript happy and make this readable.
    // See https://github.com/stream-labs/obs-studio-node/issues/1260.
    outputFormat: EVideoFormat.NV12 as unknown as osn.EVideoFormat,
    colorspace: EColorSpace.CS709 as unknown as osn.EColorSpace,
    scaleType: EScaleType.Bicubic as unknown as osn.EScaleType,
    fpsType: EFPSType.Fractional as unknown as osn.EFPSType,

    // The AMD encoder causes recordings to get much darker if using the full
    // color range setting. So swap that to partial here. See Issue 446.
    range: ERangeType.Partial as unknown as osn.ERangeType,
  };

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
    this.context = osn.VideoFactory.create();
    this.context.video = this.defaultVideoContext;

    // We create all the sources we might need to use here, as the source API
    // provided by OSN provides mechanisms for retrieving valid settings; it's
    // useful to always be able to access them even if we never enable the sources.
    this.windowCaptureSource = osn.InputFactory.create(
      'window_capture',
      'WCR Window Capture',
    );

    this.gameCaptureSource = osn.InputFactory.create(
      'game_capture',
      'WCR Game Capture',
    );

    this.monitorCaptureSource = osn.InputFactory.create(
      'monitor_capture',
      'WCR Monitor Capture',
    );

    this.dummyWindowCaptureSource = osn.InputFactory.create(
      'window_capture',
      'WCR Dummy Window Capture',
    );

    this.dummyGameCaptureSource = osn.InputFactory.create(
      'game_capture',
      'WCR Dummy Game Capture',
    );

    // In theory having this created so early isn't required, but may as well
    // and avoid a bunch of undefined checks. We will reconfigure it as required.
    this.overlayImageSource = osn.InputFactory.create(
      'image_source',
      'WCR Chat Overlay',
      { file: getAssetPath('poster', 'chat-cover.png') },
    );

    // Connects the signal handler, we get feedback from OBS by way of
    // signals, so this is how we know it's doing the right thing after
    // we ask it to start/stop.
    osn.NodeObs.OBS_service_connectOutputSignals((s: osn.EOutputSignal) => {
      this.handleSignal(s);
    });

    // The source callback is OBS's way of informing us of changes to the
    // sources. Used for dynamic resizing.
    osn.NodeObs.RegisterSourceCallback((d: ObsSourceCallbackInfo[]) => {
      this.handleSourceCallback(d);
    });

    // The volmeter callback is OBS's way of communicating the state of audio
    // sources. Used for monitoring audio levels.
    osn.NodeObs.RegisterVolmeterCallback((d: ObsVolmeterCallbackInfo[]) => {
      this.handleVolmeterCallback(d);
    });

    // The scene is an OBS construct that holds the sources, think of it as a
    // blank canvas we can add sources to. We could create it later but we can
    // once again avoid a bunch of undefined checks by doing it here.
    this.scene = osn.SceneFactory.create('WCR Scene');
    osn.Global.setOutputSource(this.videoChannel, this.scene);

    // It might seem a bit weird that we add all the sources, but we disable
    // them all by default. That way we can avoid undefined checks on all the
    // variables set here, as we need the scene item references for scaling.
    this.windowCaptureSceneItem = this.scene.add(this.windowCaptureSource);
    this.gameCaptureSceneItem = this.scene.add(this.gameCaptureSource);
    this.monitorCaptureSceneItem = this.scene.add(this.monitorCaptureSource);
    this.overlayImageSceneItem = this.scene.add(this.overlayImageSource);
  }

  /**
   * Publicly accessible method to start recording, handles all the gory internals
   * to make sure we only attempt one recorder action at once, and to handle if OBS
   * misbehaves.
   */
  public async start() {
    console.info('[Recorder] Queued start');
    const { resolveHelper, rejectHelper, promise } = deferredPromiseHelper();

    this.actionQueue.enqueue(async () => {
      try {
        await this.startOBS();
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
  public async stop() {
    console.info('[Recorder] Queued stop');
    const { resolveHelper, rejectHelper, promise } = deferredPromiseHelper();

    this.actionQueue.enqueue(async () => {
      try {
        await this.stopOBS();
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
   * Force stop OBS. This drops the current recording and stops OBS. The
   * resulting MP4 may be malformed and should not be used.
   */
  public async forceStop() {
    console.info('[Recorder] Queued force stop');
    const { resolveHelper, rejectHelper, promise } = deferredPromiseHelper();

    this.actionQueue.enqueue(async () => {
      try {
        await this.forceStopOBS();
        resolveHelper(null);
      } catch (error) {
        console.error('[Recorder] Crash on force stop call', String(error));

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

    this.obsPath = obsPath;
    await Recorder.createRecordingDirs(this.obsPath);
    this.cleanup();
    this.resolution = obsOutputResolution as keyof typeof obsResolutions;
    const { height, width } = obsResolutions[this.resolution];

    const videoInfo: osn.IVideoInfo = {
      fpsNum: obsFPS,
      fpsDen: 1,
      baseWidth: width,
      baseHeight: height,
      outputWidth: width,
      outputHeight: height,

      // Bit of a mess here to keep typescript happy and make this readable.
      // See https://github.com/stream-labs/obs-studio-node/issues/1260.
      outputFormat: EVideoFormat.NV12 as unknown as osn.EVideoFormat,
      colorspace: EColorSpace.CS709 as unknown as osn.EColorSpace,
      scaleType: EScaleType.Bicubic as unknown as osn.EScaleType,
      fpsType: EFPSType.Fractional as unknown as osn.EFPSType,

      // The AMD encoder causes recordings to get much darker if using the full
      // color range setting. So swap that to partial here. See Issue 446.
      range: ERangeType.Partial as unknown as osn.ERangeType,
    };

    if (
      videoInfo.fpsNum !== this.context.video.fpsNum ||
      videoInfo.baseWidth !== this.context.video.baseWidth ||
      videoInfo.baseHeight !== this.context.video.baseHeight ||
      videoInfo.outputWidth !== this.context.video.outputWidth ||
      videoInfo.outputHeight !== this.context.video.outputHeight
    ) {
      // There are dragons here. This looks simple but it's not and I think
      // assigning this context is the source of a bug where we can timeout
      // on reconfiguring. I spent ages trying to solve it in June 2025 but
      // gave up in. Cowardly only assign it if something has changed to avoid
      // any risk in the case where nothing has changed.
      console.info('[Recorder] Reconfigure OBS video context');
      this.context.video = videoInfo;
    }

    const outputPath = path.normalize(this.obsPath);

    Recorder.applySetting('Output', 'Mode', 'Advanced');
    Recorder.applySetting('Output', 'RecFilePath', outputPath);
    Recorder.applySetting('Output', 'RecEncoder', obsRecEncoder);
    Recorder.applySetting('Output', 'RecFormat', 'mp4');

    // Specify a 1 sec interval for the I-frames. This allows us to round to
    // the nearest second later when cutting and always land on a keyframe.
    //   - This is part of the strategy to avoid re-encoding the videos while
    //     enabling a reasonable cutting accuracy.
    //   - We won't ever be off by more than 0.5 sec with this approach, which
    //     I think is an acceptable error.
    //   - Obviously this is a trade off in file size, where the default keyframe
    //     interval appears to be around 4s.
    Recorder.applySetting('Output', 'Reckeyint_sec', 1);

    // We set the CPQ or CRF value here. Low value is higher quality, and
    // vice versa. The limits on what this can actually be set to I took
    // from what OBS studio allows and is annotated below, but we don't
    // go to the extremes of the allowed range anyway.
    const cqp = Recorder.getCqpFromQuality(obsQuality, obsRecEncoder);

    switch (obsRecEncoder) {
      case ESupportedEncoders.OBS_X264:
        // CRF and CPQ are so similar in configuration that we can just treat
        // the CRF configuration the same as CQP configuration.
        Recorder.applySetting('Output', 'Recrate_control', 'CRF');
        Recorder.applySetting('Output', 'Reccrf', cqp);
        break;

      case ESupportedEncoders.AMD_AMF_H264:
      case ESupportedEncoders.JIM_NVENC:
      case ESupportedEncoders.JIM_AV1_NVENC:
      case ESupportedEncoders.AMD_AMF_AV1:
        // These settings are identical for AMD and NVENC encoders.
        Recorder.applySetting('Output', 'Recrate_control', 'CQP');
        Recorder.applySetting('Output', 'Reccqp', cqp);
        break;

      default:
        console.error('[Recorder] Unrecognised encoder type', obsRecEncoder);
        throw new Error('Unrecognised encoder type');
    }
  }

  /**
   * Configures the video source in OBS.
   */
  public configureVideoSources(config: ObsVideoConfig, isWowRunning: boolean) {
    const { obsCaptureMode, monitorIndex, captureCursor } = config;
    this.clearFindWindowInterval();

    [
      this.windowCaptureSource,
      this.gameCaptureSource,
      this.monitorCaptureSource,
      this.overlayImageSource,
    ].forEach((src) => {
      src.enabled = false;
    });

    if (obsCaptureMode === 'monitor_capture') {
      // We don't care if WoW is running or not for monitor capture.
      this.configureMonitorCaptureSource(monitorIndex);
    }

    if (!isWowRunning) {
      // Don't try to configure game or window capture sources if WoW isn't
      // running. We won't be able to find them.
      console.info("[Recorder] WoW isn't running");
    } else {
      console.info('[Recorder] WoW is running');

      if (obsCaptureMode === 'game_capture') {
        this.configureGameCaptureSource(captureCursor);
      } else if (obsCaptureMode === 'window_capture') {
        this.configureWindowCaptureSource(captureCursor);
      }
    }

    const overlayCfg = getOverlayConfig(this.cfg);
    this.configureOverlayImageSource(overlayCfg);
  }

  /**
   * Hides the scene preview.
   */
  public hidePreview() {
    // I'd love to make OBS_content_destroyDisplay work here but I've not managed
    // so far. This is a hack to "hide" it by moving it off screen.
    this.previewLocation.xPos = 50000;
    this.previewLocation.yPos = 50000;

    osn.NodeObs.OBS_content_moveDisplay(
      this.previewName,
      this.previewLocation.xPos,
      this.previewLocation.yPos,
    );
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

    this.overlayImageSceneItem.position = {
      x: chatOverlayXPosition,
      y: chatOverlayYPosition,
    };

    this.overlayImageSceneItem.scale = {
      x: chatOverlayScale,
      y: chatOverlayScale,
    };

    this.overlayImageSceneItem.crop = {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    };

    const { settings } = this.overlayImageSource;
    settings.file = chatOverlayOwnImagePath;

    this.overlayImageSource.update(settings);
    this.overlayImageSource.save();
    this.overlayImageSource.enabled = true;
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

    // This is the height of the default chat overlay image, a bit ugly
    // to have it hardcoded here, but whatever.
    const baseWidth = 5000;
    const baseHeight = 2000;

    const toCropX = (baseWidth - chatOverlayWidth) / 2;
    const toCropY = (baseHeight - chatOverlayHeight) / 2;

    const { settings } = this.overlayImageSource;
    settings.file = getAssetPath('poster', 'chat-cover.png');

    this.overlayImageSceneItem.position = {
      x: chatOverlayXPosition,
      y: chatOverlayYPosition,
    };

    this.overlayImageSceneItem.scale = {
      x: chatOverlayScale,
      y: chatOverlayScale,
    };

    this.overlayImageSceneItem.crop = {
      left: toCropX,
      right: toCropX,
      top: toCropY,
      bottom: toCropY,
    };

    this.overlayImageSource.update(settings);
    this.overlayImageSource.save();
    this.overlayImageSource.enabled = true;
  }

  /**
   * Add the configured audio sources to the OBS scene. This is public
   * so it can be called externally when WoW is opened.
   */
  public configureAudioSources(config: ObsAudioConfig) {
    this.removeAudioSources();
    uIOhook.removeAllListeners();

    const {
      audioInputDevices,
      audioOutputDevices,
      audioProcessDevices,
      micVolume,
      speakerVolume,
      processVolume,
      obsForceMono,
      obsAudioSuppression,
    } = config;

    audioInputDevices
      .split(',')
      .filter((id) => id)
      .forEach((id, idx) => {
        console.info('[Recorder] Adding input source', id, idx);

        const obsSource = this.createOBSAudioSource(
          id,
          idx,
          TAudioSourceType.input,
        );

        const obsVolmeter = osn.VolmeterFactory.create(0);
        obsVolmeter.attach(obsSource);

        const micFader = osn.FaderFactory.create(0);
        micFader.attach(obsSource);
        micFader.mul = micVolume;

        if (obsAudioSuppression) {
          const filter = osn.FilterFactory.create(
            'noise_suppress_filter_v2',
            'filter',
            { method: 'rnnoise', suppress_level: -30, intensity: 1 },
          );

          obsSource.addFilter(filter);
        }

        this.volmeters.push(obsVolmeter);
        this.faders.push(micFader);
        this.audioInputDevices.push(obsSource);
      });

    if (this.audioInputDevices.length > this.audioInputChannels.length) {
      console.warn(
        '[Recorder] Too many audio input devices, configuring first',
        this.audioInputChannels.length,
      );

      this.audioInputDevices = this.audioInputDevices.slice(
        0,
        this.audioInputChannels.length,
      );
    }

    if (this.audioInputDevices.length !== 0 && config.pushToTalk) {
      this.obsMicState = MicStatus.MUTED;
      this.emit('state-change');
    } else if (this.audioInputDevices.length !== 0) {
      this.obsMicState = MicStatus.LISTENING;
      this.emit('state-change');
    }

    this.audioInputDevices.forEach((device) => {
      const index = this.audioInputDevices.indexOf(device);
      const channel = this.audioInputChannels[index];

      if (obsForceMono) {
        device.flags = ESourceFlags.ForceMono;
      }

      this.addAudioSource(device, channel);
    });

    if (config.pushToTalk) {
      this.audioInputDevices.forEach((device) => {
        device.muted = true;
      });

      this.inputDevicesMuted = true;

      const pttHandler = (
        fn: () => void,
        event: UiohookKeyboardEvent | UiohookMouseEvent,
      ) => {
        const convertedEvent = convertUioHookEvent(event);

        if (isPushToTalkHotkey(config, convertedEvent)) {
          fn();
        }
      };

      /* eslint-disable prettier/prettier */
      uIOhook.on('keydown', (e) => pttHandler(() => this.unmuteInputDevices(), e));
      uIOhook.on('keyup', (e) => pttHandler(() => this.muteInputDevices(), e));
      uIOhook.on('mousedown', (e) => pttHandler(() => this.unmuteInputDevices(), e));
      uIOhook.on('mouseup', (e) => pttHandler(() => this.muteInputDevices(), e));
      /* eslint-enable prettier/prettier */
    }

    audioOutputDevices
      .split(',')
      .filter((id) => id)
      .forEach((id, idx) => {
        console.info('[Recorder] Adding output source', id);

        const obsSource = this.createOBSAudioSource(
          id,
          idx,
          TAudioSourceType.output,
        );

        const obsVolmeter = osn.VolmeterFactory.create(0);
        obsVolmeter.attach(obsSource);

        const speakerFader = osn.FaderFactory.create(0);
        speakerFader.attach(obsSource);
        speakerFader.mul = speakerVolume;

        this.faders.push(speakerFader);
        this.volmeters.push(obsVolmeter);
        this.audioOutputDevices.push(obsSource);
      });

    if (this.audioOutputDevices.length > this.audioOutputChannels.length) {
      console.warn(
        '[Recorder] Too many audio output devices, configuring first',
        this.audioOutputChannels.length,
      );

      this.audioOutputDevices = this.audioOutputDevices.slice(
        0,
        this.audioOutputChannels.length,
      );
    }

    this.audioOutputDevices.forEach((device) => {
      const index = this.audioOutputDevices.indexOf(device);
      const channel = this.audioOutputChannels[index];
      this.addAudioSource(device, channel);
    });

    audioProcessDevices
      .map((source) => source.value)
      .forEach((value, idx) => {
        console.info('[Recorder] Adding app capture source', value);

        const obsSource = this.createOBSAudioSource(
          value,
          idx,
          TAudioSourceType.process,
        );

        const obsVolmeter = osn.VolmeterFactory.create(0);
        obsVolmeter.attach(obsSource);

        const processFader = osn.FaderFactory.create(0);
        processFader.attach(obsSource);
        processFader.mul = processVolume;

        this.volmeters.push(obsVolmeter);
        this.faders.push(processFader);
        this.audioProcessDevices.push(obsSource);
      });

    if (this.audioProcessDevices.length > this.audioProcessChannels.length) {
      console.warn(
        '[Recorder] Too many audio process devices, configuring first',
        this.audioProcessChannels.length,
      );

      this.audioProcessDevices = this.audioProcessDevices.slice(
        0,
        this.audioProcessChannels.length,
      );
    }

    this.audioProcessDevices.forEach((device) => {
      const index = this.audioProcessDevices.indexOf(device);
      const channel = this.audioProcessChannels[index];
      this.addAudioSource(device, channel);
    });
  }

  /**
   * Remove all audio sources from the OBS scene. This is public
   * so it can be called externally when WoW is closed.
   */
  public removeAudioSources() {
    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    console.info('[Recorder] Removing OBS audio sources...');

    this.volmeters.forEach((volmeter, index) => {
      console.info('[Recorder] Release fader', index);
      volmeter.detach();

      console.info('[Recorder] Destroy fader', index);
      volmeter.destroy();
    });

    this.faders.forEach((fader, index) => {
      console.info('[Recorder] Detach fader', index);
      fader.detach();

      console.info('[Recorder] Destroy fader', index);
      fader.destroy();
    });

    this.volmeters = [];
    this.faders = [];

    this.audioInputDevices.forEach((device, idx) => {
      const channel = this.audioInputChannels[idx];
      this.removeAudioSource(device, channel);
    });

    this.audioOutputDevices.forEach((device, idx) => {
      const channel = this.audioOutputChannels[idx];
      this.removeAudioSource(device, channel);
    });

    this.audioProcessDevices.forEach((device, idx) => {
      const channel = this.audioProcessChannels[idx];
      this.removeAudioSource(device, channel);
    });

    this.audioInputDevices = [];
    this.audioOutputDevices = [];
    this.audioProcessDevices = [];

    this.obsMicState = MicStatus.NONE;
    this.emit('state-change');
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

    // Important to avoid us trying to restart OBS while shutting down / quitting.
    this.obsState = ERecordingState.Offline;

    this.clearFindWindowInterval();

    [
      this.windowCaptureSource,
      this.gameCaptureSource,
      this.monitorCaptureSource,
      this.overlayImageSource,
      this.dummyWindowCaptureSource,
      this.dummyGameCaptureSource,
    ].forEach((src) => {
      src.release();
    });

    [this.wroteQueue, this.startQueue].forEach((queue) => {
      queue.empty();
      queue.clearListeners();
    });

    this.context.destroy();

    try {
      osn.NodeObs.InitShutdownSequence();
      osn.NodeObs.RemoveSourceCallback();
      osn.NodeObs.RemoveVolmeterCallback();
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
   * Get a list of the audio input devices. Used by the settings to populate
   * the list of devices for user selection.
   */
  public getInputAudioDevices() {
    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    const inputDevices =
      osn.NodeObs.OBS_settings_getInputAudioDevices() as IOBSDevice[];

    return inputDevices;
  }

  /**
   * Get a list of the audio output devices. Used by the settings to populate
   * the list of devices for user selection.
   */
  public getOutputAudioDevices() {
    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    const outputDevices =
      osn.NodeObs.OBS_settings_getOutputAudioDevices() as IOBSDevice[];

    return outputDevices;
  }

  /**
   * Return an array of all the windows for audio process capture available to OBS.
   */
  public getProcessAudioDevices(): {
    name: string; // Display name.
    value: string | number; // Value to configure OBS with.
  }[] {
    console.info('[Recorder] Getting available windows for audio capture');

    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    const src = osn.InputFactory.create(
      TAudioSourceType.process,
      'WCR Dummy Process Audio Source',
    );

    let prop = src.properties.first();

    while (prop && prop.name !== 'window') {
      prop = prop.next();
    }

    const windows = [];

    if (prop.name === 'window' && Recorder.isObsListProperty(prop)) {
      const unique = Array.from(
        new Map(prop.details.items.map((item) => [item.value, item])).values(),
      );

      windows.push(...unique);
    }

    src.release();
    return windows;
  }

  /**
   * Return an array of all the encoders available to OBS.
   */
  public getAvailableEncoders(): string[] {
    console.info('[Recorder] Getting available encoders');

    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    const encoders = Recorder.getAvailableValues(
      'Output',
      'Recording',
      'RecEncoder',
    );

    console.info('[Recorder]', encoders);
    return encoders;
  }

  /**
   * Show the scene preview on the UI, taking the location and dimensions as
   * input.
   */
  public showPreview(
    width: number,
    height: number,
    xPos: number,
    yPos: number,
  ) {
    if (!this.previewCreated) {
      osn.NodeObs.OBS_content_createSourcePreviewDisplay(
        this.mainWindow.getNativeWindowHandle(),
        this.scene.name,
        this.previewName,
      );

      osn.NodeObs.OBS_content_resizeDisplay(this.previewName, 0, 0);

      // This is just setting the preview background to black, and something
      // to do with the padding which I can't quite remember what.
      osn.NodeObs.OBS_content_setShouldDrawUI(this.previewName, false);
      osn.NodeObs.OBS_content_setPaddingSize(this.previewName, 0);
      osn.NodeObs.OBS_content_setPaddingColor(this.previewName, 0, 0, 0);
    }

    this.previewLocation = { width, height, xPos, yPos };
    osn.NodeObs.OBS_content_resizeDisplay(this.previewName, width, height);
    osn.NodeObs.OBS_content_moveDisplay(this.previewName, xPos, yPos);
  }

  /**
   * Show the preview on the UI, only if we already know the location and
   * dimensions.
   */
  public showPreviewMemory() {
    if (this.previewLocation !== undefined) {
      const { width, height, xPos, yPos } = this.previewLocation;
      this.showPreview(width, height, xPos, yPos);
    }
  }

  /**
   * Clean-up the recording directory.
   * @params Number of files to leave.
   */
  public async cleanup(filesToLeave = 3) {
    console.info('[Recorder] Clean out buffer', filesToLeave);

    if (!this.obsPath) {
      console.info('[Recorder] Not attempting to clean-up');
      return;
    }

    // Sort newest to oldest
    const sortedBufferVideos = await getSortedVideos(this.obsPath);
    if (!sortedBufferVideos || sortedBufferVideos.length === 0) return;
    const videosToDelete = sortedBufferVideos.slice(filesToLeave);

    const deletePromises = videosToDelete.map(async (video) => {
      await tryUnlink(video.name);
    });

    await Promise.all(deletePromises);
  }

  /**
   * Start OBS, no-op if already started.
   */
  private async startOBS() {
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
    osn.NodeObs.OBS_service_startRecording();

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
   * Stop OBS, no-op if already stopped.
   */
  private async stopOBS() {
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
    osn.NodeObs.OBS_service_stopRecording();
    const wrote = this.wroteQueue.shift();

    try {
      await Promise.race([wrote, getPromiseBomb(60, 'OBS timeout on stop')]);
      this.lastFile = osn.NodeObs.OBS_service_getLastRecording();
      console.info('[Recorder] Set last file:', this.lastFile);
    } catch (error) {
      console.error('[Recorder] Error stopping OBS', error);
      await this.forceStopOBS(wrote);
    }
  }

  /**
   * Force stop OBS, no-op if already stopped. Optionally pass in a wrote
   * promise to await instead of shifting from the queue ourselves. That's
   * useful in the case we've failed to stop and are now force stopping.
   */
  private async forceStopOBS(
    wrote: Promise<osn.EOutputSignal> | undefined = undefined,
  ) {
    console.info('[Recorder] Force stop');

    if (!this.obsInitialized) {
      console.error('[Recorder] OBS not initialized');
      throw new Error('OBS not initialized');
    }

    if (this.obsState === ERecordingState.Offline) {
      console.info('[Recorder] Already stopped');
      return;
    }

    this.wroteQueue.empty();
    osn.NodeObs.OBS_service_stopRecordingForce();

    // If we were passed a wrote promise, use that instead of shifting from
    // the queue as a previously created promise will get the result first.
    wrote = wrote || this.wroteQueue.shift();
    const bomb = getPromiseBomb(3, 'OBS timeout on force stop');
    await Promise.race([wrote, bomb]);
    this.lastFile = null;
  }

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

    try {
      osn.NodeObs.IPC.host(this.uuid);

      osn.NodeObs.SetWorkingDirectory(
        fixPathWhenPackaged(
          path.join(__dirname, '../../', 'node_modules', 'obs-studio-node'),
        ),
      );

      const initResult = osn.NodeObs.OBS_API_initAPI(
        'en-US',
        fixPathWhenPackaged(path.join(path.normalize(__dirname), 'osn-data')),
        '1.0.0',
        '',
      );

      if (initResult !== 0) {
        throw new Error(
          `OBS process initialization failed with code ${initResult}`,
        );
      }
    } catch (e) {
      throw new Error(`Exception when initializing OBS process: ${e}`);
    }

    this.obsInitialized = true;
    console.info('[Recorder] OBS initialized successfully');
  }

  /**
   * Handle a signal from OBS.
   */
  private handleSignal(obsSignal: osn.EOutputSignal) {
    console.info('[Recorder] Got signal:', obsSignal);

    if (obsSignal.type !== 'recording') {
      console.info('[Recorder] No action needed on this signal');
      return;
    }

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
    if (obsSignal.code !== 0 && obsSignal.signal === 'wrote') {
      console.error('[Recorder] Non-zero wrote signal');

      const crashData: CrashData = {
        date: new Date(),
        reason: obsSignal.error,
      };

      this.emit('crash', crashData);
      return;
    }

    switch (obsSignal.signal) {
      case EOBSOutputSignal.Start:
        this.startQueue.push(obsSignal);
        this.obsState = ERecordingState.Recording;
        break;

      case EOBSOutputSignal.Starting:
        this.obsState = ERecordingState.Starting;
        break;

      case EOBSOutputSignal.Stop:
        this.obsState = ERecordingState.Offline;
        break;

      case EOBSOutputSignal.Stopping:
        this.obsState = ERecordingState.Stopping;
        break;

      case EOBSOutputSignal.Wrote:
        this.wroteQueue.push(obsSignal);
        break;

      case EOBSOutputSignal.WriteError:
        this.emit('crash', {
          date: new Date(),
          reason: obsSignal.error,
        });
        return;

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
  private configureWindowCaptureSource(captureCursor: boolean) {
    console.info('[Recorder] Configuring OBS for Window Capture');

    this.findWindowInterval = setInterval(
      () => this.tryAttachWindowCaptureSource(captureCursor),
      this.findWindowIntervalDuration,
    );

    // Call immediately to avoid the first interval delay. Will clear
    // the interval if it is successful. Common case is that WoW has
    // been open for a while and this immediately succeeds.
    this.tryAttachWindowCaptureSource(captureCursor);
  }

  /**
   * Configures the game capture source.
   */
  private configureGameCaptureSource(captureCursor: boolean) {
    console.info('[Recorder] Configuring OBS for Game Capture');

    this.findWindowInterval = setInterval(
      () => this.tryAttachGameCaptureSource(captureCursor),
      this.findWindowIntervalDuration,
    );

    // Call immediately to avoid the first interval delay. Will clear
    // the interval if it is successful. Common case is that WoW has
    // been open for a while and this immediately succeeds.
    this.tryAttachGameCaptureSource(captureCursor);
  }

  /**
   * Creates a monitor capture source. Monitor capture always shows the cursor.
   */
  private configureMonitorCaptureSource(monitorIndex: number) {
    console.info('[Recorder] Configuring OBS for Monitor Capture');
    let prop = this.monitorCaptureSource.properties.first();

    while (prop && prop.name !== 'monitor_id') {
      prop = prop.next();
    }

    const { settings } = this.monitorCaptureSource;
    settings.compatibility = false;
    settings.force_sdr = false;

    if (prop.name === 'monitor_id' && Recorder.isObsListProperty(prop)) {
      // An "Auto" option appears as the first thing here so make sure we
      // don't select that; the frontend doesn't expect it and we end up
      // having multiple indexes corresponding to a single monitor.
      const filtered = prop.details.items.filter(
        (item) => item.value !== 'Auto',
      );

      if (filtered[monitorIndex]) {
        // The monitor selected is present so use it.
        settings.monitor_id = filtered[monitorIndex].value as string;
      } else {
        // Default to use the first monitor if index is undefined.
        console.warn('[Recorder] Monitor', monitorIndex, 'not found');
        settings.monitor_id = filtered[0].value as string;
      }
    }

    this.monitorCaptureSource.update(settings);
    this.monitorCaptureSource.save();
    this.monitorCaptureSource.enabled = true;

    // Rescale now we're hooked in-case the resolutions don't match. Usually
    // I'd expect us to get a source callback but sometimes it doesn't seem
    // to happen.
    this.scaleVideoSourceSize();
  }

  /**
   * Configure the chat overlay image source.
   */
  public configureOverlayImageSource(config: ObsOverlayConfig) {
    const { chatOverlayEnabled, chatOverlayOwnImage } = config;
    console.info('[Recorder] Configure image source for chat overlay');

    if (!chatOverlayEnabled) {
      this.overlayImageSource.enabled = false;
    } else if (chatOverlayOwnImage && this.cfg.get('cloudStorage')) {
      this.configureOwnOverlay(config);
    } else {
      this.configureDefaultOverlay(config);
    }
  }

  /**
   * Add a single audio source to the OBS scene.
   */
  private addAudioSource(obsInput: IInput, channel: number) {
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

    osn.Global.setOutputSource(channel, obsInput);
  }

  /**
   * Remove a single audio source from the OBS scene.
   */
  private removeAudioSource(source: IInput, channel: number) {
    if (!this.obsInitialized) {
      throw new Error('OBS not initialized');
    }

    console.info(
      '[Recorder] Removing OBS audio source',
      source.name,
      source.id,
    );

    osn.Global.setOutputSource(channel, null as unknown as ISource);
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
      name = `WCR App Source ${idx}`;
    } else {
      // Programmer error, should never happen.
      throw new Error('Invalid audio source type');
    }

    const settings = TAudioSourceType.process
      ? // Priority 2: "Match title, otherwise find window of same executable".
        { window: id, priority: 2 }
      : { device_id: id };

    return osn.InputFactory.create(type, name, settings);
  }

  /**
   * Watch the video input source for size changes, and rescale to fill the
   * canvas.
   */
  private scaleVideoSourceSize() {
    let src;
    let item;

    if (this.windowCaptureSource.enabled) {
      src = this.windowCaptureSource;
      item = this.windowCaptureSceneItem;
    } else if (this.gameCaptureSource.enabled) {
      src = this.gameCaptureSource;
      item = this.gameCaptureSceneItem;
    } else if (this.monitorCaptureSource.enabled) {
      src = this.monitorCaptureSource;
      item = this.monitorCaptureSceneItem;
    } else {
      // No log here as as may be frequent.
      return;
    }

    if (src.width === 0 || src.height === 0) {
      // This happens often, suspect it's before OBS gets a hook into a game
      // capture process.
      return;
    }

    const { width, height } = obsResolutions[this.resolution];

    const newScaleFactor = {
      x: width / src.width,
      y: height / src.height,
    };

    const closeEnough =
      Math.round(item.scale.x * 100) / 100 ===
        Math.round(newScaleFactor.x * 100) / 100 &&
      Math.round(item.scale.y * 100) / 100 ===
        Math.round(newScaleFactor.y * 100) / 100;

    if (closeEnough) {
      // Don't rescale if things are within a rounding error. I think the
      // OSN library does some internal rounding and we don't want to spam
      // trigger rescaling when it isn't required. See Issue 586.
      return;
    }

    console.info('[Recorder] Rescaling from', item.scale, 'to', newScaleFactor);
    item.scale = newScaleFactor;
  }

  /**
   * Mute the mic audio sources.
   */
  private muteInputDevices() {
    if (this.inputDevicesMuted) {
      return;
    }

    this.audioInputDevices.forEach((device) => {
      device.muted = true;
    });

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

    this.audioInputDevices.forEach((device) => {
      device.muted = false;
    });

    this.inputDevicesMuted = false;
    this.obsMicState = MicStatus.LISTENING;
    this.emit('state-change');
  }

  /**
   * Convert the quality setting to an appropriate CQP/CRF value based on encoder type.
   */
  private static getCqpFromQuality(obsQuality: string, encoder: string) {
    if (
      encoder === ESupportedEncoders.JIM_AV1_NVENC ||
      encoder === ESupportedEncoders.AMD_AMF_AV1
    ) {
      // AV1 typically needs lower CQP values for similar quality
      switch (obsQuality) {
        case QualityPresets.ULTRA:
          return 20;
        case QualityPresets.HIGH:
          return 24;
        case QualityPresets.MODERATE:
          return 28;
        case QualityPresets.LOW:
          return 32;
        default:
          console.error('[Recorder] Unrecognised quality', obsQuality);
          throw new Error('Unrecognised quality');
      }
    }

    // Original values for x264 CRF and other encoders' CQP
    switch (obsQuality) {
      case QualityPresets.ULTRA:
        return 22;
      case QualityPresets.HIGH:
        return 26;
      case QualityPresets.MODERATE:
        return 30;
      case QualityPresets.LOW:
        return 34;
      default:
        console.error('[Recorder] Unrecognised quality', obsQuality);
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

    let old;
    const settings = osn.NodeObs.OBS_settings_getSettings(category).data;

    settings.forEach((subcategory: ISettingsSubCategory) => {
      subcategory.parameters.forEach((param: IObsInput<TObsValue>) => {
        if (param.name === parameter) {
          old = param.currentValue;
          param.currentValue = value;
        }
      });
    });

    if (value !== old) {
      osn.NodeObs.OBS_settings_saveSettings(category, settings);
    }
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

    const categorySettings =
      osn.NodeObs.OBS_settings_getSettings(category).data;

    if (!categorySettings) {
      throw new Error(`No category found: ${category}`);
    }

    const subcategorySettings = categorySettings.find(
      (sub: ISettingsSubCategory) => sub.nameSubCategory === subcategory,
    );

    if (!subcategorySettings) {
      throw new Error(`No subcategory found: ${subcategory} in ${category}`);
    }

    const parameterSettings = subcategorySettings.parameters.find(
      (param: IObsInput<TObsValue>) => param.name === parameter,
    );

    if (!parameterSettings) {
      throw new Error(
        `No parameter found: ${parameter} in ${category} -> ${subcategory}`,
      );
    }

    return parameterSettings.values.map(
      (value: TObsValue) => Object.values(value)[0],
    );
  }

  /**
   * Type guard for an OBS list property.
   */
  private static isObsListProperty(
    property: osn.IProperty,
  ): property is osn.IListProperty {
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
   * Find a window appropriate for capture by the provided source. This
   * is logically the same and can be used for both Window and Game capture
   * modes.
   */
  private static findWowWindow(src: IInput) {
    // The source properties are cached by OSN, so update an irrelevant
    // setting to force a refresh. This refreshes the window list within
    // the properties object.
    //
    // This relies on some internals of OSN which update the cache to
    // refresh on calling the update function. See "osn::ISource::Update"
    // in isource.cpp for more details.
    const { settings } = src;
    settings.refresh = uuidv4();
    src.update(settings);

    let prop = src.properties.first();

    while (prop && prop.name !== 'window') {
      prop = prop.next();
    }

    if (prop.name !== 'window' || !Recorder.isObsListProperty(prop)) {
      console.warn('[Recorder] Did not find window property');
      return undefined;
    }

    const items = prop.details.items;
    const match = items.find(Recorder.windowMatch);

    if (!match) {
      return undefined;
    }

    const window = String(match.value);
    console.info('[Recorder] Found a match:', window);
    return window;
  }

  /**
   * Try to attach to a game capture source for WoW. If the window is not
   * found, do nothing.
   */
  private tryAttachGameCaptureSource(captureCursor: boolean) {
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

    let window = undefined;

    try {
      window = Recorder.findWowWindow(this.dummyGameCaptureSource);
    } catch (ex) {
      console.error('[Recorder] Exception when trying to find window:', ex);
    }

    if (!window) {
      console.info('[Recorder] Game capture window not found, will retry');
      return;
    }

    console.info('[Recorder] Game capture window found', window);

    const { settings } = this.gameCaptureSource;
    settings.capture_mode = 'window';
    settings.allow_transparency = false;
    settings.priority = 1;
    settings.capture_cursor = captureCursor;
    settings.window = window;

    this.gameCaptureSource.update(settings);
    this.gameCaptureSource.save();
    this.gameCaptureSource.enabled = true;

    console.info('[Recorder] Game capture source configured');
    this.clearFindWindowInterval();

    // Rescale now we're hooked in-case the resolutions don't match. Usually
    // I'd expect us to get a source callback but sometimes it doesn't seem
    // to happen.
    this.scaleVideoSourceSize();
  }

  /**
   * Try to attach to a window capture source for WoW. If the window is not
   * found, do nothing.
   */
  private tryAttachWindowCaptureSource(captureCursor: boolean) {
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

    const window = Recorder.findWowWindow(this.dummyWindowCaptureSource);

    if (!window) {
      console.info('[Recorder] Window capture window not found, will retry');
      return;
    }

    console.info('[Recorder] Window capture window found', window);

    // This corresponds to Windows Graphics Capture. The other mode "BITBLT" doesn't seem to work and
    // captures behind the WoW window. Not sure why, some googling suggested Windows theme issues.
    // See https://github.com/obsproject/obs-studio/blob/master/plugins/win-capture/window-capture.c#L70.
    const { settings } = this.windowCaptureSource;
    settings.method = 2;
    settings.cursor = captureCursor;
    settings.window = window;

    this.windowCaptureSource.update(settings);
    this.windowCaptureSource.save();
    this.windowCaptureSource.enabled = true;

    console.info('[Recorder] Window capture source configured');
    this.clearFindWindowInterval();

    // Rescale now we're hooked in-case the resolutions don't match. Usually
    // I'd expect us to get a source callback but sometimes it doesn't seem
    // to happen.
    this.scaleVideoSourceSize();
  }
}
