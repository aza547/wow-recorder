import EventEmitter from 'events';
import { getProcessPoller } from 'main/platform';
import type { IProcessPoller } from 'main/platform/poller/IProcessPoller';
import { WowProcessEvent } from 'main/types';

/**
 * Process poller singleton. Delegates to the platform-specific
 * implementation (rust-ps.exe on Windows, pgrep on macOS in a later
 * phase). Retained as a singleton so existing callers (`Manager`) do
 * not need changes.
 */
export default class Poller extends EventEmitter {
  private static instance: Poller;
  private impl: IProcessPoller = getProcessPoller();

  static getInstance(): Poller {
    if (!Poller.instance) Poller.instance = new Poller();
    return Poller.instance;
  }

  private constructor() {
    super();
    this.impl.on(WowProcessEvent.STARTED, (...args: unknown[]) =>
      this.emit(WowProcessEvent.STARTED, ...args),
    );
    this.impl.on(WowProcessEvent.STOPPED, (...args: unknown[]) =>
      this.emit(WowProcessEvent.STOPPED, ...args),
    );
  }

  isWowRunning(): boolean {
    return this.impl.isWowRunning();
  }

  start(): void {
    this.impl.start();
  }

  stop(): void {
    this.impl.stop();
  }
}
