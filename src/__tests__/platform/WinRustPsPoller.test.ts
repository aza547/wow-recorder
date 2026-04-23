import { EventEmitter } from 'events';
import type { ChildProcessWithoutNullStreams } from 'child_process';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('electron', () => ({
  app: { isPackaged: false },
}));

// Per-test control of config flags.
const cfgFlags: { [k: string]: boolean } = {
  recordRetail: true,
  recordClassic: false,
  recordEra: false,
};

jest.mock('config/ConfigService', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({
      get: jest.fn((key: string) => cfgFlags[key]),
    }),
  },
}));

import { spawn } from 'child_process';
import WinRustPsPoller from 'main/platform/poller/WinRustPsPoller';
import { WowProcessEvent } from 'main/types';

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = jest.fn();
}

function makePoller() {
  const child = new FakeChild();
  (spawn as jest.Mock).mockReturnValue(
    child as unknown as ChildProcessWithoutNullStreams,
  );
  const poller = new WinRustPsPoller();
  poller.start();
  return { child, poller };
}

describe('WinRustPsPoller', () => {
  beforeEach(() => {
    (spawn as jest.Mock).mockReset();
    cfgFlags.recordRetail = true;
    cfgFlags.recordClassic = false;
    cfgFlags.recordEra = false;
  });

  it('emits STARTED when Retail is detected and recordRetail is true', (done) => {
    const { child, poller } = makePoller();
    poller.on(WowProcessEvent.STARTED, () => {
      expect(poller.isWowRunning()).toBe(true);
      done();
    });
    child.stdout.emit('data', JSON.stringify({ Retail: true, Classic: false }));
  });

  it('emits STOPPED after STARTED when Retail disappears', (done) => {
    const { child, poller } = makePoller();
    const events: string[] = [];
    poller.on(WowProcessEvent.STARTED, () => events.push('started'));
    poller.on(WowProcessEvent.STOPPED, () => {
      events.push('stopped');
      expect(events).toEqual(['started', 'stopped']);
      done();
    });
    child.stdout.emit('data', JSON.stringify({ Retail: true, Classic: false }));
    child.stdout.emit('data', JSON.stringify({ Retail: false, Classic: false }));
  });

  it('emits STARTED on Classic when recordClassic is true', (done) => {
    cfgFlags.recordRetail = false;
    cfgFlags.recordClassic = true;
    const { child, poller } = makePoller();
    poller.on(WowProcessEvent.STARTED, () => done());
    child.stdout.emit('data', JSON.stringify({ Retail: false, Classic: true }));
  });

  it('emits STARTED on Classic when recordEra is true (Era shares Classic binary)', (done) => {
    cfgFlags.recordRetail = false;
    cfgFlags.recordEra = true;
    const { child, poller } = makePoller();
    poller.on(WowProcessEvent.STARTED, () => done());
    child.stdout.emit('data', JSON.stringify({ Retail: false, Classic: true }));
  });

  it('does NOT emit when Retail is detected but recordRetail is false', (done) => {
    cfgFlags.recordRetail = false;
    const { child, poller } = makePoller();
    const events: string[] = [];
    poller.on(WowProcessEvent.STARTED, () => events.push('started'));
    poller.on(WowProcessEvent.STOPPED, () => events.push('stopped'));
    child.stdout.emit('data', JSON.stringify({ Retail: true, Classic: false }));
    // Give the event loop a tick, then assert nothing emitted.
    setImmediate(() => {
      expect(events).toEqual([]);
      expect(poller.isWowRunning()).toBe(false);
      done();
    });
  });

  it('does not throw or emit on malformed JSON stdout', (done) => {
    const { child, poller } = makePoller();
    const events: string[] = [];
    poller.on(WowProcessEvent.STARTED, () => events.push('started'));
    poller.on(WowProcessEvent.STOPPED, () => events.push('stopped'));
    expect(() => {
      child.stdout.emit('data', '{Retail:true,Classic:false}{Retail:false');
    }).not.toThrow();
    setImmediate(() => {
      expect(events).toEqual([]);
      done();
    });
  });
});
