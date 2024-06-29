import EventEmitter from 'events';
import { validateFlavour } from '../main/util';
import { FlavourConfig } from '../main/types';
import listProcesses from './processList';

/**
 * The Poller singleton periodically checks the list of WoW active processes.
 * If the state changes, it emits either a 'wowProcessStart' or
 * 'wowProcessStop' event.
 */
export default class Poller extends EventEmitter {
  private _isWowRunning = false;

  private _pollInterval: NodeJS.Timer | undefined;

  private processRegex = new RegExp(/(wow(T|B|classic)?)\.exe/, 'i');

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

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  start() {
    this.reset();
    this.poll();
    this.pollInterval = setInterval(() => this.poll(), 1000);
  }

  private poll = async () => {
    const processList = await listProcesses();

    const wowProcesses = processList
      .map((process) => process.caption)
      .filter((name) => name.match(this.processRegex))
      .filter(this.filterFlavoursByConfig);

    // We don't care to do anything better in the scenario of multiple
    // processes running. We don't support users multi-boxing.
    if (!this.isWowRunning && wowProcesses.pop()) {
      this.isWowRunning = true;
      this.emit('wowProcessStart');
    } else if (this.isWowRunning && !wowProcesses.pop()) {
      this.isWowRunning = false;
      this.emit('wowProcessStop');
    }
  };

  private filterFlavoursByConfig = (process: string) => {
    const { recordRetail, recordClassic } = this.flavourConfig;

    try {
      validateFlavour(this.flavourConfig);
    } catch {
      return false;
    }

    const lower = process.toLowerCase();

    if (lower === 'wowclassic.exe') {
      return recordClassic;
    }

    // The process name matched the regex so must be retail.
    return recordRetail;
  };
}
