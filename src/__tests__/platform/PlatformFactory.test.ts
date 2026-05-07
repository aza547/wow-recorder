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

describe('platform factory — win32 dispatch', () => {
  beforeAll(() => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
  });

  it('returns NoobsBackend for the recorder backend', () => {
    jest.resetModules();
    const { getRecorderBackend } = require('main/platform');
    const NoobsBackend = require('main/platform/recorder/NoobsBackend').default;
    expect(getRecorderBackend()).toBeInstanceOf(NoobsBackend);
  });

  it('returns WinRustPsPoller for the process poller', () => {
    jest.resetModules();
    const { getProcessPoller } = require('main/platform');
    const WinRustPsPoller =
      require('main/platform/poller/WinRustPsPoller').default;
    expect(getProcessPoller()).toBeInstanceOf(WinRustPsPoller);
  });

  it('returns WinWowPathResolver for the WoW path resolver', () => {
    jest.resetModules();
    const { getWowPathResolver } = require('main/platform');
    const WinWowPathResolver =
      require('main/platform/paths/WinWowPathResolver').default;
    expect(getWowPathResolver()).toBeInstanceOf(WinWowPathResolver);
  });

  it('returns WinFileReveal for file reveal', () => {
    jest.resetModules();
    const { getFileReveal } = require('main/platform');
    const WinFileReveal = require('main/platform/files/WinFileReveal').default;
    expect(getFileReveal()).toBeInstanceOf(WinFileReveal);
  });

  it('returns WinFfmpegPathProvider for ffmpeg path', () => {
    jest.resetModules();
    const { getFfmpegPathProvider } = require('main/platform');
    const WinFfmpegPathProvider =
      require('main/platform/ffmpeg/WinFfmpegPathProvider').default;
    expect(getFfmpegPathProvider()).toBeInstanceOf(WinFfmpegPathProvider);
  });

  it('returns WinPermissionsGate on win32', () => {
    jest.resetModules();
    const { getPermissionsGate } = require('main/platform');
    const WinPermissionsGate =
      require('main/platform/permissions/WinPermissionsGate').default;
    expect(getPermissionsGate()).toBeInstanceOf(WinPermissionsGate);
  });
});

describe('platform factory — darwin dispatch', () => {
  beforeAll(() => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
  });

  it('returns OsnBackend on darwin', () => {
    jest.resetModules();
    const { getRecorderBackend } = require('main/platform');
    const OsnBackend = require('main/platform/recorder/OsnBackend').default;
    expect(getRecorderBackend()).toBeInstanceOf(OsnBackend);
  });

  it('returns MacPgrepPoller on darwin', () => {
    jest.resetModules();
    const { getProcessPoller } = require('main/platform');
    const MacPgrepPoller =
      require('main/platform/poller/MacPgrepPoller').default;
    expect(getProcessPoller()).toBeInstanceOf(MacPgrepPoller);
  });

  it('returns MacWowPathResolver on darwin', () => {
    jest.resetModules();
    const { getWowPathResolver } = require('main/platform');
    const MacWowPathResolver =
      require('main/platform/paths/MacWowPathResolver').default;
    expect(getWowPathResolver()).toBeInstanceOf(MacWowPathResolver);
  });

  it('returns MacFileReveal on darwin', () => {
    jest.resetModules();
    const { getFileReveal } = require('main/platform');
    const MacFileReveal = require('main/platform/files/MacFileReveal').default;
    expect(getFileReveal()).toBeInstanceOf(MacFileReveal);
  });

  it('returns MacFfmpegPathProvider on darwin', () => {
    jest.resetModules();
    const { getFfmpegPathProvider } = require('main/platform');
    const MacFfmpegPathProvider =
      require('main/platform/ffmpeg/MacFfmpegPathProvider').default;
    expect(getFfmpegPathProvider()).toBeInstanceOf(MacFfmpegPathProvider);
  });

  it('returns MacTccGate on darwin', () => {
    jest.resetModules();
    const { getPermissionsGate } = require('main/platform');
    const MacTccGate = require('main/platform/permissions/MacTccGate').default;
    expect(getPermissionsGate()).toBeInstanceOf(MacTccGate);
  });
});
