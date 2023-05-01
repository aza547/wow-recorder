/* eslint global-require: off, no-console: off, promise/always-return: off */
import path from 'path';

import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  dialog,
  Tray,
  Menu,
} from 'electron';

import os from 'os';
import RetailLogHandler from '../parsing/RetailLogHandler';
import ClassicLogHandler from '../parsing/ClassicLogHandler';
import Poller from '../utils/Poller';

import {
  resolveHtmlPath,
  loadAllVideos,
  deleteVideo,
  openSystemExplorer,
  toggleVideoProtected,
  setupApplicationLogging,
  getAvailableDisplays,
  checkAppUpdate,
  getAssetPath,
} from './util';

import Recorder from './Recorder';

import { RecStatus, VideoPlayerSettings } from './types';
import ConfigService from './ConfigService';
import CombatLogParser from '../parsing/CombatLogParser';
import {
  runClassicRecordingTest,
  runRetailRecordingTest,
} from '../utils/testButtonUtils';
import SizeMonitor from '../utils/SizeMonitor';
import { VideoCategory } from '../types/VideoCategory';

const logDir = setupApplicationLogging();
console.info('[Main] App starting, version:', app.getVersion());
console.info('[Main] On OS:', os.platform(), os.release());
console.info(
  '[Main] In timezone:',
  Intl.DateTimeFormat().resolvedOptions().timeZone
);

let retailHandler: RetailLogHandler | undefined;
let classicHandler: ClassicLogHandler | undefined;
let recorder: Recorder | undefined;
let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray = null;

// Issue 332. Need to call this before the app is ready.
// https://www.electronjs.org/docs/latest/api/app#appdisablehardwareacceleration
app.disableHardwareAcceleration();

/**
 * Updates the status icon for the application.
 * @param status the status number
 */
const updateRecStatus = (status: RecStatus, reason = '') => {
  console.info('[Main] Updating status with:', status, reason);
  if (mainWindow === null) return;
  mainWindow.webContents.send('updateRecStatus', status, reason);
};

/**
 * Guard against any UnhandledPromiseRejectionWarnings. If OBS isn't behaving
 * as expected then it's better to crash the app. See:
 * - https://nodejs.org/api/process.html#process_event_unhandledrejection.
 * - https://nodejs.org/api/process.html#event-unhandledrejection
 */
process.on('unhandledRejection', (error: Error) => {
  console.error('UnhandledPromiseRejectionWarning:', error);

  if (recorder) {
    recorder.shutdownOBS();
  }

  updateRecStatus(RecStatus.FatalError, String(error));
});

const wowProcessStarted = async () => {
  console.info('[Main] Detected WoW is running');

  if (!mainWindow) {
    throw new Error('[Main] mainWindow not defined');
  }

  if (!recorder) {
    throw new Error('[Main] No recorder object');
  }

  // We add the audio sources here so they are only held when WoW is
  // open, holding an audio devices prevents Windows go to sleeping
  // which we don't want to do if we can avoid it.
  recorder.addAudioSourcesOBS();
  await recorder.startBuffer();
};

const wowProcessStopped = async () => {
  console.info('[Main] Detected WoW is not running');

  if (!mainWindow) {
    throw new Error('[Main] mainWindow not defined');
  }

  if (!recorder) {
    console.info('[Main] No recorder object so no action taken');
    return;
  }

  // Remove the audio sources when WoW stops to avoid preventing
  // Windows going to sleep.
  if (recorder && retailHandler && retailHandler.activity) {
    await retailHandler.forceEndActivity(0, true);
    recorder.removeAudioSourcesOBS();
  } else if (recorder && classicHandler && classicHandler.activity) {
    await classicHandler.forceEndActivity(0, true);
    recorder.removeAudioSourcesOBS();
  } else {
    await recorder.stopBuffer();
    recorder.removeAudioSourcesOBS();
  }
};

/**
 * Create a settings store to handle the config.
 * This defaults to a path like:
 *   - (prod) "C:\Users\alexa\AppData\Roaming\WarcraftRecorder\config-v3.json"
 *   - (dev)  "C:\Users\alexa\AppData\Roaming\Electron\config-v3.json"
 */
const cfg = ConfigService.getInstance();

