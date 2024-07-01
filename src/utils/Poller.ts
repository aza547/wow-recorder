import EventEmitter from 'events';
import { ChildProcessWithoutNullStreams } from 'child_process';
import { FlavourConfig } from '../main/types';
import spawnRustPs from './processList';

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
    this.isWowRunning = false;

    if (this.child) {
      this.child.kill();
      this.child = undefined;
    }
  }

  start() {
    this.reset();
    this.poll();
  }

  private poll = async () => {
    this.child = spawnRustPs();

    this.child.stdout.on('data', (data) => {
      const json = JSON.parse(data);

      const { Retail, Classic } = json;
      const { recordRetail, recordClassic } = this.flavourConfig;

      const retailCheck = Retail && recordRetail;
      const classicCheck = Classic && recordClassic;

      // We don't care to do anything better in the scenario of multiple
      // processes running. We don't support users multi-boxing.

      if (!this.isWowRunning && (retailCheck || classicCheck)) {
        this.isWowRunning = true;
        this.emit('wowProcessStart');
      } else if (this.isWowRunning && !retailCheck && !classicCheck) {
        this.isWowRunning = false;
        this.emit('wowProcessStop');
      }
    });

    this.child.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });
  };
}
