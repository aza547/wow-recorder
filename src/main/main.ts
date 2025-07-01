import path from 'path';
import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  dialog,
  Tray,
  Menu,
  clipboard,
} from 'electron';
import os from 'os';
import { uIOhook } from 'uiohook-napi';
import { PTTKeyPressEvent } from 'types/KeyTypesUIOHook';
import assert from 'assert';
import { getLocalePhrase, Language, Phrase } from 'localisation/translations';
import {
  resolveHtmlPath,
  openSystemExplorer,
  setupApplicationLogging,
  getAvailableDisplays,
  getAssetPath,
  nextMousePressPromise,
  nextKeyPressPromise,
} from './util';
import { OurDisplayType, VideoPlayerSettings } from './types';
import ConfigService from '../config/ConfigService';
import Manager from './Manager';
import AppUpdater from './AppUpdater';
import MenuBuilder from './menu';

const logDir = setupApplicationLogging();
const appVersion = app.getVersion();
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const tzOffset = new Date().getTimezoneOffset() * -1; // Offset is wrong direction so flip it.
const tzOffsetStr = `UTC${tzOffset >= 0 ? '+' : ''}${tzOffset / 60}`;

console.info('[Main] App starting, version:', appVersion);
console.info('[Main] Node version', process.versions.node);
console.info('[Main] ICU version', process.versions.icu);
console.info('[Main] On OS:', os.platform(), os.release());
console.info('[Main] In timezone:', tz, tzOffsetStr);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let manager: Manager | undefined;

/**
 * Create a settings store to handle the config.
 * This defaults to a path like:
 *   - (prod) "C:\Users\alexa\AppData\Roaming\WarcraftRecorder\config-v3.json"
 *   - (dev)  "C:\Users\alexa\AppData\Roaming\Electron\config-v3.json"
 */
const cfg = ConfigService.getInstance();

// It's a common problem that hardware acceleration causes rendering issues.
// Unclear why this happens and surely not an application bug but we can
// make it easy for users to disable it if they want to.
if (!cfg.get<boolean>('hardwareAcceleration')) {
  console.info('[Main] Disabling hardware acceleration');
  app.disableHardwareAcceleration();
}

/**
 * Default the video player settings on app start.
 */
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

if (isDebug) {
  require('electron-debug').default();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

/**
 * Setup tray icon, menu and event listeners.
 */
const setupTray = () => {
  tray = new Tray(getAssetPath('./icon/small-icon.png'));

  // This wont update without an app restart but whatever.
  const language = cfg.get<string>('language') as Language;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: getLocalePhrase(language, Phrase.SystemTrayOpen),
      click() {
        console.info('[Main] User clicked open on tray icon');
        if (mainWindow) mainWindow.show();
      },
    },
    {
      label: getLocalePhrase(language, Phrase.SystemTrayQuit),
      click() {
        console.info('[Main] User clicked close on tray icon');

        if (mainWindow) {
          mainWindow.close();
        }
      },
    },
  ]);

  tray.setToolTip('Warcraft Recorder');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    console.info('[Main] User double clicked tray icon');

    if (mainWindow) {
      mainWindow.show();
    }
  });
};

/**
 * Creates the main window.
 */
