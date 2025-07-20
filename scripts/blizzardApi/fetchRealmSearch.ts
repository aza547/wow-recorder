import { getClassicNamespace } from '../../data/Classic/namespaces';
import { getClassicEraNamespace } from '../../data/ClassicEra/namespaces';
import { GameVersion } from '../../data/gameVersions';
import { LOCALE_TO_NAME, SupportedLocale } from '../../data/locales';
import { NamespaceCategory } from '../../data/namespaceCategory';
import { getRetailNamespace } from '../../data/Retail/namespaces';
import { API_BASE_URLS, Region } from '../../data/uri';
import { FetchError } from './fetchError';
import { fetchOAuthTokenMemoized } from './fetchOAuthToken';
import {
  RealmSearchResponse,
  RealmSearchResponseSchema,
} from './realmSearchResponseSchema';

const API_NAMESPACE_CATEGORY: NamespaceCategory = NamespaceCategory.Dynamic;

/** I do not know why, but "realm locale" returns in such format */
export const REALM_LOCALES: Record<string, SupportedLocale> = Object.keys(
  LOCALE_TO_NAME,
).reduce(
  (acc, locale) => {
    const realmLocale = locale.replace('_', '');
    acc[realmLocale] = locale as SupportedLocale;
    return acc;
  },
  {} as Record<string, SupportedLocale>,
);

/**
 * Fetches the list of realms from Blizzard Realm Search API.
 * @param token OAuth access token
 * @param gameVersion Game Version. Default: Retail.
 * @param namespace Blizzard API namespace
 * @returns Realm search response
 */
export async function fetchRealmSearch(
  region: Region,
  gameVersion?: GameVersion,
  token?: string,
): Promise<RealmSearchResponse> {
  token ??= await fetchOAuthTokenMemoized();

  let namespace = '';
  switch (gameVersion) {
    case GameVersion.Classic:
      namespace = getClassicNamespace(API_NAMESPACE_CATEGORY, region);
      break;
    case GameVersion.ClassicEra:
      namespace = getClassicEraNamespace(API_NAMESPACE_CATEGORY, region);
      break;
    case GameVersion.Retail:
    default:
      namespace = getRetailNamespace(API_NAMESPACE_CATEGORY, region);
      break;
  }

  /* _pageSize - min 1, max 1000 */
  const url = `${API_BASE_URLS[region]}/data/wow/search/realm?namespace=${namespace}&orderby=slug&_pageSize=1000`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new FetchError(url, response);
  }

  const json = await response.json();

  return RealmSearchResponseSchema.parse(json);
}
