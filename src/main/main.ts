/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * Application entrypoint point.
 */
import path, { join } from 'path';
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { resolveHtmlPath } from './util';


const Store = require('electron-store');
const fs = require('fs');
const spawn = require('child_process').spawn;

/**
 * Create a settings store to handle the config.
 */
const cfg = new Store();

/**
 * Arena recorder python executable path. 
 */
// const executablePath = app.isPackaged
//  ? path.join(process.resourcesPath, 'assets')
//  : path.join(__dirname, '../../assets');

var executablePath = "D:\\checkouts\\wow-recorder\\release\\app\\win64recorder\\ArenaRecorder.exe";
let recorderProcess: any;

/**
 * Start the recording process. 
 */
const startRecorder = () => {

  // Include quotes as we're using shell: true. 
  const parameters = [
    '--storage', `\"${cfg.get('storage-path')}\"`,
    '--logs',    `\"${cfg.get('log-path')}\"`,
    '--size',    `\"${cfg.get('max-storage')}\"`];

  // Start the executable. 
  recorderProcess = spawn(executablePath, parameters, { shell: true });

  // Setup stdout listeners for executable. 
  recorderProcess.stdout.on('data', function (data: any) {
    const message = data.toString();
    console.log('stdout: ' + message);

    if (message.includes('RUNNING')) {
      if (mainWindow !== null)  {
        mainWindow.webContents.send('updateStatus', 0);
      }
    } else if (message.includes('STARTED RECORDING')) {
      if (mainWindow !== null) {
        mainWindow.webContents.send('updateStatus', 1);
      }
    } else if (message.includes('STOPPED RECORDING')) {
      if (mainWindow !== null) {
        mainWindow.webContents.send('updateStatus', 0);

        // If we finish recording, refresh the GUI to show the new video. 
        mainWindow.webContents.send('refreshState');
      }
    }
  });

  // Any stderr event is treated as a fatal error and will flag failed in the GUI. 
  recorderProcess.stderr.on('data', function (data: any) {
    console.log('stderr: ' + data.toString());
    if (mainWindow) {
      mainWindow.webContents.send('updateStatus', 2);
    }
  });

  // Log process exit for debugging.
  recorderProcess.on('close', (code: any) => {
    console.log(`recorderProcess exited with code ${code}`);
  });
}

/**
 * TODO Validate the config, else prompt the user for some?.
 */

/**
 * Months of the year.
 */
 const monthNames = [
   "January",
   "February",
   "March",
   "April",
   "May",
   "June",
   "July",
   "August",
   "September",
   "October",
   "November",
   "December"
  ];

const zones = {
    // Arenas
    1672: "Blade's Edge Arena",
    617: "Dalaran Arena",
    1505: "Nagrand Arena",
    572: "Ruins of Lordaeron",
    2167: "The Robodrome",
    1134: "Tiger's Peak",
    980: "Tol'Viron Arena",
    1504: "Black Rook Hold Arena",
    2373: "Empyrean Domain",
    1552: "Ashamane's Fall",
    1911: "Mugambala",
    1825: "Hook Point",
    2509: "Maldraxxus Coliseum",
    2547: "Enigma Crucible",
    // Raids
    // Dungeons
    // Battlegrounds
  }

const encounters = {
  2537: "The Jailer" // The Jailer Encounter
}


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
    minWidth: 1024,
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

  mainWindow.loadURL(resolveHtmlPath('mainWindow.index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }

    startRecorder();
    mainWindow.webContents.send('updateStatus', 2);

    mainWindow.setAspectRatio(15/9);

    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    if (recorderProcess !== null) {
      recorderProcess.kill('SIGINT')
    }

    mainWindow = null;
  });

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  // new AppUpdater();
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
 * Get the list of video files and their state.
 */
 ipcMain.on('getVideoState', (event, categories: string[]) => {

  let videoState = {};


  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    videoState[category] = [];

    const path = `D:/wow-recorder-files/${category}/`;
    const videos = fs.readdirSync(path).sort(function(a, b) {
      // reverse chronological sort
      // https://stackoverflow.com/questions/10559685/using-node-js-how-do-you-get-a-list-of-files-in-chronological-order
      return fs.statSync(path + b).mtime.getTime() - fs.statSync(path + a).mtime.getTime();
    });



    for (let j = 0; j < videos.length; j++) {
      const fullPath = path + "/" + videos[j];
      const name = videos[j];

      // Split the zoneID and duration out of the video file.
      const zoneID = name.split("-")[0];
      const duration = name.split("-")[1];

      // Get date object when file was last modified.
      const date = new Date(fs.statSync(path + videos[j]).mtime)

      // Get a date string in the form "7 Sep".
      const day = date.getDate();
      const month = monthNames[date.getMonth()].slice(0, 3);
      const dateStr = `${day} ${month}`;

      // Get a clock time in the form "HH:MM".
      const hours = date.getHours().toLocaleString('en-US', { minimumIntegerDigits: 2});
      const mins = date.getMinutes().toLocaleString('en-US', { minimumIntegerDigits: 2});
      const timeStr = `${hours}:${mins}`;

      // If in a raid, zoneID is actually the encounter ID.
      let zone: string;

      if (category === "Raids") {
        zone = "Sepulcher of the First Ones"; // Sepulcher, to add support for future raids as released.
      } else {
        zone = zones[zoneID]
      }

      // If in a raid, zoneID is actually the encounter ID.
      // If in PVP, just use the category e.g. "2v2" as the encounter name.
      let encounter: string;

      if (category === "Raids") {
        encounter = encounters[zoneID];
      } else {
        encounter = category;
      }

      videoState[categories[i]].push({
        name: name,
        index: j,
        fullPath: fullPath,
        encounter: encounter,
        zone: zone,
        zoneID: zoneID,
        duration: duration,
        result: 0, // 0 for fail, 1 for success
        date: dateStr,
        time: timeStr
      });
    }
  }

  event.returnValue = videoState;
});
