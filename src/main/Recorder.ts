import { BrowserWindow, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import * as osn from 'obs-studio-node';
import { isEqual } from 'lodash';
import {
  IFader,
  IInput,
  IScene,
  ISceneItem,
  ISceneItemInfo,
  ISource,
} from 'obs-studio-node';
import WaitQueue from 'wait-queue';

import { UiohookKeyboardEvent, UiohookMouseEvent, uIOhook } from 'uiohook-napi';
import { EventEmitter } from 'stream';
import Queue from 'queue-promise';
import { getOverlayConfig } from '../utils/configUtils';
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
} from './util';

import {
  CrashData,
  IOBSDevice,
  MicStatus,
  ObsAudioConfig,
  ObsBaseConfig,
  ObsOverlayConfig,
  ObsVideoConfig,
  RecStatus,
  TAudioSourceType,
  TPreviewPosition,
} from './types';
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
   * ISceneItem object for the video feed, useful to have handy for rescaling.
   */
  private videoSceneItem: ISceneItem | undefined;

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
  private videoScaleFactor = { x: 1, y: 1 };

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
   * Gets toggled if push to talk is enabled and when the hotkey for push to
   * talk is held down.
   */
  private inputDevicesMuted = false;

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
   * Name we use to create and reference the preview display.
   */
  private previewName = 'preview';

  /**
   * Bool tracking if the preview exists yet.
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
   * The image source to be used for the overlay, we create this
   * ahead of time regardless of if the user has the overlay enabled.
   */
  private overlayImageSource: IInput | undefined;

  /**
   * Faders are used to modify the volume of an input source. We keep a list
   * of them here as we need a fader per audio source so it's handy to have a
   * list for cleaning them up.
   */
  private faders: IFader[] = [];

  /**
   * Handle to the scene item for the overlay source. Handy for adding
   * and removing it later.
   */
  private overlaySceneItem: ISceneItem | undefined;

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
   * Action queue.
   */
  private actionQueue = new Queue({
    concurrent: 1,
    interval: 100,
  });

  /**
   * Action queue.
   */
  public lastFile: string = '';

  /**
   * Contructor.
   *
   * @param mainWindow main app window for IPC interaction
   */
  constructor(mainWindow: BrowserWindow) {
    super();
    console.info('[Recorder] Constructing recorder:', this.uuid);
    this.mainWindow = mainWindow;
    this.initializeOBS();
  }

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
  public configureBase(config: ObsBaseConfig) {
    const {
      bufferStoragePath,
      obsFPS,
      obsRecEncoder,
      obsKBitRate,
      obsOutputResolution,
    } = config;

    if (this.obsState !== ERecordingState.Offline) {
      throw new Error('[Recorder] OBS must be offline to do this');
    }

    this.bufferStorageDir = bufferStoragePath;
    this.createRecordingDirs(this.bufferStorageDir);
    this.resolution = obsOutputResolution as keyof typeof obsResolutions;
    const { height, width } = obsResolutions[this.resolution];

    // The AMD encoder causes recordings to get much darker if using the full
    // color range setting. So swap that to partial here. See https://github.com/aza547/wow-recorder/issues/446.
    const colorRange =
      obsRecEncoder === ESupportedEncoders.AMD_AMF_H264
        ? ERangeType.Partial
        : ERangeType.Full;

    osn.VideoFactory.videoContext = {
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
      range: colorRange as unknown as osn.ERangeType,
    };

    if (!this.obsRecordingFactory) {
      this.obsRecordingFactory = osn.AdvancedRecordingFactory.create();
    }

    this.obsRecordingFactory.path = path.normalize(this.bufferStorageDir);
    this.obsRecordingFactory.format = 'mp4' as osn.ERecordingFormat;
    this.obsRecordingFactory.useStreamEncoders = false;
    this.obsRecordingFactory.overwrite = false;
    this.obsRecordingFactory.noSpace = false;

    // This function is defined here:
    //   (client) https://github.com/stream-labs/obs-studio-node/blob/staging/obs-studio-client/source/video-encoder.cpp
    //   (server) https://github.com/stream-labs/obs-studio-node/blob/staging/obs-studio-server/source/osn-video-encoder.cpp
    //
    // Ideally we'd pass the 3rd arg with all the settings, but it seems that
    // hasn't been implemented so we instead call .update() shortly after.
    this.obsRecordingFactory.videoEncoder = osn.VideoEncoderFactory.create(
      obsRecEncoder,
      'WR-video-encoder',
      {}
    );

    this.obsRecordingFactory.videoEncoder.update({
      rate_control: 'VBR',
      bitrate: obsKBitRate * 1000,
      max_bitrate: obsKBitRate * 1000,
    });

    // Not totally clear why AMF is a special case here. Theory is that as it
    // is a plugin to OBS (it's a seperate github repo), and the likes of the
    // nvenc/x264 encoders are native to OBS so have homogenized settings. We
    // add a 1.5 multiplier onto the peak from what the user sets here.
    if (obsRecEncoder === ESupportedEncoders.AMD_AMF_H264) {
      this.obsRecordingFactory.videoEncoder.update({
        'Bitrate.Peak': obsKBitRate * 1000 * 1.5,
      });
    }

    console.info(
      'Video encoder settings:',
      this.obsRecordingFactory.videoEncoder.settings
    );

    this.obsRecordingFactory.signalHandler = (signal) => {
      this.handleSignal(signal);
    };
  }

  /**
   * Configures the video source in OBS.
   */
  public configureVideoSources(config: ObsVideoConfig) {
    const { obsCaptureMode, monitorIndex, captureCursor } = config;

    if (this.scene === undefined || this.scene === null) {
      throw new Error('[Recorder] No scene');
    }

    if (this.videoSource) {
      this.videoSource.release();
      this.videoSource.remove();
      this.videoScaleFactor = { x: 1, y: 1 };
    }

    if (obsCaptureMode === 'monitor_capture') {
      this.videoSource = Recorder.createMonitorCaptureSource(
        monitorIndex,
        captureCursor
      );
    } else if (obsCaptureMode === 'game_capture') {
      this.videoSource = Recorder.createGameCaptureSource(captureCursor);
    } else if (obsCaptureMode === 'window_capture') {
      this.videoSource = Recorder.createWindowCaptureSource(captureCursor);
    } else {
      throw new Error(`[Recorder] Unexpected mode: ${obsCaptureMode}`);
    }

    this.videoSceneItem = this.scene.add(this.videoSource);

    if (this.videoSourceSizeInterval) {
      clearInterval(this.videoSourceSizeInterval);
    }

    this.watchVideoSourceSize();

    // Re-add the overlay so it doesnt end up underneath the game itself.
    const overlayCfg = getOverlayConfig(this.cfg);
    this.configureOverlaySource(overlayCfg);
  }

  public hidePreview() {
    if (!this.previewCreated) {
      console.warn('[Recorder] Preview display not created');
      return;
    }

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
   * Apply a chat overlay to the scene.
   */
  public configureOverlaySource(config: ObsOverlayConfig) {
    const {
      chatOverlayEnabled,
      chatOverlayWidth,
      chatOverlayHeight,
      chatOverlayXPosition,
      chatOverlayYPosition,
    } = config;

    if (this.scene === undefined || this.overlayImageSource === undefined) {
      console.error(
        '[Recorder] Not applying overlay as scene or image source undefined',
        this.scene,
        this.overlayImageSource
      );

      return;
    }

    if (this.overlaySceneItem !== undefined) {
      this.overlaySceneItem.remove();
    }

    if (!chatOverlayEnabled) {
      return;
    }

    // This is the height of the chat overlay image, a bit ugly
    // to have it hardcoded here, but whatever.
    const baseWidth = 5000;
    const baseHeight = 2000;

    const toCropX = (baseWidth - chatOverlayWidth) / 2;
    const toCropY = (baseHeight - chatOverlayHeight) / 2;

    const overlaySettings: ISceneItemInfo = {
      name: 'overlay',
      crop: {
        left: toCropX,
        right: toCropX,
        top: toCropY,
        bottom: toCropY,
      },
      scaleX: 1,
      scaleY: 1,
      visible: true,
      x: chatOverlayXPosition,
      y: chatOverlayYPosition,
      rotation: 0,
      streamVisible: true,
      recordingVisible: true,
      scaleFilter: 0,
      blendingMode: 0,
    };

    this.overlaySceneItem = this.scene.add(
      this.overlayImageSource,
      overlaySettings
    );
  }

  /**
   * Add the configured audio sources to the OBS scene. This is public
   * so it can be called externally when WoW is opened.
   */
  public configureAudioSources(config: ObsAudioConfig) {
    this.removeAudioSources();
    uIOhook.removeAllListeners();
    this.obsMicState = MicStatus.NONE;
    this.refreshMicStatus();

    const {
      audioInputDevices,
      audioOutputDevices,
      micVolume,
      speakerVolume,
      obsForceMono,
      obsAudioSuppression,
    } = config;

    // Pretty sure these arguments are doing nothing.
    // See https://github.com/stream-labs/obs-studio-node/issues/1367.
    const track1 = osn.AudioTrackFactory.create(160, 'track1');
    osn.AudioTrackFactory.setAtIndex(track1, 1);

    audioInputDevices
      .split(',')
      .filter((id) => id)
      .forEach((id) => {
        console.info('[Recorder] Adding input source', id);
        const obsSource = this.createOBSAudioSource(id, TAudioSourceType.input);

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
      this.refreshMicStatus();
    } else if (this.audioInputDevices.length !== 0) {
      this.obsMicState = MicStatus.LISTENING;
      this.refreshMicStatus();
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
      .forEach((id) => {
        console.info('[Recorder] Adding output source', id);

        const obsSource = this.createOBSAudioSource(
          id,
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

    this.audioInputDevices.forEach((device) => {
      const index = this.audioInputDevices.indexOf(device);
      const channel = this.audioInputChannels[index];
      this.removeAudioSource(device, channel);
      this.audioInputDevices.splice(index, 1);
    });

    this.audioOutputDevices.forEach((device) => {
      const index = this.audioOutputDevices.indexOf(device);
      const channel = this.audioOutputChannels[index];
      this.removeAudioSource(device, channel);
      this.audioOutputDevices.splice(index, 1);
    });
  }

  /**
   * Release all OBS resources and shut it down.
   */
  public shutdownOBS() {
    console.info('[Recorder] OBS shutting down', this.uuid);

    if (!this.obsInitialized) {
      console.info('[Recorder] OBS not initialized so not attempting shutdown');
    }

    if (this.videoSourceSizeInterval) {
      clearInterval(this.videoSourceSizeInterval);
    }

    if (this.overlayImageSource) {
      this.overlayImageSource.release();
      this.overlayImageSource.remove();
    }

    if (this.videoSource) {
      this.videoSource.release();
      this.videoSource.remove();
    }

    osn.Global.setOutputSource(1, null as unknown as ISource);

    if (this.obsRecordingFactory) {
      osn.AdvancedRecordingFactory.destroy(this.obsRecordingFactory);
      this.obsRecordingFactory = undefined;
    }

    this.wroteQueue.empty();
    this.wroteQueue.clearListeners();
    this.startQueue.empty();
    this.startQueue.clearListeners();

    try {
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
      console.info('[Recorder] Preview display not yet created, creating...');
      this.createPreview();
    }

    if (!this.previewCreated) {
      console.error('[Recorder] Preview display still does not exist');
      return;
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
  public async cleanup(filesToLeave = 0) {
    if (!this.bufferStorageDir) {
      console.info('[Recorder] Not attempting to clean-up');
      return;
    }

    // Sort newest to oldest
    const sortedBufferVideos = await getSortedVideos(this.bufferStorageDir);
    if (!sortedBufferVideos || sortedBufferVideos.length === 0) return;
    const videosToDelete = sortedBufferVideos.slice(filesToLeave);

    const deletePromises = videosToDelete.map(async (video) => {
      await tryUnlink(video.name);
    });

    await Promise.all(deletePromises);
  }

  /**
   * Push the state of the recorder to the RecStatus icon on the frontend.
   */
  public refreshRecStatus(activity = false) {
    if (activity) {
      this.mainWindow.webContents.send('updateRecStatus', RecStatus.Recording);
    } else if (this.obsState === ERecordingState.Recording) {
      this.mainWindow.webContents.send(
        'updateRecStatus',
        RecStatus.ReadyToRecord
      );
    } else if (
      this.obsState === ERecordingState.Offline ||
      this.obsState === ERecordingState.Starting ||
      this.obsState === ERecordingState.Stopping
    ) {
      this.mainWindow.webContents.send(
        'updateRecStatus',
        RecStatus.WaitingForWoW
      );
    }
  }

  /**
   * Push the state of the mic to the MicStatus icon on the frontend.
   */
  public refreshMicStatus() {
    this.mainWindow.webContents.send('updateMicStatus', this.obsMicState);
  }

  private async startOBS() {
    console.info('[Recorder] Start');

    if (!this.obsInitialized) {
      console.error('[Recorder] OBS not initialized');
      throw new Error('OBS not initialized');
    }

    if (!this.obsRecordingFactory) {
      console.warn('[Recorder] startBuffer called but no recording factory');
      throw new Error('startBuffer called but no recording factory');
    }

    if (this.obsState === ERecordingState.Recording) {
      console.info('[Recorder] Already started');
      return;
    }

    this.obsRecordingFactory.start();

    // Wait up to 30 seconds for OBS to signal it has started recording,
    // really this shouldn't take nearly as long.
    await Promise.race([
      this.startQueue.shift(),
      getPromiseBomb(30000, '[Recorder] OBS timeout waiting for start'),
    ]);

    this.startQueue.empty();
    this.startDate = new Date();
  }

  private async stopOBS() {
    console.info('[Recorder] Stop');

    if (!this.obsInitialized) {
      console.error('[Recorder] OBS not initialized');
      throw new Error('OBS not initialized');
    }

    if (!this.obsRecordingFactory) {
      console.warn('[Recorder] Stop OBS called but no obsRecordingFactory');
      return;
    }

    if (this.obsState === ERecordingState.Offline) {
      console.info('[Recorder] Already stopped');
      return;
    }

    this.obsRecordingFactory.stop();

    // Wait up to 30 seconds for OBS to signal it has wrote the file, really
    // this shouldn't take nearly as long as this but we're generous to account
    // for slow HDDs etc.
    await Promise.race([
      this.wroteQueue.shift(),
      getPromiseBomb(30000, '[Recorder] OBS timeout waiting for video file'),
    ]);

    this.wroteQueue.empty();
    this.lastFile = this.obsRecordingFactory.lastFile();
  }

  /**
   * Create the bufferStorageDir if it doesn't already exist. Also
   * cleans it out for good measure.
   */
  private createRecordingDirs(bufferStoragePath: string) {
    if (bufferStoragePath === '') {
      console.error('[Recorder] bufferStorageDir not set');
      return;
    }

    if (!fs.existsSync(bufferStoragePath)) {
      console.info('[Recorder] Creating dir:', bufferStoragePath);
      fs.mkdirSync(bufferStoragePath);
    } else {
      console.info('[Recorder] Clean out buffer');
      this.cleanup();
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

    this.scene = osn.SceneFactory.create('WR Scene');
    osn.Global.setOutputSource(this.videoChannel, this.scene);
    this.createOverlayImageSource();

    this.obsInitialized = true;
    console.info('[Recorder] OBS initialized successfully');
  }

  private handleSignal(obsSignal: osn.EOutputSignal) {
    console.info('[Recorder] Got signal:', obsSignal);

    if (obsSignal.type !== 'recording') {
      console.info('[Recorder] No action needed on this signal');
      return;
    }

    switch (obsSignal.signal) {
      case EOBSOutputSignal.Start:
        this.startQueue.push(obsSignal);
        this.obsState = ERecordingState.Recording;
        this.refreshRecStatus();
        break;

      case EOBSOutputSignal.Starting:
        this.obsState = ERecordingState.Starting;
        this.refreshRecStatus();
        break;

      case EOBSOutputSignal.Stop:
        this.obsState = ERecordingState.Offline;
        this.refreshRecStatus();
        break;

      case EOBSOutputSignal.Stopping:
        this.obsState = ERecordingState.Stopping;
        this.refreshRecStatus();
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
   * Creates a game capture source.
   */
  private static createGameCaptureSource(captureCursor: boolean) {
    console.info('[Recorder] Configuring OBS for Game Capture');

    const gameCaptureSource = osn.InputFactory.create(
      'game_capture',
      'WR Game Capture'
    );

    const { settings } = gameCaptureSource;
    settings.capture_mode = 'window';
    settings.allow_transparency = true;
    settings.priority = 1;
    settings.capture_cursor = captureCursor;
    settings.window = 'World of Warcraft:GxWindowClass:Wow.exe';

    gameCaptureSource.update(settings);
    gameCaptureSource.save();

    return gameCaptureSource;
  }

  /**
   * Creates a monitor capture source.
   */
  private static createMonitorCaptureSource(
    monitorIndex: number,
    captureCursor: boolean
  ) {
    console.info('[Recorder] Configuring OBS for Monitor Capture');

    const monitorCaptureSource = osn.InputFactory.create(
      'monitor_capture',
      'WR Monitor Capture'
    );

    const { settings } = monitorCaptureSource;
    settings.monitor = monitorIndex;
    settings.capture_cursor = captureCursor;

    monitorCaptureSource.update(settings);
    monitorCaptureSource.save();

    return monitorCaptureSource;
  }

  /**
   * Creates a window capture source.
   */
  private static createWindowCaptureSource(captureCursor: boolean) {
    console.info('[Recorder] Configuring OBS for Window Capture');

    const windowCaptureSource = osn.InputFactory.create(
      'window_capture',
      'WR Window Capture',
      {
        cursor: captureCursor,
        window: 'World of Warcraft:GxWindowClass:Wow.exe',
        // This corresponds to Windows Graphics Capture. The other mode "BITBLT" doesn't seem to work and
        // capture behind the WoW window. Not sure why, some googling suggested Windows theme issues.
        // See https://github.com/obsproject/obs-studio/blob/master/plugins/win-capture/window-capture.c#L70.
        method: 2,
      }
    );

    return windowCaptureSource;
  }

  /**
   * Creates an image source.
   */
  private createOverlayImageSource() {
    console.info('[Recorder] Create image source for chat overlay');

    const settings = {
      file: getAssetPath('poster', 'chat-cover.png'),
    };

    this.overlayImageSource = osn.InputFactory.create(
      'image_source',
      'WR Chat Overlay',
      settings
    );

    if (this.overlayImageSource === null) {
      console.error('[Recorder] Failed to create image source');
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

    if (channel <= 1 || channel >= 64) {
      throw new Error(`[Recorder] Invalid channel number ${channel}`);
    }

    osn.Global.setOutputSource(channel, obsInput);
  }

  /**
   * Remove a single audio source from the OBS scene.
   */
  private removeAudioSource(obsInput: IInput, channel: number) {
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
   * Set up an interval to run the scaleVideoSourceSize function, and run it
   * upfront.
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
   * Watch the video input source for size changes. This only matters for
   * doing game capture on a windowed instance of WoW, such that we'll scale
   * it to the size of the output video if it's resized by the player.
   */
  private scaleVideoSourceSize() {
    if (!this.videoSource) {
      throw new Error('[Recorder] videoSource was undefined');
    }

    if (!this.videoSceneItem) {
      throw new Error('[Recorder] videoSceneItem was undefined');
    }

    if (this.videoSource.width === 0 || this.videoSource.height === 0) {
      // This happens often, suspect it's before OBS gets a hook into a game capture process.
      return;
    }

    const { width, height } = obsResolutions[this.resolution];

    const xScaleFactor =
      Math.round((width / this.videoSource.width) * 100) / 100;

    const yScaleFactor =
      Math.round((height / this.videoSource.height) * 100) / 100;

    const newScaleFactor = { x: xScaleFactor, y: yScaleFactor };

    if (!isEqual(this.videoScaleFactor, newScaleFactor)) {
      console.info(
        '[Recorder] Rescaling from',
        this.videoScaleFactor,
        'to',
        newScaleFactor
      );

      this.videoScaleFactor = newScaleFactor;
      this.videoSceneItem.scale = newScaleFactor;
    }
  }

  createPreview() {
    console.info('[Recorder] Creating preview');

    if (this.scene === undefined) {
      console.error('[Recorder] Scene undefined so not creating preview');
      return;
    }

    if (this.previewCreated) {
      console.warn('[Recorder] Preview display already exists');
      return;
    }

    osn.NodeObs.OBS_content_createSourcePreviewDisplay(
      this.mainWindow.getNativeWindowHandle(),
      this.scene.name,
      this.previewName
    );

    osn.NodeObs.OBS_content_setShouldDrawUI(this.previewName, false);
    osn.NodeObs.OBS_content_setPaddingSize(this.previewName, 0);
    osn.NodeObs.OBS_content_setPaddingColor(this.previewName, 0, 0, 0);

    this.previewCreated = true;
  }

  private muteInputDevices() {
    if (this.inputDevicesMuted) {
      return;
    }

    this.audioInputDevices.forEach((device) => {
      device.muted = true;
    });

    this.inputDevicesMuted = true;
    this.obsMicState = MicStatus.MUTED;
    this.refreshMicStatus();
  }

  private unmuteInputDevices() {
    if (!this.inputDevicesMuted) {
      return;
    }

    this.audioInputDevices.forEach((device) => {
      device.muted = false;
    });

    this.inputDevicesMuted = false;
    this.obsMicState = MicStatus.LISTENING;
    this.refreshMicStatus();
  }
}
