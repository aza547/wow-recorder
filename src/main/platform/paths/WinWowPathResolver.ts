import type { IWowPathResolver, WowFlavour } from './IWowPathResolver';

const FLAVOUR_DIR: Record<WowFlavour, string> = {
  retail: '_retail_',
  classic: '_classic_',
  classic_era: '_classic_era_',
  classic_ptr: '_classic_ptr_',
};

/**
 * Windows WoW path resolver. Scans the common drive-letter install
 * locations Battle.net uses on Windows.
 */
export default class WinWowPathResolver implements IWowPathResolver {
  searchRoots(): string[] {
    return [
      'C:\\World of Warcraft',
      'C:\\Program Files\\World of Warcraft',
      'C:\\Program Files (x86)\\World of Warcraft',
      'D:\\World of Warcraft',
      'D:\\Program Files\\World of Warcraft',
      'D:\\Program Files (x86)\\World of Warcraft',
      'E:\\World of Warcraft',
      'E:\\Program Files\\World of Warcraft',
      'E:\\Program Files (x86)\\World of Warcraft',
    ];
  }

  joinLogPath(root: string, flavour: WowFlavour): string {
    return `${root}\\${FLAVOUR_DIR[flavour]}\\Logs`;
  }
}
