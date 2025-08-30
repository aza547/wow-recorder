import { BrowserWindow, app, clipboard, ipcMain, powerMonitor } from 'electron';
import { uIOhook, UiohookKeyboardEvent } from 'uiohook-napi';
import assert from 'assert';
import EraLogHandler from '../parsing/EraLogHandler';
import {
  buildClipMetadata,
  getMetadataForVideo,
  getOBSFormattedDate,
  tagVideoDisk,
  openSystemExplorer,
  markForVideoForDelete,
  exists,
  deleteVideoDisk,
  protectVideoDisk,
  isManualRecordHotKey,
  playSoundAlert,
  nextKeyPressPromise,
  nextMousePressPromise,
} from './util';
import { VideoCategory } from '../types/VideoCategory';
import Poller from '../utils/Poller';
import ClassicLogHandler from '../parsing/ClassicLogHandler';
import RetailLogHandler from '../parsing/RetailLogHandler';
import Recorder from './Recorder';
import ConfigService from '../config/ConfigService';
import {
  RecStatus,
  VideoQueueItem,
  MicStatus,
  RendererVideo,
  DiskStatus,
  UploadQueueItem,
  WCRSceneItem,
  AudioSourceType,
  WowProcessEvent,
  SoundAlerts,
  BaseConfig,
} from './types';
import {
  getObsVideoConfig,
  getObsAudioConfig,
  getOverlayConfig,
  getBaseConfig,
  validateBaseConfig,
  getLocaleError,
} from '../utils/configUtils';
import { ERecordingState } from './obsEnums';
import {
  runClassicRecordingTest,
  runRetailRecordingTest,
} from '../utils/testButtonUtils';
import VideoProcessQueue from './VideoProcessQueue';
import DiskSizeMonitor from '../storage/DiskSizeMonitor';
import noobs from 'noobs';
import { Phrase } from 'localisation/phrases';
import LogHandler from 'parsing/LogHandler';
import { PTTKeyPressEvent } from 'types/KeyTypesUIOHook';

/**
 * The manager class is responsible for orchestrating all the functional
 * bits of the app including the Recorder, LogHandlers and Poller classes.
 *
 * In particular, it has the knowledge of how to reconfigure the Recorder
 * class, which is non-trivial as some config can be changed live while others
 * can not.
 *
 * The external interface here is manage(), call this any time a config change
 * occurs and it will always do the right thing.
 */
export default class Manager {
  public recorder: Recorder;

  private window: BrowserWindow;

  private cfg = ConfigService.getInstance();

  private poller = Poller.getInstance();

  private retailLogHandler: RetailLogHandler | undefined;

  private classicLogHandler: ClassicLogHandler | undefined;

  private eraLogHandler: EraLogHandler | undefined;

  private retailPtrLogHandler: RetailLogHandler | undefined;

  private videoProcessQueue: VideoProcessQueue;

  private configValid = false;

  private configMessage = '';

  private reconfiguring = false;

  private audioSettingsOpen = false;

  /**
   * It's confusing if you try to change the hotkey to something similar and
   * it starts a recording mid changing it, so set this to true while doing so.
   */
  private manualHotKeyDisabled = false;

  /**
   * This log handler assigned for a manual recording. Need a reference to
   * this to know which log handler to use to stop the manual recording on.
   */
  private manualLogHandler?: LogHandler;

  /**
   * Constructor.
   */
  constructor(window: BrowserWindow) {
    console.info('[Manager] Creating manager');

    this.window = window;
    this.setupListeners();
    this.recorder = new Recorder(this.window);

    this.recorder.on('state-change', () => {
      setTimeout(() => this.refresh(), 0);
    });

    this.videoProcessQueue = new VideoProcessQueue(this.window);
  }

  /**
   * Run the startup configuration, which validates the config and applies it
   * from the config service.
   */
  public async startup() {
    console.info('[Manager] Starting up');

    this.reconfiguring = true;
    this.refresh();

    try {
      await this.configureBase();
      await this.configureObsVideo();
      await this.configureObsAudio();
      await this.validateOverlayConfig();
      await this.configureObsOverlay();
    } catch (error) {
      console.error('[Manager] Error during startup', error);
      this.reconfiguring = false;
      this.setConfigInvalid(String(error));
      return;
    }

    this.reconfiguring = false;
    this.setConfigValid();

    this.poller
      .on(WowProcessEvent.STARTED, () => this.onWowStarted())
      .on(WowProcessEvent.STOPPED, () => this.onWowStopped())
      .start();
  }

