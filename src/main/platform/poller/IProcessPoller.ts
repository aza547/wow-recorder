import type EventEmitter from 'events';

/**
 * Periodically reports whether any WoW client process is running.
 * Emits 'started' / 'stopped' on transitions. Consumers (Manager)
 * attach listeners via the EventEmitter interface.
 */
export interface IProcessPoller extends EventEmitter {
  start(): void;
  stop(): void;
  isWowRunning(): boolean;
}
