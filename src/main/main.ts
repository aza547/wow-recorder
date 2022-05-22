/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { resolveHtmlPath } from './util';

const Store = require('electron-store');
Store.initRenderer();
const store = new Store();

store.set('storage-path', 'D:/wow-recorder-files');
store.set('log-path', 'D:/World of Warcraft/_retail_/Logs');
store.set('max-storage', '50');


const fs = require('fs');
const files = fs.readdirSync('D:/wow-recorder-files/2v2');

ipcMain.on('LIST', (event, args) => {
  event.reply('LISTRESPONSE', files);
  return event.returnValue = "";
});

ipcMain.on('maximize', () => {
  //mainWindow is the reference to your window
  console.log("received maximize event");
  if (mainWindow !== null) mainWindow.maximize();
})

export default class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

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
   // autoHideMenuBar: true,
   frame: false,
    webPreferences: {
      webSecurity: false,
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
    resizable: true,
    icon: getAssetPath('icons8-settings.svg'),
   // autoHideMenuBar: true,
    frame: false,
    webPreferences: {
      webSecurity: false,
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
 * Add event listeners...
 */

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

ipcMain.on('SAVE-SETTINGS', (event, settings) => {
  if (settingsWindow !== null) {
    console.log(settings);
    console.log(settings[0]);
    console.log(settings[1]);
    console.log(settings[2]);
    settingsWindow.close();
  }
})

ipcMain.on('CLOSE-SETTINGS', () => {
  if (settingsWindow !== null)  settingsWindow.close();
})

ipcMain.on('GET-STORAGE-PATH', (event) => {
  event.reply('RESP-STORAGE-PATH', store.get('storage-path'));
})

ipcMain.on('GET-LOG-PATH', (event) => {
  event.reply('RESP-LOG-PATH', store.get('log-path'));
})

ipcMain.on('GET-MAX-STORAGE', (event) => {
  event.reply('RESP-MAX-STORAGE', store.get('max-storage'));
})

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