  /**
   * Configure the base config.
   */
  private async configureBase() {
    const config = getBaseConfig(this.cfg);
    await validateBaseConfig(config);
    await this.applyBaseConfig(config);
  }

  /**
   * Force a recording to stop regardless of the scenario.
   */
  public async forceStop() {
    if (this.retailLogHandler && this.retailLogHandler.activity) {
      await this.retailLogHandler.forceEndActivity();
    }

    if (this.classicLogHandler && this.classicLogHandler.activity) {
      await this.classicLogHandler.forceEndActivity();
    }

    if (this.eraLogHandler && this.eraLogHandler.activity) {
      await this.eraLogHandler.forceEndActivity();
    }

    if (this.retailPtrLogHandler && this.retailPtrLogHandler.activity) {
      await this.retailPtrLogHandler.forceEndActivity();
    }
  }

  /**
   * Immediately drop any in-progress activity.
   */
  public dropActivity() {
    if (this.retailLogHandler && this.retailLogHandler.activity) {
      console.info('[Manager] Dropping retail activity');
      this.retailLogHandler.dropActivity();
    }

    if (this.classicLogHandler && this.classicLogHandler.activity) {
      console.info('[Manager] Dropping classic activity');
      this.classicLogHandler.dropActivity();
    }

    if (this.eraLogHandler && this.eraLogHandler.activity) {
      console.info('[Manager] Dropping era activity');
      this.eraLogHandler.dropActivity();
    }

    if (this.retailPtrLogHandler && this.retailPtrLogHandler.activity) {
      console.info('[Manager] Dropping ptr activity');
      this.retailPtrLogHandler.dropActivity();
    }
  }

  /**
   * Run a test. We prefer retail here, if the user doesn't have a retail path
   * configured, then fall back to classic. We only pass through the category
   * for retail, any classic tests will default to 2v2. Probably should fix
   * that.
   */
  public test(category: VideoCategory, endTest: boolean) {
    const retail = this.retailLogHandler || this.retailPtrLogHandler;

    if (retail) {
      console.info('[Manager] Running retail test');
      const parser = retail.combatLogWatcher;
      runRetailRecordingTest(category, parser, endTest);
      return;
    }

    if (this.classicLogHandler) {
      console.info('[Manager] Running classic test');
      const parser = this.classicLogHandler.combatLogWatcher;
      runClassicRecordingTest(parser, endTest);
    }
  }

  /**
   * Set member variables to reflect the config being valid.
   */
  private setConfigValid() {
    this.configValid = true;
    this.configMessage = '';
    this.refresh();
  }

  /**
   * Set member variables to reflect the config being invalid.
   */
  private setConfigInvalid(reason: string) {
    this.configValid = false;
    this.configMessage = reason;
    this.refresh();
  }

  /**
   * Refresh the recorder and mic status icons in the UI. This is the only
   * place that this should be done from to avoid any status icon confusion.
   */
  public refresh() {
    if (this.reconfiguring) {
      this.refreshRecStatus(RecStatus.Reconfiguring);
      return;
    }

    if (!this.configValid) {
      this.refreshRecStatus(
        RecStatus.InvalidConfig,
        String(this.configMessage),
      );
      return;
    }

    const inOverrun =
      this.retailLogHandler?.overrunning ||
      this.classicLogHandler?.overrunning ||
      this.eraLogHandler?.overrunning ||
      this.retailPtrLogHandler?.overrunning;

    const inActivity =
      this.retailLogHandler?.activity ||
      this.classicLogHandler?.activity ||
      this.eraLogHandler?.activity ||
      this.retailPtrLogHandler?.activity;

    if (inOverrun) {
      this.refreshRecStatus(RecStatus.Overrunning);
    } else if (inActivity) {
      this.refreshRecStatus(RecStatus.Recording);
    } else if (this.recorder.obsState === ERecordingState.Recording) {
      this.refreshRecStatus(RecStatus.ReadyToRecord);
    } else if (
      this.recorder.obsState === ERecordingState.Offline ||
      this.recorder.obsState === ERecordingState.Starting ||
      this.recorder.obsState === ERecordingState.Stopping
    ) {
      this.refreshRecStatus(RecStatus.WaitingForWoW);
    }

    this.refreshMicStatus(this.recorder.obsMicState);
    this.redrawPreview();
  }

