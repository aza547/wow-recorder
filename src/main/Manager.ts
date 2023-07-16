import { BrowserWindow, app, ipcMain, powerMonitor } from 'electron';
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
  RecStatus,
  ConfigStage,
  FlavourConfig,
  ObsOverlayConfig,
} from './types';
import {
  getObsBaseConfig,
  getObsVideoConfig,
  getObsAudioConfig,
  getStorageConfig,
  getFlavourConfig,
  getOverlayConfig,
} from '../utils/configUtils';
import { updateRecStatus, validateFlavour } from './util';
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

  private poller = Poller.getInstance(getFlavourConfig(this.cfg));

  private active = false;

  private queued = false;

  private storageCfg: StorageConfig = getStorageConfig(this.cfg);

  private obsBaseCfg: ObsBaseConfig = getObsBaseConfig(this.cfg);

  private obsVideoCfg: ObsVideoConfig = getObsVideoConfig(this.cfg);

  private obsAudioCfg: ObsAudioConfig = getObsAudioConfig(this.cfg);

  private flavourCfg: FlavourConfig = getFlavourConfig(this.cfg);

  private overlayCfg: ObsOverlayConfig = getOverlayConfig(this.cfg);

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
      name: 'flavour',
      initial: true,
      current: this.flavourCfg,
      get: (cfg: ConfigService) => getFlavourConfig(cfg),
      validate: (config: FlavourConfig) => validateFlavour(config),
      configure: async (config: FlavourConfig) => this.configureFlavour(config),
    },
    {
      name: 'overlay',
      initial: true,
      current: this.overlayCfg,
      get: (cfg: ConfigService) => getOverlayConfig(cfg),
      validate: () => {},
      configure: async (config: ObsOverlayConfig) => this.configureObsOverlay(config),
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

  /**
   * Force a recording to stop regardless of the scenario.
   */
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

  /**
   * Run a test. We prefer retail here, if the user doesn't have a retail path
   * configured, then fall back to classic. We only pass through the category
   * for retail, any classic tests will default to 2v2. Probably should fix 
   * that.
   */
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
        this.refreshStatus(true, String(error));
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

    this.refreshStatus(false);
  }

  /**
   * Refresh the status after a config change.
   */
  private refreshStatus(invalidConfig: boolean, message = '') {
    if (invalidConfig) {
      updateRecStatus(
        this.mainWindow,
        RecStatus.InvalidConfig,
        String(message)
      );
    } else if (this.recorder.obsState === ERecordingState.Offline) {
      updateRecStatus(
        this.mainWindow,
        RecStatus.WaitingForWoW,
      );
    } else {
      updateRecStatus(
        this.mainWindow,
        RecStatus.ReadyToRecord,
      );
    }
  }

  /**
   * Called when the WoW process is detected, which may be either on launch
   * of the App if WoW is open, or the user has genuinely opened WoW. Attaches
   * the audio sources and starts the buffer recording.
   */
  private async onWowStarted() {
    console.info('[Manager] Detected WoW running, or Windows active again');
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
    console.info('[Manager] Detected WoW not running, or Windows going inactive');

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
  private async configureFlavour(config: FlavourConfig) {
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

    if (this.classicLogHandler) {
      this.classicLogHandler.destroy();
    }

    if (config.recordRetail) {
      this.retailLogHandler = new RetailLogHandler(
        this.recorder,
        config.retailLogPath
      );
    }

    if (config.recordClassic) {
      this.classicLogHandler = new ClassicLogHandler(
        this.recorder,
        config.classicLogPath
      );
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

  /**
   * Setup event listeneres the app relies on.
   */
  private setupListeners() {
    // Config change listener we use to tweak the app settings in Windows if 
    // the user enables/disables run on start-up.
    this.cfg.on('change', (key: string, value: any) => {
      if (key === 'startUp') {
        const isStartUp = value === true;
        console.log('[Main] OS level set start-up behaviour:', isStartUp);
    
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
    ipcMain.on('getEncoders', (event) => {
      const obsEncoders = this.recorder
        .getAvailableEncoders()
        .filter((encoder) => encoder !== 'none');

      event.returnValue = obsEncoders;
    });
    
    // Audio devices listener, to populate settings on the frontend.
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

    // Test listener, to enable the test button to start a test.
    ipcMain.on('test', (_event, args) => {
      const testCategory = args[0] as VideoCategory;
      const endTest = Boolean(args[1]);
      this.test(testCategory, endTest);
    });

    // Force stop listener, to enable the force stop button to do its job.
    ipcMain.on('recorder', async (_event, args) => {
      if (args[0] === 'stop') {
        console.log('[Manager] Force stopping recording due to user request.');
        this.forceStop();
        return;
      }

      this.manage();
    });

        // 
        ipcMain.on('remux', (_event, args) => {
          if (this.recorder) {
            this.recorder.remux();
          }
        });


    // Important we shutdown OBS on the before-quit event as if we get closed by
    // the installer we want to ensure we shutdown OBS, this is common when
    // upgrading the app. See issue 325 and 338.
    app.on('before-quit', () => {
      console.info('[Manager] Running before-quit actions');
      this.recorder.shutdownOBS();
    });

    // If Windows is going to sleep, we don't want to confuse OBS.
    // Stop the recording as if WoW has been closed, and resume it once Windows
    // has resumed. 
    powerMonitor.on('suspend', () => {
      console.info('[Manager] Detected Windows is going to sleep.');
      this.onWowStopped();
    });

    powerMonitor.on('resume', () => {
      console.log('[Manager] Detected Windows waking up from a sleep.');
      this.poller.start();
    });
  }
}