const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  mainWindow = new BrowserWindow({
    show: false,
    height: 1020 * 0.9,
    width: 1980 * 0.8,
    icon: getAssetPath('./icon/small-icon.png'),
    frame: false,
    title: `Warcraft Recorder v${appVersion}`,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  if (manager === undefined) {
    manager = new Manager(mainWindow);
  }

  mainWindow.on('ready-to-show', async () => {
    if (!mainWindow) {
      throw new Error('mainWindow is not defined');
    }

    // This shows the correct version on a release build, not during development.
    mainWindow.webContents.send(
      'updateVersionDisplay',
      `Warcraft Recorder v${appVersion}`,
    );

    assert(manager);
    await manager.manage();

    const startMinimized = cfg.get<boolean>('startMinimized');

    if (!startMinimized) {
      mainWindow.show();
    }
  });

  mainWindow.on('moved', () => {
    if (manager) {
      manager.recorder.showPreviewMemory();
    }
  });

  mainWindow.on('focus', () => {
    mainWindow?.webContents.send('window-focus-status', true);
  });

  mainWindow.on('blur', () => {
    mainWindow?.webContents.send('window-focus-status', false);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(resolveHtmlPath('index.html'));
  manager.refreshStatus();
  setupTray();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  uIOhook.start();

  // Runs the auto-updater, which checks GitHub for new releases
  // and will prompt the user if any are available.
  new AppUpdater(mainWindow);
};

/**
 * mainWindow event listeners.
 */
ipcMain.on('mainWindow', (_event, args) => {
  if (mainWindow === null) return;

  if (args[0] === 'minimize') {
    console.info('[Main] User clicked minimize');

    if (cfg.get<boolean>('minimizeToTray')) {
      console.info('[Main] Minimize main window to tray');
      mainWindow.webContents.send('pausePlayer');
      mainWindow.hide();
    } else {
      console.info('[Main] Minimize main window to taskbar');
      mainWindow.minimize();
    }
  }

  if (args[0] === 'resize') {
    console.info('[Main] User clicked resize');

    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }

  if (args[0] === 'quit') {
    console.info('[Main] User clicked quit button');

    if (cfg.get<boolean>('minimizeOnQuit')) {
      console.info('[Main] Hiding main window');
      mainWindow.webContents.send('pausePlayer');
      mainWindow.hide();
    } else {
      console.info('[Main] Closing main window');
      mainWindow.close();
    }
  }
});

/**
 * Opens a system explorer window to select a path.
 */
ipcMain.handle('selectPath', async () => {
  if (!mainWindow) {
    return '';
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });

  if (result.canceled) {
    console.info('[Main] User cancelled path selection');
    return '';
  }

  return result.filePaths[0];
});

/**
 * Opens a system explorer window to select a path.
 */
ipcMain.handle('selectFile', async () => {
  if (!mainWindow) {
    return '';
  }

  const result = await dialog.showOpenDialog(mainWindow);

  if (result.canceled) {
    console.info('[Main] User cancelled file selection');
    return '';
  }

  return result.filePaths[0];
});

/**
 * Listener to open the folder containing the Warcraft Recorder logs.
 */
ipcMain.on('logPath', (_event, args) => {
  if (args[0] === 'open') {
    openSystemExplorer(logDir);
  }
});

/**
 * Listener to write to clipboard.
 */
ipcMain.on('writeClipboard', (_event, args) => {
  clipboard.writeText(args[0] as string);
});

/**
 * Handle any settings change from the frontend.
 */
ipcMain.on('settingsChange', () => {
  console.info('[Main] Settings change event');

  if (manager) {
    manager.manage();
  }
});

/**
 * Opens a URL in the default browser.
 */
ipcMain.on('openURL', (event, args) => {
  event.preventDefault();
  require('electron').shell.openExternal(args[0]);
});

/**
 * Get all displays.
 */
ipcMain.handle('getAllDisplays', (): OurDisplayType[] => {
  return getAvailableDisplays();
});

/**
 * Get the next key pressed by the user. This can be modifier keys, so if
 * you want to catch the next non-modifier key you may need to call this
 * a few times back to back. The event returned includes modifier details.
 */
ipcMain.handle('getNextKeyPress', async (): Promise<PTTKeyPressEvent> => {
  return Promise.race([nextKeyPressPromise(), nextMousePressPromise()]);
});

/**
 * Get the list of video files and their state.
 */
ipcMain.handle('getVideoState', async () => {
  const storagePath = cfg.get<string>('storagePath');
  assert(manager);
  return manager.loadAllVideos(storagePath);
});

/**
 * Set/get global video player settings.
 */
ipcMain.on('videoPlayerSettings', (event, args) => {
  const action = args[0];

  if (action === 'get') {
    event.returnValue = videoPlayerSettings;
    return;
  }

  if (action === 'set') {
    const settings = args[1] as VideoPlayerSettings;
    videoPlayerSettings.muted = settings.muted;
    videoPlayerSettings.volume = settings.volume;
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
 * App start-up.
 */
app
  .whenReady()
  .then(() => {
    console.info('[Main] App ready');
    const singleInstanceLock = app.requestSingleInstanceLock();

    if (!singleInstanceLock) {
      console.warn(
        '[Main] Blocked attempt to launch a second instance of the application',
      );

      app.quit();
      return;
    }

    app.on('second-instance', () => {
      console.info('[Main] Second instance attempted');

      // Someone tried to run a second instance, we should focus this app.
      if (mainWindow) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }

        mainWindow.show();
        mainWindow.focus();
      }
    });

    new MenuBuilder().buildMenu();
    createWindow();
  })
  .catch(console.error);
