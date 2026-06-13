export type WowProcessSnapshot = {
  Retail: boolean;
  Classic: boolean;
};

const classicMarkers = [
  'world of warcraft classic',
  '/_classic_/',
  '/_classic_era_/',
  '/_classic_ptr_/',
  'wowclassic',
];

const retailMarkers = [
  '/_retail_/',
  '/_xptr_/',
  '/_beta_/',
  '/wow.app/',
  'wow.exe',
  'wowt.exe',
  'wowb.exe',
];

const retailProcessNameMarkers = ['world of warcraft', 'wow', 'wowt', 'wowb'];

const includesRetailProcessName = (line: string) =>
  !line.includes('launcher') &&
  retailProcessNameMarkers.some(
    (marker) =>
      line === marker ||
      line.startsWith(`${marker} `) ||
      line.includes(`/${marker}`) ||
      line.includes(`/${marker} `),
  );

/**
 * Detect WoW processes from Unix process-listing output. The Windows runtime
 * keeps using rust-ps.exe; this is for macOS/Linux where we do not have that
 * helper binary.
 */
const detectWowProcessesFromProcessList = (
  output: string,
): WowProcessSnapshot => {
  let Retail = false;
  let Classic = false;

  output.split('\n').forEach((rawLine) => {
    const line = rawLine.trim().toLowerCase();
    if (!line) return;

    const classic = classicMarkers.some((marker) => line.includes(marker));

    if (classic) {
      Classic = true;
      return;
    }

    const retail =
      retailMarkers.some((marker) => line.includes(marker)) ||
      includesRetailProcessName(line);

    if (retail) {
      Retail = true;
    }
  });

  return { Retail, Classic };
};

export { detectWowProcessesFromProcessList };
