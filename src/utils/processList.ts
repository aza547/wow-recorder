import path from 'path';
import { spawn } from 'child_process';
import { app } from 'electron';

const BINARY = 'rust-ps.exe';

export interface ProcessDescriptor {
  readonly pid: number;
  readonly name: string;
  readonly ppid: number;
}

/**
 *
 */
const spawnRustPs = () => {
  const binaryPath = app.isPackaged
    ? path.join(process.resourcesPath, 'binaries', BINARY)
    : path.join(__dirname, '../../binaries', BINARY);

  return spawn(binaryPath);
};

export default spawnRustPs;
