import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const isLinux = process.platform === 'linux';
export const isWindows = process.platform === 'win32';

const LINUX_AUTOSTART_FILE_NAME = 'warcraft-recorder.desktop';

function getLinuxAppImagePath(): string | undefined {
  return process.env.APPIMAGE;
}

function getLinuxAutostartDir(): string {
    return path.join(os.homedir(), '.config', 'autostart');
}

function getLinuxAutostartFilePath(): string {
  return path.join(getLinuxAutostartDir(), LINUX_AUTOSTART_FILE_NAME);
}

function getLinuxAutostartFileContent(): string {
  const execPath = getLinuxAppImagePath();
  const appName = app.getName() || 'Warcraft Recorder';

  return `[Desktop Entry]
Type=Application
Name=${appName}
Exec="${execPath}"
X-GNOME-Autostart-enabled=true
Hidden=false
NoDisplay=false
Comment=Automatically record your World of Warcraft encounters
StartupNotify=false
Terminal=false
`;
}

function setLinuxAutostart(enabled: boolean): void {
  if (!app.isPackaged) {
    console.warn('[Autostart] Skipping autostart setup in dev mode');
    return;
  }

  const autostartDir = getLinuxAutostartDir();
  const desktopFilePath = getLinuxAutostartFilePath();

  if (enabled) {
    if (!fs.existsSync(autostartDir)) {
      fs.mkdirSync(autostartDir, { recursive: true });
    }
    fs.writeFileSync(desktopFilePath, getLinuxAutostartFileContent(), 'utf-8');
    console.info('[Autostart] Linux autostart enabled:', desktopFilePath);
  } else {
    if (fs.existsSync(desktopFilePath)) {
      fs.unlinkSync(desktopFilePath);
      console.info('[Autostart] Linux autostart disabled');
    }
  }
}

/**
 * Cross-platform autostart setter. Handles Windows/macOS via Electron API,
 * Linux via .desktop file in ~/.config/autostart/
 */
export function setAutostart(enabled: boolean): void {
  if (isLinux) {
    setLinuxAutostart(enabled);
  } else {
    app.setLoginItemSettings({ openAtLogin: enabled });
  }
}

/**
 * Call on startup to ensure Linux autostart path is current
 * (handles AppImage being moved)
 */
export function ensureAutostartPath(startUpEnabled: boolean): void {
  if (isLinux && app.isPackaged && startUpEnabled) {
    setLinuxAutostart(true);
  }
}
