import EventEmitter from 'events';
import { FlavourConfig } from 'main/types';
import { PollerImplementation } from 'types/Poller';
import si from 'systeminformation';

export class PollerMac extends EventEmitter implements PollerImplementation {
  private _isWowRunning = false;
  private _pollInterval: NodeJS.Timer | undefined;
  private flavourConfig: FlavourConfig;

  constructor(flavourConfig: FlavourConfig) {
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
    this.pollInterval = setInterval(this.poll, 5000);
  }

  private poll = async () => {
    try {
      const processes = await si.processes();
      const { recordRetail, recordClassic } = this.flavourConfig;
      const wowProcesses = processes.list.filter((p) =>
        ['WowClassic', 'World of Warcraft'].includes(p.name)
      );

      const retailCheck = wowProcesses.some(
        (p) => ['World of Warcraft'].includes(p.name) && recordRetail
      );
      const classicCheck = wowProcesses.some(
        (p) => p.name === 'WowClassic' && recordClassic
      );

      if (!this.isWowRunning && (retailCheck || classicCheck)) {
        this.isWowRunning = true;
        this.emit('wowProcessStart');
      } else if (this.isWowRunning && !retailCheck && !classicCheck) {
        this.isWowRunning = false;
        this.emit('wowProcessStop');
      }
    } catch (error) {
      console.error('Error fetching processes:', error);
    }
  };
}
