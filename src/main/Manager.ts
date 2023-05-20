import { BrowserWindow, app, ipcMain } from 'electron';
import { isEqual } from 'lodash';
import path from 'path';
import fs from 'fs';
import { VideoCategory } from 'types/VideoCategory';
import Poller from '../utils/Poller';
import ClassicLogHandler from '../parsing/ClassicLogHandler';
import RetailLogHandler from '../parsing/RetailLogHandler';
import Recorder from './Recorder';
import ConfigService from './ConfigService';
import {
  StorageConfig,
  ObsBaseConfig,
  ObsVideoConfig,
  ObsAudioConfig,
  RetailConfig,
  ClassicConfig,
  RecStatus,
  ConfigStage,
} from './types';
import {
  getObsBaseConfig,
  getObsVideoConfig,
  getObsAudioConfig,
  getRetailConfig,
  getClassicConfig,
  getStorageConfig,
} from '../utils/configUtils';
import { updateRecStatus, validateClassic, validateRetail } from './util';
import { ERecordingState } from './obsEnums';
import {
  runClassicRecordingTest,
  runRetailRecordingTest,
} from '../utils/testButtonUtils';

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

  private poller = Poller.getInstance(
    getRetailConfig(this.cfg),
    getClassicConfig(this.cfg)
  );

  private active = false;

  private queued = false;

  private storageCfg: StorageConfig = getStorageConfig(this.cfg);

  private obsBaseCfg: ObsBaseConfig = getObsBaseConfig(this.cfg);

  private obsVideoCfg: ObsVideoConfig = getObsVideoConfig(this.cfg);

  private obsAudioCfg: ObsAudioConfig = getObsAudioConfig(this.cfg);

  private retailCfg: RetailConfig = getRetailConfig(this.cfg);

  private classicCfg: ClassicConfig = getClassicConfig(this.cfg);

  private retailLogHandler: RetailLogHandler | undefined;

  private classicLogHandler: ClassicLogHandler | undefined;

  /**
   * Defined stages of configuration. They are named only for logging
   * purposes. Each stage holds the current state of the stages config,
   * and provides functions to get, validate and configure the config.
   */
  private stages: ConfigStage[] = [
    /* eslint-disable prettier/prettier */
    {
      name: 'storage',
      initial: true,
      current: this.storageCfg,
      get: (cfg: ConfigService) => getStorageConfig(cfg),
      validate: (config: StorageConfig) => Manager.validateStorageCfg(config),
      configure: async () => this.configureStorage(),
    },
    {
      name: 'obsBase',
      initial: true,
      current: this.obsBaseCfg,
      get: (cfg: ConfigService) => getObsBaseConfig(cfg),
      validate: (config: ObsBaseConfig) => this.validateObsBaseCfg(config),
      configure: async (config: ObsBaseConfig) => this.configureObsBase(config),
    },
    {
      name: 'obsVideo',
      initial: true,
      current: this.obsVideoCfg,
      get: (cfg: ConfigService) => getObsVideoConfig(cfg),
      validate: () => {},
      configure: async (config: ObsVideoConfig) => this.configureObsVideo(config),
    },
    {
      name: 'obsAudio',
      initial: true,
      current: this.obsAudioCfg,
      get: (cfg: ConfigService) => getObsAudioConfig(cfg),
      validate: () => {},
      configure: async (config: ObsAudioConfig) => this.configureObsAudio(config),
    },
    {
      name: 'retail',
      initial: true,
      current: this.retailCfg,
      get: (cfg: ConfigService) => getRetailConfig(cfg),
      validate: (config: RetailConfig) => validateRetail(config),
      configure: async (config: RetailConfig) => this.configureRetail(config),
    },
    {
      name: 'classic',
      initial: true,
      current: this.classicCfg,
      get: (cfg: ConfigService) => getClassicConfig(cfg),
      validate: (config: ClassicConfig) => validateClassic(config),
      configure: async (config: ClassicConfig) => this.configureClassic(config),
    },
    // eslint-enable prettier/prettier */
  ];

  /**
   * Constructor.
   */
  constructor(mainWindow: BrowserWindow) {
    console.info('[Manager] Creating manager');

    this.setupListeners();

    this.mainWindow = mainWindow;
    this.recorder = new Recorder(this.mainWindow);

    this.poller
      .on('wowProcessStart', () => this.onWowStarted())
      .on('wowProcessStop', () => this.onWowStopped());

    this.manage();
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
      console.info('[Manager] Queued a manage call');
      this.queued = true;
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

  public async forceStop() {
    if (this.retailLogHandler && this.retailLogHandler.activity) {
      await this.retailLogHandler.forceEndActivity(0, false);
      return;
    }

    if (this.classicLogHandler && this.classicLogHandler.activity) {
      await this.classicLogHandler.forceEndActivity(0, false);
      return;
    }

    if (this.recorder) {
      await this.recorder.forceStop();
    }
  };

  public test(category: VideoCategory, endTest: boolean) {
    if (this.retailLogHandler) {
      console.info('[Manager] Running retail test');
      const parser = this.retailLogHandler.combatLogParser;
      runRetailRecordingTest(category, parser, endTest);
      return;
    }
  
    if (this.classicLogHandler) {
      console.info('[Manager] Running classic test');
      const parser = this.classicLogHandler.combatLogParser;
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
      const configChanged = !isEqual(newConfig, stage.current);

      try {
        stage.validate(newConfig);
      } catch (error) {
        stage.current = newConfig;
        stage.initial = false;

        updateRecStatus(
          this.mainWindow,
          RecStatus.InvalidConfig,
          String(error)
        );

        return;
      }

      if (stage.initial || configChanged) {
        console.info(
          '[Manager] Configuring stage',
          stage.name,
          'with',
          newConfig
        );

        updateRecStatus(
          this.mainWindow,
          RecStatus.WaitingForWoW,
        );

        // eslint-disable-next-line no-await-in-loop
        await stage.configure(newConfig);
        stage.current = newConfig;
        stage.initial = false;
      }
    }


  }

  /**
   * Called when the WoW process is detected, which may be either on launch
   * of the App if WoW is open, or the user has genuinely opened WoW. Attaches
   * the audio sources and starts the buffer recording.
   */
  private async onWowStarted() {
    console.info('[Manager] Detected WoW running');
    const config = getObsAudioConfig(this.cfg);
    this.recorder.configureAudioSources(config);
    await this.recorder.startBuffer();
  }

  /**
   * Called when the WoW process is detected to have exited. Ends any
   * recording that is still ongoing. We detach audio sources here to
   * allow Windows to go to sleep with WR running.
   */
  private async onWowStopped() {
    console.info('[Manager] Detected WoW not running');

    if (
      this.recorder &&
      this.retailLogHandler &&
      this.retailLogHandler.activity
    ) {
      await this.retailLogHandler.forceEndActivity(0, true);
      this.recorder.removeAudioSources();
    } else if (
      this.recorder &&
      this.classicLogHandler &&
      this.classicLogHandler.activity
    ) {
      await this.classicLogHandler.forceEndActivity(0, true);
      this.recorder.removeAudioSources();
    } else {
      await this.recorder.stopBuffer();
      this.recorder.removeAudioSources();
    }
  }

  /**
   * Configure the frontend to use the new Storage Path. All we need to do
   * here is trigger a frontened refresh.
   */
  private configureStorage() {
    this.mainWindow.webContents.send('refreshState');
  }

  private async configureObsBase(config: ObsBaseConfig) {
    if (this.recorder.isRecording) {
      console.error('[Manager] Invalid request from frontend');
      throw new Error('[Manager] Invalid request from frontend');
    }

    if (this.recorder.obsState === ERecordingState.Recording) {
      // We can't change this config if OBS is recording. If OBS is recording
      // but isRecording is false, that means it's a buffer recording. Stop it
      // briefly to change the config.
      await this.recorder.stopBuffer();
    }

    this.recorder.configureBase(config);
    this.poller.start();
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
    this.recorder.configureAudioSources(config);
  }

  /**
   * Configure the RetailLogHandler.
   */
  private async configureRetail(config: RetailConfig) {
    if (this.recorder.isRecording) {
      console.error('[Manager] Invalid request from frontend');
      throw new Error('[Manager] Invalid request from frontend');
    }

    if (this.recorder.obsState === ERecordingState.Recording) {
      // We can't change this config if OBS is recording. If OBS is recording
      // but isRecording is false, that means it's a buffer recording. Stop it
      // briefly to change the config.
      await this.recorder.stopBuffer();
    }

    if (this.retailLogHandler) {
      this.retailLogHandler.destroy();
    }

    this.poller.reconfigureRetail(config);
    this.poller.start();

    if (!config.recordRetail) {
      return;
    }

    this.retailLogHandler = new RetailLogHandler(
      this.recorder,
      config.retailLogPath
    );
  }

  /**
   * Configure the ClassicLogHandler.
   */
  private async configureClassic(config: ClassicConfig) {
    if (this.recorder.isRecording) {
      console.error('[Manager] Invalid request from frontend');
      throw new Error('[Manager] Invalid request from frontend');
    }

    if (this.recorder.obsState === ERecordingState.Recording) {
      // We can't change this config if OBS is recording. If OBS is recording
      // but isRecording is false, that means it's a buffer recording. Stop it
      // briefly to change the config.
      await this.recorder.stopBuffer();
    }

    if (this.classicLogHandler) {
      this.classicLogHandler.destroy();
    }

    this.poller.reconfigureClassic(config);
    this.poller.start();

    if (!config.recordClassic) {
      return;
    }

    this.classicLogHandler = new ClassicLogHandler(
      this.recorder,
      config.classicLogPath
    );
  }

  /**
   * Checks the storage path is set and exists on the users PC.
   * @throws an error describing why the config is invalid
   */
  private static validateStorageCfg(config: StorageConfig) {
    const { storagePath } = config;

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
  }

  /**
   * Checks the buffer storage path is set, exists on the users PC, and is 
   * not the same as the storage path.
   * @throws an error describing why the config is invalid
   */
  private validateObsBaseCfg(config: ObsBaseConfig) {
    const { bufferStoragePath } = config;

    if (!bufferStoragePath) {
      console.warn(
        '[Manager] Validation failed: `bufferStoragePath` is falsy',
        bufferStoragePath
      );

      throw new Error('Buffer Storage Path is invalid.');
    }

    if (!fs.existsSync(path.dirname(bufferStoragePath))) {
      console.warn(
        '[Manager] Validation failed, bufferStoragePath does not exist',
        bufferStoragePath
      );

      throw new Error('Buffer Storage Path is invalid.');
    }

    const storagePath = this.cfg.get<string>('storagePath');

    if (storagePath === bufferStoragePath) {
      console.warn(
        '[Manager] Validation failed: Storage Path is the same as Buffer Path'
      );

      throw new Error('Storage Path is the same as Buffer Path');
    }
  }

  private setupListeners() {
    this.cfg.on('change', (key: string, value: any) => {
      if (key === 'startUp') {
        const isStartUp = value === true;
        console.log('[Main] OS level set start-up behaviour:', isStartUp);
    
        app.setLoginItemSettings({
          openAtLogin: isStartUp,
        });
      }
    });

    ipcMain.on('preview', (_event, args) => {
      if (args[0] === 'show') {
        this.recorder.showPreview(args[1], args[2], args[3], args[4]);
      } else if (args[0] === 'hide') {
        this.recorder.hidePreview();
      }
    });

    ipcMain.on('getEncoders', (event) => {
      const obsEncoders = this.recorder
        .getAvailableEncoders()
        .filter((encoder) => encoder !== 'none');

      event.returnValue = obsEncoders;
    });

    ipcMain.on('getAudioDevices', (event) => {
      if (!this.recorder.obsInitialized) {
        event.returnValue = {
          input: [],
          output: [],
        };
    
        return;
      }
    
      const inputDevices = this.recorder.getInputAudioDevices();
      const outputDevices = this.recorder.getOutputAudioDevices();
    
      event.returnValue = {
        input: inputDevices,
        output: outputDevices,
      };
    });


    ipcMain.on('test', (_event, args) => {
      const testCategory = args[0] as VideoCategory;
      const endTest = Boolean(args[1]);
      this.test(testCategory, endTest);
    });

    ipcMain.on('recorder', async (_event, args) => {
      if (args[0] === 'stop') {
        console.log('[Manager] Force stopping recording due to user request.');
        this.forceStop();
        return;
      }

      this.manage();
    });


  // Important we shutdown OBS on the before-quit event as if we get closed by
  // the installer we want to ensure we shutdown OBS, this is common when
  // upgrading the app. See issue 325 and 338.
  app.on('before-quit', () => {
    console.info('[Manager] Running before-quit actions');
    this.recorder.shutdownOBS();
  });
  }
}