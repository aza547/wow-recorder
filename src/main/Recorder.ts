import { BrowserWindow, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import * as osn from 'obs-studio-node';
import { isEqual } from 'lodash';
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
  ObsVideoConfig,
  TAudioSourceType,
  TObsValue,
  TPreviewPosition,
} from './types';
import ConfigService from './ConfigService';
import { obsResolutions } from './constants';
import { getOverlayConfig } from '../utils/configUtils';

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
  private uuid: string = uuidfn();

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
   * The image source to be used for the overlay, we create this
   * ahead of time regardless of if the user has the overlay enabled.
   */
  private overlayImageSource: IInput;

  /**
   * Resolution selected by the user in settings. Defaults to 1920x1080 for
   * no good reason other than avoiding undefined. It quickly gets set to
   * what the user configured.
   */
  private resolution: keyof typeof obsResolutions = '1920x1080';

  /**
   * Timer object for checking the size of the game window and rescaling if
   * required.
   */
  private videoSourceSizeInterval?: NodeJS.Timer;

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
  public lastFile: string = '';

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
      'WCR Window Capture'
    );

    this.gameCaptureSource = osn.InputFactory.create(
      'game_capture',
      'WCR Game Capture'
    );

    this.monitorCaptureSource = osn.InputFactory.create(
      'monitor_capture',
      'WCR Monitor Capture'
    );

    // In theory having this created so early isn't required, but may as well
    // and avoid a bunch of undefined checks. We will reconfigure it as required.
    this.overlayImageSource = osn.InputFactory.create(
      'image_source',
      'WCR Chat Overlay',
      { file: getAssetPath('poster', 'chat-cover.png') }
    );

    // Connects the signal handler, we get feedback from OBS by way of
    // signals, so this is how we know it's doing the right thing after
    // we ask it to start/stop.
    osn.NodeObs.OBS_service_connectOutputSignals((s: osn.EOutputSignal) => {
      this.handleSignal(s);
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

    this.context.video = videoInfo;
    const outputPath = path.normalize(this.obsPath);

    Recorder.applySetting('Output', 'Mode', 'Advanced');
    Recorder.applySetting('Output', 'RecFilePath', outputPath);
    Recorder.applySetting('Output', 'RecEncoder', obsRecEncoder);
    Recorder.applySetting('Output', 'RecFormat', 'mp4');

    // We set the CPQ or CRF value here. Low value is higher quality, and
    // vice versa. The limits on what this can actually be set to I took
    // from what OBS studio allows and is annotated below, but we don't
    // go to the extremes of the allowed range anyway.
    const cqp = Recorder.getCqpFromQuality(obsQuality);

    switch (obsRecEncoder) {
      case ESupportedEncoders.OBS_X264:
        // CRF and CPQ are so similar in configuration that we can just treat
        // the CRF configuration the same as CQP configuration.
        Recorder.applySetting('Output', 'Recrate_control', 'CRF');
        Recorder.applySetting('Output', 'Reccrf', cqp);
        break;

      case ESupportedEncoders.AMD_AMF_H264:
      case ESupportedEncoders.JIM_NVENC:
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
  public configureVideoSources(config: ObsVideoConfig) {
    const { obsCaptureMode, monitorIndex, captureCursor } = config;

    [
      this.windowCaptureSource,
      this.gameCaptureSource,
      this.monitorCaptureSource,
      this.overlayImageSource,
    ].forEach((src) => {
      src.enabled = false;
    });

    if (obsCaptureMode === 'monitor_capture') {
      this.configureMonitorCaptureSource(monitorIndex);
    } else if (obsCaptureMode === 'game_capture') {
      this.configureGameCaptureSource(captureCursor);
    } else if (obsCaptureMode === 'window_capture') {
      this.configureWindowCaptureSource(captureCursor);
    } else {
      throw new Error(`[Recorder] Unexpected mode: ${obsCaptureMode}`);
    }

    const overlayCfg = getOverlayConfig(this.cfg);
    this.configureOverlayImageSource(overlayCfg);
    this.watchVideoSourceSize();
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
      this.previewLocation.yPos
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
      micVolume,
      speakerVolume,
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
          TAudioSourceType.input
        );

        const micFader = osn.FaderFactory.create(0);
        micFader.attach(obsSource);
        micFader.mul = micVolume;
        this.faders.push(micFader);

        if (obsAudioSuppression) {
          const filter = osn.FilterFactory.create(
            'noise_suppress_filter_v2',
            'filter',
            { method: 'rnnoise', suppress_level: -30, intensity: 1 }
          );

          obsSource.addFilter(filter);
        }

        this.audioInputDevices.push(obsSource);
      });

    if (this.audioInputDevices.length > this.audioInputChannels.length) {
      console.warn(
        '[Recorder] Too many audio input devices, configuring first',
        this.audioInputChannels.length
      );

      this.audioInputDevices = this.audioInputDevices.slice(
        0,
        this.audioInputChannels.length
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
        event: UiohookKeyboardEvent | UiohookMouseEvent
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
          TAudioSourceType.output
        );

        const speakerFader = osn.FaderFactory.create(0);
        speakerFader.attach(obsSource);
        speakerFader.mul = speakerVolume;
        this.faders.push(speakerFader);
        this.audioOutputDevices.push(obsSource);
      });

    if (this.audioOutputDevices.length > this.audioOutputChannels.length) {
      console.warn(
        '[Recorder] Too many audio output devices, configuring first',
        this.audioOutputChannels.length
      );

      this.audioOutputDevices = this.audioOutputDevices.slice(
        0,
        this.audioOutputChannels.length
      );
    }

    this.audioOutputDevices.forEach((device) => {
      const index = this.audioOutputDevices.indexOf(device);
      const channel = this.audioOutputChannels[index];
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

    this.faders.forEach((fader) => {
      fader.detach();
      fader.destroy();
    });

    this.faders = [];

    this.audioInputDevices.forEach((device, idx) => {
      const channel = this.audioInputChannels[idx];
      this.removeAudioSource(device, channel);
    });

    this.audioOutputDevices.forEach((device, idx) => {
      const channel = this.audioOutputChannels[idx];
      this.removeAudioSource(device, channel);
    });

    this.audioInputDevices = [];
    this.audioOutputDevices = [];

    this.obsMicState = MicStatus.NONE;
    this.emit('state-change');
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

    if (this.videoSourceSizeInterval) {
      clearInterval(this.videoSourceSizeInterval);
    }

    [
      this.windowCaptureSource,
      this.gameCaptureSource,
      this.monitorCaptureSource,
      this.overlayImageSource,
    ].forEach((src) => {
      src.release();
    });

    [this.wroteQueue, this.startQueue].forEach((queue) => {
      queue.empty();
      queue.clearListeners();
    });

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
   * Get a list of the audio input devices. Used by the settings to populate
   * the list of devices for user selection.
   */
  public getInputAudioDevices() {
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
  public getOutputAudioDevices() {
    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    const outputDevices =
      osn.NodeObs.OBS_settings_getOutputAudioDevices() as IOBSDevice[];

    return outputDevices.filter((v) => v.id !== 'default');
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
      'RecEncoder'
    );

    console.info('[Recorder]', encoders);
    return encoders;
  }

  /**
   * Show the scene preview on the UI, taking the location and dimensions as
   * input. We scale to match the monitor scaling here too else the preview
   * will be misplaced (see issue 397).
   */
  public showPreview(
    width: number,
    height: number,
    xPos: number,
    yPos: number
  ) {
    if (!this.previewCreated) {
      osn.NodeObs.OBS_content_createSourcePreviewDisplay(
        this.mainWindow.getNativeWindowHandle(),
        this.scene.name,
        this.previewName
      );

      osn.NodeObs.OBS_content_resizeDisplay(this.previewName, 0, 0);

      // This is just setting the preview background to black, and something
      // to do with the padding which I can't quite remember what.
      osn.NodeObs.OBS_content_setShouldDrawUI(this.previewName, false);
      osn.NodeObs.OBS_content_setPaddingSize(this.previewName, 0);
      osn.NodeObs.OBS_content_setPaddingColor(this.previewName, 0, 0, 0);
    }

    const winBounds = this.mainWindow.getBounds();

    const currentScreen = screen.getDisplayNearestPoint({
      x: winBounds.x,
      y: winBounds.y,
    });

    const { scaleFactor } = currentScreen;
    this.previewLocation = { width, height, xPos, yPos };

    osn.NodeObs.OBS_content_resizeDisplay(
      this.previewName,
      width * scaleFactor,
      height * scaleFactor
    );

    osn.NodeObs.OBS_content_moveDisplay(
      this.previewName,
      xPos * scaleFactor,
      yPos * scaleFactor
    );
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
    osn.NodeObs.OBS_service_startRecording();

    // Wait up to 30 seconds for OBS to signal it has started recording,
    // really this shouldn't take nearly as long.
    await Promise.race([
      this.startQueue.shift(),
      getPromiseBomb(30000, 'OBS timeout waiting for start'),
    ]);

    this.startQueue.empty();
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

    osn.NodeObs.OBS_service_stopRecording();

    // Wait up to 60 seconds for OBS to signal it has wrote the file, really
    // this shouldn't take nearly as long as this but we're generous to account
    // for slow HDDs etc.
    await Promise.race([
      this.wroteQueue.shift(),
      getPromiseBomb(60000, '[Recorder] OBS timeout waiting for video file'),
    ]);

    this.wroteQueue.empty();
    this.lastFile = osn.NodeObs.OBS_service_getLastRecording();
    console.info('[Recorder] Got last file from OBS:', this.lastFile);
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
   * Creates a game capture source.
   */
  private configureGameCaptureSource(captureCursor: boolean) {
    console.info('[Recorder] Configuring OBS for Game Capture');

    // This is the name of the retail window, we fall back to this
    // if we don't find something in the game capture source.
    let window = 'World of Warcraft:waApplication Window:Wow.exe';

    // Search the game capture source for WoW options.
    let prop = this.gameCaptureSource.properties.first();

    while (prop && prop.name !== 'window') {
      prop = prop.next();
    }

    if (prop.name === 'window' && Recorder.isObsListProperty(prop)) {
      // Filter the WoW windows, and reverse sort them alphabetically. This
      // is deliberate so that "waApplication" wins over the legacy "gxWindowClass".
      const windows = prop.details.items
        .filter(Recorder.windowMatch)
        .sort()
        .reverse();

      if (windows.length) {
        window = windows[0].value as string;
      }
    }

    const { settings } = this.gameCaptureSource;
    settings.capture_mode = 'window';
    settings.allow_transparency = true;
    settings.priority = 1;
    settings.capture_cursor = captureCursor;
    settings.window = window;

    this.gameCaptureSource.update(settings);
    this.gameCaptureSource.save();
    this.gameCaptureSource.enabled = true;
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
    settings.orce_sdr = false;

    if (prop.name === 'monitor_id' && Recorder.isObsListProperty(prop)) {
      // An "Auto" option appears as the first thing here so make sure we
      // don't select that; the frontend doesn't expect it and we end up
      // having multiple indexes corresponding to a single monitor.
      const filtered = prop.details.items.filter(
        (item) => item.value !== 'Auto'
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
  }

  /**
   * Creates a window capture source. In TWW, the retail and classic Window names
   * diverged slightly, so while this was previously a hardcoded string, now we
   * search for it in the OSN sources API.
   */
  private configureWindowCaptureSource(captureCursor: boolean) {
    console.info('[Recorder] Configuring OBS for Window Capture');

    // This is the name of the retail window, we fall back to this
    // if we don't find something in the window capture source.
    let window = 'World of Warcraft:waApplication Window:Wow.exe';

    // Search the game capture source for WoW options.
    let prop = this.windowCaptureSource.properties.first();

    while (prop && prop.name !== 'window') {
      prop = prop.next();
    }

    if (prop.name === 'window' && Recorder.isObsListProperty(prop)) {
      // Filter the WoW windows, and reverse sort them alphabetically. This
      // is deliberate so that "waApplication" wins over the legacy "gxWindowClass".
      const windows = prop.details.items
        .filter(Recorder.windowMatch)
        .sort()
        .reverse();

      if (windows.length) {
        window = windows[0].value as string;
      }
    }

    // This corresponds to Windows Graphics Capture. The other mode "BITBLT" doesn't seem to work and
    // captures behind the WoW window. Not sure why, some googling suggested Windows theme issues.
    // See https://github.com/obsproject/obs-studio/blob/master/plugins/win-capture/window-capture.c#L70.
    const { settings } = this.windowCaptureSource;
    settings.method = 2;
    settings.cursor = captureCursor;
    settings.window = window;

    this.windowCaptureSource.update(settings);
    this.windowCaptureSource.save();

    // Enable the source which is what actually makes it show up in the scene.
    this.windowCaptureSource.enabled = true;
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
      obsInput.id
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
      source.id
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
    type: TAudioSourceType
  ) {
    console.info('[Recorder] Creating OBS audio source', id, idx, type);

    if (!this.obsInitialized) {
      throw new Error('[Recorder] OBS not initialized');
    }

    const name =
      type === TAudioSourceType.input
        ? `WCR Mic Source ${idx}`
        : `WCR Speaker Source ${idx}`;

    return osn.InputFactory.create(type, name, { device_id: id });
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
    }, 2000);
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
      console.error('[Recorder] No video source to scale');
      return;
    }

    if (src.width === 0 || src.height === 0) {
      // This happens often, suspect it's before OBS gets a hook into a game
      // capture process.
      return;
    }

    const { width, height } = obsResolutions[this.resolution];
    const xScaleFactor = Math.round((width / src.width) * 100) / 100;
    const yScaleFactor = Math.round((height / src.height) * 100) / 100;
    const newScaleFactor = { x: xScaleFactor, y: yScaleFactor };

    if (isEqual(item.scale, newScaleFactor)) {
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
   * Convert the quality setting to an appropriate CQP value.
   */
  private static getCqpFromQuality(obsQuality: string) {
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
    value: string | number
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
    parameter: string
  ) {
    console.info(
      '[Recorder] Get available values for',
      category,
      subcategory,
      parameter
    );

    const categorySettings =
      osn.NodeObs.OBS_settings_getSettings(category).data;

    if (!categorySettings) {
      throw new Error(`No category found: ${category}`);
    }

    const subcategorySettings = categorySettings.find(
      (sub: ISettingsSubCategory) => sub.nameSubCategory === subcategory
    );

    if (!subcategorySettings) {
      throw new Error(`No subcategory found: ${subcategory} in ${category}`);
    }

    const parameterSettings = subcategorySettings.parameters.find(
      (param: IObsInput<TObsValue>) => param.name === parameter
    );

    if (!parameterSettings) {
      throw new Error(
        `No parameter found: ${parameter} in ${category} -> ${subcategory}`
      );
    }

    return parameterSettings.values.map(
      (value: TObsValue) => Object.values(value)[0]
    );
  }

  /**
   * Type guard for an OBS list property.
   */
  private static isObsListProperty(
    property: osn.IProperty
  ): property is osn.IListProperty {
    return property.type === 6;
  }

  /**
   * Check if the name of the window matches one of the known WoW window names.
   */
  private static windowMatch(item: { name: string; value: string | number }) {
    const englishMatch = item.name.includes('[Wow.exe]: World of Warcraft');
    const chineseMatch = item.name.includes('[Wow.exe]: 魔兽世界');
    return englishMatch || chineseMatch;
  }
}
