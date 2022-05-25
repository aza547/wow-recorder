/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * Application entrypoint point.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { resolveHtmlPath } from './util';

const Store = require('electron-store');
const fs = require('fs');

/**
 * Create a settings store to handle the config.
 */
const cfg = new Store();

/**
 * Validate the config, else prompt the user for some?.
 */



export default class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

/**
 * Define renderer windows.
 */
let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let pythonWindow: BrowserWindow | null = null;

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
 * Creates the main window I think?
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
    height: 575,
    minWidth: 1024,
    minHeight: 525,
    icon: getAssetPath('icon.png'),
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

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
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

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
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
    width: 400,
    height: 400,
    resizable: false,
    icon: getAssetPath('icons8-settings.svg'),
    frame: false,
    webPreferences: {
      webSecurity: false,
      //devTools: false,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  settingsWindow.loadURL(`file://${__dirname}/../settings/settings.html`);

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

/**
 * Creates the settings window, called on clicking the settings cog.
 */
const createPythonWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  pythonWindow = new BrowserWindow({
    show: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
 });

  pythonWindow.loadURL(`file://${__dirname}/../recorder/recorder.html`);

  pythonWindow.on('closed', () => {
    pythonWindow = null;
  });

  // Open urls in the user's browser
  pythonWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });
};

/**
 * Add event listeners...
 */
ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

ipcMain.on('maximize', () => {
  //mainWindow is the reference to your window
  if (mainWindow !== null) mainWindow.maximize();
})



app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    createPythonWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);

ipcMain.on('HIDE', () => {
    if (mainWindow !== null) mainWindow.minimize();
  })

ipcMain.on('RESIZE', () => {
    if (mainWindow !== null) {
      mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    };
})

ipcMain.on('QUIT', () => {
  if (mainWindow !== null) mainWindow.close();
})

ipcMain.on('CREATE-SETTINGS', () => {
  if (settingsWindow === null) createSettingsWindow();
})

/**
 * Save settings event, write any non-null settings to the store,
 * then close the settings window.
 */
ipcMain.on('SAVE-SETTINGS', (event, settings) => {

  console.log(settings[0]);
  console.log(settings[1]);
  console.log(settings[2]);

  if (settings[0] !== null) {
    cfg.set("storage-path", settings[0]);
  }
  if (settings[1] !== null) {
    cfg.set("log-path", settings[1]);
  }
  if (settings[2] !== null) {
    cfg.set("max-storage", settings[2]);
  }

  if (settingsWindow !== null) {
    settingsWindow.close();
  }
});

/**
 * Close settings window.
 */
ipcMain.on('CLOSE-SETTINGS', () => {
  if (settingsWindow !== null)  settingsWindow.close();
});

ipcMain.on('GET-STORAGE-PATH', (event) => {
  event.reply('RESP-STORAGE-PATH', cfg.get('storage-path'));
});

ipcMain.on('GET-LOG-PATH', (event) => {
  event.reply('RESP-LOG-PATH', cfg.get('log-path'));
});

ipcMain.on('GET-MAX-STORAGE', (event) => {
  event.reply('RESP-MAX-STORAGE', cfg.get('max-storage'));
});

/**
 * Dialog window folder selection.
 */
ipcMain.on("SET-STORAGE-PATH", (event) => {
  if (settingsWindow !== null) {
  dialog.showOpenDialog(settingsWindow, {
      properties: ['openDirectory']
  }).then(result => {
    console.log(result.canceled)
    if (result.canceled) {
      console.log("User cancelled dialog");
    } else {
      event.reply('APPLY-STORAGE-PATH', result.filePaths[0]);
    }
  }).catch(err => {
    console.log(err);
  })
  }
});

ipcMain.on("SET-LOG-PATH", (event) => {
  if (settingsWindow !== null) {
  dialog.showOpenDialog(settingsWindow, {
      properties: ['openDirectory']
  }).then(result => {
    console.log(result.canceled)
    if (result.canceled) {
      console.log("User cancelled dialog");
    } else {
      event.reply('APPLY-LOG-PATH', result.filePaths[0]);
    }
  }).catch(err => {
    console.log(err);
  })
  }
});

/**
 * Get the list of video files.
 */
ipcMain.on('LIST', (event) => {
  event.returnValue = fs.readdirSync('D:/wow-recorder-files/2v2');
  return fs.readdirSync('D:/wow-recorder-files/2v2');
});

/**
 * Get the list of video files.
 */
 ipcMain.on('LISTSOLO', (event) => {
  event.returnValue = fs.readdirSync('D:/wow-recorder-files/Solo Shuffle');
  return fs.readdirSync('D:/wow-recorder-files/Solo Shuffle');
});

/**
 * Get the list of video files.
 */
 ipcMain.on('LISTRAID', (event) => {
  event.returnValue = fs.readdirSync('D:/wow-recorder-files/Raids');
  return fs.readdirSync('D:/wow-recorder-files/Raids');
});

/**
 * Return the config.
 * See https://electron-react-boilerplate.js.org/docs/electron-store for a better way to do this.
 */
ipcMain.handle('GET-CFG', async () => {
  return [
    cfg.get('storage-path'),
    cfg.get('log-path'),
    cfg.get('max-storage')
  ];
});
