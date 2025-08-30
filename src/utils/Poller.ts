import EventEmitter from 'events';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';
import ConfigService from 'config/ConfigService';
import { WowProcessEvent } from 'main/types';

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
   * Reset the poller state and stop the child process.
   */
  public reset() {
    console.info('[Poller] Reset process poller');
    this.wowRunning = false;

    if (this.child) {
      this.child.kill();
      this.child = undefined;
    }
  }

  /**
   * Start the poller.
   */
  public start() {
    console.info('[Poller] Start process poller');
    this.reset();

    this.child = spawn(this.binary);
    this.child.stdout.on('data', this.handleStdout);
    this.child.stderr.on('data', this.handleStderr);
  }

  /**
   * Handle stdout data from the child process, this is a tiny blob of JSON
   * in the format {"Retail":true, "Classic":false}.
   *
   * We don't care to do anything better in the scenario of multiple processes
   * running. We don't support users multi-boxing.
   */
  private handleStdout = (data: string) => {
    let parsed;

    try {
      parsed = JSON.parse(data);
    } catch {
      // We can hit this on sleeping/resuming from sleep. Or anything
      // else that blocks the event loop long enough to cause us to end up
      // with more than one JSON entry. This used to log but it was just
      // messy and experience has demonstrated it's never interesting.
      return;
    }

    const { Retail, Classic } = parsed;

    const recordRetail = this.cfg.get<boolean>('recordRetail');
    const recordClassic = this.cfg.get<boolean>('recordClassic');
    const recordEra = this.cfg.get<boolean>('recordEra');

    const running =
      (recordRetail && Retail) ||
      (recordClassic && Classic) ||
      (recordEra && Classic); // Era and Classic clients share a process name.

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
