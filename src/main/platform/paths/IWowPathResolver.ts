export type WowFlavour = 'retail' | 'classic' | 'classic_era' | 'classic_ptr';

/**
 * Locates the per-flavour `Logs` folder for a WoW installation.
 * Used during first-time setup to auto-configure log paths.
 */
export interface IWowPathResolver {
  /** Roots under which WoW installations are expected to exist. */
  searchRoots(): string[];
  /** Join a root + flavour to produce the absolute Logs directory. */
  joinLogPath(root: string, flavour: WowFlavour): string;
}
