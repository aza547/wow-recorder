import { BrowserWindow } from 'electron';
import { isEqual } from 'lodash';
import path from 'path';
import fs from 'fs';
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
} from './types';
import {
  getObsBaseConfig,
  getObsVideoConfig,
  getObsAudioConfig,
  getRetailConfig,
  getClassicConfig,
  getStorageConfig,
} from '../utils/configUtils';
import { updateRecStatus } from './util';
import { ERecordingState } from './obsEnums';

type ConfigStage = {
  name: string;
  initial: boolean;
  current: any;
  get: (cfg: ConfigService) => any;
  configure: (...args: any[]) => Promise<void>;
  validate: (...args: any[]) => void;
};

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
   * purposes. Each stage holds the current state of the stage, and provides
   * functions to get, validate and configure the config.
   */
  private stages: ConfigStage[] = [
    {
      name: 'storage',
      initial: true,
      current: this.storageCfg,
      get: (cfg: ConfigService) => getStorageConfig(cfg),
      validate: this.validateStorageCfg,
      configure: async (config: StorageConfig) => this.configureStorage(config),
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
      validate: () => {},
      configure: async (config: RetailConfig) => this.configureRetail(config),
    },
    {
      name: 'classic',
      initial: true,
      current: this.classicCfg,
      get: (cfg: ConfigService) => getClassicConfig(cfg),
      validate: () => {},
      configure: async (config: ClassicConfig) => this.configureClassic(config),
    },
  ];

  /**
   * Constructor.
   */
  constructor(mainWindow: BrowserWindow) {
    console.info('[Manager] Creating manager');

    this.mainWindow = mainWindow;
    this.recorder = new Recorder(this.mainWindow);
    this.manage();

    Poller.getInstance()
      .on('wowProcessStart', () => this.onWowStarted())
      .on('wowProcessStop', () => this.onWowStopped())
      .start();
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
  private configureStorage(config: StorageConfig) {
    this.mainWindow.webContents.send('refreshState');
  }

  private async configureObsBase(config: ObsBaseConfig) {
    if (this.recorder.isRecording) {
      // throw error
    }

    if (this.recorder.obsState === ERecordingState.Recording) {
      // We can't change this config if OBS is recording. If OBS is recording
      // but isRecording is false, that means it's a buffer recording. Stop it
      // briefly to change the config.
      await this.recorder.stopBuffer();
    }

    this.recorder.configureBase(config);
    Poller.getInstance().start();
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
  private configureRetail(config: RetailConfig) {
    if (this.retailLogHandler) {
      this.retailLogHandler.destroy();
      this.retailLogHandler = undefined;
    }

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
  private configureClassic(config: ClassicConfig) {
    if (this.classicLogHandler) {
      this.classicLogHandler.destroy();
      this.classicLogHandler = undefined;
    }

    if (!config.recordClassic) {
      return;
    }

    this.classicLogHandler = new ClassicLogHandler(
      this.recorder,
      config.classicLogPath
    );
  }

  private validateStorageCfg(config: StorageConfig) {
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
        '[Config Service] Validation failed, storagePath does not exist',
        storagePath
      );

      throw new Error('Storage Path is invalid.');
    }
  }

  private validateObsBaseCfg(config: ObsBaseConfig) {
    const { bufferStoragePath } = config;

    if (!bufferStoragePath) {
      console.warn(
        '[Config Service] Validation failed: `bufferStoragePath` is falsy',
        bufferStoragePath
      );

      throw new Error('Buffer Storage Path is invalid.');
    }

    if (!fs.existsSync(path.dirname(bufferStoragePath))) {
      console.warn(
        '[Config Service] Validation failed, bufferStoragePath does not exist',
        bufferStoragePath
      );

      throw new Error('Buffer Storage Path is invalid.');
    }

    const storagePath = this.cfg.get<string>('storagePath');

    if (storagePath === bufferStoragePath) {
      console.warn(
        '[Config Service] Validation failed: Storage Path is the same as Buffer Path'
      );

      throw new Error('Storage Path is the same as Buffer Path');
    }
  }

  // validateRetail() {
  //   // Check if the specified paths is a valid WoW Combat Log directory
  //   const recordRetail = this.get<boolean>('recordRetail');

  //   if (recordRetail) {
  //     const retailLogPath = this.get<string>('retailLogPath');
  //     const wowFlavour = getWowFlavour(retailLogPath);

  //     if (wowFlavour !== 'wow') {
  //       console.error('[ConfigService] Invalid retail log path', retailLogPath);
  //       throw new Error('[ConfigService] Invalid retail log path');
  //     }
  //   }
  // }

  // validateClassic() {
  //   const recordClassic = this.get<boolean>('recordClassic');

  //   if (recordClassic) {
  //     const classicLogPath = this.get<string>('classicLogPath');
  //     const wowFlavour = getWowFlavour(classicLogPath);

  //     if (wowFlavour !== 'wow_classic') {
  //       console.error(
  //         '[ConfigService] Invalid classic log path',
  //         classicLogPath
  //       );
  //       throw new Error('[ConfigService] Invalid classic log path');
  //     }
  //   }
  // }
}

// private getAllConfig() {
//   return {
//     maxStorage: this.cfg.get<number>('maxStorage'),
//     minEncounterDuration: this.cfg.get<number>('minEncounterDuration'),
//     startUp: this.cfg.get<boolean>('startUp'),
//     startMinimized: this.cfg.get<boolean>('startMinimized'),
//     recordRetail: this.cfg.get<boolean>('recordRetail'),
//     recordClassic: this.cfg.get<boolean>('recordClassic'),
//     recordRaids: this.cfg.get<boolean>('recordRaids'),
//     recordDungeons: this.cfg.get<boolean>('recordDungeons'),
//     recordTwoVTwo: this.cfg.get<boolean>('recordTwoVTwo'),
//     recordThreeVThree: this.cfg.get<boolean>('recordThreeVThree'),
//     recordFiveVFive: this.cfg.get<boolean>('recordFiveVFive'),
//     recordSkirmish: this.cfg.get<boolean>('recordSkirmish'),
//     recordSoloShuffle: this.cfg.get<boolean>('recordSoloShuffle'),
//     recordBattlegrounds: this.cfg.get<boolean>('recordBattlegrounds'),
//     selectedCategory: this.cfg.get<number>('selectedCategory'),
//     minKeystoneLevel: this.cfg.get<number>('minKeystoneLevel'),
//     minimizeOnQuit: this.cfg.get<boolean>('minimizeOnQuit'),
//     minimizeToTray: this.cfg.get<boolean>('minimizeToTray'),
//     minRaidDifficulty: this.cfg.get<string>('minRaidDifficulty'),
//   };