  /**
   * Send a message to the frontend to update the recorder status icon.
   */
  private refreshRecStatus(status: RecStatus, msg = '') {
    if (this.window.isDestroyed()) return; // Can happen on shutdown.
    this.window.webContents.send('updateRecStatus', status, msg);
  }

  /**
   * Send a message to the frontend to update the mic status icon.
   */
  private refreshMicStatus(status: MicStatus) {
    if (this.window.isDestroyed()) return; // Can happen on shutdown.
    this.window.webContents.send('updateMicStatus', status);
  }

  /**
   * Trigger the frontend to redraw the preview if it's open.
   */
  private redrawPreview() {
    // Really don't understand the need for the timeout here but it sometimes
    // gets stale data otherwise. A caching thing in libobs maybe? Noobs will
    // send a source signal to the recorder if the size of sources change, but
    // for other changes we need to manually trigger a redraw.
    setTimeout(() => this.window.webContents.send('redrawPreview'), 100);
  }

  /**
   * Send a message to the frontend to update the disk status, which populates
   * the disk usage bar.
   */
  private async refreshDiskStatus() {
    const usage = await new DiskSizeMonitor(this.window).usage();
    const limit = this.cfg.get<number>('maxStorage') * 1024 ** 3;
    const status: DiskStatus = { usage, limit };
    this.window.webContents.send('updateDiskStatus', status);
  }

  /**
   * Called when the WoW process is detected, which may be either on launch
   * of the App if WoW is open, or the user has genuinely opened WoW. Attaches
   * the audio sources and starts the buffer recording.
   */
  private async onWowStarted() {
    console.info('[Manager] Detected WoW is running');
    this.recorder.attachCaptureSource();

    const audioConfig = getObsAudioConfig(this.cfg);
    this.recorder.configureAudioSources(audioConfig);

    try {
      await this.recorder.startBuffer();
    } catch (error) {
      console.error('[Manager] OBS failed to record when WoW started', error);
    }
  }

  /**
   * Called when the WoW process is detected to have exited. Ends any
   * recording that is still ongoing. We detach audio sources here to
   * allow Windows to go to sleep with WCR running.
   */
  private async onWowStopped() {
    console.info('[Manager] Detected WoW not running');

    if (this.retailLogHandler && this.retailLogHandler.activity) {
      await this.retailLogHandler.forceEndActivity();
    } else if (this.classicLogHandler && this.classicLogHandler.activity) {
      await this.classicLogHandler.forceEndActivity();
    } else if (this.eraLogHandler && this.eraLogHandler.activity) {
      await this.eraLogHandler.forceEndActivity();
    } else if (this.retailPtrLogHandler && this.retailPtrLogHandler.activity) {
      await this.retailPtrLogHandler.forceEndActivity();
    } else {
      // No activity so we can just force stop.
      await this.recorder.stop(true);
    }

    this.recorder.clearFindWindowInterval();

    if (!this.audioSettingsOpen) {
      // Only remove the audio sources if the audio settings window is not open.
      // We want to keep them attached to show the volmeter bars if it is.
      this.recorder.removeAudioSources();
    }
  }

