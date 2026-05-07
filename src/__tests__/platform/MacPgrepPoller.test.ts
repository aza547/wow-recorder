jest.useFakeTimers();

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

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

import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import MacPgrepPoller from 'main/platform/poller/MacPgrepPoller';
import { WowProcessEvent } from 'main/types';

class FakeProc extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = jest.fn();
}

let pendingProcs: FakeProc[] = [];

function runTick(retailFound: boolean, classicFound: boolean) {
  const spawnMock = spawn as jest.Mock;
  pendingProcs = [];

  spawnMock.mockImplementation(() => {
    const p = new FakeProc();
    pendingProcs.push(p);
    return p;
  });

  jest.advanceTimersByTime(2100);

  // Emit exit events synchronously
  const [retailProc, classicProc] = pendingProcs;
  if (retailProc) {
    retailProc.emit('exit', retailFound ? 0 : 1);
  }
  if (classicProc) {
    classicProc.emit('exit', classicFound ? 0 : 1);
  }
}

describe('MacPgrepPoller', () => {
  beforeEach(() => {
    (spawn as jest.Mock).mockReset();
    cfgFlags.recordRetail = true;
    cfgFlags.recordClassic = false;
    cfgFlags.recordEra = false;
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  it('emits STARTED when pgrep finds "World of Warcraft" and recordRetail is true', (done) => {
    const poller = new MacPgrepPoller();
    poller.on(WowProcessEvent.STARTED, () => {
      expect(poller.isWowRunning()).toBe(true);
      poller.stop();
      done();
    });
    poller.start();
    runTick(true, false);
  });

  it('emits STOPPED after STARTED when retail disappears', (done) => {
    const poller = new MacPgrepPoller();
    const events: string[] = [];
    poller.on(WowProcessEvent.STARTED, () => events.push('started'));
    poller.on(WowProcessEvent.STOPPED, () => {
      events.push('stopped');
      expect(events).toEqual(['started', 'stopped']);
      poller.stop();
      done();
    });
    poller.start();
    runTick(true, false);
    runTick(false, false);
  });

  it('emits STARTED for era when recordEra is true and Classic binary is running', (done) => {
    cfgFlags.recordRetail = false;
    cfgFlags.recordEra = true;
    const poller = new MacPgrepPoller();
    poller.on(WowProcessEvent.STARTED, () => {
      poller.stop();
      done();
    });
    poller.start();
    runTick(false, true);
  });

  it('does not emit if recordRetail is false even when retail binary runs', () => {
    cfgFlags.recordRetail = false;
    const poller = new MacPgrepPoller();
    const events: string[] = [];
    poller.on(WowProcessEvent.STARTED, () => events.push('started'));
    poller.on(WowProcessEvent.STOPPED, () => events.push('stopped'));
    poller.start();
    runTick(true, false);
    poller.stop();
    expect(events).toEqual([]);
    expect(poller.isWowRunning()).toBe(false);
  });
});
