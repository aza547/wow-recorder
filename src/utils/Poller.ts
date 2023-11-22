import EventEmitter from 'events';
import { desktopCapturer } from 'electron';

/**
 * The Poller singleton periodically checks the list of open WoW windows. If
 * the state changes, it emits either a 'wowStart' or 'wowStop' event. We
 * can't tell the flavour of WoW from the Window.
 */
export default class Poller extends EventEmitter {
  private isWowRunning = false;

  private interval: NodeJS.Timer | undefined;

  private static instance: Poller;

  private constructor() {
    super();
  }

  static getInstance() {
    if (!Poller.instance) {
      Poller.instance = new Poller();
    }

    return Poller.instance;
  }

  static getInstanceLazy() {
    if (!Poller.instance) {
      throw new Error('[Poller] Must create poller first');
    }

    return Poller.instance;
  }

  public reset() {
    this.isWowRunning = false;

    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  public start() {
    this.reset();
    this.poll();
    this.interval = setInterval(() => this.poll(), 5000);
  }

  private poll = async () => {
    const windowList = await desktopCapturer.getSources({
      types: ['window', 'screen'],
    });

    const wowWindows = windowList.filter(
      (source) => source.name === 'World of Warcraft'
    );

    if (!this.isWowRunning && wowWindows.length > 0) {
      this.isWowRunning = true;
      this.emit('wowStart');
    } else if (this.isWowRunning && wowWindows.length < 1) {
      this.isWowRunning = false;
      this.emit('wowStop');
    }
  };
}