  /**
   * Configure the base OBS config. We need to stop the recording to do this.
   */
  private async applyBaseConfig(config: BaseConfig) {
    await this.recorder.stop(true);

    await this.refreshDiskStatus();

    await this.recorder.configureBase(config);
    this.manualLogHandler = undefined;

    if (this.retailLogHandler) {
      this.retailLogHandler.removeAllListeners();
      this.retailLogHandler.destroy();
      this.retailLogHandler = undefined;
    }

    if (this.classicLogHandler) {
      this.classicLogHandler.removeAllListeners();
      this.classicLogHandler.destroy();
      this.classicLogHandler = undefined;
    }

    if (this.eraLogHandler) {
      this.eraLogHandler.removeAllListeners();
      this.eraLogHandler.destroy();
      this.eraLogHandler = undefined;
    }

    if (this.retailPtrLogHandler) {
      this.retailPtrLogHandler.removeAllListeners();
      this.retailPtrLogHandler.destroy();
      this.retailPtrLogHandler = undefined;
    }

    if (config.recordRetail) {
      this.retailLogHandler = new RetailLogHandler(
        this.window,
        this.recorder,
        this.videoProcessQueue,
        config.retailLogPath,
      );

      this.retailLogHandler.on('state-change', () => this.refresh());
    }

    if (config.recordClassic) {
      this.classicLogHandler = new ClassicLogHandler(
        this.window,
        this.recorder,
        this.videoProcessQueue,
        config.classicLogPath,
      );

      this.classicLogHandler.on('state-change', () => this.refresh());
    }

    if (config.recordEra) {
      this.eraLogHandler = new EraLogHandler(
        this.window,
        this.recorder,
        this.videoProcessQueue,
        config.eraLogPath,
      );

      this.eraLogHandler.on('state-change', () => this.refresh());
    }

    if (config.recordRetailPtr) {
      this.retailPtrLogHandler = new RetailLogHandler(
        this.window,
        this.recorder,
        this.videoProcessQueue,
        config.retailPtrLogPath,
      );

      this.retailPtrLogHandler.setIsPtr();
      this.retailPtrLogHandler.on('state-change', () => this.refresh());
    }

    // Order of priority which log handler to use for manual recordings.
    // It doesn't actually matter which takes it as the logic is all in
    // the LogHandler class itself, but it's abstract and we need to make
    // sure we start and stop aganst the same concrete implementation.
    //
    // TODO what if we send manual through one but get real events through another?
    if (this.retailLogHandler) {
      this.manualLogHandler = this.retailLogHandler;
    } else if (this.retailPtrLogHandler) {
      this.manualLogHandler = this.retailPtrLogHandler;
    } else if (this.classicLogHandler) {
      this.manualLogHandler = this.classicLogHandler;
    } else if (this.eraLogHandler) {
      this.manualLogHandler = this.eraLogHandler;
    }

    // We're done, now make sure we refresh the frontend.
    this.window.webContents.send('refreshState');
  }

  /**
   * Configure video settings in OBS. This can all be changed live.
   */
  private configureObsVideo() {
    const isWowRunning = this.poller.isWowRunning();
    const config = getObsVideoConfig(this.cfg);
    this.recorder.configureVideoSources(config, isWowRunning);
  }

  /**
   * Configure audio settings in OBS. This can all be changed live.
   */
  private configureObsAudio() {
    const isWowRunning = this.poller.isWowRunning();
    const shouldConfigure = isWowRunning || this.audioSettingsOpen;

    if (!shouldConfigure) {
      console.info("[Manager] Won't configure audio sources, WoW not running");
      return;
    }

    const config = getObsAudioConfig(this.cfg);
    this.recorder.configureAudioSources(config);
  }

  /**
   * Configure chat overlay in OBS. This can all be changed live.
   */
  private configureObsOverlay() {
    const config = getOverlayConfig(this.cfg);
    this.recorder.configureOverlayImageSource(config);
  }

  private async validateOverlayConfig() {
    const config = getOverlayConfig(this.cfg);
    const { chatOverlayOwnImage, chatOverlayOwnImagePath, cloudStorage } =
      config;

    if (!chatOverlayOwnImage) {
      return;
    }

    if (!cloudStorage) {
      console.warn('[Manager] To use a custom overlay, enable cloud storage');
      throw new Error(getLocaleError(Phrase.ErrorCustomOverlayNotAllowed));
    }

    if (!chatOverlayOwnImagePath) {
      console.warn(
        '[Manager] Overlay image was not provided for custom overlay',
      );

      throw new Error(getLocaleError(Phrase.ErrorNoCustomImage));
    }

    if (
      !chatOverlayOwnImagePath.toLocaleLowerCase().endsWith('.png') &&
      !chatOverlayOwnImagePath.toLocaleLowerCase().endsWith('.gif')
    ) {
      console.warn('[Manager] Overlay image must be a .png or .gif file');
      throw new Error(getLocaleError(Phrase.ErrorCustomImageFileType));
    }

    const fileExists = await exists(chatOverlayOwnImagePath);

    if (!fileExists) {
      console.warn(`[Manager] ${chatOverlayOwnImagePath} does not exist`);
      let errorMsg = getLocaleError(Phrase.ErrorCustomImageFileType);
      errorMsg += `: ${chatOverlayOwnImagePath}`;
      throw new Error(errorMsg);
    }
  }

