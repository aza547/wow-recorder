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

import { uIOhook } from 'uiohook-napi';
import { PTTKeyPressEvent } from 'types/KeyTypesUIOHook';
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
  nextMousePressPromise,
  nextKeyPressPromise,
} from './util';
import { OurDisplayType, VideoPlayerSettings } from './types';
import ConfigService from './ConfigService';
import Manager from './Manager';

const logDir = setupApplicationLogging();
const appVersion = app.getVersion();

console.info('[Main] App starting, version:', appVersion);
console.info('[Main] On OS:', os.platform(), os.release());
console.info(
  '[Main] In timezone:',
  Intl.DateTimeFormat().resolvedOptions().timeZone
);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let manager: Manager | undefined;

// Issue 332. Need to call this before the app is ready.
// https://www.electronjs.org/docs/latest/api/app#appdisablehardwareacceleration
app.disableHardwareAcceleration();

/**
 * Create a settings store to handle the config.
 * This defaults to a path like:
 *   - (prod) "C:\Users\alexa\AppData\Roaming\WarcraftRecorder\config-v3.json"
 *   - (dev)  "C:\Users\alexa\AppData\Roaming\Electron\config-v3.json"
 */
const cfg = ConfigService.getInstance();

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
 * Setup tray icon, menu and event listeners.
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

        if (mainWindow) {
          mainWindow.close();
        }
      },
    },
  ]);

  tray.setToolTip('Warcraft Recorder');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    console.log('[Main] User double clicked tray icon');

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
    height: 1020 * 0.85,
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

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('mainWindow is not defined');
    }

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

    mainWindow.webContents.send('refreshState');
  });

  mainWindow.on('moved', () => {
    if (manager) {
      manager.recorder.showPreviewMemory();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(resolveHtmlPath('mainWindow.index.html'));
  setupTray();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  uIOhook.start();
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
 * VideoButton event listeners.
 */
ipcMain.on('videoButton', async (_event, args) => {
  const action = args[0];

  if (action === 'delete') {
    const videoForDeletion = args[1];
    await deleteVideo(videoForDeletion);
    if (mainWindow) mainWindow.webContents.send('refreshState');
  }

  if (action === 'open') {
    const fileToOpen = args[1];
    openSystemExplorer(fileToOpen);
  }

  if (action === 'save') {
    const videoToToggle = args[1];
    await toggleVideoProtected(videoToToggle);

    if (mainWindow) {
      mainWindow.webContents.send('refreshState');
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
 * Listener to open the folder containing the Warcraft Recorder logs.
 */
ipcMain.on('logPath', (_event, args) => {
  if (args[0] === 'open') {
    openSystemExplorer(logDir);
  }
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
ipcMain.handle('getVideoState', async () =>
  loadAllVideos(cfg.get<string>('storagePath'))
);

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
  uIOhook.stop();
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
        '[Main] Blocked attempt to launch a second instance of the application'
      );

      app.quit();
      return;
    }

    createWindow();
  })
  .catch(console.error);