cfg.on('change', (key: string, value: any) => {
  if (key === 'startUp') {
    const isStartUp = value === true;
    console.log('[Main] OS level set start-up behaviour:', isStartUp);

    app.setLoginItemSettings({
      openAtLogin: isStartUp,
    });
  }
});

// Default video player settings on app start
const videoPlayerSettings: VideoPlayerSettings = {
  muted: false,
  volume: 1,
};

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

// OBS doesn't play all that nicely with the dev tools, so we can call
// "npm run start-ui-only" to skip using OBS entirely if doing UI work.
const noObsDev =
  process.env.NODE_ENV === 'development' && process.env.INIT_OBS === 'false';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};

/**
 * Setup tray icon, menu and even listeners.
 */
const setupTray = () => {
  tray = new Tray(getAssetPath('./icon/small-icon.png'));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open',
      click() {
        console.log('[Main] User clicked open on tray icon');
        if (mainWindow) mainWindow.show();
      },
    },
    {
      label: 'Quit',
      click() {
        console.log('[Main] User clicked close on tray icon');
        if (mainWindow) mainWindow.close();
      },
    },
  ]);

  tray.setToolTip('Warcraft Recorder');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    console.log('[Main] User double clicked tray icon');
    if (mainWindow) mainWindow.show();
  });
};

/**
 * Creates the main window.
 */
