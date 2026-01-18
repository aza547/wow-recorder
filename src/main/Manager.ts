import { app, ipcMain, powerMonitor } from 'electron';
import { uIOhook, UiohookKeyboardEvent } from 'uiohook-napi';
import EraLogHandler from '../parsing/EraLogHandler';
import {
  buildClipMetadata,
  getMetadataForVideo,
  getOBSFormattedDate,
  isManualRecordHotKey,
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
  WowProcessEvent,
  BaseConfig,
  ActivityStatus,
} from './types';
import {
  getObsVideoConfig,
  getObsAudioConfig,
  getOverlayConfig,
  getBaseConfig,
  validateBaseConfig,
} from '../utils/configUtils';
import { ERecordingState } from './obsEnums';
import {
  runClassicRecordingTest,
  runRetailRecordingTest,
} from '../utils/testButtonUtils';
import VideoProcessQueue from './VideoProcessQueue';
import LogHandler from 'parsing/LogHandler';
import { PTTKeyPressEvent } from 'types/KeyTypesUIOHook';
import { send } from './main';
import DiskClient from 'storage/DiskClient';
import Activity from 'activitys/Activity';

/**
 * Manager class.
 */
export default class Manager {
  /**
   * Quick references to a bunch of singletons.
   */
  private poller = Poller.getInstance();
  private recorder = Recorder.getInstance();
  private cfg = ConfigService.getInstance();

  /**
   * Log handlers.
   */
  private retailLogHandler: RetailLogHandler | undefined;
  private retailPtrLogHandler: RetailLogHandler | undefined;
  private classicLogHandler: ClassicLogHandler | undefined;
  private classicPtrLogHandler: ClassicLogHandler | undefined;
  private eraLogHandler: EraLogHandler | undefined;

  /**
   * If the config is valid or not.
   */
  private configValid = false;

  /**
   * The config message, typically used to show the user why their config is
   * invalid.
   */
  private configMessage = '';

  /**
   * If we are in the middle of a reconfigure or not.
   */
  private reconfiguring = false;

  /**
   * If the audio settings are open or not. We want the audio devices to
   * be attached to power the volmeters in the case they are on display,
   * even if WoW is closed. But we want the audio devices disconnected if
   * both the settings and WoW are closed to allow Windows to naturally sleep.
   */
  private audioSettingsOpen = false;

  /**
   * It's confusing if you try to change the hotkey to something similar and
   * it starts a recording mid changing it, so set this to true while doing so.
   */
  private manualHotKeyDisabled = false;

  /**
   * Constructor.
   */
  constructor() {
    console.info('[Manager] Creating manager');
    this.setupListeners();

    this.recorder.on('state-change', () => {
      setTimeout(() => this.refreshStatus(), 0);
    });

    this.poller
      .on(WowProcessEvent.STARTED, () => this.onWowStarted())
      .on(WowProcessEvent.STOPPED, () => this.onWowStopped());
  }

  /**
   * Run the startup configuration. Run once, on startup.
   */
  public async startup() {
    console.info('[Manager] Starting up');
    this.reconfiguring = true;
    let success = false;

    try {
      // This can fail.
      await this.configureBase(true);
      success = true;
    } catch (error) {
      console.error('[Manager] Failed to configure base on startup', error);
      this.setConfigInvalid(String(error));
    }

    // This stuff should never fail, and doesn't rely on the previous step
    // succeeding. We still want to apply as much as we can.
    await this.configureObsVideo();
    await this.configureObsAudio();
    await this.configureObsOverlay();

    if (success) {
      this.setConfigValid();
      this.poller.start();
    }

    this.reconfiguring = false;
  }

  /**
   * Reconfigure the base settings. This exists because we need the recorder
   * to be stopped to do this, and because the user can input invalid settings
   * which we want to catch.
   *
   * Be careful how you call this. While JavaScript is single-threaded, async
   * calls can overlap and cause race conditions. Do not run this concurrently.
   */
  public async reconfigureBase() {
    console.info('[Manager] Reconfiguring base');

    // The recording must be stopped to do this.
    await this.recorder.forceStop(true);
    this.reconfiguring = true;
    this.refreshStatus();
    let success = false;

    try {
      await this.configureBase(false);
      success = true;
    } catch (error) {
      console.error('[Manager] Failed to configure base on startup', error);
      this.setConfigInvalid(String(error));
    }

    if (success) {
      this.setConfigValid();
      this.poller.start();
    }

    // We're done, now make sure we refresh the frontend.
    this.reconfiguring = false;
    this.refreshStatus();

    // ...and for the disk client too.
    await DiskClient.getInstance().refreshStatus();
    await DiskClient.getInstance().refreshVideos();
  }

  /**
   * Configure the base config.
   */
  private async configureBase(startup: boolean) {
    const config = getBaseConfig(this.cfg);
    await validateBaseConfig(config);
    await this.applyBaseConfig(config, startup);
  }

  /**
   * Force a recording to stop regardless of the scenario.
   */
  public async forceStop() {
    if (!LogHandler.activity) {
      console.info('[Manager] No activity to force end');
      return;
    }

    console.info('[Manager] Force ending activity');
    LogHandler.forceEndActivity();
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
    this.refreshStatus();
  }

  /**
   * Set member variables to reflect the config being invalid.
   */
  private setConfigInvalid(reason: string) {
    this.configValid = false;
    this.configMessage = reason;
    this.refreshStatus();
  }

