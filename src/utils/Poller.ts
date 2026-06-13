import EventEmitter from 'events';
import { ChildProcessWithoutNullStreams, execFile, spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';
import ConfigService from 'config/ConfigService';
import { WowProcessEvent } from 'main/types';
import {
  detectWowProcessesFromProcessList,
  WowProcessSnapshot,
} from './wowProcess';

type ExecFileError = Error & {
  code?: number | string;
};

/**
 * The Poller singleton periodically checks the list of WoW active
 * processes. If the state changes, it emits a WowProcessEvent.
 */
export default class Poller extends EventEmitter {
  /**
   * Singleton instance.
   */
  private static instance: Poller;

  /**
   * Config service handle.
   */
  private cfg: ConfigService = ConfigService.getInstance();

  /**
   * If a WoW process is running AND the corresponding record config is
   * enabled. Includes various flavours of retail, classic and era.
   */
  private wowRunning = false;

  /**
   * Spawned child process.
   */
  private child: ChildProcessWithoutNullStreams | undefined;

  /**
   * Timer used on non-Windows platforms where rust-ps.exe is unavailable.
   */
  private timer: NodeJS.Timeout | undefined;

  /**
   * Avoid overlapping process scans if the OS is slow to return process data.
   */
  private scanning = false;

  /**
   * True while process scan results are allowed to emit state changes.
   */
  private running = false;

  /**
   * Best-effort interval for platforms without the rust-ps.exe helper.
   */
  private pollIntervalMs = 5000;

  /**
   * Singleton instance.
   */
  private binary = app.isPackaged
    ? path.join(process.resourcesPath, 'binaries', 'rust-ps.exe')
    : path.join(__dirname, '../../binaries', 'rust-ps.exe');

  /**
   * Create or get the singleton.
   */
  static getInstance() {
    if (!Poller.instance) Poller.instance = new Poller();
    return Poller.instance;
  }

  /**
   * Private constructor as part of the singleton pattern.
   */
  private constructor() {
    super();
  }

  /**
   * Convienence method to check if WoW is running. Only returns true if WoW
   * is running, and the configuration is setup to record that flavour of WoW.
   */
  public isWowRunning() {
    return this.wowRunning;
  }

  /**
   * Stop the poller and reset the state.
   */
  public stop() {
    console.info('[Poller] Stop process poller');
    this.running = false;
    this.wowRunning = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    if (this.child) {
      this.child.kill();
      this.child = undefined;
    }
  }

  /**
   * Start the poller.
   */
  public start() {
    this.stop();
    console.info('[Poller] Start process poller');
    this.running = true;

    if (process.platform !== 'win32') {
      this.startUnixPoller();
      return;
    }

    this.child = spawn(this.binary);
    this.child.stdout.on('data', this.handleStdout);
    this.child.stderr.on('data', this.handleStderr);
  }

  /**
   * Start polling the Unix process table. Used for macOS/Linux support.
   */
  private startUnixPoller() {
    void this.scanUnixProcesses();
    this.timer = setInterval(() => {
      void this.scanUnixProcesses();
    }, this.pollIntervalMs);
  }

  /**
   * Scan the process list for WoW on Unix-like systems.
   */
  private async scanUnixProcesses() {
    if (this.scanning) {
      return;
    }

    this.scanning = true;

    try {
      const stdout = await new Promise<string>((resolve, reject) => {
        execFile('pgrep', ['-fl', 'World of Warcraft|Wow|WowClassic'], (
          error: ExecFileError | null,
          out,
          stderr,
        ) => {
          if (error) {
            if (error.code === 1) {
              resolve('');
              return;
            }

            reject(new Error(`${error.message}: ${stderr}`));
            return;
          }

          resolve(out);
        });
      });

      if (this.running) {
        this.handleSnapshot(detectWowProcessesFromProcessList(stdout));
      }
    } catch (error) {
      console.warn('[Poller] Failed to scan process list');
      console.error(String(error));
    } finally {
      this.scanning = false;
    }
  }

  /**
   * Handle stdout data from the child process, this is a tiny blob of JSON
   * in the format {"Retail":true, "Classic":false}.
   *
   * We don't care to do anything better in the scenario of multiple processes
   * running. We don't support users multi-boxing.
   */
  private handleStdout = (data: Buffer) => {
    if (!this.running) {
      return;
    }

    let parsed;

    try {
      parsed = JSON.parse(data.toString()) as WowProcessSnapshot;
    } catch {
      // We can hit this on sleeping/resuming from sleep. Or anything
      // else that blocks the event loop long enough to cause us to end up
      // with more than one JSON entry. This used to log but it was just
      // messy and experience has demonstrated it's never interesting.
      return;
    }

    this.handleSnapshot(parsed);
  };

  private handleSnapshot = (snapshot: WowProcessSnapshot) => {
    if (!this.running) {
      return;
    }

    const { Retail, Classic } = snapshot;

    const recordRetail = this.cfg.get<boolean>('recordRetail');
    const recordRetailPtr = this.cfg.get<boolean>('recordRetailPtr');
    const recordClassic = this.cfg.get<boolean>('recordClassic');
    const recordClassicPtr = this.cfg.get<boolean>('recordClassicPtr');
    const recordEra = this.cfg.get<boolean>('recordEra');

    const running =
      ((recordRetail || recordRetailPtr) && Retail) ||
      ((recordClassic || recordClassicPtr || recordEra) && Classic);

    if (this.wowRunning === running) {
      // Nothing to emit.
      return;
    }

    if (running) {
      this.emit(WowProcessEvent.STARTED);
    } else {
      this.emit(WowProcessEvent.STOPPED);
    }

    this.wowRunning = running;
  };

  /**
   * Handle stderr, we don't expect to ever see this but log it incase
   * anything weird happens.
   */
  private handleStderr = (data: string) => {
    console.warn('[Poller] stderr returned from child process');
    console.error(data);
  };
}