const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const appVersion = app.getVersion();

  mainWindow = new BrowserWindow({
    show: false,
    height: 1020 * 0.75,
    width: 1980 * 0.75,
    icon: getAssetPath('./icon/small-icon.png'),
    frame: false,
    title: `Warcraft Recorder v${appVersion}`,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
      // devTools: false,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('mainWindow.index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) throw new Error('"mainWindow" is not defined');

    checkAppUpdate(mainWindow);

    // This shows the correct version on a release build, not during development.
    mainWindow.webContents.send(
      'updateTitleBar',
      `Warcraft Recorder v${appVersion}`
    );

    const startMinimized = cfg.get<boolean>('startMinimized');

    if (!startMinimized) {
      mainWindow.show();
    }

    if (!noObsDev) {
      recorder = new Recorder(mainWindow);
    }

    Poller.getInstance()
      .on('wowProcessStart', wowProcessStarted)
      .on('wowProcessStop', wowProcessStopped);

    try {
      cfg.validate();
      updateRecStatus(RecStatus.WaitingForWoW);
    } catch (error) {
      updateRecStatus(RecStatus.InvalidConfig, String(error));
      return;
    }

    if (!noObsDev && recorder) {
      recorder.configure();
    }

    Poller.getInstance().start();
    mainWindow.webContents.send('refreshState');

    const retailLogPath = cfg.getPath('retailLogPath');
    const classicLogPath = cfg.getPath('classicLogPath');

    if (!noObsDev && recorder) {
      if (retailLogPath) {
        retailHandler = new RetailLogHandler(recorder, retailLogPath);
      }

      if (classicLogPath) {
        classicHandler = new ClassicLogHandler(recorder, classicLogPath);
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  setupTray();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });
};

/**
 * Creates the settings window, called on clicking the settings cog.
 */
const createSettingsWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  settingsWindow = new BrowserWindow({
    show: false,
    width: 650,
    height: 525,
    resizable: process.env.NODE_ENV !== 'production',
    icon: getAssetPath('./icon/settings-icon.svg'),
    frame: false,
    webPreferences: {
      webSecurity: false,
      // devTools: false,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  settingsWindow.loadURL(resolveHtmlPath('settings.index.html'));

  settingsWindow.on('ready-to-show', () => {
    if (!settingsWindow) {
      throw new Error('"settingsWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      settingsWindow.minimize();
    } else {
      settingsWindow.show();
    }
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  // Open urls in the user's browser
  settingsWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });
};

const openPathDialog = (event: any, args: any) => {
  if (!settingsWindow) return;
  const setting = args[1];

  dialog
    .showOpenDialog(settingsWindow, { properties: ['openDirectory'] })
    .then((result) => {
      if (!result.canceled) {
        const selectedPath = result.filePaths[0];
        let validationResult = true;

        // Validate the path if it's a path for a log directory
        if (setting === 'retailLogPath' || setting === 'classicLogPath') {
          validationResult = CombatLogParser.validateLogPath(selectedPath);
        }

        event.reply('settingsWindow', [
          'pathSelected',
          setting,
          selectedPath,
          validationResult,
        ]);
      }
    })
    .catch((err) => {
      console.log(err);
    });
};

/**
 * mainWindow event listeners.
 */
ipcMain.on('mainWindow', (_event, args) => {
  if (mainWindow === null) return;

  if (args[0] === 'minimize') {
    console.log('[Main] User clicked minimize');

    if (cfg.get<boolean>('minimizeToTray')) {
      console.log('[Main] Minimize main window to tray');
      mainWindow.hide();
    } else {
      console.log('[Main] Minimize main window to taskbar');
      mainWindow.minimize();
    }
  }

  if (args[0] === 'resize') {
    console.log('[Main] User clicked resize');

    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }

  if (args[0] === 'quit') {
    console.log('[Main] User clicked quit button');

    if (cfg.get<boolean>('minimizeOnQuit')) {
      console.log('[Main] Hiding main window');
      mainWindow.hide();
    } else {
      console.log('[Main] Closing main window');
      mainWindow.close();
    }
  }
});

/**
 * settingsWindow event listeners.
 */
ipcMain.on('settingsWindow', (event, args) => {
  if (args[0] === 'create') {
    console.log('[Main] User clicked open settings');
    if (!settingsWindow) createSettingsWindow();
  }

  if (settingsWindow === null) return;

  if (args[0] === 'quit') {
    console.log('[Main] User closed settings');
    settingsWindow.close();
  }

  if (args[0] === 'update') {
    console.log('[Main] User updated settings');

    settingsWindow.once('closed', async () => {
      if (!mainWindow) {
        throw new Error('[Main] mainWindow not defined');
      }

      mainWindow.webContents.send('refreshState');

      if (recorder) {
        await recorder.reconfigure(mainWindow);
      } else {
        recorder = new Recorder(mainWindow);
      }

      try {
        cfg.validate();
        updateRecStatus(RecStatus.WaitingForWoW);
      } catch (error) {
        updateRecStatus(RecStatus.InvalidConfig, String(error));
        return;
      }

      recorder.configure();
      Poller.getInstance().start();

      const retailLogPath = cfg.getPath('retailLogPath');
      const classicLogPath = cfg.getPath('classicLogPath');

      if (retailLogPath) {
        if (retailHandler) {
          retailHandler.reconfigure(retailLogPath);
        } else {
          retailHandler = new RetailLogHandler(recorder, retailLogPath);
        }
      }

      if (classicLogPath) {
        if (classicHandler) {
          classicHandler.reconfigure(classicLogPath);
        } else {
          classicHandler = new ClassicLogHandler(recorder, classicLogPath);
        }
      }

      if (mainWindow) new SizeMonitor(mainWindow).run();
    });

    settingsWindow.close();
  }

  if (args[0] === 'openPathDialog') {
    openPathDialog(event, args);
    return;
  }

  if (args[0] === 'getAllDisplays') {
    event.returnValue = getAvailableDisplays();
    return;
  }

  if (args[0] === 'getObsAvailableRecEncoders') {
    if (!recorder) {
      event.returnValue = [];
      return;
    }

    const obsEncoders = recorder
      .getAvailableEncoders()
      .filter((encoder) => encoder !== 'none');

    event.returnValue = obsEncoders;
  }
});

/**
 * contextMenu event listeners.
 */
ipcMain.on('contextMenu', async (_event, args) => {
  if (args[0] === 'delete') {
    const videoForDeletion = args[1];
    deleteVideo(videoForDeletion);
    if (mainWindow) mainWindow.webContents.send('refreshState');
  }

  if (args[0] === 'open') {
    const fileToOpen = args[1];
    openSystemExplorer(fileToOpen);
  }

  if (args[0] === 'save') {
    const videoToToggle = args[1];
    await toggleVideoProtected(videoToToggle);
    if (mainWindow) mainWindow.webContents.send('refreshState');
  }

  if (args[0] === 'seekVideo') {
    const videoIndex = parseInt(args[1], 10);
    const seekTime = parseInt(args[2], 10);

    if (mainWindow) {
      mainWindow.webContents.send('seekVideo', videoIndex, seekTime);
    }
  }
});

/**
 * logPath event listener.
 */
ipcMain.on('logPath', (_event, args) => {
  if (args[0] === 'open') {
    openSystemExplorer(logDir);
  }
});

/**
 * openURL event listener.
 */
ipcMain.on('openURL', (event, args) => {
  event.preventDefault();
  require('electron').shell.openExternal(args[0]);
});

/**
 * Preview event listener.
 */
ipcMain.on('preview', (_event, args) => {
  if (!recorder) {
    return;
  }

  if (args[0] === 'show') {
    recorder.showPreview(args[1], args[2], args[3], args[4]);
  } else if (args[0] === 'hide') {
    recorder.hidePreview();
  }
});

/**
 * Chat overlay event listener.
 */
ipcMain.on('overlay', (_event, args) => {
  if (recorder) {
    recorder.applyOverlay(args[0], args[1], args[2], args[3], args[4]);
  }
});

/**
 * Get the list of video files and their state.
 */
ipcMain.handle('getVideoState', async () =>
  loadAllVideos(cfg.get<string>('storagePath'))
);

ipcMain.on('getAudioDevices', (event) => {
  if (!recorder || !recorder.obsInitialized) {
    throw new Error('[Main] getAudioDevices called when OBS not initialized');
  }

  const inputDevices = recorder.getInputAudioDevices();
  const outputDevices = recorder.getOutputAudioDevices();

  console.info(
    '[Main] Input devices:',
    inputDevices,
    'Output devices:',
    outputDevices
  );

  event.returnValue = {
    input: inputDevices,
    output: outputDevices,
  };
});

/**
 * Set/get global video player settings
 */
ipcMain.on('videoPlayerSettings', (event, args) => {
  switch (args[0]) {
    case 'get':
      event.returnValue = videoPlayerSettings;
      break;

    case 'set':
      {
        const settings = args[1] as VideoPlayerSettings;
        videoPlayerSettings.muted = settings.muted;
        videoPlayerSettings.volume = settings.volume;
      }
      break;

    default:
      break;
  }
});

/**
 * Test button listener.
 */
ipcMain.on('test', (_event, args) => {
  if (retailHandler) {
    console.info('[Main] Running retail test');

    runRetailRecordingTest(
      args[0] as VideoCategory,
      retailHandler.combatLogParser,
      Boolean(args[1])
    );
  } else if (classicHandler) {
    console.info('[Main] Running classic test');
    runClassicRecordingTest(classicHandler.combatLogParser, Boolean(args[0]));
  }
});

/**
 * Handle when a user clicks the stop recording button.
 */
ipcMain.on('recorder', async (_event, args) => {
  if (args[0] === 'stop') {
    console.log('[Main] Force stopping recording due to user request.');

    if (retailHandler && retailHandler.activity) {
      await retailHandler.forceEndActivity(0, false);
      return;
    }

    if (classicHandler && classicHandler.activity) {
      await classicHandler.forceEndActivity(0, false);
      return;
    }

    if (recorder) await recorder.forceStop();
  }
});

/**
 * Shutdown the app if all windows closed.
 */
app.on('window-all-closed', async () => {
  console.info('[Main] User closed app');
  app.quit();
});

/**
 * Important we shutdown OBS on the before-quit event as if we get closed by
 * the installer we want to ensure we shutdown OBS, this is common when
 * upgrading the app. See issue 325 and 338.
 */
app.on('before-quit', () => {
  console.info('[Main] Running before-quit actions');

  if (recorder) {
    console.info('[Main] Shutting down OBS before quit');
    recorder.shutdownOBS();
    recorder = undefined;
  }
});

/**
 * App start-up.
 */
app
  .whenReady()
  .then(() => {
    console.log('[Main] App ready');
    const singleInstanceLock = app.requestSingleInstanceLock();

    if (!singleInstanceLock) {
      console.warn(
        '[Main] Blocked attempt to launch a second instance of the application'
      );
      app.quit();
    } else {
      createWindow();
    }
  })
  .catch(console.log);
