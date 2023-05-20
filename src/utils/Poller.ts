import EventEmitter from 'events';
import { validateClassic, validateRetail } from '../main/util';
import { ClassicConfig, RetailConfig } from '../main/types';

const tasklist = require('tasklist');

const wowExecutableFlavours: { [key: string]: string } = {
  wow: 'Retail',
  wowt: 'PTR',
  wowb: 'Beta',
  wowclassic: 'Classic',
};

type WoWProcessResultKey = keyof typeof wowExecutableFlavours;

type WowProcess = {
  exe: string;
  flavour: WoWProcessResultKey;
};

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

  private retailConfig: RetailConfig;

  private classicConfig: ClassicConfig;

  static getInstance(retailConfig: RetailConfig, classicConfig: ClassicConfig) {
    if (!Poller._instance) {
      Poller._instance = new Poller(retailConfig, classicConfig);
    }

    return Poller._instance;
  }

  static getInstanceLazy() {
    if (!Poller._instance) {
      throw new Error('[Poller] Must create poller first');
    }

    return Poller._instance;
  }

  private constructor(
    retailConfig: RetailConfig,
    classicConfig: ClassicConfig
  ) {
    super();
    this.retailConfig = retailConfig;
    this.classicConfig = classicConfig;
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

  reconfigureRetail(retailConfig: RetailConfig) {
    this.retailConfig = retailConfig;
  }

  reconfigureClassic(classicConfig: ClassicConfig) {
    this.classicConfig = classicConfig;
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
    this.pollInterval = setInterval(() => this.poll(), 5000);
  }

  private poll = async () => {
    const processList = await tasklist();

    // Tasklist package doesn't export types annoyingly, hence
    // the use of any here.
    const wowProcesses = processList
      .map((process: any) => process.imageName.match(this.processRegex))
      .filter((matches: string[]) => matches)
      .map(this.convertToWowProcessType)
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

  private filterFlavoursByConfig = (wowProcess: WowProcess) => {
    const wowFlavour = wowProcess.flavour;
    const { recordRetail } = this.retailConfig;
    const { recordClassic } = this.classicConfig;

    // Any non classic flavour is considered a retail flavour (i.e. retail, beta, ptr)
    let validRetailProcess = wowFlavour !== 'Classic' && recordRetail;
    let validClassicProcess = wowFlavour === 'Classic' && recordClassic;

    if (!validRetailProcess && !validClassicProcess) {
      // We're not configured to record any matching process.
      return false;
    }

    try {
      validateRetail(this.retailConfig);
    } catch {
      validRetailProcess = false;
    }

    try {
      validateClassic(this.classicConfig);
    } catch {
      validClassicProcess = false;
    }

    if (!validRetailProcess && !validClassicProcess) {
      return false;
    }

    return true;
  };

  private convertToWowProcessType = (match: string[]) => {
    const wowProcessObject: WowProcess = {
      exe: match[0],
      flavour: wowExecutableFlavours[match[1].toLowerCase()],
    };

    return wowProcessObject;
  };
}
