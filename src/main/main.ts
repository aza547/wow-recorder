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
  protocol,
} from 'electron';
import os from 'os';
import { uIOhook } from 'uiohook-napi';
import assert from 'assert';
import { getLocalePhrase, Language } from 'localisation/translations';
import {
  resolveHtmlPath,
  openSystemExplorer,
  setupApplicationLogging,
  getAvailableDisplays,
  getAssetPath,
} from './util';
import { OurDisplayType, SoundAlerts, VideoPlayerSettings } from './types';
import ConfigService from '../config/ConfigService';
import Manager from './Manager';
import AppUpdater from './AppUpdater';
import MenuBuilder from './menu';
import { Phrase } from 'localisation/phrases';
import CloudClient from 'storage/CloudClient';
import DiskClient from 'storage/DiskClient';
import Poller from 'utils/Poller';
import Recorder from './Recorder';
import AsyncQueue from 'utils/AsyncQueue';
import { ESupportedEncoders } from './obsEnums';
import fs from 'fs';

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

let window: BrowserWindow | null = null;
let tray: Tray | null = null;
const manager = new Manager();

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

// Register the vod:// protocol as privileged. Required to securely play
// videos from disk.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'vod',
    privileges: {
      bypassCSP: true,
      standard: true,
      stream: true,
      supportFetchAPI: true,
    },
  },
]);

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
        if (window) window.show();
      },
    },
    {
      label: getLocalePhrase(language, Phrase.SystemTrayQuit),
      click() {
        console.info('[Main] User clicked close on tray icon');

        if (window) {
          window.close();
        }
      },
    },
  ]);

  tray.setToolTip('Warcraft Recorder');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    console.info('[Main] User double clicked tray icon');

    if (window) {
      window.show();
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

  window = new BrowserWindow({
    show: false,
    height: 1020 * 0.9,
    width: 1980 * 0.8,
    icon: getAssetPath('./icon/small-icon.png'),
    frame: false,
    title: `Warcraft Recorder v${appVersion}`,
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  // We need to do this AFTER creating the window as it's used by the preview.
  Recorder.getInstance().initializeObs();
  await manager.startup();

  // If this is first time setup, auto-pick an encoder for the user. Only do it
  // if the current value is the software encoder, as this is new in 7.0.0, all
  // users would be subject to it. This way, only the few people who really do
  // prefer the software encoder will be inconvenienced.
  const firstTimeSetup =
    cfg.get<boolean>('firstTimeSetup') &&
    cfg.get<string>('obsRecEncoder') === ESupportedEncoders.OBS_X264;

  if (firstTimeSetup) {
    // Don't bother to signal to the frontend here, they would have to be
    // very fast to have opened the settings already.
    console.info('[Main] First time setup, picking default encoder');
    const encoder = Recorder.getInstance().getSensibleEncoderDefault();
    cfg.set('obsRecEncoder', encoder);
  }

  // Ensure we don't hit the above branch again.
  cfg.set('firstTimeSetup', false);

  // This gets hit on a user triggering refresh with CTRL-R.
  window.on('ready-to-show', async () => {
    console.log('[Main] Ready to show');

    const status = app.getGPUFeatureStatus();
    const info = await app.getGPUInfo('complete');
    console.info('[Main] GPU info', { status, info });

    if (!window) {
      throw new Error('window is not defined');
    }

    // This shows the correct version on a release build, not during development.
    window.webContents.send(
      'updateVersionDisplay',
      `Warcraft Recorder v${appVersion}`,
    );

    const startMinimized = cfg.get<boolean>('startMinimized');
    if (!startMinimized) window.show();

    // Important to refresh status and videos after a user triggered
    // refresh, otherwise the frontend will be in its default state
    // which may not reflect reality.
    const disk = DiskClient.getInstance();
    const cloud = CloudClient.getInstance();

    await Promise.all([
      manager.refreshStatus(),
      disk.refreshStatus(),
      disk.refreshVideos(),
      cloud.refreshStatus(),
      cloud.refreshVideos(),
    ]);
  });

  window.on('focus', () => {
    window?.webContents.send('window-focus-status', true);
  });

  window.on('blur', () => {
    window?.webContents.send('window-focus-status', false);
  });

  window.on('closed', () => {
    window = null;
  });

  await window.loadURL(resolveHtmlPath('index.html'));
  setupTray();

  // Open urls in the user's browser
  window.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  uIOhook.start();

  // Runs the auto-updater, which checks GitHub for new releases
  // and will prompt the user if any are available.
  new AppUpdater(window);
};

/**
 * window event listeners.
 */
ipcMain.on('window', (_event, args) => {
  if (window === null) return;

  if (args[0] === 'minimize') {
    console.info('[Main] User clicked minimize');

    if (cfg.get<boolean>('minimizeToTray')) {
      console.info('[Main] Minimize main window to tray');
      window.webContents.send('pausePlayer');
      window.hide();
    } else {
      console.info('[Main] Minimize main window to taskbar');
      window.minimize();
    }
  }

  if (args[0] === 'resize') {
    console.info('[Main] User clicked resize');

    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  }

  if (args[0] === 'quit') {
    console.info('[Main] User clicked quit button');

    if (cfg.get<boolean>('minimizeOnQuit')) {
      console.info('[Main] Hiding main window');
      window.webContents.send('pausePlayer');
      window.hide();
    } else {
      console.info('[Main] Closing main window');
      window.close();
    }
  }
});

/**
 * Opens a system explorer window to select a path.
 */
ipcMain.handle('selectPath', async () => {
  if (!window) {
    return '';
  }

  const result = await dialog.showOpenDialog(window, {
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
  if (!window) {
    return '';
  }

  const result = await dialog.showOpenDialog(window);

  if (result.canceled) {
    console.info('[Main] User cancelled file selection');
    return '';
  }

  return result.filePaths[0];
});

/**
 * Opens a system explorer window to select a path.
 */
ipcMain.handle('selectImage', async () => {
  if (!window) {
    return '';
  }

  const result = await dialog.showOpenDialog(window, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['gif', 'png'] }],
  });

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

// Enforces serial execution of calls to reconfigureBase. Also has a limit
// of 1 queued task and will drop any extra tasks, which is appropriate for
// deduplicating reconfigure work.
const reconfigureBaseQueue = new AsyncQueue(1);

/**
 * A reconfig is triggered when a base setting changes.
 */
ipcMain.on('reconfigureBase', () => {
  console.info('[Main] Queue a reconfigure');
  reconfigureBaseQueue.add(() => manager.reconfigureBase());
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

const refreshCloudGuilds = async () => {
  console.info('[Main] Frontend triggered cloud guilds refresh');
  const client = CloudClient.getInstance();
  await client.fetchAffiliations(true);
  client.refreshStatus();
};

ipcMain.on('refreshCloudGuilds', refreshCloudGuilds);

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
 * Before quit events, also called invoked the automatic quit on upgrade.
 */
app.on('before-quit', () => {
  console.info('[Main] Running before-quit actions');

  if (tray) {
    console.info('[Main] Destroy tray icon');
    tray.destroy();
    tray = null;
  }

  Poller.getInstance().stop();
  uIOhook.stop();
  Recorder.getInstance().shutdownOBS();
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
      console.warn('[Main] Blocked attempt to launch a second instance');
      app.quit();
      return;
    }

    app.on('second-instance', () => {
      console.info('[Main] Second instance attempted, will restore app');
      if (!window) return;
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    });

    new MenuBuilder().buildMenu();

    // Required by the video player to safely play files from disk.
    protocol.handle('vod', async (request) => {
      try {
        // Extract Base64-encoded filename
        const encodedFilename = decodeURIComponent(
          request.url.replace('vod://wcr/', ''),
        );
        const filename = encodedFilename.split('#')[0];

        // Allow only mp4 files
        if (!filename.endsWith('.mp4')) {
          return new Response('Only video files are allowed', { status: 400 });
        }

        const stats = fs.statSync(filename);
        const totalSize = stats.size;

        // Parse Range header
        const range = request.headers.get('Range') || 'bytes=0-';
        const [startStr, endStr] = range.replace('bytes=', '').split('-');
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : totalSize - 1;
        const chunkSize = end - start + 1;

        // Read the exact chunk
        const buffer = new Uint8Array(chunkSize);
        const fd = fs.openSync(filename, 'r');
        fs.readSync(fd, buffer, 0, chunkSize, start);
        fs.closeSync(fd);

        return new Response(buffer, {
          status: 206,
          statusText: 'Partial Content',
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': chunkSize.toString(),
            'Accept-Ranges': 'bytes',
            'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          },
        });
      } catch (err) {
        console.error(err);
        return new Response('Error serving file', { status: 500 });
      }
    });

    createWindow();
  })
  .catch(console.error);

const send = (channel: string, ...args: unknown[]) => {
  if (!window || window.isDestroyed()) return; // Can happen on shutdown.
  window.webContents.send(channel, ...args);
};

const playSoundAlert = (alert: SoundAlerts) => {
  if (!window || window.isDestroyed()) return; // Can happen on shutdown.
  console.info('[Main] Playing sound alert', alert);
  const path = getAssetPath(`sounds/${alert}.mp3`);
  send('playAudio', path);
};

const getNativeWindowHandle = () => {
  assert(window);
  assert(!window.isDestroyed()); // Can't tolerate this here. But this shouldn't be possible.
  return window.getNativeWindowHandle();
};

export { send, getNativeWindowHandle, playSoundAlert };
