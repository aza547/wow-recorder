jest.mock('electron', () => ({
  app: { isPackaged: false },
}));

jest.mock('main/util', () => ({
  fixPathWhenPackaged: (p: string) => p,
}));

import path from 'path';
import MacFfmpegPathProvider from 'main/platform/ffmpeg/MacFfmpegPathProvider';

describe('MacFfmpegPathProvider', () => {
  it('returns an absolute path ending in binaries/ffmpeg', () => {
    const p = new MacFfmpegPathProvider().getPath();
    expect(path.isAbsolute(p)).toBe(true);
    expect(p.endsWith('binaries/ffmpeg')).toBe(true);
  });
});
