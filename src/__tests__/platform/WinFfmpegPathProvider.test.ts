jest.mock('main/util', () => ({
  fixPathWhenPackaged: (p: string) => p,
}));

import path from 'path';
import WinFfmpegPathProvider from 'main/platform/ffmpeg/WinFfmpegPathProvider';

describe('WinFfmpegPathProvider', () => {
  it('returns a path ending in noobs/dist/bin/ffmpeg.exe', () => {
    const p = new WinFfmpegPathProvider().getPath();
    expect(p.replace(/\\/g, '/')).toContain('noobs/dist/bin/ffmpeg.exe');
    expect(path.isAbsolute(p)).toBe(true);
  });
});
