import EventEmitter from 'events';
import { spawn } from 'child_process';
import ConfigService from 'config/ConfigService';
import { WowProcessEvent } from 'main/types';
import type { IProcessPoller } from './IProcessPoller';

const POLL_INTERVAL_MS = 2000;
const RETAIL_PROCESS = 'World of Warcraft';
const CLASSIC_PROCESS = 'World of Warcraft Classic';

/**
 * macOS process poller. Spawns `pgrep -x <name>` for retail and
 * classic process names every 2 seconds; exit code 0 = running,
 * 1 = not running. Config gates (recordRetail/Classic/Era) are
 * applied before emitting. Era shares the Classic binary on mac,
 * mirroring the Windows behaviour.
 */
export default class MacPgrepPoller extends EventEmitter implements IProcessPoller {
  private cfg = ConfigService.getInstance();
  private wowRunning = false;
  private timer: NodeJS.Timeout | undefined;

  isWowRunning(): boolean {
    return this.wowRunning;
  }

  start(): void {
    this.stop();
    console.info('[MacPgrepPoller] Start');
    this.timer = setInterval(this.poll, POLL_INTERVAL_MS);
  }

  stop(): void {
    console.info('[MacPgrepPoller] Stop');
    this.wowRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private poll = () => {
    Promise.all([
      this.pgrep(RETAIL_PROCESS),
      this.pgrep(CLASSIC_PROCESS),
    ]).then(([retail, classic]) => this.apply(retail, classic));
  };

  private pgrep(name: string): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn('pgrep', ['-x', name]);
      child.on('exit', (code) => resolve(code === 0));
      child.on('error', () => resolve(false));
    });
  }

  private apply(retail: boolean, classic: boolean): void {
    const recordRetail = this.cfg.get<boolean>('recordRetail');
    const recordClassic = this.cfg.get<boolean>('recordClassic');
    const recordEra = this.cfg.get<boolean>('recordEra');

    const running =
      (recordRetail && retail) ||
      (recordClassic && classic) ||
      (recordEra && classic);

    if (this.wowRunning === running) return;
    this.wowRunning = running;
    if (running) this.emit(WowProcessEvent.STARTED);
    else this.emit(WowProcessEvent.STOPPED);
  }
}
