import WinWowPathResolver from 'main/platform/paths/WinWowPathResolver';

describe('WinWowPathResolver', () => {
  const r = new WinWowPathResolver();

  it('includes C: and D: Program Files variants', () => {
    const roots = r.searchRoots();
    expect(roots).toContain('C:\\Program Files\\World of Warcraft');
    expect(roots).toContain('D:\\World of Warcraft');
  });

  it('joins a retail log path with Windows backslashes', () => {
    const joined = r.joinLogPath('C:\\World of Warcraft', 'retail');
    expect(joined).toBe('C:\\World of Warcraft\\_retail_\\Logs');
  });

  it('joins a classic_era log path', () => {
    const joined = r.joinLogPath('D:\\World of Warcraft', 'classic_era');
    expect(joined).toBe('D:\\World of Warcraft\\_classic_era_\\Logs');
  });
});
