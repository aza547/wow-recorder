import EventEmitter from 'events';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';
import { FlavourConfig } from '../main/types';

/**
 * The Poller singleton periodically checks the list of WoW active processes.
 * If the state changes, it emits either a 'wowProcessStart' or
 * 'wowProcessStop' event.
 */
export default class Poller extends EventEmitter {
  private _isWowRunning = false;

  private _pollInterval: NodeJS.Timer | undefined;

  private child: ChildProcessWithoutNullStreams | undefined;

  private static _instance: Poller;

  private flavourConfig: FlavourConfig;

  private binary = 'rust-ps.exe';

  private binaryPath = app.isPackaged
    ? path.join(process.resourcesPath, 'binaries', this.binary)
    : path.join(__dirname, '../../binaries', this.binary);

  static getInstance(flavourConfig: FlavourConfig) {
    if (!Poller._instance) {
      Poller._instance = new Poller(flavourConfig);
    }

    return Poller._instance;
  }

  static getInstanceLazy() {
    if (!Poller._instance) {
      throw new Error('[Poller] Must create poller first');
    }

    return Poller._instance;
  }

  private constructor(flavourConfig: FlavourConfig) {
    super();
    this.flavourConfig = flavourConfig;
  }

  get isWowRunning() {
    return this._isWowRunning;
  }

  set isWowRunning(value) {
    this._isWowRunning = value;
  }

  get pollInterval() {
    return this._pollInterval;
  }

  set pollInterval(value) {
    this._pollInterval = value;
  }

  reconfigureFlavour(flavourConfig: FlavourConfig) {
    this.flavourConfig = flavourConfig;
  }

  reset() {
    console.info('[Poller] Reset process poller');
    this.isWowRunning = false;

    if (this.child) {
      this.child.kill();
      this.child = undefined;
    }
  }

  start() {
    console.info('[Poller] Start process poller');
    this.reset();
    this.poll();
  }

  private poll = async () => {
    this.child = spawn(this.binaryPath);
    this.child.stdout.on('data', this.handleStdout);
    this.child.stderr.on('data', this.handleStderr);
  };

  private handleStdout = (data: any) => {
    try {
      const json = JSON.parse(data);

      const { Retail, Classic } = json;
      const { recordRetail, recordClassic, recordEra, recordRetailPtr } =
        this.flavourConfig;

      const retailCheck = Retail && (recordRetail || recordRetailPtr);
      const classicCheck = Classic && recordClassic;
      const eraCheck = Classic && recordEra;

      // We don't care to do anything better in the scenario of multiple
      // processes running. We don't support users multi-boxing.
      if (!this.isWowRunning && (retailCheck || classicCheck || eraCheck)) {
        this.isWowRunning = true;
        this.emit('wowProcessStart');
      } else if (
        this.isWowRunning &&
        !retailCheck &&
        !classicCheck &&
        !eraCheck
      ) {
        this.isWowRunning = false;
        this.emit('wowProcessStop');
      }
    } catch {
      // We can hit this on sleeping/resuming from sleep. Or anything
      // else that blocks the event loop long enough to cause us to end up
      // with more than one JSON entry.
    }
  };

  private handleStderr = (data: any) => {
    console.warn('stderr returned from rust-ps');
    console.error(data);
  };
}
