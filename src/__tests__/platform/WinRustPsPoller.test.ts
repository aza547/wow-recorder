import { EventEmitter } from 'events';
import type { ChildProcessWithoutNullStreams } from 'child_process';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('electron', () => ({
  app: { isPackaged: false },
}));

jest.mock('config/ConfigService', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({
      get: jest.fn((key: string) => {
        if (key === 'recordRetail') return true;
        if (key === 'recordClassic') return false;
        if (key === 'recordEra') return false;
        return undefined;
      }),
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

describe('WinRustPsPoller', () => {
  beforeEach(() => {
    (spawn as jest.Mock).mockReset();
  });

  it('emits STARTED when Retail is detected and recordRetail is true', (done) => {
    const child = new FakeChild();
    (spawn as jest.Mock).mockReturnValue(
      child as unknown as ChildProcessWithoutNullStreams,
    );

    const poller = new WinRustPsPoller();
    poller.on(WowProcessEvent.STARTED, () => {
      expect(poller.isWowRunning()).toBe(true);
      done();
    });

    poller.start();
    child.stdout.emit('data', JSON.stringify({ Retail: true, Classic: false }));
  });

  it('emits STOPPED after STARTED when Retail disappears', (done) => {
    const child = new FakeChild();
    (spawn as jest.Mock).mockReturnValue(
      child as unknown as ChildProcessWithoutNullStreams,
    );

    const poller = new WinRustPsPoller();
    const events: string[] = [];
    poller.on(WowProcessEvent.STARTED, () => events.push('started'));
    poller.on(WowProcessEvent.STOPPED, () => {
      events.push('stopped');
      expect(events).toEqual(['started', 'stopped']);
      done();
    });

    poller.start();
    child.stdout.emit('data', JSON.stringify({ Retail: true, Classic: false }));
    child.stdout.emit(
      'data',
      JSON.stringify({ Retail: false, Classic: false }),
    );
  });
});
