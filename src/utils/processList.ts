import util from 'util';
import path from 'path';
import childProcess from 'child_process';
import { app } from 'electron';

const TEN_MEGABYTES = 1000 * 1000 * 10;
const BINARY = 'fastlist-0.3.0-x64.exe';
const execFile = util.promisify(childProcess.execFile);

export interface ProcessDescriptor {
  readonly pid: number;
  readonly name: string;
  readonly ppid: number;
}

/**
 * An interface to fastlist. This is basically just ps-list
 * (https://github.com/sindresorhus/ps-list), but because ps-list is an ESM
 * module we can't just use it like normal. This file exists to call the
 * fastlist executable, and parse the output.
 */
const listProcesses = async (): Promise<ProcessDescriptor[]> => {
  const binaryPath = app.isPackaged
    ? path.join(process.resourcesPath, 'binaries', BINARY)
    : path.join(__dirname, '../../binaries', BINARY);

  const { stdout } = await execFile(binaryPath, {
    maxBuffer: TEN_MEGABYTES,
    windowsHide: true,
  });

  return stdout
    .trim()
    .split('\r\n')
    .map((line) => line.split('\t'))
    .map(([pid, ppid, name]) => ({
      pid: Number.parseInt(pid, 10),
      ppid: Number.parseInt(ppid, 10),
      name,
    }));
};

export default listProcesses;
