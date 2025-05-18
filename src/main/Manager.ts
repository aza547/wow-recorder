import { BrowserWindow, app, clipboard, ipcMain, powerMonitor } from 'electron';
import { isEqual } from 'lodash';
import path from 'path';
import fs from 'fs';
import { uIOhook } from 'uiohook-napi';
import assert from 'assert';
import { getLocalePhrase, Language, Phrase } from 'localisation/translations';
import AuthError from '../utils/AuthError';
import EraLogHandler from '../parsing/EraLogHandler';
import {
  addCrashToUI,
  buildClipMetadata,
  checkDisk,
  getMetadataForVideo,
  getOBSFormattedDate,
  tagVideoDisk,
  openSystemExplorer,
  markForVideoForDelete,
  getPromiseBomb,
  loadAllVideosDisk,
  cloudSignedMetadataToRendererVideo,
  isFolderOwned,
  exists,
  takeOwnershipStorageDir,
  takeOwnershipBufferDir,
  deleteVideoDisk,
  getWowFlavour,
  convertKoreanVideoCategory,
  protectVideoDisk,
} from './util';
import { VideoCategory } from '../types/VideoCategory';
import Poller from '../utils/Poller';
import ClassicLogHandler from '../parsing/ClassicLogHandler';
import RetailLogHandler from '../parsing/RetailLogHandler';
import Recorder from './Recorder';
import ConfigService from '../config/ConfigService';
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
  CloudConfig,
} from './types';
import {
  getObsBaseConfig,
  getObsVideoConfig,
  getObsAudioConfig,
  getFlavourConfig,
  getOverlayConfig,
  getCloudConfig,
} from '../utils/configUtils';
import { ERecordingState } from './obsEnums';
import {
  runClassicRecordingTest,
  runRetailRecordingTest,
} from '../utils/testButtonUtils';
import VideoProcessQueue from './VideoProcessQueue';
import CloudClient from '../storage/CloudClient';
import DiskSizeMonitor from '../storage/DiskSizeMonitor';
import RetryableConfigError from '../utils/RetryableConfigError';
import { TAffiliation } from 'types/api';

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

  private cloudCfg: CloudConfig = getCloudConfig(this.cfg);

  private retailLogHandler: RetailLogHandler | undefined;

  private classicLogHandler: ClassicLogHandler | undefined;

  private eraLogHandler: EraLogHandler | undefined;

  private retailPtrLogHandler: RetailLogHandler | undefined;

  private cloudClient: CloudClient | undefined;

  private videoProcessQueue: VideoProcessQueue;

  private configValid = false;

  private configMessage = '';

  private reconfiguring = false;

  private retryTimer: NodeJS.Timeout | undefined;

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
      validate: async (config: ObsBaseConfig) => this.validateBaseConfig(config),
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
      validate: async (config: FlavourConfig) => this.validateFlavour(config),
      configure: async (config: FlavourConfig) => this.configureFlavour(config),
    },
    {
      name: 'overlay',
      valid: false,
      current: this.overlayCfg,
      get: (cfg: ConfigService) => getOverlayConfig(cfg),
      validate: async (config: ObsOverlayConfig) => this.validateOverlayConfig(config),
      configure: async (config: ObsOverlayConfig) => this.configureObsOverlay(config),
    },
    {
      name: 'cloud',
      valid: false,
      current: this.cloudCfg,
      get: (cfg: ConfigService) => getCloudConfig(cfg),
      validate: async (config: CloudConfig) => this.validateCloudConfig(config),
      configure: async (config: CloudConfig) => this.configureCloudClient(config),
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

    this.recorder.on('crash', (crashData) => {
      setTimeout(() => this.recoverRecorderFromCrash(crashData), 0);
    });

    this.recorder.on('state-change', () => {
      setTimeout(() => this.refreshStatus(), 0);
    });

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

    if (this.retailPtrLogHandler && this.retailPtrLogHandler.activity) {
      await this.retailPtrLogHandler.forceEndActivity();
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
   * This function iterates through the config stages, checks for any changes,
   * validates the new config and then applies it.
   */
  private async internalManage() {
    console.info('[Manager] Internal manage');
    this.reconfiguring = true;
    this.refreshStatus();

    if (this.retryTimer) {
      // We're here already configuring so we don't need to have a retry timer
      // active. We will create one if appropriate.
      clearTimeout(this.retryTimer);
    }

    for (let i = 0; i < this.stages.length; i++) {
      const stage = this.stages[i];
      const newConfig = stage.get(this.cfg);
      const stageConfigChanged = !isEqual(newConfig, stage.current);

      if (stageConfigChanged) {
        // Assume the config isn't valid till we prove otherwise.
        stage.valid = false;
      }

      if (!stage.valid) {
        const loggable = { ...newConfig };

        if (loggable.cloudAccountPassword) {
          loggable.cloudAccountPassword = '**********';
        }

        console.info(
          '[Manager] Validating and configuring stage',
          stage.name,
          'with',
          loggable,
        );

        try {
          console.info('[Manager] Now validating stage', stage.name);
          await stage.validate(newConfig);
          console.info('[Manager] Validated stage', stage.name);
        } catch (error) {
          // If this stage isn't valid we won't go further, set the frontend
          // stage to reflect what's wrong and drop out.
          console.warn('[Manager] Failed validating stage', stage.name, error);
          this.reconfiguring = false;
          this.setConfigInvalid(String(error));

          if (error instanceof RetryableConfigError) {
            // If we hit a RetryableConfigError, typically a network
            // issue, then retry in a bit. This covers us if WCR starts
            // while the network is offline etc.
            this.retryTimer = setTimeout(() => this.manage(), error.time);
          }

          return;
        }

        console.info('[Manager] Now configuring stage', stage.name);
        await stage.configure(newConfig);
        console.info('[Manager] Configured stage', stage.name);

        // We've validated and configured the new config, mark the stage as
        // valid so we won't reconfigure it unless it changes.
        stage.valid = true;
        stage.current = newConfig;
      }
    }

    // Update the frontend to reflect the valid config.
    this.reconfiguring = false;
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
      const usagePromise = this.cloudClient.getUsage();
      const limitPromise = this.cloudClient.getStorageLimit();
      const affiliationsPromise = this.cloudClient.getUserAffiliations();

      // This is a bit tricky, get the guild name from the active client which is
      // guarenteed to be up to date, unlike other fields in this class.
      const guild = this.cloudClient.getGuildName();

      const usage = await usagePromise;
      const limit = await limitPromise;
      const affiliations = await affiliationsPromise;

      const available = affiliations.map((aff) => aff.guildName);
      const affiliation = affiliations.find((aff) => aff.guildName === guild);

      const status: CloudStatus = {
        guild,
        available,
        usage: usage,
        limit: limit,
        read: false,
        write: false,
        del: false,
      };

      if (affiliation) {
        status.read = affiliation.read;
        status.write = affiliation.write;
        status.del = affiliation.del;
      }

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
    const limit = this.cfg.get<number>('maxStorage') * 1024 ** 3;
    const status: DiskStatus = { usage, limit };
    this.mainWindow.webContents.send('updateDiskStatus', status);
  }

  /**
   * Called when the WoW process is detected, which may be either on launch
   * of the App if WoW is open, or the user has genuinely opened WoW. Attaches
   * the audio sources and starts the buffer recording.
   */
  private async onWowStarted() {
    console.info('[Manager] Detected WoW is running');

    const videoConfig = getObsVideoConfig(this.cfg);
    this.recorder.configureVideoSources(videoConfig, this.poller.isWowRunning);

    const audioConfig = getObsAudioConfig(this.cfg);
    this.recorder.configureAudioSources(audioConfig);

    try {
      await this.recorder.start();
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
    console.info(
      '[Manager] Detected WoW not running, or Windows going inactive',
    );

    if (this.retailLogHandler && this.retailLogHandler.activity) {
      await this.retailLogHandler.forceEndActivity();
    } else if (this.classicLogHandler && this.classicLogHandler.activity) {
      await this.classicLogHandler.forceEndActivity();
    } else if (this.eraLogHandler && this.eraLogHandler.activity) {
      await this.eraLogHandler.forceEndActivity();
    } else if (this.retailPtrLogHandler && this.retailPtrLogHandler.activity) {
      await this.retailPtrLogHandler.forceEndActivity();
    } else {
      await this.recorder.stop();
    }

    this.recorder.clearFindWindowInterval();
    await this.recorder.removeAudioSources();
  }

  /**
   * Configure the base OBS config. We need to stop the recording to do this.
   */
  private async configureObsBase(config: ObsBaseConfig) {
    await this.recorder.stop();

    await this.refreshCloudStatus();
    await this.refreshDiskStatus();

    await this.recorder.configureBase(config);
    this.poller.start();
    this.mainWindow.webContents.send('refreshState');
  }

  /**
   * Configure the base OBS config. We need to stop the recording to do this.
   */
  private async configureCloudClient(config: CloudConfig) {
    const {
      cloudStorage,
      cloudAccountName,
      cloudAccountPassword,
      cloudGuildName,
    } = config;

    if (this.cloudClient) {
      this.cloudClient.removeAllListeners();
      this.cloudClient.stopPolling();
      this.cloudClient = undefined;
      this.videoProcessQueue.unsetCloudClient();
    }

    if (cloudStorage) {
      console.info('[Manager] Cloud storage is enabled');

      this.cloudClient = new CloudClient(
        cloudAccountName,
        cloudAccountPassword,
        cloudGuildName,
      );

      this.cloudClient.on('change', () => {
        this.mainWindow.webContents.send('refreshState');
        this.refreshCloudStatus();
      });

      this.cloudClient.on('logout', () => {
        // Likely the user has changed their password on the website. Trigger
        // a reconfigure which will update the status card and move the app to
        // error state.
        console.warn('[Manager] Got logout event from CloudClient');
        this.stages[5].valid = false; // Stage 5 is the cloud stage.
        this.manage(); // Queue a call to manage to mimic first time setup.
      });

      await this.cloudClient.pollInit();
      this.cloudClient.startPolling();
      this.videoProcessQueue.setCloudClient(this.cloudClient);
    }

    await this.refreshCloudStatus();
    this.mainWindow.webContents.send('refreshState');
  }

  /**
   * Configure video settings in OBS. This can all be changed live.
   */
  private configureObsVideo(config: ObsVideoConfig) {
    this.recorder.configureVideoSources(config, this.poller.isWowRunning);
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
   * Configure the appropriate LogHandlers.
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

    if (this.retailPtrLogHandler) {
      this.retailPtrLogHandler.removeAllListeners();
      this.retailPtrLogHandler.destroy();
    }

    if (config.recordRetail) {
      this.retailLogHandler = new RetailLogHandler(
        this.mainWindow,
        this.recorder,
        this.videoProcessQueue,
        config.retailLogPath,
      );

      this.retailLogHandler.on('state-change', () => this.refreshStatus());
    }

    if (config.recordClassic) {
      this.classicLogHandler = new ClassicLogHandler(
        this.mainWindow,
        this.recorder,
        this.videoProcessQueue,
        config.classicLogPath,
      );

      this.classicLogHandler.on('state-change', () => this.refreshStatus());
    }

    if (config.recordEra) {
      this.eraLogHandler = new EraLogHandler(
        this.mainWindow,
        this.recorder,
        this.videoProcessQueue,
        config.eraLogPath,
      );

      this.eraLogHandler.on('state-change', () => this.refreshStatus());
    }

    if (config.recordRetailPtr) {
      this.retailPtrLogHandler = new RetailLogHandler(
        this.mainWindow,
        this.recorder,
        this.videoProcessQueue,
        config.retailPtrLogPath,
      );

      this.retailPtrLogHandler.on('state-change', () => this.refreshStatus());
    }

    this.poller.reconfigureFlavour(config);
    this.poller.start();
  }

  /**
   * Configure chat overlay in OBS. This can all be changed live.
   */
  private configureObsOverlay(config: ObsOverlayConfig) {
    this.recorder.configureOverlayImageSource(config);
  }

  /**
   * Validate the cloud config.
   */
  private async validateCloudConfig(config: CloudConfig) {
    const {
      cloudStorage,
      cloudAccountName,
      cloudAccountPassword,
      cloudGuildName,
      cloudUpload,
    } = config;

    if (!cloudStorage) {
      console.info('[Manager] Cloud Storage is not enabled');
      return;
    }

    if (!cloudAccountName) {
      console.warn('[Manager] Empty account name');
      throw new Error(this.getLocaleError(Phrase.ErrorAccountEmpty));
    }

    if (!cloudAccountPassword) {
      console.warn('[Manager] Empty account key');
      throw new Error(this.getLocaleError(Phrase.ErrorPasswordEmpty));
    }

    let winner;

    try {
      winner = await Promise.race([
        CloudClient.getUserAffiliations(cloudAccountName, cloudAccountPassword),
        getPromiseBomb(10000, 'Authentication timed out'),
      ]);
    } catch (error) {
      console.warn('[Manager] Cloud validation failed', String(error));

      if (error instanceof AuthError) {
        // If the server returns a 401 or a 403 we just rethrow that so the
        // message is presented on the status indicator. No point retrying
        // if the user has their password wrong.
        console.warn('[Manager] Auth failed, will not retry');
        throw error;
      }

      console.warn('[Manager] Will retry');

      throw new RetryableConfigError(
        'Failed to authenticate with the cloud store.',
        10000,
      );
    }

    // Safe to cast here, either we got this data or we have thrown.
    const affiliations = winner as TAffiliation[];
    const guild = cloudGuildName;
    const available = affiliations.map((aff) => aff.guildName);

    // Look for a match against the selected guild name. If this isn't selected
    // yet, cloudGuildName is an empty string, which will never match.
    const affiliation = affiliations.find((aff) => aff.guildName === guild);

    // We need to push the available guilds to the frontend to allow the user
    // select a guild. Just push the permissions if we can for good measure so
    // they are present on first attempt if the guild name is present. If the config
    // is invalid we might get stuck before doing a full refresh so it's nice if this
    // is accurate.
    const status: CloudStatus = {
      guild,
      available,
      usage: 0,
      limit: 0,
      read: false,
      write: false,
      del: false,
    };

    if (affiliation) {
      status.read = affiliation.read;
      status.write = affiliation.write;
      status.del = affiliation.del;
    }

    this.mainWindow.webContents.send('updateCloudStatus', status);

    if (!affiliation) {
      console.warn('[Manager] Empty guild name');
      throw new Error(this.getLocaleError(Phrase.ErrorGuildEmpty));
    }

    if (!affiliation.read) {
      throw new Error(
        this.getLocaleError(Phrase.ErrorUserNotAuthorizedPlayback),
      );
    }

    if (!affiliation.write && cloudUpload) {
      throw new Error(this.getLocaleError(Phrase.ErrorUserNotAuthorizedUpload));
    }
  }

  /**
   * Validate the base config.
   */
  private async validateBaseConfig(config: ObsBaseConfig) {
    const { storagePath, maxStorage, obsPath } = config;

    if (!storagePath) {
      console.warn(
        '[Manager] Validation failed: `storagePath` is falsy',
        storagePath,
      );

      throw new Error(this.getLocaleError(Phrase.ErrorStoragePathInvalid));
    }

    if (!fs.existsSync(path.dirname(storagePath))) {
      console.warn(
        '[Manager] Validation failed, storagePath does not exist',
        storagePath,
      );

      throw new Error(this.getLocaleError(Phrase.ErrorStoragePathInvalid));
    }

    await checkDisk(storagePath, maxStorage);

    if (!obsPath) {
      console.warn('[Manager] Validation failed: `obsPath` is falsy', obsPath);
      throw new Error(this.getLocaleError(Phrase.ErrorBufferPathInvalid));
    }

    const obsParentDir = path.dirname(obsPath);
    const obsParentDirExists = await exists(obsParentDir);

    if (!obsParentDirExists) {
      console.warn(
        '[Manager] Validation failed, obsPath does not exist',
        obsPath,
      );

      throw new Error(this.getLocaleError(Phrase.ErrorBufferPathInvalid));
    }

    if (path.resolve(storagePath) === path.resolve(obsPath)) {
      console.warn(
        '[Manager] Validation failed: Storage Path is the same as Buffer Path',
      );

      throw new Error(
        this.getLocaleError(Phrase.ErrorStoragePathSameAsBufferPath),
      );
    }

    const obsDirExists = await exists(obsPath);

    // 10GB is a rough guess at what the worst case buffer directory might be.
    if (obsDirExists) {
      await checkDisk(obsPath, 10);
    } else {
      const parentDir = path.dirname(obsPath);
      await checkDisk(parentDir, 10);
    }

    const storagePathOwned = await isFolderOwned(storagePath);

    if (!storagePathOwned) {
      await takeOwnershipStorageDir(storagePath);
    }

    if (obsDirExists && !(await isFolderOwned(obsPath))) {
      await takeOwnershipBufferDir(obsPath);
    }
  }

  /**
   * Checks the flavour config is valid.
   * @throws an error describing why the config is invalid
   */
  private validateFlavour = (config: FlavourConfig) => {
    const {
      recordRetail,
      retailLogPath,
      recordRetailPtr,
      retailPtrLogPath,
      recordClassic,
      classicLogPath,
      recordEra,
      eraLogPath,
    } = config;

    if (recordRetail) {
      const validFlavours = ['wow'];
      const validPath =
        validFlavours.includes(getWowFlavour(retailLogPath)) &&
        path.basename(retailLogPath) === 'Logs';

      if (!validPath) {
        console.error('[Util] Invalid retail log path', retailLogPath);
        throw new Error(this.getLocaleError(Phrase.InvalidRetailLogPath));
      }
    }

    if (recordRetailPtr) {
      const validFlavours = ['wowxptr', 'wow_beta'];
      const validPath =
        validFlavours.includes(getWowFlavour(retailPtrLogPath)) &&
        path.basename(retailPtrLogPath) === 'Logs';

      if (!validPath) {
        console.error('[Util] Invalid retail PTR log path', retailPtrLogPath);
        throw new Error(
          this.getLocaleError(Phrase.InvalidRetailPtrLogPathText),
        );
      }
    }

    if (recordClassic) {
      const validFlavours = ['wow_classic', 'wow_classic_beta'];
      const validPath =
        validFlavours.includes(getWowFlavour(classicLogPath)) &&
        path.basename(classicLogPath) === 'Logs';

      if (!validPath) {
        console.error('[Util] Invalid classic log path', classicLogPath);
        throw new Error(this.getLocaleError(Phrase.InvalidClassicLogPath));
      }
    }

    if (recordEra) {
      const validFlavours = ['wow_classic_era'];
      const validPath =
        validFlavours.includes(getWowFlavour(eraLogPath)) &&
        path.basename(eraLogPath) === 'Logs';

      if (!validPath) {
        console.error('[Util] Invalid era log path', eraLogPath);
        throw new Error(this.getLocaleError(Phrase.InvalidEraLogPath));
      }
    }
  };

  private async validateOverlayConfig(config: ObsOverlayConfig) {
    const { chatOverlayOwnImage, chatOverlayOwnImagePath, cloudStorage } =
      config;

    if (!chatOverlayOwnImage) {
      return;
    }

    if (!cloudStorage) {
      console.warn('[Manager] To use a custom overlay, enable cloud storage');
      throw new Error(this.getLocaleError(Phrase.ErrorCustomOverlayNotAllowed));
    }

    if (!chatOverlayOwnImagePath) {
      console.warn(
        '[Manager] Overlay image was not provided for custom overlay',
      );

      throw new Error(this.getLocaleError(Phrase.ErrorNoCustomImage));
    }

    if (
      !chatOverlayOwnImagePath.toLocaleLowerCase().endsWith('.png') &&
      !chatOverlayOwnImagePath.toLocaleLowerCase().endsWith('.gif')
    ) {
      console.warn('[Manager] Overlay image must be a .png or .gif file');
      throw new Error(this.getLocaleError(Phrase.ErrorCustomImageFileType));
    }

    const fileExists = await exists(chatOverlayOwnImagePath);

    if (!fileExists) {
      console.warn(`[Manager] ${chatOverlayOwnImagePath} does not exist`);
      let errorMsg = this.getLocaleError(Phrase.ErrorCustomImageFileType);
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
        process: {
          name: string;
          value: string | number;
        }[];
      } => {
        if (!this.recorder.obsInitialized) {
          return {
            input: [],
            output: [],
            process: [],
          };
        }

        return {
          input: this.recorder.getInputAudioDevices(),
          output: this.recorder.getOutputAudioDevices(),
          process: this.recorder.getProcessAudioDevices(),
        };
      },
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

      this.manage();
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
     * Listener to generate a shareable link to a video.
     */
    ipcMain.handle('getShareableLink', async (_event, args) => {
      assert(this.cloudClient);
      const videoName = args[0];
      const shareable = await this.cloudClient.getShareableLink(videoName);
      clipboard.writeText(shareable);
    });

    /**
     * Called when the user triggers a refresh (with F5 or Ctrl + R) to repopulate
     * status fields on the frontend.
     */
    ipcMain.on('refreshFrontend', async () => {
      this.refreshStatus();

      if (this.configValid) {
        await this.refreshDiskStatus();
        await this.refreshCloudStatus();
      }
    });

    /**
     * Callback to attach the audio devices. This is called when the user
     * opens the audio settings so that the volmeter bars can be populated.
     */
    ipcMain.on('attachAudioSources', (_event, args) => {
      const attach = args[0];

      if (!this.stages[3].valid) {
        console.warn('[Manager] Wont attach audio sources with invalid config');
        return;
      }

      if (attach) {
        console.info('[Manager] Frontend requested audio sources be attached');
        const audioConfig = getObsAudioConfig(this.cfg);
        this.recorder.configureAudioSources(audioConfig);
      } else {
        console.info('[Manager] Frontend requested audio sources be detached');
        this.recorder.removeAudioSources();
      }
    });

    // Important we shutdown OBS on the before-quit event as if we get closed by
    // the installer we want to ensure we shutdown OBS, this is common when
    // upgrading the app. See issue 325 and 338.
    app.on('before-quit', () => {
      console.info('[Manager] Running before-quit actions');
      this.poller.reset();
      uIOhook.stop();

      // This takes a few seconds and is synchronous so do it last.
      this.recorder.shutdownOBS();
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

    if (this.retailPtrLogHandler) {
      this.retailPtrLogHandler.removeAllListeners();
      this.retailPtrLogHandler.destroy();
    }

    this.recorder = new Recorder(this.mainWindow);

    this.recorder.on('crash', (crashData) => {
      setTimeout(() => this.recoverRecorderFromCrash(crashData), 0);
    });

    this.recorder.on('state-change', () => {
      setTimeout(() => this.refreshStatus(), 0);
    });

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
    const retailPtrNotSafe = this.retailPtrLogHandler?.activity;

    if (retailNotSafe || classicNotSafe || eraNotSafe || retailPtrNotSafe) {
      console.info('[Manager] Not restarting recorder as in an activity');
      return;
    }

    const retailOverrunning = this.retailLogHandler?.overrunning;
    const classicOverrunning = this.classicLogHandler?.overrunning;
    const eraOverrunning = this.eraLogHandler?.overrunning;
    const retailPtrOverrunning = this.retailPtrLogHandler?.overrunning;

    if (
      retailOverrunning ||
      classicOverrunning ||
      eraOverrunning ||
      retailPtrOverrunning
    ) {
      console.info(
        '[Manager] Not restarting recorder as an activity is overrunning',
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
    try {
      assert(this.cloudClient);
      const cloudSigned = await this.cloudClient.getState();
      cloudSigned.forEach(convertKoreanVideoCategory);
      return cloudSigned.map(cloudSignedMetadataToRendererVideo);
    } catch (error) {
      console.error('[Manager] Failed to get state:', String(error));
      return [];
    }
  }

  /**
   * Delete a video from the disk, and it's accompanying metadata.
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

  /**
   * Return a language appropriate error string.
   */
  private getLocaleError(phrase: Phrase) {
    const lang = this.cfg.get<string>('language') as Language;
    return getLocalePhrase(lang, phrase);
  }
}
