import { fetchRealmSearch } from '../fetchRealmSearch';
import { GameVersion } from '../../../data/gameVersions';
import { GlobalRegion } from '../../../data/uri';

describe('fetchRealmSearch (integration)', () => {
  it('should fetch realms from Blizzard API (requires valid token)', async () => {
    const region = GlobalRegion.EU;
    const gameVersion = GameVersion.Retail;

    const result = await fetchRealmSearch(region, gameVersion);
    expect(result).toHaveProperty('results');
    expect(Array.isArray(result.results)).toBe(true);
    expect(result.results.length).toBeGreaterThan(0);

    console.info(
      `Fetched ${result.results.length} realms. Sample:`,
      result.results.slice(0, 1),
    );
  });
});
