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
import {
  CaptureMode,
  EOBSOutputSignal,
  ERecordingState,
  ESupportedEncoders,
  QualityPresets,
} from './obsEnums';
import {
  deferredPromiseHelper,
  fixPathWhenPackaged,
  getAssetPath,
  isPushToTalkHotkey,
  convertUioHookEvent,
  tryUnlink,
  getPromiseBomb,
  takeOwnershipBufferDir,
  exists,
  emitErrorReport,
  getSortedFiles,
} from './util';
import {
  AudioSource,
  AudioSourceType,
  BaseConfig,
  MicStatus,
  ObsAudioConfig,
  ObsOverlayConfig,
  ObsVideoConfig,
  VideoSourceName,
  SceneItem,
  FileSortDirection,
  ObsOrderMovement,
} from './types';
import { getOBSAudioSourceType } from './obsAudioSourceTypes';
import ConfigService from '../config/ConfigService';
import { obsResolutions } from './constants';
import {
  getObsAudioConfig,
  getObsVideoConfig,
  getOverlayConfig,
} from '../utils/configUtils';

import noobs, {
  ObsData,
  SceneItemPosition,
  Signal,
  SourceDimensions,
} from 'noobs';

import { getNativeWindowHandle, send } from './main';
import { app, ipcMain } from 'electron';
import Poller from 'utils/Poller';
import AsyncQueue from 'utils/AsyncQueue';
import assert from 'assert';
import { isHighRes } from 'renderer/rendererutils';
import { isLinux } from './platform';

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
   * Singleton instance.
   */
  private static instance: Recorder;

  /**
   * Singleton instance accessor.
   */
  public static getInstance() {
    if (!this.instance) this.instance = new this();
    return this.instance;
  }

  /**
   * ConfigService instance.
   */
  private cfg = ConfigService.getInstance();

  /**
   * Timer for latching onto a window for either game capture or
   * window capture. Often this does not appear immediately on
   * the WoW process starting.
   */
  private findWindowTimer?: NodeJS.Timeout;

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
   * Resolution selected by the user in settings.
   */
  private resolution: keyof typeof obsResolutions = this.cfg.get<string>(
    'obsOutputResolution',
  ) as keyof typeof obsResolutions;

  /**
   * Active audio sources.
   */
  private audioSources: AudioSource[] = [];

  /**
   * Gets toggled if push to talk is enabled and when the hotkey for push to
   * talk is held down.
   */
  private inputDevicesMuted = false;

  /**
   * WaitQueue object for storing signalling from OBS. We only care about
   * start signals here which indicate the recording has started.
   */
  private startQueue = new WaitQueue<Signal>();

  /**
   * WaitQueue object for storing signalling from OBS. We only care about
   * deactivate signals here which indicate the OBS output has deactivated.
   */
  private stopQueue = new WaitQueue<Signal>();

  /**
   * The state of the recorder, typically used to tell if OBS is recording
   * or not.
   */
  public obsState = ERecordingState.None;

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
   * Action queue, used to ensure we do not make concurrent stop/start
   * requests to OBS. That's complication we can do without.
   */
  private queue = new AsyncQueue(Number.MAX_SAFE_INTEGER);

  /**
   * The last file output by OBS.
   */
  public lastFile: string | null = null;

  /**
   * Timer that keeps the mic on briefly after you release the Push To Talk key.
   */
  private pttReleaseDelayTimer?: NodeJS.Timeout;

  /**
   * Timer to debounce the saving of the game capture position or scale changing.
   */
  private gamePosDebounceTimer?: NodeJS.Timeout;

  /**
   * Timer to debounce the saving of the overlay position or scale changing.
   */
  private overlayPosDebounceTimer?: NodeJS.Timeout;

  private captureMode = CaptureMode.NONE;

  private captureSource?: string;

  private overlaySource?: string;

  private chatOverlayDefaultImage = getAssetPath('poster', 'chat-overlay.png');

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private pushToTalkKeyListener = (e: UiohookKeyboardEvent) => {};

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private pushToTalkMouseListener = (e: UiohookMouseEvent) => {};

  /**
   * Constructor.
   */
  private constructor() {
    console.info('[Recorder] Constructing recorder');
    super();
    this.setupListeners();
  }

  private setupListeners() {
    ipcMain.on('reconfigureVideo', () => {
      console.info('[Recorder] Video source reconfigure');
      const cfg = getObsVideoConfig(this.cfg);
      this.configureVideoSources(cfg);
    });

    ipcMain.on('reconfigureAudio', () => {
      console.info('[Recorder] Audio source reconfigure');
      const cfg = getObsAudioConfig(this.cfg);
      this.configureAudioSources(cfg);
    });

    ipcMain.on('reconfigureOverlay', () => {
      console.info('[Recorder] Overlay source reconfigure');
      const overlayCfg = getOverlayConfig(this.cfg);
      this.configureOverlayImageSource(overlayCfg);
    });

    ipcMain.on('reselectPipewireSource', () => {
      console.info('[Recorder] Reselecting Pipewire source');
      // Invalidate the restore token
      this.cfg.set('pipewireRestoreToken', null);
      // Re-trigger video configuration
      const cfg = getObsVideoConfig(this.cfg);
      this.configureVideoSources(cfg);
    });

    /**
     * Callback to attach the audio devices. This is called when the user
     * opens the audio settings so that the volmeter bars can be populated.
     */
    ipcMain.handle('audioSettingsOpen', async () => {
      console.info('[Manager] Audio settings were opened');
      noobs.SetVolmeterEnabled(true);

      if (Poller.getInstance().isWowRunning()) {
        console.info('[Manager] Wont touch audio sources as WoW is running');
        return;
      }

      const config = getObsAudioConfig(this.cfg);
      this.configureAudioSources(config);
    });

    ipcMain.handle('audioSettingsClosed', () => {
      console.info('[Manager] Audio settings were closed');
      noobs.SetVolmeterEnabled(false);

      if (Poller.getInstance().isWowRunning()) {
        console.info('[Manager] Wont touch audio sources as WoW is running');
        return;
      }

      this.removeAudioSources();
    });

    ipcMain.handle('getDisplayInfo', () => {
      return this.getDisplayInfo();
    });

    ipcMain.handle('getSourcePosition', (_event, item: SceneItem) => {
      return this.getSourcePosition(item);
    });

    ipcMain.on(
      'setSourcePosition',
      (
        event,
        item: SceneItem,
        target: {
          x: number;
          y: number;
          width: number;
          height: number;
          cropLeft: number;
          cropRight: number;
          cropTop: number;
          cropBottom: number;
        },
      ) => {
        const src =
          item === SceneItem.OVERLAY ? this.overlaySource : this.captureSource;
        if (!src) return;
        this.setSourcePosition(src, target);
        // Don't need to redraw here, frontend handles this for us.
      },
    );

    ipcMain.on('resetSourcePosition', (_event, item: SceneItem) => {
      const src =
        item === SceneItem.OVERLAY ? this.overlaySource : this.captureSource;
      if (!src) return;
      this.resetSourcePosition(src);
      setTimeout(() => send('redrawPreview'), 100);
    });

    ipcMain.handle(
      'createAudioSource',
      (event, id: string, type: AudioSourceType) => {
        const obsType = getOBSAudioSourceType(type);
        console.info('[Manager] Creating audio source', id, 'of type', obsType);
        const name = noobs.CreateSource(id, obsType);

        // set MatchPriority to 1 (app name first) for Linux Pipewire app capture
        if (isLinux && type === AudioSourceType.PROCESS) {
          const settings = noobs.GetSourceSettings(name);
          settings['CaptureMode'] = 0; // CAPTURE_MODE_SINGLE
          // No, 'Priorty' is not a typo, here...
          // https://github.com/dimtpap/obs-pipewire-audio-capture/blob/2eb74267393f352256bb97295facf4c62870ff45/src/pipewire-audio-capture-app.c#L72
          settings['MatchPriorty'] = 1; // MATCH_PRIORITY_APP_NAME
          noobs.SetSourceSettings(name, settings);
        }
        console.info('[Manager] Created audio source', name);
        noobs.AddSourceToScene(name);
        return name;
      },
    );

    ipcMain.handle('getAudioSourceProperties', (_event, id: string) => {
      console.info('[Manager] Getting audio source properties for', id);
      return noobs.GetSourceProperties(id);
    });

    ipcMain.on('deleteAudioSource', (_event, id: string) => {
      console.info('[Manager] Deleting audio source', id);
      noobs.DeleteSource(id);
    });

    ipcMain.on('setAudioSourceDevice', (_event, id: string, value: string) => {
      console.info(
        '[Manager] Setting audio device for source',
        id,
        'to',
        value,
      );
      const settings = noobs.GetSourceSettings(id);
      settings['device_id'] = value;
      noobs.SetSourceSettings(id, settings);
    });

    ipcMain.on('setAudioSourceWindow', (_event, id: string, value: string) => {
      console.info(
        '[Manager] Setting audio window for source',
        id,
        'to',
        value,
      );
      const settings = noobs.GetSourceSettings(id);

      if (isLinux) {
        settings['TargetName'] = value;
        settings['CaptureMode'] = 0; // CAPTURE_MODE_SINGLE
        // No, 'Priorty' is not a typo, here...
        // https://github.com/dimtpap/obs-pipewire-audio-capture/blob/2eb74267393f352256bb97295facf4c62870ff45/src/pipewire-audio-capture-app.c#L72
        settings['MatchPriorty'] = 1; // MATCH_PRIORITY_APP_NAME
      } else {
        settings['window'] = value;
        settings['priority'] = 2; // Executable matching
      }
      noobs.SetSourceSettings(id, settings);
    });

    ipcMain.on('setAudioSourceVolume', (_event, id: string, value: number) => {
      console.info(
        '[Manager] Setting audio volume for source',
        id,
        'to',
        value,
      );
      noobs.SetSourceVolume(id, value);
    });

    ipcMain.on('setForceMono', (_event, enabled: boolean) => {
      console.info('[Manager] Setting force mono to', enabled);
      noobs.SetForceMono(enabled);
    });

    ipcMain.on('setAudioSuppression', (_event, enabled: boolean) => {
      console.info('[Manager] Setting audio suppression to', enabled);
      noobs.SetAudioSuppression(enabled);
    });

    ipcMain.on(
      'configurePreview',
      (_event, x: number, y: number, width: number, height: number) => {
        this.configurePreview(x, y, width, height);
        setTimeout(() => send('redrawPreview'), 100);
      },
    );

    ipcMain.on('showPreview', () => {
      this.showPreview();
    });

    ipcMain.on('hidePreview', () => {
      this.hidePreview();
    });

    ipcMain.on('disablePreview', () => {
      this.disablePreview();
    });

    // Encoder listener, to populate settings on the frontend.
    ipcMain.handle('getEncoders', (): string[] => {
      const obsEncoders = this.getAvailableEncoders().filter(
        (encoder) => encoder !== 'none',
      );

      return obsEncoders;
    });

    ipcMain.handle('getSensibleEncoderDefault', (): string => {
      return this.getSensibleEncoderDefault();
    });
  }

  /**
   * Publicly accessible method to start recording, handles all the gory internals
   * to make sure we only attempt one recorder action at once, and to handle if OBS
   * misbehaves.
   */
  public async startBuffer() {
    console.info('[Recorder] Queued start buffer');
    const { resolveHelper, rejectHelper, promise } = deferredPromiseHelper();

    const task = async () => {
      try {
        await this.startObsBuffer();
        resolveHelper(null);
      } catch (error) {
        console.error('[Recorder] Error on starting buffer', String(error));
        emitErrorReport(error);
        rejectHelper(error);
      }
    };

    this.queue.add(task);
    await promise;
  }

  /**
   * Publicly accessible method to start recording, handles all the gory internals
   * to make sure we only attempt one recorder action at once, and to handle if OBS
   * misbehaves.
   */
  public async startRecording(offset: number) {
    console.info('[Recorder] Queued start recording');
    const { resolveHelper, rejectHelper, promise } = deferredPromiseHelper();

    const task = async () => {
      try {
        await this.convertObsBuffer(offset);
        resolveHelper(null);
      } catch (error) {
        console.error('[Recorder] Error on starting recording', String(error));
        emitErrorReport(error);
        rejectHelper(error);
      }
    };

    this.queue.add(task);
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

    const task = async () => {
      try {
        await this.stopObsRecording();
        resolveHelper(null);
      } catch (error) {
        console.error('[Recorder] Error on stop', String(error));
        emitErrorReport(error);
        rejectHelper(error);
      }
    };

    this.queue.add(task);
    await promise;
  }

  /**
   * Publicly accessible method to stop recording, handles all the gory internals
   * to make sure we only attempt one recorder action at once, and to handle if OBS
   * misbehaves.
   */
  public async forceStop(timeout: boolean) {
    console.info('[Recorder] Queued force stop');
    const { resolveHelper, rejectHelper, promise } = deferredPromiseHelper();

    const task = async () => {
      try {
        await this.forceStopOBS(timeout);
        resolveHelper(null);
      } catch (error) {
        console.error('[Recorder] Error on force stop', String(error));
        emitErrorReport(error);
        rejectHelper(error);
      }
    };

    this.queue.add(task);
    await promise;
  }

  /**
   * Configures OBS. This does a bunch of things that we need the
   * user to have setup their config for, which is why it's split out.
   */
  public async configureBase(config: BaseConfig, startup: boolean) {

    const { obsFPS, obsRecEncoder, obsQuality, obsOutputResolution, obsPath } =
      config;

    if (this.obsState !== ERecordingState.None) {
      console.error('[Recorder] OBS must be offline to reconfigure base');
      throw new Error('[Recorder] OBS must be offline to reconfigure base');
    }

    this.resolution = obsOutputResolution as keyof typeof obsResolutions;
    const { height, width } = obsResolutions[this.resolution];
    console.info('[Recorder] Configure OBS video context');

    const canvas = noobs.GetPreviewInfo();
    noobs.ResetVideoContext(obsFPS, width, height);

    const { canvasHeight, canvasWidth } = canvas;
    const changedResolution = canvasHeight !== height || canvasWidth !== width;

    if (changedResolution && !startup) {
      // Noobs defaults to 1920x1080, so if at a different resolution, this
      // will be hit on startup. Changing canvas size causes libobs to auto-scale
      // the existing sources. So reconfigure the video sources if the resolution
      // has changed to undo that. We avoid this branch on startup as we will
      // reconfigure the video sources anyway.
      console.info('[Recorder] Resolution changed, reconfig video sources');
      const cfg = getObsVideoConfig(this.cfg);
      this.configureVideoSources(cfg);
    }

    const outputPath = path.normalize(obsPath);
    await Recorder.createRecordingDirs(outputPath);
    await this.cleanup(outputPath);

    // Record in MKV to avoid file corruption on crashes. MP4 cannot be
    // recovered in that event but MKV can. We will remux to MP4 for browser
    // player compatibility in the VideoProcessQueue.
    console.info('[Recorder] Set recording directory', outputPath);
    noobs.SetRecordingCfg(outputPath, 'mkv');

    // Configure the encoder. It's possible that a user has replaced their
    // GPU since we last ran, so double check the encoder is still valid.
    let encoder = obsRecEncoder;

    if (!this.getAvailableEncoders().includes(obsRecEncoder)) {
      // If the encoder is not valid, then default to something sensible and
      // save that in the config as if it were first time setup.
      console.warn('[Recorder] Encoder not available', obsRecEncoder);
      encoder = this.getSensibleEncoderDefault();
      this.cfg.set('obsRecEncoder', encoder);
    }

    const settings = Recorder.getEncoderSettings(encoder, obsQuality);
    noobs.SetVideoEncoder(encoder, settings);
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

      case ESupportedEncoders.AMD_H264:
      case ESupportedEncoders.AMD_AV1:
      case ESupportedEncoders.NVENC_H264:
      case ESupportedEncoders.NVENC_AV1:
      case ESupportedEncoders.QSV_H264:
      case ESupportedEncoders.QSV_AV1:
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
  public configureVideoSources(config: ObsVideoConfig) {
    const { obsCaptureMode } = config;
    this.clearFindWindowInterval();

    if (this.captureSource) {
      console.info(
        '[Recorder] Removing existing capture source',
        this.captureSource,
      );

      noobs.RemoveSourceFromScene(this.captureSource);
      noobs.DeleteSource(this.captureSource);
      this.captureSource = undefined;
      this.captureMode = CaptureMode.NONE;
    }

    if (obsCaptureMode === 'monitor_capture') {
      // sanity: shouldn't get here on linux, but noobs will crash if we do
      if (isLinux) {
        console.warn('[Recorder] Attempted to select monitor capture on Linux');
        return;
      }
      this.configureMonitorCaptureSource(config);
    } else if (obsCaptureMode === 'game_capture') {
      // sanity: shouldn't get here on linux, but noobs will crash if we do
      if (isLinux) {
          console.warn('[Recorder] Attempted to select game capture on Linux');
          return;
        }
      this.configureGameCaptureSource(config);
    } else if (obsCaptureMode === 'window_capture') {
      if (isLinux) {
        setTimeout(() => {
          // pipewire will trigger the portal again if the same restore token is used too
          // soon after a previous session ends
          this.configurePipeWireCaptureSource(config);
        }, 100);
      } else {
        this.configureWindowCaptureSource(config);
      }
    } else {
      console.error('[Recorder] Unrecognised capture mode', obsCaptureMode);
      throw new Error('Unrecognised capture mode');
    }

    const wowRunning = Poller.getInstance().isWowRunning();

    if (wowRunning && obsCaptureMode !== 'monitor_capture') {
      this.attachCaptureSource();
    }

    const overlayCfg = getOverlayConfig(this.cfg);
    this.configureOverlayImageSource(overlayCfg);
  }

  /**
   * Configure and add the chat overlay to the scene.
   */
  private async configureOwnOverlay(config: ObsOverlayConfig) {
    console.info('[Recorder] Configure own image as chat overlay');

    if (!this.overlaySource) {
      console.error('[Recorder] No existing overlay source');
      throw new Error('No existing overlay source');
    }

    const {
      chatOverlayScale,
      chatOverlayXPosition,
      chatOverlayYPosition,
      chatOverlayOwnImagePath,
    } = config;

    const settings = noobs.GetSourceSettings(this.overlaySource);

    noobs.SetSourceSettings(this.overlaySource, {
      ...settings,
      file: chatOverlayOwnImagePath,
    });

    console.info('[Recorder] Setting overlay file path:', chatOverlayOwnImagePath);

    noobs.AddSourceToScene(this.overlaySource);

    noobs.SetSourcePos(this.overlaySource, {
      x: chatOverlayXPosition,
      y: chatOverlayYPosition,
      scaleX: chatOverlayScale,
      scaleY: chatOverlayScale,
      cropLeft: config.chatOverlayCropX,
      cropRight: config.chatOverlayCropX,
      cropTop: config.chatOverlayCropY,
      cropBottom: config.chatOverlayCropY,
    });

    // ensure the chat overlay is on top
    noobs.SetSceneItemOrder(this.overlaySource, ObsOrderMovement.OBS_ORDER_MOVE_TOP);
  }

  /**
   * Configure and add the default chat overlay to the scene.
   */
  private configureDefaultOverlay(config: ObsOverlayConfig) {
    console.info('[Recorder] Configure default image as chat overlay');

    if (!this.overlaySource) {
      console.error('[Recorder] No existing overlay source');
      throw new Error('No existing overlay source');
    }

    const { chatOverlayXPosition, chatOverlayYPosition, chatOverlayScale } =
      config;

    const settings = noobs.GetSourceSettings(this.overlaySource);

    noobs.SetSourceSettings(this.overlaySource, {
      ...settings,
      file: this.chatOverlayDefaultImage,
    });

    noobs.AddSourceToScene(this.overlaySource);

    noobs.SetSourcePos(this.overlaySource, {
      x: chatOverlayXPosition,
      y: chatOverlayYPosition,
      scaleX: chatOverlayScale,
      scaleY: chatOverlayScale,
      cropLeft: config.chatOverlayCropX,
      cropRight: config.chatOverlayCropX,
      cropTop: config.chatOverlayCropY,
      cropBottom: config.chatOverlayCropY,
    });

    // ensure the chat overlay is on top
    noobs.SetSceneItemOrder(this.overlaySource, ObsOrderMovement.OBS_ORDER_MOVE_TOP);
  }

  /**
   * Add the configured audio sources to the OBS scene. This is public
   * so it can be called externally when WoW is opened.
   */
  public configureAudioSources(config: ObsAudioConfig) {
    this.removeAudioSources();

    console.info('[Recorder] Configure audio sources');

    // Can't release all the listeners here as we now use
    // uIOhook for triggering manual recording too.
    uIOhook.off('keydown', this.pushToTalkKeyListener);
    uIOhook.off('keyup', this.pushToTalkKeyListener);
    uIOhook.off('mousedown', this.pushToTalkMouseListener);
    uIOhook.off('mouseup', this.pushToTalkMouseListener);

    noobs.SetForceMono(config.obsForceMono);
    noobs.SetAudioSuppression(config.obsAudioSuppression);

    config.audioSources.forEach((src) => {
      const obsType = getOBSAudioSourceType(src.type);

      console.info('[Recorder] Create audio source', src.id, 'for type', obsType);
      const name = noobs.CreateSource(src.id, obsType);
      const settings = noobs.GetSourceSettings(name);

      if (src.type === AudioSourceType.PROCESS && src.device) {
        if (isLinux) {
          settings['TargetName'] = src.device;
          settings['CaptureMode'] = 0; // CAPTURE_MODE_SINGLE
          // No, 'Priorty' is not a typo, here...
          // https://github.com/dimtpap/obs-pipewire-audio-capture/blob/2eb74267393f352256bb97295facf4c62870ff45/src/pipewire-audio-capture-app.c#L72
          settings['MatchPriorty'] = 1; // MATCH_PRIORITY_APP_NAME
        } else {
          settings['window'] = src.device;
          settings['priority'] = 2; // Executable matching
        }
        
        noobs.SetSourceSettings(name, settings);
      } else if (src.type !== AudioSourceType.PROCESS) {
        const properties = noobs.GetSourceProperties(name);
        const available = properties.find((prop) => prop.name === 'device_id');
        assert(available && available.type === 'list'); // To help the compiler out.

        // Try to match by device ID.
        let match = available.items.find((d) => d.value === src.device);

        if (!match) {
          // Fallback to matching by name if we didn't find an ID match.
          // Suspect this can happen on replugging devices.
          console.info('[Recorder] Fallback to matching audio device by name');
          match = available.items.find((d) => d.name === src.friendly);

          if (!match) {
            // Still no match after looking at both ID and friendly name,
            // so give up trying to configure this source.
            console.warn(
              '[Recorder] Failed to configure audio device',
              src,
              available.items,
            );
            return;
          }

          // Correct the device ID in the config.
          console.info(
            '[Recorder] Fix up audio device ID from',
            src.device,
            'to',
            match.value,
          );

          src.device = match.value;
          this.cfg.set('audioSources', config.audioSources);
        }

        // Finish configuring the source.
        settings['device_id'] = match.value;
        noobs.SetSourceSettings(name, settings);
        noobs.SetSourceVolume(name, src.volume);
      } else {
        // Can happen if a user adds an app source but never selects a window.
        console.warn('[Recorder] Unable to configure audio source', src);
      }

      noobs.AddSourceToScene(name);
      this.audioSources.push(src);
    });

    const mics = this.audioSources.filter(
      (src) => src.type === AudioSourceType.INPUT,
    );

    if (mics.length !== 0 && config.pushToTalk) {
      this.obsMicState = MicStatus.MUTED;
      this.emit('state-change');
    } else if (mics.length !== 0) {
      this.obsMicState = MicStatus.LISTENING;
      this.emit('state-change');
    }

    if (config.pushToTalk) {
      this.inputDevicesMuted = true;

      this.pushToTalkKeyListener = (e: UiohookKeyboardEvent) =>
        this.pushToTalkHandler(e, config);

      this.pushToTalkMouseListener = (e: UiohookMouseEvent) =>
        this.pushToTalkHandler(e, config);

      uIOhook.on('keydown', this.pushToTalkKeyListener);
      uIOhook.on('keyup', this.pushToTalkKeyListener);
      uIOhook.on('mousedown', this.pushToTalkMouseListener);
      uIOhook.on('mouseup', this.pushToTalkMouseListener);
    }
  }

  /**
   * Remove all audio sources from the OBS scene. This is public
   * so it can be called externally when WoW is closed.
   */
  public removeAudioSources() {
    console.info('[Recorder] Remove all audio sources');

    this.obsMicState = MicStatus.NONE;
    this.emit('state-change');

    this.audioSources.forEach((src) => {
      console.info('[Recorder] Remove audio source', src.id);
      noobs.RemoveSourceFromScene(src.id);
      noobs.DeleteSource(src.id);
    });

    this.audioSources = [];
    this.inputDevicesMuted = true;
  }

  /**
   * Cancel the find window interval timer.
   */
  public clearFindWindowInterval() {
    this.findWindowAttempts = 0;

    if (this.findWindowTimer) {
      clearInterval(this.findWindowTimer);
      this.findWindowTimer = undefined;
    }
  }

  /**
   * Release all OBS resources and shut it down.
   */
  public shutdownOBS() {
    console.info('[Recorder] OBS shutting down');

    if (!this.obsInitialized) {
      console.info('[Recorder] OBS not initialized so not attempting shutdown');
      return;
    }

    noobs.Shutdown();
    this.obsInitialized = false;
    console.info('[Recorder] OBS shut down successfully');
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
   * Set the size and position of the scene preview.
   */
  public configurePreview(x: number, y: number, width: number, height: number) {
    console.info('[Recorder] Configure preview with', x, y, width, height);
    noobs.ConfigurePreview(x, y, width, height);
  }

  /**
   * Show the scene preview.
   */
  public showPreview() {
    console.info('[Recorder] Show preview');
    noobs.ShowPreview();
  }

  /**
   * Hide the scene preview.
   */
  public hidePreview() {
    console.info('[Recorder] Hide preview');
    noobs.HidePreview();
  }

  /**
   * Disable the scene preview.
   */
  public disablePreview() {
    console.info('[Recorder] Disable preview');
    noobs.DisablePreview();
  }

  /**
   * Clean-up the recording directory.
   */
  public async cleanup(obsPath: string) {
    console.info('[Recorder] Clean out buffer');

    // We now record in MKV but convert to MP4 during processing. So we're really
    // cleaning out MKVs here but also may as well make sure we get any stray MP4s
    // that might be hanging around from legacy versions.
    const videos = await getSortedFiles(
      obsPath,
      '.*\\.(mp4|mkv)',
      FileSortDirection.NewestFirst, // This sorting is redundant in this context.
    );

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

    this.startQueue.empty();
    noobs.StartBuffer();

    await Promise.race([
      this.startQueue.shift(),
      getPromiseBomb(30, 'Failed to start'),
    ]);

    this.startQueue.empty();
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

    if (this.obsState !== ERecordingState.Recording) {
      console.error('[Recorder] Buffer not started');
      throw new Error('Buffer not started');
    }

    // The native code expects an integer.
    const rounded = Math.round(offset);
    noobs.StartRecording(rounded);
  }

  /**
   * Stop OBS, no-op if already stopped. If stopping fails, will attempt
   * recovery by force stopping. Will set lastFile if successful.
   */
  private async stopObsRecording() {
    console.info('[Recorder] Stop recording');

    if (!this.obsInitialized) {
      console.error('[Recorder] OBS not initialized');
      throw new Error('OBS not initialized');
    }

    if (this.obsState === ERecordingState.None) {
      console.info('[Recorder] Already stopped');
      return;
    }

    this.stopQueue.empty();
    noobs.StopRecording();
    const wrote = this.stopQueue.shift();

    try {
      await Promise.race([wrote, getPromiseBomb(60, 'Failed to stop')]);
      console.info('[Recorder] Stopped successfully');
    } catch (error) {
      console.error('[Recorder]', error, 'will force stop.');

      emitErrorReport(
        'Failed to stop OBS cleanly. This may lead to miscut videos and is typically a symptom of encoder overload.',
      );

      noobs.ForceStopRecording();

      await Promise.race([
        wrote,
        getPromiseBomb(3, 'Failed to recover by force stopping'),
      ]);

      console.info('[Recorder] Force stopped successfully');
    }

    // Now that we record in MKV we can still attempt to save
    // a recording here even if we failed to stop cleanly.
    this.lastFile = noobs.GetLastRecording();
  }

  /**
   * Force stop OBS, no-op if already stopped. Optionally pass in a wrote
   * promise to await instead of shifting from the queue ourselves. That's
   * useful in the case we've failed to stop and are now force stopping.
   */
  private async forceStopOBS(timeout: boolean) {
    console.info('[Recorder] Force stop');

    if (!this.obsInitialized) {
      console.error('[Recorder] OBS not initialized');
      throw new Error('OBS not initialized');
    }

    if (this.obsState === ERecordingState.None) {
      console.info('[Recorder] Already stopped');
      return;
    }

    this.stopQueue.empty();
    noobs.ForceStopRecording();

    const wrote = this.stopQueue.shift();

    if (timeout) {
      // In the normal case we expect to be done within a short timeout,
      // so enforce that here.
      const bomb = getPromiseBomb(3, 'Failed to force stop');
      await Promise.race([wrote, bomb]);
    } else {
      // We allow this to be called without a timeout to enable waiting
      // indefinitely on Windows sleeping. Often the deactivate signal
      // is not received until Windows wakes, which could be an arbitrary
      // amount of time later. This isn't perfect as we could in theory
      // get stuck here forever, but it's hopefully good enough.
      await wrote;
    }

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
   * Initialize OBS, should be called once only.
   */
  public initializeObs() {
    console.info('[Recorder] Initializing OBS');
    const cb = this.handleSignal.bind(this);

    // writable log path inside of the package
    let logPath = devMode
      ? path.resolve(__dirname, './logs')
      
      : app.isPackaged 
        ? path.join(app.getPath('userData'), 'logs') 
        : path.resolve(__dirname, '../../dist/main/logs');

    console.info('LOG_PATH', logPath);

    // Ensure log directory exists
    if (!fs.existsSync(logPath)) {
      fs.mkdirSync(logPath, { recursive: true });
    }

    let noobsPath = devMode
      ? path.resolve(__dirname, '../../release/app/node_modules/noobs/dist')
      : path.resolve(__dirname, '../../node_modules/noobs/dist');

    logPath = fixPathWhenPackaged(logPath);
    noobsPath = fixPathWhenPackaged(noobsPath);

    console.info('[Recorder] Noobs path:', noobsPath);
    console.info('[Recorder] Log path', logPath);
    
    noobs.Init(noobsPath, logPath, cb);
    console.info('noobs.Init completed successfully'); 
    noobs.SetBuffering(true);

    const hwnd = getNativeWindowHandle();
    noobs.InitPreview(hwnd);
    noobs.SetDrawSourceOutline(true);

    this.overlaySource = noobs.CreateSource(
      VideoSourceName.OVERLAY,
      'image_source',
    );

    this.obsInitialized = true;
    console.info('[Recorder] OBS initialized successfully');
  }

  /**
   * Handle a signal from OBS.
   */
  private handleSignal(signal: Signal) {
    if (signal.type === 'volmeter' && signal.value !== undefined) {
      // A volmeter callback was fired. This happens very often while there
      // are audio sources attached and the audio settings are open.
      send('volmeter', signal.id, signal.value);
      return;
    }

    // The rest of the signals here are not as frequent as volmeter signals
    // so just log them all.
    console.info('[Recorder] Got signal', signal);

    if (signal.type === 'source') {
      // A source has sporadically changed dimensions. This typically happens
      // when a game or window capture source is initialized or resized. To be
      // clear this is the dimensions NOT the scale. Users cannot trigger this.
      send('redrawPreview');
      send('initCropSliders');

      if (this.captureMode === CaptureMode.PIPEWIRE && signal.id === this.captureSource) {
        this.savePipewireRestoreToken();
      }
      return;
    }

    switch (signal.id) {
      case EOBSOutputSignal.Start:
        this.startQueue.push(signal);
        this.obsState = ERecordingState.Recording;
        this.emit('state-change');
        console.info('[Recorder] State is now:', this.obsState);
        break;

      case EOBSOutputSignal.Deactivate:
        this.stopQueue.push(signal);
        this.obsState = ERecordingState.None;
        this.emit('state-change');
        console.info('[Recorder] State is now:', this.obsState);
        break;

      default:
        console.info('[Recorder] No action needed on this signal');
        break;
    }
  }

  /**
   * Creates a window capture source. In TWW, the retail and classic Window names
   * diverged slightly, so while this was previously a hardcoded string, now we
   * search for it in the OSN sources API.
   */
  private configureWindowCaptureSource(config: ObsVideoConfig) {
    console.info('[Recorder] Configuring OBS for Window Capture');
    const {
      forceSdr,
      captureCursor,
      videoSourceXPosition,
      videoSourceYPosition,
      videoSourceScale,
    } = config;

    this.captureMode = CaptureMode.WINDOW;
    this.captureSource = noobs.CreateSource(
      VideoSourceName.WINDOW,
      'window_capture',
    );

    const settings = noobs.GetSourceSettings(this.captureSource);

    noobs.SetSourceSettings(this.captureSource, {
      ...settings,
      capture_mode: 'window',
      force_sdr: forceSdr,
      cursor: captureCursor, // For some reason is named differently here.
      method: 2,
      compatibility: true,
    });

    noobs.AddSourceToScene(this.captureSource);

    noobs.SetSourcePos(this.captureSource, {
      x: videoSourceXPosition,
      y: videoSourceYPosition,
      scaleX: videoSourceScale,
      scaleY: videoSourceScale,
      cropLeft: 0,
      cropRight: 0,
      cropTop: 0,
      cropBottom: 0,
    });
  }

  /**
   * Configures the game capture source.
   */
  private configureGameCaptureSource(config: ObsVideoConfig) {
    console.info('[Recorder] Configuring OBS for Game Capture');

    const {
      forceSdr,
      captureCursor,
      videoSourceXPosition,
      videoSourceYPosition,
      videoSourceScale,
    } = config;

    this.captureMode = CaptureMode.GAME;
    this.captureSource = noobs.CreateSource(
      VideoSourceName.GAME,
      'game_capture',
    );

    const defaults = noobs.GetSourceSettings(this.captureSource);

    const settings = {
      ...defaults,
      capture_mode: 'window',
      force_sdr: forceSdr,
      capture_cursor: captureCursor,
      priority: 2,
    };

    const position = {
      x: videoSourceXPosition,
      y: videoSourceYPosition,
      scaleX: videoSourceScale,
      scaleY: videoSourceScale,
      cropLeft: 0,
      cropRight: 0,
      cropTop: 0,
      cropBottom: 0,
    };

    noobs.SetSourceSettings(this.captureSource, settings);
    noobs.AddSourceToScene(this.captureSource);
    noobs.SetSourcePos(this.captureSource, position);
  }

  /**
   * Capture and save the PipeWire restore token after portal selection.
   * Call this after the user has completed the portal dialog.
   */
  private savePipewireRestoreToken(): ObsData | undefined {
    if (!this.captureSource || this.captureMode !== CaptureMode.PIPEWIRE) {
      console.warn('[Recorder] Not a PipeWire source, skipping token save');
      return undefined;
    }

    const settings = noobs.GetSourceSettings(this.captureSource);
    const restoreToken = settings['RestoreToken'];

    if (restoreToken && typeof restoreToken === 'string') {
      console.info('[Recorder] Saving PipeWire restore token:', restoreToken);
      this.cfg.set('pipewireRestoreToken', restoreToken);
    } else {
      console.warn('[Recorder] No restore token available to save');
    }
    return settings;
  } 

  /**
   * Creates a PipeWire screen capture source (Linux).
   */
  private configurePipeWireCaptureSource(config: ObsVideoConfig) {
    console.info('[Recorder] Configuring OBS for PipeWire Screen Capture');

    const {
      videoSourceXPosition,
      videoSourceYPosition,
      videoSourceScale,
      captureCursor,
      pipewireRestoreToken,
    } = config;

    console.info('[Recorder] Applying PipeWire settings with restore token:', 
    pipewireRestoreToken ? 'present' : 'none');

    // if there's a pipewire token present, use it
    const initialSettings = {
      // https://github.com/obsproject/obs-studio/blob/c11253bb088bd501b12998fb37fdcd6bf4743c35/plugins/linux-pipewire/screencast-portal.c#L518-L519
      ShowCursor: captureCursor,
      RestoreToken: pipewireRestoreToken
    }

    this.captureMode = CaptureMode.PIPEWIRE;
    this.captureSource = noobs.CreateSource(
      VideoSourceName.PIPEWIRE,
      'pipewire-screen-capture-source', // 'screen' capture handles both window and monitor in pipewire
      initialSettings,
    );

    // this will give us back a new restore token, which must be saved
    const settings = this.savePipewireRestoreToken();

    const position: SceneItemPosition = {
      x: videoSourceXPosition,
      y: videoSourceYPosition,
      scaleX: videoSourceScale,
      scaleY: videoSourceScale,
      cropLeft: 0,
      cropRight: 0,
      cropTop: 0,
      cropBottom: 0,
    };

    noobs.SetSourceSettings(this.captureSource, settings ?? initialSettings);
    noobs.AddSourceToScene(this.captureSource);
    noobs.SetSourcePos(this.captureSource, position);
    // ensure video is always on bottom
    noobs.SetSceneItemOrder(this.captureSource, ObsOrderMovement.OBS_ORDER_MOVE_BOTTOM);
  }

  /**
   * Creates a monitor capture source.
   */
  private configureMonitorCaptureSource(config: ObsVideoConfig) {
    console.info('[Recorder] Configuring OBS for Monitor Capture');

    const {
      forceSdr,
      monitorIndex,
      videoSourceXPosition,
      videoSourceYPosition,
      videoSourceScale,
      captureCursor,
    } = config;

    this.captureMode = CaptureMode.MONITOR;
    this.captureSource = noobs.CreateSource(
      VideoSourceName.MONITOR,
      'monitor_capture',
    );

    const defaults = noobs.GetSourceSettings(this.captureSource);
    const properties = noobs.GetSourceProperties(this.captureSource);

    const monitors = properties.find((p) => p.name === 'monitor_id');

    if (!monitors) {
      console.error('[Recorder] No monitors found');
      throw new Error('[Recorder] No monitors found');
    }

    if (monitors.type !== 'list') {
      console.error('[Recorder] Window setting is not a list');
      throw new Error('Window setting is not a list');
    }

    const opts = monitors.items.filter((item) => item.value !== 'DUMMY');
    let monitorId = opts[monitorIndex];

    if (!monitorId) {
      console.warn(
        '[Recorder] Monitor with index was not found for index',
        monitorIndex,
        opts,
        'will default to first monitor',
      );

      monitorId = opts[0];

      if (!monitorId) {
        // Somehow still no monitor so all we can do is error.
        console.error('[Recorder] No valid monitors found', opts);
        throw new Error('[Recorder] No valid monitors');
      }
    }

    console.info('[Recorder] Selected monitor:', monitorId);

    const settings = {
      ...defaults,
      method: 0,
      monitor_id: monitorId.value,
      force_sdr: forceSdr,
      capture_cursor: captureCursor,
    };

    const position: SceneItemPosition = {
      x: videoSourceXPosition,
      y: videoSourceYPosition,
      scaleX: videoSourceScale,
      scaleY: videoSourceScale,
      cropLeft: 0,
      cropRight: 0,
      cropTop: 0,
      cropBottom: 0,
    };

    noobs.SetSourceSettings(this.captureSource, settings);
    noobs.AddSourceToScene(this.captureSource);
    noobs.SetSourcePos(this.captureSource, position);
  }

  /**
   * Configure the chat overlay image source.
   */
  public async configureOverlayImageSource(config: ObsOverlayConfig) {
    const { chatOverlayEnabled } = config;
    console.info('[Recorder] Configure image source for chat overlay');

    if (this.overlaySource) {
      // Might be a no-op, we never actually delete this source.
      noobs.RemoveSourceFromScene(this.overlaySource);
    }

    if (!chatOverlayEnabled) {
      console.info('[Recorder] Chat overlay is disabled, not configuring');
      return;
    }

    const useDefaultOverlay = await this.useDefaultOverlayImage(config);

    if (useDefaultOverlay) {
      console.info('[Recorder] Using default overlay');
      this.configureDefaultOverlay(config);
    } else {
      console.info('[Recorder] Using custom overlay');
      this.configureOwnOverlay(config);
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
      encoder === ESupportedEncoders.NVENC_AV1 ||
      encoder === ESupportedEncoders.AMD_AV1
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
   * Check if the name of the window matches one of the known WoW window names.
   */
  private static windowMatch(item: { name: string; value: string | number }) {
    return (
      item.name.startsWith('[Wow.exe]: ') ||
      item.name.startsWith('[WowT.exe]: ') ||
      item.name.startsWith('[WowB.exe]: ') ||
      item.name.startsWith('[WowClassic.exe]: ') ||
      item.name.startsWith('[WowClassicT.exe]: ')
    );
  }

  /**
   * Attach the current game_capture or window_capture source to the WoW client.
   */
  public attachCaptureSource() {
    console.info('[Recorder] Attaching capture source', this.captureSource);

    if (
      this.captureMode !== CaptureMode.WINDOW &&
      this.captureMode !== CaptureMode.GAME
    ) {
      console.info('[Recorder] Nothing to attach for', this.captureMode);
      return;
    }

    if (!this.captureSource) {
      // This should never happen.
      console.error('[Recorder] No capture source available');
      return;
    }

    const properties = noobs.GetSourceProperties(this.captureSource);
    const windows = properties.find((item) => item.name === 'window');

    if (!windows) {
      console.error('[Recorder] Failed to find window setting');
      throw new Error('Failed to find window setting');
    }

    if (windows.type !== 'list') {
      console.error('[Recorder] Window setting is not a list');
      throw new Error('Window setting is not a list');
    }

    const opts = windows.items;
    const match = opts.find(Recorder.windowMatch);

    if (match) {
      console.info('[Recorder] Found matching window for game capture:', match);
      const settings = noobs.GetSourceSettings(this.captureSource);
      const updated = { ...settings, window: match.value };
      noobs.SetSourceSettings(this.captureSource, updated);
      return;
    }

    if (this.findWindowAttempts < this.findWindowAttemptLimit) {
      console.info('[Recorder] No matching window yet');
      this.findWindowAttempts++;

      this.findWindowTimer = setTimeout(
        () => this.attachCaptureSource(),
        this.findWindowIntervalDuration,
      );

      return;
    }

    console.warn(
      '[Recorder] Failed to find WoW window after',
      this.findWindowAttempts,
      'attempts. Giving up.',
    );
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
  public getSourcePosition(item: SceneItem) {
    const previewInfo = this.getDisplayInfo(); // Could be cached
    const sfx = previewInfo.previewWidth / previewInfo.canvasWidth;
    const sfy = previewInfo.previewHeight / previewInfo.canvasHeight;
    const sf = Math.min(sfx, sfy);

    const src =
      item === SceneItem.OVERLAY ? this.overlaySource : this.captureSource;

    if (!src) {
      console.warn(
        '[Recorder] getSourcePosition: No source found for item:',
        item,
      );
      return;
    }

    const current = noobs.GetSourcePos(src);

    const position: SceneItemPosition & SourceDimensions = {
      x: current.x * sf,
      y: current.y * sf,
      scaleX: current.scaleX,
      scaleY: current.scaleY,
      width: current.width * sf * current.scaleX,
      height: current.height * sf * current.scaleY,
      cropLeft: current.cropLeft * sf * current.scaleX,
      cropRight: current.cropRight * sf * current.scaleX,
      cropTop: current.cropTop * sf * current.scaleY,
      cropBottom: current.cropBottom * sf * current.scaleY,
    };

    return position;
  }

  /**
   * Sets the position of a source in the OBS scene.
   */
  public setSourcePosition(
    src: string,
    target: {
      x: number;
      y: number;
      width: number;
      height: number;
      cropLeft: number;
      cropRight: number;
      cropTop: number;
      cropBottom: number;
    },
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
    const scale = ratioX * current.scaleX;

    const updated: SceneItemPosition = {
      x: target.x / sf,
      y: target.y / sf,
      scaleX: scale,
      scaleY: scale,
      cropLeft: target.cropLeft / (sf * scale),
      cropRight: target.cropRight / (sf * scale),
      cropTop: target.cropTop / (sf * scale),
      cropBottom: target.cropBottom / (sf * scale),
    };

    noobs.SetSourcePos(src, updated);

    const item = src.startsWith('WCR Chat Overlay')
      ? SceneItem.OVERLAY
      : SceneItem.GAME;

    const timer =
      item === SceneItem.OVERLAY
        ? this.overlayPosDebounceTimer
        : this.gamePosDebounceTimer;

    if (timer) {
      clearTimeout(timer);
    }

    if (item === SceneItem.OVERLAY) {
      this.overlayPosDebounceTimer = setTimeout(() => {
        this.saveSourcePosition(
          item,
          updated.x,
          updated.y,
          scale,
          updated.cropLeft,
          updated.cropTop,
        );
        this.overlayPosDebounceTimer = undefined;
      }, 1000);
    } else if (item === SceneItem.GAME) {
      this.gamePosDebounceTimer = setTimeout(() => {
        this.saveSourcePosition(item, updated.x, updated.y, scale);
        this.gamePosDebounceTimer = undefined;
      }, 1000);
    }
  }

  /**
   * Reset the source position to 0, 0 and unscaled.
   */
  public resetSourcePosition(src: string) {
    console.info('[Recorder] Reset source position', src);

    const updated: SceneItemPosition = {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      cropLeft: 0,
      cropTop: 0,
      cropRight: 0,
      cropBottom: 0,
    };

    const item = src.startsWith('WCR Chat Overlay')
      ? SceneItem.OVERLAY
      : SceneItem.GAME;

    if (item === SceneItem.GAME) {
      console.info('[Recorder] Resetting game source so fit to window');

      const { height, width } = noobs.GetSourcePos(src);
      const { canvasHeight, canvasWidth } = noobs.GetPreviewInfo();

      const scaleX = canvasWidth / width;
      const scaleY = canvasHeight / height;

      if (scaleX < scaleY) {
        // X-limited, center vertically.
        updated.scaleX = scaleX;
        updated.scaleY = scaleX;
        updated.y = (canvasHeight - height * scaleX) / 2;
      } else {
        // Y-limited, center horizontally.
        updated.x = (canvasWidth - width * scaleY) / 2;
        updated.scaleX = scaleY;
        updated.scaleY = scaleY;
      }
    }

    // scaleX and scaleY are the same by this point as we maintain aspect ratio.
    noobs.SetSourcePos(src, updated);
    this.saveSourcePosition(item, updated.x, updated.y, updated.scaleX);
  }

  /**
   * Save a video source position in the config.
   */
  private saveSourcePosition(
    item: SceneItem,
    x: number,
    y: number,
    scale: number,
    cropX: number = 0,
    cropY: number = 0,
  ) {
    console.info('[Recorder] Saving', item, 'position', {
      x,
      y,
      scale,
      cropX,
      cropY,
    });

    if (item === SceneItem.OVERLAY) {
      this.cfg.set('chatOverlayXPosition', x);
      this.cfg.set('chatOverlayYPosition', y);
      this.cfg.set('chatOverlayScale', scale);
      this.cfg.set('chatOverlayCropX', cropX);
      this.cfg.set('chatOverlayCropY', cropY);
    } else {
      this.cfg.set('videoSourceXPosition', x);
      this.cfg.set('videoSourceYPosition', y);
      this.cfg.set('videoSourceScale', scale);
    }
  }

  /**
   * Choose a sensible default encoder from those available. Doesn't choose AV1
   * variants, those are considered advanced and not a sensible default. They
   * need hardware rendering of the app to be enabled.
   */
  public getSensibleEncoderDefault() {
    const encoders = this.getAvailableEncoders();
    const highRes = isHighRes(this.resolution);

    if (highRes) {
      // Just go for the software encoder if high res.
      return ESupportedEncoders.OBS_X264;
    }

    if (encoders.includes(ESupportedEncoders.NVENC_H264)) {
      return ESupportedEncoders.NVENC_H264;
    }

    if (encoders.includes(ESupportedEncoders.QSV_H264)) {
      return ESupportedEncoders.QSV_H264;
    }

    if (encoders.includes(ESupportedEncoders.AMD_H264)) {
      // Deliberatly after other hardware encoders as sometimes the
      // AMD iGPU can provide this and it's not usable.
      return ESupportedEncoders.AMD_H264;
    }

    return ESupportedEncoders.OBS_X264;
  }

  /**
   * Decide if we can should use the default overlay image or the custom one.
   */
  private async useDefaultOverlayImage(config: ObsOverlayConfig) {
    const { chatOverlayOwnImage, chatOverlayOwnImagePath } = config;

    if (!chatOverlayOwnImage) {
      console.info('[Recorder] Configured to use default overlay');
      return true;
    }

    if (!chatOverlayOwnImagePath) {
      console.warn('[Recorder] No custom image path set');
      return true;
    }

    const fileExists = await exists(chatOverlayOwnImagePath);

    if (!fileExists) {
      console.warn(`[Recorder] File does not exist`, chatOverlayOwnImagePath);
      return true;
    }

    return false;
  }

  /**
   * Get the last recorded file and clear it so it won't be returned again.
   */
  public getAndClearLastFile() {
    console.info('[Recorder] Get and clear last file', this.lastFile);
    const last = this.lastFile;
    this.lastFile = null;
    return last;
  }
}
