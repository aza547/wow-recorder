import { GameVersion } from '../../../data/gameVersions';
import { GlobalRegion } from '../../../data/uri';
import { fetchRealmSearch } from '../fetchRealmSearch';

describe('fetchRealmSearch', () => {
  it('should parse response with no realm data correctly', async () => {
    const mockResponse = {
      page: 1,
      pageSize: 1000,
      maxPageSize: 1000,
      pageCount: 1,
      results: [],
    };

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    global.fetch = mockFetch;
    const token = 'test-token';
    const region = GlobalRegion.EU;
    const gameVersion = GameVersion.Retail;
    const result = await fetchRealmSearch(region, gameVersion, token);

    expect(mockFetch).toHaveBeenCalledWith(
      `https://${region}.api.blizzard.com/data/wow/search/realm?namespace=dynamic-eu&orderby=slug&_pageSize=1000`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    expect(result).toEqual(mockResponse);
  });

  it('should parse response with realm data correctly', async () => {
    const mockResponse = {
      page: 1,
      pageSize: 1000,
      maxPageSize: 1000,
      pageCount: 1,
      results: [
        {
          key: {
            href: 'https://eu.api.blizzard.com/data/wow/realm/577?namespace=dynamic-eu',
          },
          data: {
            is_tournament: false,
            timezone: 'Europe/Paris',
            name: {
              en_US: 'Aegwynn',
              de_DE: 'Aegwynn',
            },
            id: 577,
            region: {
              name: {
                en_US: 'Europe',
                de_DE: 'Europa',
              },
              id: 3,
            },
            category: {
              en_US: 'German',
              de_DE: 'Deutsch',
            },
            locale: 'deDE',
            type: {
              name: {
                en_US: 'Normal',
                de_DE: 'Normal',
              },
              type: 'NORMAL',
            },
            slug: 'aegwynn',
          },
        },
      ],
    };

    const token = 'test-token';

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    global.fetch = mockFetch;
    const result = await fetchRealmSearch(
      GlobalRegion.EU,
      GameVersion.Retail,
      token,
    );

    expect(result.results).toHaveLength(1);
    expect(result.results[0].data.name.en_US).toBe('Aegwynn');
    expect(result.results[0].data.slug).toBe('aegwynn');
  });
});
