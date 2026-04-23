jest.mock('noobs', () => ({}), { virtual: true });
jest.mock('electron', () => ({
  app: { isPackaged: false },
}));
jest.mock('config/ConfigService', () => ({
  __esModule: true,
  default: { getInstance: () => ({ get: () => undefined }) },
}));
jest.mock('main/util', () => ({
  fixPathWhenPackaged: (p: string) => p,
}));
jest.mock('child_process');

import {
  getRecorderBackend,
  getProcessPoller,
  getWowPathResolver,
  getFileReveal,
  getFfmpegPathProvider,
} from 'main/platform';
import NoobsBackend from 'main/platform/recorder/NoobsBackend';
import WinRustPsPoller from 'main/platform/poller/WinRustPsPoller';
import WinWowPathResolver from 'main/platform/paths/WinWowPathResolver';
import WinFileReveal from 'main/platform/files/WinFileReveal';
import WinFfmpegPathProvider from 'main/platform/ffmpeg/WinFfmpegPathProvider';

describe('platform factory', () => {
  it('returns NoobsBackend for the recorder backend', () => {
    expect(getRecorderBackend()).toBeInstanceOf(NoobsBackend);
  });
  it('returns WinRustPsPoller for the process poller', () => {
    expect(getProcessPoller()).toBeInstanceOf(WinRustPsPoller);
  });
  it('returns WinWowPathResolver for the WoW path resolver', () => {
    expect(getWowPathResolver()).toBeInstanceOf(WinWowPathResolver);
  });
  it('returns WinFileReveal for file reveal', () => {
    expect(getFileReveal()).toBeInstanceOf(WinFileReveal);
  });
  it('returns WinFfmpegPathProvider for ffmpeg path', () => {
    expect(getFfmpegPathProvider()).toBeInstanceOf(WinFfmpegPathProvider);
  });
});
