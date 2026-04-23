jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

import { spawn } from 'child_process';
import MacFileReveal from 'main/platform/files/MacFileReveal';

describe('MacFileReveal', () => {
  beforeEach(() => {
    (spawn as jest.Mock).mockReset();
  });

  it('invokes `open -R <path>` with the file path unchanged', () => {
    new MacFileReveal().reveal('/Users/me/Movies/clip.mkv');
    expect(spawn).toHaveBeenCalledWith('open', ['-R', '/Users/me/Movies/clip.mkv']);
  });

  it('does not rewrite forward slashes on mac paths', () => {
    new MacFileReveal().reveal('/tmp/foo bar/baz.mp4');
    expect(spawn).toHaveBeenCalledWith('open', ['-R', '/tmp/foo bar/baz.mp4']);
  });
});
