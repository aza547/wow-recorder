import EventEmitter from 'events';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';
import ConfigService from 'config/ConfigService';
import { Flavour, WowProcessEvent } from 'main/types';

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
   * Tracks what is currently running for each flavour of WoW.
   */
  private state = {
    Retail: false,
    Classic: false,
    Forever: false,
  };

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
   * Added for convenience when determining which flavour of WoW is currently
   * active when starting a manual recording. Most of the app doesn't care
   * about which flavour is currently active.
   *
   * A reminder we don't support multiboxing games (nor does Blizzard on the
   * same account), which is why it's OK this is in order of preference.
   */
  public getFlavor(): Flavour | null {
    if (this.state.Retail && this.cfg.get<boolean>('recordRetail')) {
      return Flavour.Retail;
    }

    if (this.state.Classic && this.cfg.get<boolean>('recordClassic')) {
      return Flavour.Classic;
    }

    if (this.state.Forever && this.cfg.get<boolean>('recordForever')) {
      return Flavour.Forever;
    }

    return null;
  }

  /**
   * Stop the poller and reset the state.
   */
  public stop() {
    console.info('[Poller] Stop process poller');
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
    this.stop();
    console.info('[Poller] Start process poller');

    this.child = spawn(this.binary);
    this.child.stdout.on('data', this.handleStdout);
    this.child.stderr.on('data', this.handleStderr);
  }

  /**
   * Handle stdout data from the child process, this is a tiny blob of JSON
   * in the format {"Retail":true, "Classic":false, "Forever":false}.
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

    const { Retail, Classic, Forever } = parsed;

    const recordRetail = this.cfg.get<boolean>('recordRetail');
    const recordRetailPtr = this.cfg.get<boolean>('recordRetailPtr');
    const recordClassic = this.cfg.get<boolean>('recordClassic');
    const recordClassicPtr = this.cfg.get<boolean>('recordClassicPtr');
    const recordEra = this.cfg.get<boolean>('recordEra');
    const recordForever = this.cfg.get<boolean>('recordForever');

    const running =
      ((recordRetail || recordRetailPtr) && Retail) ||
      ((recordClassic || recordClassicPtr || recordEra) && Classic) ||
      (recordForever && Forever);

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
    this.state = { Retail, Classic, Forever };
    const count = Object.values(this.state).filter(Boolean).length;

    if (count > 1) {
      // Not a disaster, but not a state we claim to support.
      console.warn('[Poller] Multiple WoW processes detected', this.state);
    }
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
