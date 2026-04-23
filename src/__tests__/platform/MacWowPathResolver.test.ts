jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: () => '/Users/testuser',
}));

import MacWowPathResolver from 'main/platform/paths/MacWowPathResolver';

describe('MacWowPathResolver', () => {
  const r = new MacWowPathResolver();

  it('includes the standard /Applications root', () => {
    expect(r.searchRoots()).toContain('/Applications/World of Warcraft');
  });

  it('includes the home-dir Applications fallback', () => {
    expect(r.searchRoots()).toContain(
      '/Users/testuser/Applications/World of Warcraft',
    );
  });

  it('joins a retail log path with forward slashes', () => {
    expect(r.joinLogPath('/Applications/World of Warcraft', 'retail')).toBe(
      '/Applications/World of Warcraft/_retail_/Logs',
    );
  });

  it('joins a classic_era log path', () => {
    expect(
      r.joinLogPath('/Applications/World of Warcraft', 'classic_era'),
    ).toBe('/Applications/World of Warcraft/_classic_era_/Logs');
  });
});
