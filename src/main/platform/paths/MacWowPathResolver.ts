import os from 'os';
import path from 'path';
import type { IWowPathResolver, WowFlavour } from './IWowPathResolver';

const FLAVOUR_DIR: Record<WowFlavour, string> = {
  retail: '_retail_',
  classic: '_classic_',
  classic_era: '_classic_era_',
  classic_ptr: '_classic_ptr_',
};

/**
 * macOS WoW path resolver. Battle.net defaults to /Applications;
 * user-Applications is a common fallback for sandbox-sensitive setups.
 */
export default class MacWowPathResolver implements IWowPathResolver {
  searchRoots(): string[] {
    return [
      '/Applications/World of Warcraft',
      path.join(os.homedir(), 'Applications', 'World of Warcraft'),
    ];
  }

  joinLogPath(root: string, flavour: WowFlavour): string {
    return `${root}/${FLAVOUR_DIR[flavour]}/Logs`;
  }
}
