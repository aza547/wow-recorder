import { execFile } from 'child_process';
import path from 'path';

const DRIVE_FORMAT_COMMAND = '[System.IO.DriveInfo]::new($args[0]).DriveFormat';

const getWindowsRoot = (targetPath: string) => {
  return path.win32.parse(path.win32.resolve(targetPath)).root;
};

const getDriveFormat = async (
  targetPath: string,
): Promise<string | undefined> => {
  if (process.platform !== 'win32') {
    return undefined;
  }

  const root = getWindowsRoot(targetPath);

  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        DRIVE_FORMAT_COMMAND,
        root,
      ],
      { windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          console.warn('[Filesystem] Failed to get drive format', targetPath);
          console.warn(String(error));

          if (stderr) {
            console.warn(String(stderr).trim());
          }

          resolve(undefined);
          return;
        }

        const driveFormat = String(stdout).trim();

        if (!driveFormat) {
          console.warn('[Filesystem] Empty drive format returned', targetPath);
          resolve(undefined);
          return;
        }

        console.info('[Filesystem] Drive format', targetPath, driveFormat);
        resolve(driveFormat);
      },
    );
  });
};

const isExFatPath = async (targetPath: string): Promise<boolean> => {
  const driveFormat = await getDriveFormat(targetPath);

  return driveFormat?.toLowerCase() === 'exfat';
};

export { getDriveFormat, isExFatPath };