  /**
   * Refresh the recorder and mic status icons in the UI. This is the only
   * place that this should be done from to avoid any status icon confusion.
   */
  public refreshStatus() {
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

    const inOverrun = LogHandler.overrunning;

    if (inOverrun) {
      this.refreshRecStatus(RecStatus.Overrunning);
    } else if (LogHandler.activity) {
      const activityStatus: ActivityStatus = {
        category: LogHandler.activity.category,
        start: LogHandler.activity.startDate.getTime(),
      };

      this.refreshRecStatus(RecStatus.Recording, '', activityStatus);
    } else if (this.recorder.obsState === ERecordingState.Recording) {
      this.refreshRecStatus(RecStatus.ReadyToRecord);
    } else if (this.recorder.obsState === ERecordingState.None) {
      this.refreshRecStatus(RecStatus.WaitingForWoW);
    }

    this.refreshMicStatus(this.recorder.obsMicState);
    this.redrawPreview();
  }

  /**
   * Send a message to the frontend to update the recorder status icon.
   */
  private refreshRecStatus(
    status: RecStatus,
    msg = '',
    activityStatus: ActivityStatus | null = null,
  ) {
    send('updateRecStatus', status, msg);
    send('updateActivityStatus', activityStatus);
  }

  /**
   * Send a message to the frontend to update the mic status icon.
   */
  private refreshMicStatus(status: MicStatus) {
    send('updateMicStatus', status);
  }

  /**
   * Trigger the frontend to redraw the preview if it's open.
   */
  private redrawPreview() {
    // Really don't understand the need for the timeout here but it sometimes
    // gets stale data otherwise. A caching thing in libobs maybe? Noobs will
    // send a source signal to the recorder if the size of sources change, but
    // for other changes we need to manually trigger a redraw.
    setTimeout(() => send('redrawPreview'), 100);
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
    const inActivity = Boolean(LogHandler.activity);

    if (inActivity) {
      console.info('[Manager] Force ending activity');
      LogHandler.forceEndActivity();
    } else {
      await this.recorder.forceStop(true);
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
  private async applyBaseConfig(config: BaseConfig, startup: boolean) {
    await this.recorder.configureBase(config, startup);

    LogHandler.activity = undefined;
    LogHandler.overrunning = false;
    LogHandler.setStateChangeCallback(() => this.refreshStatus());

    if (!startup) {
      console.info('[Manager] Not startup, so reset log handlers');

      const logHandlers = [
        this.retailLogHandler,
        this.retailPtrLogHandler,
        this.classicLogHandler,
        this.classicPtrLogHandler,
        this.eraLogHandler,
      ];

      logHandlers
        .filter((lh) => lh !== undefined)
        .forEach((lh) => lh.destroy());

      this.retailLogHandler = undefined;
      this.retailPtrLogHandler = undefined;
      this.classicLogHandler = undefined;
      this.classicPtrLogHandler = undefined;
      this.eraLogHandler = undefined;
    }

    if (config.recordRetail) {
      this.retailLogHandler = new RetailLogHandler(config.retailLogPath);
    }

    if (config.recordClassic) {
      this.classicLogHandler = new ClassicLogHandler(config.classicLogPath);
    }

    if (config.recordClassicPtr) {
      this.classicLogHandler = new ClassicLogHandler(config.classicPtrLogPath);
    }

    if (config.recordEra) {
      this.eraLogHandler = new EraLogHandler(config.eraLogPath);
    }

    if (config.recordRetailPtr) {
      this.retailPtrLogHandler = new RetailLogHandler(config.retailPtrLogPath);
      this.retailPtrLogHandler.setIsPtr();
    }
  }

  /**
   * Configure video settings in OBS. This can all be changed live.
   */
  private configureObsVideo() {
    const config = getObsVideoConfig(this.cfg);
    this.recorder.configureVideoSources(config);
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
        clip: true,
        metadata: clipMetadata,
      };

      VideoProcessQueue.getInstance().queueVideo(clipQueueItem);
    });

    // Listens for a manual recording being started via the button. The
    // hotkey listener is handled separately.
    ipcMain.on('toggleManualRecording', async () => {
      if (!this.cfg.get('manualRecord')) {
        // Manual recording is not enabled.
        return;
      }

      if (!this.poller.isWowRunning()) {
        console.warn('[Manager] WoW not running when manual hotkey pressed');
        return;
      }

      if (this.recorder.obsState !== ERecordingState.Recording) {
        console.warn('[Manager] Recorder not ready when manual hotkey pressed');
        return;
      }

      LogHandler.handleManualRecordingHotKey();
    });

    // Handles a click of the force stop button.
    ipcMain.on('forceStopRecording', async () => {
      LogHandler.forceEndActivity();
    });

    // Test listener, to enable the test button to start a test.
    ipcMain.on('test', (_event, args) => {
      const testCategory = args[0] as VideoCategory;
      const endTest = Boolean(args[1]);
      this.test(testCategory, endTest);
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

      if (this.recorder.obsState !== ERecordingState.Recording) {
        console.warn('[Manager] Recorder not ready when manual hotkey pressed');
        return;
      }

      LogHandler.handleManualRecordingHotKey();
    });

    // If Windows is going to sleep, we don't want to confuse OBS. It would be
    // unusual for someone to sleep windows while WoW is open AND while in an
    // activity, all we can do is drop the activity and stop the recorder.
    powerMonitor.on('suspend', async () => {
      console.info('[Manager] Detected Windows is going to sleep.');
      LogHandler.dropActivity();
      this.poller.stop();
      await this.recorder.forceStop(false); // No timeout on this.
    });

    powerMonitor.on('resume', async () => {
      console.info('[Manager] Detected Windows waking up from a sleep.');
      await this.recorder.forceStop(true);
      this.poller.start();
    });
  }
}
