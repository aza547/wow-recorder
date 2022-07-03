/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * Application entrypoint point.
 */
import path, { join } from 'path';
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { resolveHtmlPath } from './util';

/**
 * List of supported categories. Order is the order they show up in the GUI.
 */
 const categories = [
  "2v2",
  "3v3",
  "Skirmish",
  "Solo Shuffle",
  "Mythic+",
  "Raids",
  "Battlegrounds"
];

const Store = require('electron-store');
const fs = require('fs');
const spawn = require('child_process').spawn;
const systemInformation = require('systeminformation');

/**
 * Create a settings store to handle the config.
 */
const cfg = new Store();

/**
 * Arena recorder python executable path. 
 */
let recorderProcess: any;

const recorderBinaryPath = app.isPackaged
? path.join(process.resourcesPath, 'win64recorder/recorder.exe')
: path.join(__dirname, '../../win64recorder/recorder.exe');

const ffmpegBinaryPath = app.isPackaged
? path.join(process.resourcesPath, 'ffmpeg/ffmpeg.exe')
: path.join(__dirname, '../../ffmpeg/ffmpeg.exe');

/**
 * Diags log path. 
 */
let outputLog: string = path.join(process.resourcesPath, 'output.log');

/**
 * Get the GPU type. Restart recorder to pick it up. 
 */
 let GPUVendor: string;


 systemInformation.graphics()
   .then((data) => {
      fs.appendFile(outputLog, "\nGPU Data: " + JSON.stringify(data) + "\n", err => {
        if (err) {
          console.error(err);
        }
      });    

      if (data.controllers[0].vendor) {
        GPUVendor = data.controllers[0].vendor;
        fs.appendFile(outputLog, "GPU Vendor: " + GPUVendor + "\n", err => {
          if (err) {
            console.error(err);
          }
        });    
        restartRecorder();
     }
   })
   .catch((error) => {
     console.error(error);
   });
   

/**
 * Start the recording process. 
 */
const startRecorder = () => {

  // Get config.
  const storagePath = cfg.get('storage-path');
  const logPath = cfg.get('log-path');
  const maxStorage = cfg.get('max-storage');

  // Include quotes as we're using shell: true. 
  let parameters = [
    '--storage', `\"${storagePath}\"`,
    '--logs',    `\"${logPath}\"`,
    '--size',    `\"${maxStorage}\"`,
    '--ffmpeg',  `\"${ffmpegBinaryPath}\"`
  ];

  // Identify brand of GPU and use hardware encoding if NVIDIA/AMD, defaults to CPU encoding. 
  const isNvidia = GPUVendor && GPUVendor.toUpperCase().includes("NVIDIA");
  const isAMD = GPUVendor && ((GPUVendor.toUpperCase().includes("AMD")) || (GPUVendor.toUpperCase().includes("ADVANCED MICRO DEVICES")));

  if (isNvidia) {
    parameters.push("--hwe", "NVIDIA");
  } else if (isAMD) {
    parameters.push("--hwe", "AMD");
  }

  // Start the executable. 
  recorderProcess = spawn(recorderBinaryPath, parameters, { shell: true });

  // Setup stdout listeners for executable. 
  recorderProcess.stdout.on('data', function (data: any) {
    const message = 'stdout: ' + data.toString();
    const outputLog = `${storagePath}/diags/output.log`;

    fs.appendFile(outputLog, message, err => {
      if (err) {
        console.error(err);
      }
    });    

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
    const errorMessage = 'stderr: ' + data.toString();
    const outputLog = `${storagePath}/diags/output.log`;

    fs.appendFile(outputLog, errorMessage, err => {
      if (err) {
        console.error(err);
      }
    });  

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
 * Start the recording process. 
 */
 const stopRecorder = () => {
  if (recorderProcess) {
    recorderProcess.kill('SIGINT');
    recorderProcess = null;
  }
 }

/**
 * Restart the recording process. 
 */
 const restartRecorder = () => {
  stopRecorder();
  startRecorder();
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
  2537: "The Jailer"
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
 * Check dirs we expect to exist do, create them if not. 
 */
const checkDirs = () => {
  
  if (cfg.get('storage-path') === undefined) {
    console.log("Storage path was undefined");
  } else {
    // Create dirs for categories if they don't exist.
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      const storagePath = `${cfg.get('storage-path')}/${category}/`;

      if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
      }
    }

    // Create dirs for diags and metadata if they don't exist.
    const diagsPath = `${cfg.get('storage-path')}/diags`;
    const metadataPath = `${cfg.get('storage-path')}/metadata`;

    if (!fs.existsSync(diagsPath)) {
      fs.mkdirSync(diagsPath, { recursive: true });
    }
    if (!fs.existsSync(metadataPath)) {
      fs.mkdirSync(metadataPath, { recursive: true });
    } 
  }
}

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
    icon: getAssetPath('icons8-heart-with-mouse-48.png'),
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
    checkDirs();
    createWindow();
  })
  .catch(console.log);

/**
 * Window control listeners. 
 */
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

  // Log the passed config. 
  console.log(settings);

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

  if (mainWindow !== null) {
    mainWindow.webContents.send('refreshState');
  }

  // Restart recorder process with new config.
  stopRecorder();
  checkDirs();
  startRecorder();
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
 ipcMain.on('getVideoState', (event) => {

  let videoState = {};
  const storagePath = cfg.get('storage-path');

  if (storagePath === undefined) {
    for (let i = 0; i < categories.length; i++) {
      videoState[categories[i]] = [];
    }
  } else {
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      videoState[category] = [];

      const path = `${storagePath}/${category}/`;
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
  }

  event.returnValue = videoState;
});
