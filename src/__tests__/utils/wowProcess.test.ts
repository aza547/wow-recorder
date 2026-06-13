import { detectWowProcessesFromProcessList } from '../../utils/wowProcess';

describe('detectWowProcessesFromProcessList', () => {
  test('detects retail macOS app process', () => {
    const output = [
      '85148 /Applications/World of Warcraft/_retail_/World of Warcraft.app/Contents/MacOS/World of Warcraft',
      '/bin/zsh',
    ].join('\n');

    expect(detectWowProcessesFromProcessList(output)).toStrictEqual({
      Retail: true,
      Classic: false,
    });
  });

  test('detects retail PTR macOS process', () => {
    const output =
      '85148 /Applications/World of Warcraft/_xptr_/World of Warcraft.app/Contents/MacOS/World of Warcraft';

    expect(detectWowProcessesFromProcessList(output)).toStrictEqual({
      Retail: true,
      Classic: false,
    });
  });

  test('detects classic macOS app process without also marking retail', () => {
    const output =
      '85148 /Applications/World of Warcraft/_classic_/World of Warcraft Classic.app/Contents/MacOS/World of Warcraft Classic';

    expect(detectWowProcessesFromProcessList(output)).toStrictEqual({
      Retail: false,
      Classic: true,
    });
  });

  test('detects classic era process', () => {
    const output =
      '85148 /Applications/World of Warcraft/_classic_era_/World of Warcraft Classic.app/Contents/MacOS/World of Warcraft Classic';

    expect(detectWowProcessesFromProcessList(output)).toStrictEqual({
      Retail: false,
      Classic: true,
    });
  });

  test('returns false when no WoW process is present', () => {
    const output = ['/Applications/Discord.app/Contents/MacOS/Discord'].join(
      '\n',
    );

    expect(detectWowProcessesFromProcessList(output)).toStrictEqual({
      Retail: false,
      Classic: false,
    });
  });

  test('does not treat the launcher as the retail game', () => {
    const output =
      '/Applications/World of Warcraft/World of Warcraft Launcher.app/Contents/MacOS/World of Warcraft Launcher';

    expect(detectWowProcessesFromProcessList(output)).toStrictEqual({
      Retail: false,
      Classic: false,
    });
  });
});
