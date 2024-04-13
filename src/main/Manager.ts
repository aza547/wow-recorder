/* eslint-disable no-await-in-loop */
import { BrowserWindow, app, ipcMain, powerMonitor } from 'electron';
import { isEqual } from 'lodash';
import path from 'path';
import fs from 'fs';
import { uIOhook } from 'uiohook-napi';
import assert from 'assert';
import EraLogHandler from '../parsing/EraLogHandler';
import {
  addCrashToUI,
  buildClipMetadata,
  checkDisk,
  getMetadataForVideo,
  getOBSFormattedDate,
  validateFlavour,
  tagVideoDisk,
  toggleVideoProtectedDisk,
  openSystemExplorer,
  markForVideoForDelete,
  getPromiseBomb,
  loadAllVideosDisk,
} from './util';
import { VideoCategory } from '../types/VideoCategory';
import Poller from '../utils/Poller';
import ClassicLogHandler from '../parsing/ClassicLogHandler';
import RetailLogHandler from '../parsing/RetailLogHandler';
import Recorder from './Recorder';
import ConfigService from './ConfigService';
import {
  ObsBaseConfig,
  ObsVideoConfig,
  ObsAudioConfig,
  RecStatus,
  ConfigStage,
  FlavourConfig,
  ObsOverlayConfig,
  IOBSDevice,
  CrashData,
  VideoQueueItem,
  MicStatus,
  RendererVideo,
  CloudStatus,
  DiskStatus,
  UploadQueueItem,
  CloudMetadata,
} from './types';
import {
  getObsBaseConfig,
  getObsVideoConfig,
  getObsAudioConfig,
  getFlavourConfig,
  getOverlayConfig,
} from '../utils/configUtils';
import { ERecordingState } from './obsEnums';
import {
  runClassicRecordingTest,
  runRetailRecordingTest,
} from '../utils/testButtonUtils';
import VideoProcessQueue from './VideoProcessQueue';
import CloudClient from '../storage/CloudClient';
import CloudSizeMonitor from '../storage/CloudSizeMonitor';
import DiskSizeMonitor from '../storage/DiskSizeMonitor';

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

  private mainWindow: BrowserWindow;

  private cfg: ConfigService = ConfigService.getInstance();

  private poller = Poller.getInstance(getFlavourConfig(this.cfg));

  private active = false;

  private queued = false;

  private obsBaseCfg: ObsBaseConfig = getObsBaseConfig(this.cfg);

  private obsVideoCfg: ObsVideoConfig = getObsVideoConfig(this.cfg);

  private obsAudioCfg: ObsAudioConfig = getObsAudioConfig(this.cfg);

  private flavourCfg: FlavourConfig = getFlavourConfig(this.cfg);

  private overlayCfg: ObsOverlayConfig = getOverlayConfig(this.cfg);

  private retailLogHandler: RetailLogHandler | undefined;

  private classicLogHandler: ClassicLogHandler | undefined;

  private eraLogHandler: EraLogHandler | undefined;

  private cloudClient: CloudClient | undefined;

  private videoProcessQueue: VideoProcessQueue;

  private configValid = false;

  private configMessage = '';

  /**
   * Defined stages of configuration. They are named only for logging
   * purposes. Each stage holds the current state of the stages config,
   * and provides functions to get, validate and configure the config.
   */
  private stages: ConfigStage[] = [
    /* eslint-disable prettier/prettier */
    {
      name: 'obsBase',
      valid: false,
      current: this.obsBaseCfg,
      get: (cfg: ConfigService) => getObsBaseConfig(cfg),
      validate: async (config: ObsBaseConfig) => Manager.validateBaseCfg(config),
      configure: async (config: ObsBaseConfig) => this.configureObsBase(config),
    },
    {
      name: 'obsVideo',
      valid: false,
      current: this.obsVideoCfg,
      get: (cfg: ConfigService) => getObsVideoConfig(cfg),
      validate: async () => {},
      configure: async (config: ObsVideoConfig) => this.configureObsVideo(config),
    },
    {
      name: 'obsAudio',
      valid: false,
      current: this.obsAudioCfg,
      get: (cfg: ConfigService) => getObsAudioConfig(cfg),
      validate: async () => {},
      configure: async (config: ObsAudioConfig) => this.configureObsAudio(config),
    },
    {
      name: 'flavour',
      valid: false,
      current: this.flavourCfg,
      get: (cfg: ConfigService) => getFlavourConfig(cfg),
      validate: async (config: FlavourConfig) => validateFlavour(config),
      configure: async (config: FlavourConfig) => this.configureFlavour(config),
    },
    {
      name: 'overlay',
      valid: false,
      current: this.overlayCfg,
      get: (cfg: ConfigService) => getOverlayConfig(cfg),
      validate: async () => {},
      configure: async (config: ObsOverlayConfig) => this.configureObsOverlay(config),
    },
    /* eslint-enable prettier/prettier */
  ];

  /**
   * Constructor.
   */
  constructor(mainWindow: BrowserWindow) {
    console.info('[Manager] Creating manager');

    this.setupListeners();

    this.mainWindow = mainWindow;
    this.recorder = new Recorder(this.mainWindow);

    this.recorder.on('crash', (crashData) =>
      this.recoverRecorderFromCrash(crashData)
    );

    this.recorder.on('state-change', () => this.refreshStatus());
    this.videoProcessQueue = new VideoProcessQueue(this.mainWindow);

    this.poller
      .on('wowProcessStart', () => this.onWowStarted())
      .on('wowProcessStop', () => this.onWowStopped());

    setInterval(() => this.restartRecorder(), 5 * (1000 * 60));
  }

  /**
   * The public interface to this class. This function carefully calls into
   * internalManage() but catches duplicate calls and queues them, up to a
   * a limit of one queued call.
   *
   * This prevents someone spamming buttons in the setings page from sending
   * invalid configuration requests to the Recorder class.
   */
  public async manage() {
    if (this.active) {
      if (!this.queued) {
        console.info('[Manager] Queued a manage call');
        this.queued = true;
      }

      return;
    }

    this.active = true;
    await this.internalManage();

    if (this.queued) {
      console.info('[Manager] Execute a queued manage call');
      this.queued = false;
      await this.internalManage();
    }

    this.active = false;
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
  }

  /**
   * Run a test. We prefer retail here, if the user doesn't have a retail path
   * configured, then fall back to classic. We only pass through the category
   * for retail, any classic tests will default to 2v2. Probably should fix
   * that.
   */
  public test(category: VideoCategory, endTest: boolean) {
    if (this.retailLogHandler) {
      console.info('[Manager] Running retail test');
      const parser = this.retailLogHandler.combatLogWatcher;
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
   * This function iterates through the config stages, checks for any changes,
   * validates the new config and then applies it.
   */
  private async internalManage() {
    console.info('[Manager] Internal manage');

    for (let i = 0; i < this.stages.length; i++) {
      const stage = this.stages[i];
      const newConfig = stage.get(this.cfg);
      const stageConfigChanged = !isEqual(newConfig, stage.current);

      if (stageConfigChanged) {
        // Assume the config isn't valid till we prove otherwise.
        stage.valid = false;
      }

      if (!stage.valid) {
        try {
          await stage.validate(newConfig);
        } catch (error) {
          // If this stage isn't valid we won't go further, set the frontend
          // stage to reflect what's wrong and drop out.
          this.setConfigInvalid(String(error));
          return;
        }

        console.info(
          '[Manager] Configuring stage',
          stage.name,
          'with',
          newConfig
        );

        await stage.configure(newConfig);

        // We've validated and configured the new config, mark the stage as
        // valid so we won't reconfigure it unless it changes.
        stage.valid = true;
        stage.current = newConfig;
      }
    }

    // Update the frontend to reflect the valid config.
    this.setConfigValid();
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
    if (!this.configValid) {
      this.refreshRecStatus(
        RecStatus.InvalidConfig,
        String(this.configMessage)
      );
      return;
    }

    const inOverrun =
      this.retailLogHandler?.overrunning ||
      this.classicLogHandler?.overrunning ||
      this.eraLogHandler?.overrunning;

    const inActivity =
      this.retailLogHandler?.activity ||
      this.classicLogHandler?.activity ||
      this.eraLogHandler?.activity;

    if (inOverrun) {
      this.refreshRecStatus(RecStatus.Overruning);
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
  }

  /**
   * Send a message to the frontend to update the recorder status icon.
   */
  private refreshRecStatus(status: RecStatus, msg = '') {
    this.mainWindow.webContents.send('updateRecStatus', status, msg);
  }

  /**
   * Send a message to the frontend to update the mic status icon.
   */
  private refreshMicStatus(status: MicStatus) {
    this.mainWindow.webContents.send('updateMicStatus', status);
  }

  /**
   * Send a message to the frontend to update the cloud status, which populates
   * the cloud usage bar. Safe to call regardless of if cloud storage in use or not.
   */
  private async refreshCloudStatus() {
    if (this.cloudClient === undefined) {
      return;
    }

    try {
      const usage = await new CloudSizeMonitor(
        this.mainWindow,
        this.cloudClient,
        250
      ).usage();

      const status: CloudStatus = {
        usageGB: usage / 1024 ** 3,
        maxUsageGB: 250,
      };

      this.mainWindow.webContents.send('updateCloudStatus', status);
    } catch (error) {
      console.error('[Manager] Error getting cloud status', String(error));
    }
  }

  /**
   * Send a message to the frontend to update the disk status, which populates
   * the disk usage bar.
   */
  private async refreshDiskStatus() {
    const usage = await new DiskSizeMonitor(this.mainWindow).usage();

    const status: DiskStatus = {
      usageGB: usage / 1024 ** 3,
      maxUsageGB: this.cfg.get<number>('maxStorage'),
    };

    this.mainWindow.webContents.send('updateDiskStatus', status);
  }

  /**
   * Called when the WoW process is detected, which may be either on launch
   * of the App if WoW is open, or the user has genuinely opened WoW. Attaches
   * the audio sources and starts the buffer recording.
   */
  private async onWowStarted() {
    console.info('[Manager] Detected WoW is running');
    const config = getObsAudioConfig(this.cfg);
    this.recorder.configureAudioSources(config);

    try {
      await this.recorder.start();
    } catch (error) {
      console.error('[Manager] OBS failed to record when WoW started');
    }
  }

  /**
   * Called when the WoW process is detected to have exited. Ends any
   * recording that is still ongoing. We detach audio sources here to
   * allow Windows to go to sleep with WR running.
   */
  private async onWowStopped() {
    console.info(
      '[Manager] Detected WoW not running, or Windows going inactive'
    );

    if (this.retailLogHandler && this.retailLogHandler.activity) {
      await this.retailLogHandler.forceEndActivity();
      this.recorder.removeAudioSources();
    } else if (this.classicLogHandler && this.classicLogHandler.activity) {
      await this.classicLogHandler.forceEndActivity();
      this.recorder.removeAudioSources();
    } else if (this.eraLogHandler && this.eraLogHandler.activity) {
      await this.eraLogHandler.forceEndActivity();
      this.recorder.removeAudioSources();
    } else {
      await this.recorder.stop();
      this.recorder.removeAudioSources();
    }
  }

  /**
   * Configure the base OBS config. We need to stop the recording to do this.
   */
  private async configureObsBase(config: ObsBaseConfig) {
    await this.recorder.stop();

    const {
      cloudStorage,
      cloudUpload,
      cloudAccountName,
      cloudAccountPassword,
      cloudGuildName,
    } = config;

    if (this.cloudClient) {
      this.cloudClient.removeAllListeners();
      this.cloudClient.stopPollForUpdates();
      this.cloudClient = undefined;
      this.videoProcessQueue.unsetCloudClient();
    }

    if (cloudStorage) {
      this.cloudClient = new CloudClient(
        cloudAccountName,
        cloudAccountPassword,
        cloudGuildName
      );

      await this.cloudClient.init();

      this.cloudClient.on('change', () => {
        this.mainWindow.webContents.send('refreshState');
        this.refreshCloudStatus();
      });

      this.cloudClient.pollInit();
      this.cloudClient.pollForUpdates(10);

      if (cloudUpload) {
        // The video process queue only needs the cloud client for uploads, so
        // we only need to set this if we're configured to upload.
        this.videoProcessQueue.setCloudClient(this.cloudClient);
      }
    }

    this.refreshDiskStatus();
    this.recorder.configureBase(config);
    this.poller.start();
    this.mainWindow.webContents.send('refreshState');
  }

  /**
   * Configure video settings in OBS. This can all be changed live.
   */
  private configureObsVideo(config: ObsVideoConfig) {
    this.recorder.configureVideoSources(config);
  }

  /**
   * Configure audio settings in OBS. This can all be changed live.
   */
  private configureObsAudio(config: ObsAudioConfig) {
    if (this.poller.isWowRunning) {
      this.recorder.configureAudioSources(config);
    }
  }

  /**
   * Configure the RetailLogHandler.
   */
  private async configureFlavour(config: FlavourConfig) {
    if (this.recorder.obsState === ERecordingState.Recording) {
      // We can't change this config if OBS is recording. If OBS is recording
      // but isRecording is false, that means it's a buffer recording. Stop it
      // briefly to change the config.
      await this.recorder.stop();
    }

    if (this.retailLogHandler) {
      this.retailLogHandler.removeAllListeners();
      this.retailLogHandler.destroy();
    }

    if (this.classicLogHandler) {
      this.classicLogHandler.removeAllListeners();
      this.classicLogHandler.destroy();
    }

    if (this.eraLogHandler) {
      this.eraLogHandler.removeAllListeners();
      this.eraLogHandler.destroy();
    }

    if (config.recordRetail) {
      this.retailLogHandler = new RetailLogHandler(
        this.mainWindow,
        this.recorder,
        this.videoProcessQueue,
        config.retailLogPath
      );

      this.retailLogHandler.on('state-change', () => this.refreshStatus());
    }

    if (config.recordClassic) {
      this.classicLogHandler = new ClassicLogHandler(
        this.mainWindow,
        this.recorder,
        this.videoProcessQueue,
        config.classicLogPath
      );

      this.classicLogHandler.on('state-change', () => this.refreshStatus());
    }

    if (config.recordEra) {
      this.eraLogHandler = new EraLogHandler(
        this.mainWindow,
        this.recorder,
        this.videoProcessQueue,
        config.eraLogPath
      );

      this.eraLogHandler.on('state-change', () => this.refreshStatus());
    }

    this.poller.reconfigureFlavour(config);
    this.poller.start();
  }

  /**
   * Configure chat overlay in OBS. This can all be changed live.
   */
  private configureObsOverlay(config: ObsOverlayConfig) {
    this.recorder.configureOverlaySource(config);
  }

  private static async validateBaseCfg(config: ObsBaseConfig) {
    const { cloudStorage } = config;

    await Manager.validateBaseConfig(config);

    if (cloudStorage) {
      await Manager.validateCloudBaseConfig(config);
    }
  }

  private static async validateCloudBaseConfig(config: ObsBaseConfig) {
    const { cloudAccountName, cloudAccountPassword, cloudGuildName } = config;

    if (!cloudAccountName) {
      console.warn('[Manager] Empty account name');
      throw new Error('Account name must not be empty.');
    }

    if (!cloudAccountPassword) {
      console.warn('[Manager] Empty account key');
      throw new Error('Password must not be empty.');
    }

    if (!cloudGuildName) {
      console.warn('[Manager] Empty guild name');
      throw new Error('Guild name must not be empty.');
    }

    try {
      const client = new CloudClient(
        cloudAccountName,
        cloudAccountPassword,
        cloudGuildName
      );

      await client.init();

      // Poll init is a handy way to ensure we access to R2. If the mtime
      // object in R2 if this is the first launch, or to just read it if
      // it's already present.
      await Promise.race([
        client.pollInit(),
        getPromiseBomb(2000, 'R2 access too slow or failed'),
      ]);
    } catch (error) {
      console.warn('[Manager] Cloud validation failed,', String(error));
      throw new Error('Failed to authenticate with the cloud store.');
    }
  }

  private static async validateBaseConfig(config: ObsBaseConfig) {
    const { storagePath, maxStorage, obsPath } = config;

    if (!storagePath) {
      console.warn(
        '[Manager] Validation failed: `storagePath` is falsy',
        storagePath
      );

      throw new Error('Storage path is invalid.');
    }

    if (!fs.existsSync(path.dirname(storagePath))) {
      console.warn(
        '[Manager] Validation failed, storagePath does not exist',
        storagePath
      );

      throw new Error('Storage Path is invalid.');
    }

    await checkDisk(storagePath, maxStorage);

    if (!obsPath) {
      console.warn('[Manager] Validation failed: `obsPath` is falsy', obsPath);
      throw new Error('Buffer Storage Path is invalid.');
    }

    if (!fs.existsSync(path.dirname(obsPath))) {
      console.warn(
        '[Manager] Validation failed, obsPath does not exist',
        obsPath
      );

      throw new Error('Buffer Storage Path is invalid.');
    }

    if (storagePath === obsPath) {
      console.warn(
        '[Manager] Validation failed: Storage Path is the same as Buffer Path'
      );

      throw new Error('Storage Path is the same as Buffer Path');
    }

    // 10GB is a rough guess at what the worst case buffer directory might be.
    if (fs.existsSync(obsPath)) {
      await checkDisk(obsPath, 10);
    } else {
      const parentDir = path.dirname(obsPath);
      await checkDisk(parentDir, 10);
    }
  }

  /**
   * Setup event listeneres the app relies on.
   */
  private setupListeners() {
    // Config change listener we use to tweak the app settings in Windows if
    // the user enables/disables run on start-up.
    this.cfg.on('change', (key: string, value: any) => {
      if (key === 'startUp') {
        const isStartUp = value === true;
        console.info('[Main] OS level set start-up behaviour:', isStartUp);

        app.setLoginItemSettings({
          openAtLogin: isStartUp,
        });
      }
    });

    // The OBS preview window is tacked on-top of the UI so we call this often
    // whenever we need to move, resize, show or hide it.
    ipcMain.on('preview', (_event, args) => {
      if (args[0] === 'show') {
        this.recorder.showPreview(args[1], args[2], args[3], args[4]);
      } else if (args[0] === 'hide') {
        this.recorder.hidePreview();
      }
    });

    // Encoder listener, to populate settings on the frontend.
    ipcMain.handle('getEncoders', (): string[] => {
      const obsEncoders = this.recorder
        .getAvailableEncoders()
        .filter((encoder) => encoder !== 'none');

      return obsEncoders;
    });

    // Audio devices listener, to populate settings on the frontend.
    ipcMain.handle(
      'getAudioDevices',
      (): {
        input: IOBSDevice[];
        output: IOBSDevice[];
      } => {
        if (!this.recorder.obsInitialized) {
          return {
            input: [],
            output: [],
          };
        }

        const inputDevices = this.recorder.getInputAudioDevices();
        const outputDevices = this.recorder.getOutputAudioDevices();

        return {
          input: inputDevices,
          output: outputDevices,
        };
      }
    );

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
      const clipMetadata = buildClipMetadata(sourceMetadata, duration);
      const now = new Date();

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

      this.manage();
    });

    // Respond to a request from frontend for the cloud or disk usage
    // status; this populates the storage progress bars.
    ipcMain.on('getCloudStatus', () => this.refreshCloudStatus());
    ipcMain.on('getDiskStatus', () => this.refreshDiskStatus());

    // VideoButton event listeners.
    ipcMain.on('videoButton', async (_event, args) => {
      const action = args[0] as string;
      const src = args[1] as string;

      if (action === 'open') {
        // Open only called for disk based video, see openURL for cloud version.
        const cloud = args[2] as boolean;
        assert(!cloud);
        openSystemExplorer(src);
      }

      if (action === 'save') {
        const cloud = args[2] as boolean;
        const bool = args[3] as boolean;

        if (cloud) {
          await this.protectVideoCloud(src, bool);
        } else {
          await toggleVideoProtectedDisk(src);
        }
      }

      if (action === 'tag') {
        const cloud = args[2] as boolean;
        const tag = args[3] as string;

        if (cloud) {
          await this.tagVideoCloud(src, tag);
        } else {
          await tagVideoDisk(src, tag);
        }
      }

      if (action === 'download') {
        this.videoProcessQueue.queueDownload(src);
      }

      if (action === 'upload') {
        const item: UploadQueueItem = {
          path: src,
        };

        this.videoProcessQueue.queueUpload(item);
      }
    });

    ipcMain.on('safeDeleteVideo', async (_event, args) => {
      const src = args[0] as string;
      const cloud = args[1] as string;

      if (cloud) {
        // No special handling for cloud storage.
        await this.deleteVideoCloud(src);
      } else {
        markForVideoForDelete(src);
      }
    });

    // URL Signer. We expose this so that the videoState doesn't need to
    // contain signed URLs which are variable. That triggers lots of re-renders
    // we can do without if we keep things deterministic.
    ipcMain.handle('signGetUrl', async (_event, args): Promise<string> => {
      const baseUrl = args[0];

      if (this.cloudClient === undefined) {
        return '';
      }

      // Sign the frontend resources for a week in the future so that we don't
      // need to worry about these links expiring. We only use this function for
      // loading images and videos directly into React.
      return this.cloudClient.signGetUrl(baseUrl, 3600 * 24 * 7);
    });

    // Important we shutdown OBS on the before-quit event as if we get closed by
    // the installer we want to ensure we shutdown OBS, this is common when
    // upgrading the app. See issue 325 and 338.
    app.on('before-quit', () => {
      console.info('[Manager] Running before-quit actions');
      this.recorder.shutdownOBS();
      uIOhook.stop();
    });

    // If Windows is going to sleep, we don't want to confuse OBS. Stop the
    // recording as if WoW has been closed, and resume it once Windows has
    // resumed.
    powerMonitor.on('suspend', () => {
      console.info('[Manager] Detected Windows is going to sleep.');
      this.onWowStopped();
    });

    powerMonitor.on('resume', () => {
      console.info('[Manager] Detected Windows waking up from a sleep.');
      this.poller.start();
    });
  }

  /**
   * If the recorder emits a crash event, we shut down OBS and create a new
   * recorder. That may not help whatever caused the crash, but will help
   * the app back into a good state.
   */
  private recoverRecorderFromCrash(crashData: CrashData) {
    console.error('[Manager] OBS got into a bad state, restarting it');
    addCrashToUI(this.mainWindow, crashData);

    this.recorder.removeAllListeners();
    this.recorder.shutdownOBS();

    if (this.retailLogHandler) {
      this.retailLogHandler.removeAllListeners();
      this.retailLogHandler.destroy();
    }

    if (this.classicLogHandler) {
      this.classicLogHandler.removeAllListeners();
      this.classicLogHandler.destroy();
    }

    if (this.eraLogHandler) {
      this.eraLogHandler.removeAllListeners();
      this.eraLogHandler.destroy();
    }

    this.recorder = new Recorder(this.mainWindow);
    this.recorder.on('crash', (cd) => this.recoverRecorderFromCrash(cd));
    this.recorder.on('state-change', () => this.refreshStatus());

    for (let i = 0; i < this.stages.length; i++) {
      this.stages[i].valid = false;
    }

    this.active = false;
    this.queued = false;
    this.manage();
  }

  /**
   * Every so often we'll try restart the recorder to avoid having an
   * infinitely long video sitting in the .temp folder. First we check
   * it's safe to do so, i.e. we're currently recording and not in an
   * activity.
   */
  private async restartRecorder() {
    if (this.recorder.obsState !== ERecordingState.Recording) {
      console.info('[Manager] Not restarting recorder as not recording');
      return;
    }

    const retailNotSafe = this.retailLogHandler?.activity;
    const classicNotSafe = this.classicLogHandler?.activity;
    const eraNotSafe = this.eraLogHandler?.activity;

    if (retailNotSafe || classicNotSafe || eraNotSafe) {
      console.info('[Manager] Not restarting recorder as in an activity');
      return;
    }

    const retailOverrunning = this.retailLogHandler?.overrunning;
    const classicOverrunning = this.classicLogHandler?.overrunning;
    const eraOverrunning = this.eraLogHandler?.overrunning;

    if (retailOverrunning || classicOverrunning || eraOverrunning) {
      console.info(
        '[Manager] Not restarting recorder as an activity is overrunning'
      );
      return;
    }

    console.info('[Manager] Restart recorder');
    await this.recorder.stop();
    await this.recorder.cleanup();
    await this.recorder.start();
  }

  /**
   * Load the details for all the videos.
   */
  public async loadAllVideos(storagePath: string) {
    const videos: RendererVideo[] = [];

    if (this.cloudClient !== undefined) {
      const cloudVideos = await this.loadAllVideosCloud();
      videos.push(...cloudVideos);
    }

    const diskVideos = await loadAllVideosDisk(storagePath);
    videos.push(...diskVideos);

    return videos;
  }

  private async loadAllVideosCloud(): Promise<RendererVideo[]> {
    let data: CloudMetadata[];

    try {
      assert(this.cloudClient);
      data = await this.cloudClient.getState();
    } catch (error) {
      console.error('[Manager] Failed to get state:', String(error));
      return [];
    }

    const list: RendererVideo[] = data.map((metadata) => {
      return {
        ...metadata,
        videoSource: metadata.videoKey,
        thumbnailSource: metadata.thumbnailKey,
        multiPov: [],
        cloud: true,
        isProtected: Boolean(metadata.protected),
        mtime: 0,
      };
    });

    return list;
  }

  /**
   * Delete a video from the cloud, and it's accompanying metadata and thumbnail.
   */
  private deleteVideoCloud = async (videoName: string) => {
    try {
      assert(this.cloudClient);
      await this.cloudClient.deleteVideo(videoName);
    } catch (error) {
      // Just log this and quietly swallow it. Nothing more we can do.
      console.warn('[Manager] Failed to delete', videoName, String(error));
    }
  };

  /**
   * Toggle protection on a video in the cloud.
   */
  private protectVideoCloud = async (videoName: string, bool: boolean) => {
    console.info('[Manager] User protected', videoName, bool);

    try {
      assert(this.cloudClient);
      await this.cloudClient.protectVideo(videoName, bool);
    } catch (error) {
      // Just log this and quietly swallow it. Nothing more we can do.
      console.warn('[Manager] Failed to protect', videoName, String(error));
    }
  };

  /**
   * Tag a video in the cloud.
   */
  private tagVideoCloud = async (videoName: string, tag: string) => {
    console.info('[Manager] User tagged', videoName, 'with', tag);

    try {
      assert(this.cloudClient);
      await this.cloudClient.tagVideo(videoName, tag);
    } catch (error) {
      // Just log this and quietly swallow it. Nothing more we can do.
      console.warn('[Manager] Failed to tag', videoName, String(error));
    }
  };
}
