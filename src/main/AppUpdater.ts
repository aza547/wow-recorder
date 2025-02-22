import { BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';

const customConsoleLogger = {
  log: (...args: string[]) => console.log('[AutoUpdater]', ...args),
  // Debug logging is too verbose for production.
  // debug: (...args: string[]) => console.debug('[AutoUpdater]', ...args),
  info: (...args: string[]) => console.info('[AutoUpdater]', ...args),
  warn: (...args: string[]) => console.warn('[AutoUpdater]', ...args),
  error: (...args: string[]) => console.error('[AutoUpdater]', ...args),
};

export default class AppUpdater {
  constructor(window: BrowserWindow) {
    autoUpdater.logger = customConsoleLogger;

    // Don't auto-install on quit. This would force users to update which
    // isn't friendly.
    autoUpdater.autoInstallOnAppQuit = false;

    // If we find a new version on GitHub, inform the frontend.
    autoUpdater.on('update-downloaded', () => {
      window.webContents.send('updateAvailable');
    });

    // If the user accepted the update on the frontend, actually
    // do it.
    ipcMain.on('doAppUpdate', () => {
      console.log('[AutoUpdater] User triggered auto-update');
      autoUpdater.quitAndInstall();
    });

    // Check GitHub to see if any new versions are available.
    autoUpdater.checkForUpdates();
  }
}
