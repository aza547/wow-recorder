import EventEmitter from 'events';
import path from 'path';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { app } from 'electron';
import ConfigService from 'config/ConfigService';
import { WowProcessEvent } from 'main/types';
import type { IProcessPoller } from './IProcessPoller';

/**
 * Windows process poller. Spawns the `rust-ps.exe` binary shipped with
 * the app, which periodically emits `{"Retail":bool,"Classic":bool}`
 * JSON on stdout.
 */
export default class WinRustPsPoller
  extends EventEmitter
  implements IProcessPoller
{
  private cfg = ConfigService.getInstance();
  private wowRunning = false;
  private child: ChildProcessWithoutNullStreams | undefined;

  private readonly binary = app.isPackaged
    ? path.join(process.resourcesPath, 'binaries', 'rust-ps.exe')
    : path.join(__dirname, '../../binaries', 'rust-ps.exe');

  isWowRunning(): boolean {
    return this.wowRunning;
  }

  start(): void {
    this.stop();
    console.info('[WinRustPsPoller] Start');
    this.child = spawn(this.binary);
    this.child.stdout.on('data', this.handleStdout);
    this.child.stderr.on('data', this.handleStderr);
  }

  stop(): void {
    console.info('[WinRustPsPoller] Stop');
    this.wowRunning = false;
    if (this.child) {
      this.child.kill();
      this.child = undefined;
    }
  }

  private handleStdout = (data: string | Buffer) => {
    let parsed: { Retail?: boolean; Classic?: boolean };
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      return;
    }

    const { Retail = false, Classic = false } = parsed;
    const recordRetail = this.cfg.get<boolean>('recordRetail');
    const recordClassic = this.cfg.get<boolean>('recordClassic');
    const recordEra = this.cfg.get<boolean>('recordEra');

    const running =
      (recordRetail && Retail) ||
      (recordClassic && Classic) ||
      (recordEra && Classic);

    if (this.wowRunning === running) return;

    this.wowRunning = running;

    if (running) this.emit(WowProcessEvent.STARTED);
    else this.emit(WowProcessEvent.STOPPED);
  };

  private handleStderr = (data: string | Buffer) => {
    console.warn('[WinRustPsPoller] stderr:', data.toString());
  };
}