  /**
   * Setup event listeneres the app relies on.
   */
  private setupListeners() {
    // Config change listener we use to tweak the app settings in Windows if
    // the user enables/disables run on start-up.
    this.cfg.on('change', (key: string, value: unknown) => {
      if (key === 'startUp') {
        const isStartUp = value === true;
        console.info('[Main] OS level set start-up behaviour:', isStartUp);

        app.setLoginItemSettings({
          openAtLogin: isStartUp,
        });
      }
    });

    ipcMain.on(
      'configurePreview',
      (_event, x: number, y: number, width: number, height: number) => {
        this.recorder.configurePreview(x, y, width, height);
        this.redrawPreview();
      },
    );

    ipcMain.on('showPreview', () => {
      this.recorder.showPreview();
    });

    ipcMain.on('hidePreview', () => {
      this.recorder.hidePreview();
    });

    ipcMain.on('disablePreview', () => {
      this.recorder.disablePreview();
    });

    // Encoder listener, to populate settings on the frontend.
    ipcMain.handle('getEncoders', (): string[] => {
      const obsEncoders = this.recorder
        .getAvailableEncoders()
        .filter((encoder) => encoder !== 'none');

      return obsEncoders;
    });

    // Test listener, to enable the test button to start a test.
    ipcMain.on('test', (_event, args) => {
      const testCategory = args[0] as VideoCategory;
      const endTest = Boolean(args[1]);
      this.test(testCategory, endTest);
    });

    // Clipping listener.
    ipcMain.on('clip', async (_event, args) => {
      console.info('[Manager] Clip request received with args', args);

      const source = args[0];
      const offset = args[1];
      const duration = args[2];

      const sourceMetadata = await getMetadataForVideo(source);
      const now = new Date();
      const clipMetadata = buildClipMetadata(sourceMetadata, duration, now);

      const clipQueueItem: VideoQueueItem = {
        source,
        suffix: `Clipped at ${getOBSFormattedDate(now)}`,
        offset,
        duration,
        deleteSource: false,
        metadata: clipMetadata,
      };

      this.videoProcessQueue.queueVideo(clipQueueItem);
    });

    // Force stop listener, to enable the force stop button to do its job.
    ipcMain.on('recorder', async (_event, args) => {
      if (args[0] === 'stop') {
        console.info('[Manager] Force stopping recording due to user request.');
        this.forceStop();
        return;
      }

      const isWowRunning = this.poller.isWowRunning();

      if (isWowRunning) {
        this.onWowStarted();
      }
    });

    // VideoButton event listeners.
    ipcMain.on('videoButton', async (_event, args) => {
      const action = args[0] as string;

      if (action === 'open') {
        // Open only called for disk based video, see openURL for cloud version.
        const src = args[1] as string;
        const cloud = args[2] as boolean;
        assert(!cloud);
        openSystemExplorer(src);
      }

      if (action === 'protect') {
        const protect = args[1] as boolean;
        const videos = args[2] as RendererVideo[];

        const cloud = videos.filter((v) => v.cloud);
        const disk = videos.filter((v) => !v.cloud);

        disk
          .map((v) => v.videoSource)
          .forEach((src) => protectVideoDisk(protect, src));

        if (cloud.length > 0) {
          const cloudNames = cloud.map((v) => v.videoName);
          this.protectVideoCloud(protect, cloudNames);
        }
      }

      if (action === 'tag') {
        const tag = args[1] as string;
        const videos = args[2] as RendererVideo[];

        const cloud = videos.filter((v) => v.cloud);
        const disk = videos.filter((v) => !v.cloud);

        disk.map((v) => v.videoSource).forEach((src) => tagVideoDisk(src, tag));

        if (cloud.length > 0) {
          const cloudNames = cloud.map((v) => v.videoName);
          this.tagVideosCloud(cloudNames, tag);
        }
      }

      if (action === 'download') {
        if (!this.configValid) {
          console.warn('[Manager] Refusing to queue download, config invalid');
          return;
        }

        const video = args[1] as RendererVideo;
        this.videoProcessQueue.queueDownload(video);
      }

      if (action === 'upload') {
        if (!this.configValid) {
          console.warn('[Manager] Refusing to queue upload, config invalid');
          return;
        }

        const src = args[1] as string;

        const item: UploadQueueItem = {
          path: src,
        };

        this.videoProcessQueue.queueUpload(item);
      }
    });

    ipcMain.on('deleteVideos', async (_event, args) => {
      const videos = args as RendererVideo[];

      const cloud = videos.filter((v) => v.cloud);
      const disk = videos.filter((v) => !v.cloud);

      disk.map((v) => v.videoSource).forEach(this.deleteVideoDisk);

      if (cloud.length > 0) {
        this.deleteCloudVideos(cloud);
      }
    });

    /**
     * Callback to attach the audio devices. This is called when the user
     * opens the audio settings so that the volmeter bars can be populated.
     */
    ipcMain.handle('audioSettingsOpen', () => {
      console.info('[Manager] Audio settings were opened');
      noobs.SetVolmeterEnabled(true);

      if (this.poller.isWowRunning()) {
        console.info('[Manager] Wont touch audio sources as WoW is running');
        return;
      }

      const audioConfig = getObsAudioConfig(this.cfg);
      this.recorder.configureAudioSources(audioConfig);
    });

    ipcMain.handle('audioSettingsClosed', () => {
      console.info('[Manager] Audio settings were closed');
      noobs.SetVolmeterEnabled(false);

      if (this.poller.isWowRunning()) {
        console.info('[Manager] Wont touch audio sources as WoW is running');
        return;
      }

      this.recorder.removeAudioSources();
    });

    ipcMain.handle('getDisplayInfo', () => {
      return this.recorder.getDisplayInfo();
    });

    ipcMain.handle('getSourcePosition', (_event, item: WCRSceneItem) => {
      return this.recorder.getSourcePosition(item);
    });

    ipcMain.on(
      'setSourcePosition',
      (
        _event,
        item: WCRSceneItem,
        target: { x: number; y: number; width: number; height: number },
      ) => {
        this.recorder.setSourcePosition(item, target);
        // Don't need to redraw here, frontend handles this for us.
      },
    );

    ipcMain.on('resetSourcePosition', (_event, item: WCRSceneItem) => {
      this.recorder.resetSourcePosition(item);
      this.redrawPreview();
    });

    ipcMain.handle(
      'createAudioSource',
      (_event, id: string, type: AudioSourceType) => {
        console.info('[Manager] Creating audio source', id, 'of type', type);
        const name = noobs.CreateSource(id, type);
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
      settings['window'] = value;
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

    /**
     * Get the next key pressed by the user. This can be modifier keys, so if
     * you want to catch the next non-modifier key you may need to call this
     * a few times back to back. The event returned includes modifier details.
     *
     * Probably should rename the PTTKeyPressEvent, it's generic and not
     * specific to Push to Talk, it's just like that for historical reasons.
     */
    ipcMain.handle('getNextKeyPress', async (): Promise<PTTKeyPressEvent> => {
      this.manualHotKeyDisabled = true;

      const event = await Promise.race([
        nextKeyPressPromise(),
        nextMousePressPromise(),
      ]);

      this.manualHotKeyDisabled = false;
      return event;
    });

    /**
     * Manually start/stop recording. Being careful with the logs here as
     * some of this is very spammy as it fires on every key press.
     */
    uIOhook.on('keydown', (event: UiohookKeyboardEvent) => {
      if (this.manualHotKeyDisabled) {
        // This user is updating their settings. Don't do anything.
        return;
      }

      if (!this.cfg.get('manualRecord')) {
        // Manual recording is not enabled.
        return;
      }

      if (!isManualRecordHotKey(event)) {
        // It's not the manual record hotkey.
        return;
      }

      if (!this.poller.isWowRunning()) {
        console.warn('[Manager] WoW not running when manual hotkey pressed');
        return;
      }

      const logHandlers = [
        this.retailLogHandler,
        this.retailPtrLogHandler,
        this.classicLogHandler,
        this.eraLogHandler,
      ];

      // TODO - worry about the reverse. This protects starting a manual
      // recording while in a real activity. What about starting a real
      // activity while in a manual activity? I think that needs solved.
      const inRealActivity =
        logHandlers
          .filter((handler) => handler !== undefined)
          .map((handler) => handler.activity)
          .filter((activity) => activity !== undefined)
          .map((handler) => handler.category)
          .filter((category) => category !== VideoCategory.Manual).length > 0;

      if (inRealActivity) {
        console.warn('[Manager] In activity, unable to start manual recording');
        const sounds = this.cfg.get('manualRecordSoundAlert');

        if (sounds) {
          playSoundAlert(SoundAlerts.MANUAL_RECORDING_ERROR, this.window);
        }

        return;
      }

      if (!this.manualLogHandler) {
        // I don't think it should be possible to hit this, but be safe.
        // The poller check above compares WoW process state to config categories.
        console.warn('[Manager] No manual log handler available');
        const sounds = this.cfg.get('manualRecordSoundAlert');

        if (sounds) {
          playSoundAlert(SoundAlerts.MANUAL_RECORDING_ERROR, this.window);
        }

        return;
      }

      this.manualLogHandler.handleManualRecordingHotKey();
    });

    // Important we shutdown OBS on the before-quit event as if we get closed by
    // the installer we want to ensure we shutdown OBS, this is common when
    // upgrading the app. See issue 325 and 338.
    app.on('before-quit', () => {
      console.info('[Manager] Running before-quit actions');
      this.poller.reset();
      uIOhook.stop();
      this.recorder.shutdownOBS();
    });

    // If Windows is going to sleep, we don't want to confuse OBS. It would be
    // unusual for someone to sleep windows while WoW is open AND while in an
    // activity, all we can do is drop the activity and stop the recorder.
    powerMonitor.on('suspend', async () => {
      console.info('[Manager] Detected Windows is going to sleep.');
      this.dropActivity();
      this.poller.reset();
      await this.recorder.stop(true);
    });

    powerMonitor.on('resume', async () => {
      console.info('[Manager] Detected Windows waking up from a sleep.');
      await this.recorder.stop(true);

      this.poller
        .on('wowProcessStart', () => this.onWowStarted())
        .on('wowProcessStop', () => this.onWowStopped())
        .start();
    });
  }

  /**
   * Delete a video from the disk, and its accompanying metadata.
   */
  private deleteVideoDisk = async (videoName: string) => {
    try {
      // Bit weird we have to check a boolean here given all the error handling
      // going on. That's just me taking an easy way out rather than fixing this
      // more elegantly. TL;DR deleteVideoDisk doesn't throw anything.
      const success = await deleteVideoDisk(videoName);

      if (!success) {
        throw new Error('Failed deleting video, will mark for delete');
      }
    } catch (error) {
      // If that didn't work for any reason, try to at least mark it for deletion,
      // so that it can be picked up on refresh and we won't show videos the user
      // intended to delete
      console.warn(
        '[Manager] Failed to directly delete video on disk:',
        String(error),
      );

      markForVideoForDelete(videoName);
    }
  };

  /**
   * Delete a video from the cloud, and it's accompanying metadata.
   */
  private deleteCloudVideos = async (videos: RendererVideo[]) => {
    try {
      assert(this.cloudClient);
      const names = videos.map((v) => v.videoName);
      await this.cloudClient.deleteVideos(names);
    } catch (error) {
      // Just log this and quietly swallow it. Nothing more we can do.
      console.warn('[Manager] Failed to bulk delete', String(error));
    }
  };

  /**
   * Toggle protection on a video in the cloud.
   */
  private protectVideoCloud = async (
    protect: boolean,
    videoNames: string[],
  ) => {
    console.info(
      `[Manager] User ${protect ? 'protected' : 'unprotected'}`,
      videoNames,
    );

    try {
      assert(this.cloudClient);

      if (protect) {
        await this.cloudClient.protectVideos(true, videoNames);
      } else {
        await this.cloudClient.protectVideos(false, videoNames);
      }
    } catch (error) {
      // Just log this and quietly swallow it. Nothing more we can do.
      console.warn(
        `[Manager] Failed to ${protect ? 'protect' : 'unprotect'}`,
        videoNames,
        String(error),
      );
    }
  };

  /**
   * Tag a video in the cloud.
   */
  private tagVideosCloud = async (videoNames: string[], tag: string) => {
    console.info('[Manager] User tagged', videoNames, 'with', tag);

    try {
      assert(this.cloudClient);
      await this.cloudClient.tagVideos(tag, videoNames);
    } catch (error) {
      // Just log this and quietly swallow it. Nothing more we can do.
      console.warn('[Manager] Failed to tag', videoNames, String(error));
    }
  };
}
