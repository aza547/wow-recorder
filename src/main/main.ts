/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * Application entrypoint point.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { resolveHtmlPath, getVideoState, writeMetadataFile, runSizeMonitor, isConfigReady } from './util';
import { watchLogs, Metadata, getLatestLog } from './logutils';
import Store from 'electron-store';

const obsRecorder = require('./obsRecorder');

/**
 * Create a settings store to handle the config.
 */
const cfg = new Store();
let storageDir: any = cfg.get('storage-path') + "/";
let baseLogPath: any = cfg.get('log-path') + "/";
let maxStorage: any = cfg.get('max-storage');

/**
 * Getter and setter config listeners. 
 */
ipcMain.on('cfg-get', async (event, val) => {
  event.returnValue = cfg.get(val);
});
ipcMain.on('cfg-set', async (_event, key, val) => {
  cfg.set(key, val);
});

/**
 * Define renderer windows.
 */
let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;

/**
 * Are we currently recording, and what category? 
 */
let isRecording: boolean = false;
let isRecordingCategory: string | null = null;

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
 * Creates the main window.
 */
const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    minWidth: 1024,
    icon: getAssetPath('./icon/small-icon.png'),
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      webSecurity: false,
      //devTools: false,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('mainWindow.index.html'));
  mainWindow.setAspectRatio(15/9);

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) throw new Error('"mainWindow" is not defined');

    // Check we have all config, and at least one log is in the log directory. 
    if (isConfigReady(cfg) && (getLatestLog(baseLogPath))) {
      mainWindow.webContents.send('updateStatus', 0);
    } else {
      mainWindow.webContents.send('updateStatus', 2);
    }

    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

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

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  settingsWindow = new BrowserWindow({
    show: false,
    width: 380,
    height: 380,
    resizable: true,
    icon: getAssetPath('./icon/settings-icon.svg'),
    frame: false,
    webPreferences: {
      webSecurity: false,
      //devTools: false,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  settingsWindow.loadURL(resolveHtmlPath("settings.index.html"));

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
  
  dialog.showOpenDialog(settingsWindow, { properties: ['openDirectory'] }).then(result => {
    if (!result.canceled) {
      event.reply('settingsWindow', ['pathSelected', setting, result.filePaths[0]]);
    }
  })
  .catch(err => {
    console.log(err);
  })
} 

/**
 * Start recording.
 */
 const startRecording = (metadata: Metadata) => {
  obsRecorder.start();
  isRecording = true;
  isRecordingCategory = metadata.category;
  if (mainWindow) mainWindow.webContents.send('updateStatus', 1);
}

/**
 * Start recording.
 */
 const stopRecording = (metadata: Metadata) => {
  obsRecorder.stop();
  isRecording = false;
  isRecordingCategory = null;

  setTimeout(() => {
      if (mainWindow) { 
        writeMetadataFile(storageDir, metadata);
        runSizeMonitor(storageDir, maxStorage * 1000000000); //convert GB to bytes
        mainWindow.webContents.send('updateStatus', 0);
        mainWindow.webContents.send('refreshState');
      };
  }, 2000);
}

/**
 * mainWindow event listeners.
 */
ipcMain.on('mainWindow', (_event, args) => {
  if (mainWindow === null) return; 
  if (args[0] === "minimize") mainWindow.minimize();
  if (args[0] === "resize") mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  if (args[0] === "quit") mainWindow.close();
})

/**
 * settingsWindow event listeners.
 */
ipcMain.on('settingsWindow', (event, args) => {
  if (args[0] === "create") createSettingsWindow();
  if (settingsWindow === null) return; 
  if (args[0] === "quit") settingsWindow.close();
  if (args[0] === "openPathDialog") openPathDialog(event, args);
})

/**
 * Get the list of video files and their state.
 */
ipcMain.on('getVideoState', (event) => {
  const videoState = getVideoState(storageDir);
  event.returnValue = videoState;
});

/**
 * Shutdown the app if all windows closed. 
 */
app.on('window-all-closed', () => {
  obsRecorder.shutdown();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * App start-up.
 */
app
  .whenReady()
  .then(() => {
    obsRecorder.initialize(storageDir);
    createWindow();
    if (!isConfigReady(cfg) || !getLatestLog(baseLogPath)) return;
    watchLogs(baseLogPath);
  })
  .catch(console.log);

export {
  startRecording,
  stopRecording,
  isRecording,
  isRecordingCategory
};





