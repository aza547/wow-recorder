jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

import { exec } from 'child_process';
import WinFileReveal from 'main/platform/files/WinFileReveal';

describe('WinFileReveal', () => {
  beforeEach(() => {
    (exec as unknown as jest.Mock).mockReset();
  });

  it('invokes explorer.exe /select with backslash-normalised path', () => {
    const r = new WinFileReveal();
    r.reveal('C:/foo/bar/baz.mp4');
    expect(exec).toHaveBeenCalledWith(
      'explorer.exe /select,"C:\\foo\\bar\\baz.mp4"',
      expect.any(Function),
    );
  });
});
