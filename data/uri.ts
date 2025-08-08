/**
 * Battle.net API URI Builder
 *
 * This module provides utilities for building URIs for the Battle.net API endpoints.
 * It handles regional endpoints, OAuth authentication URLs, and API versioning.
 *
 * @see https://develop.battle.net/documentation/guides/getting-started
 * @see https://develop.battle.net/documentation/world-of-warcraft
 */

/**
 * Battle.net API regions
 * @see https://develop.battle.net/documentation/guides/regionality-and-apis
 */
export enum GlobalRegion {
  US = 'us',
  EU = 'eu',
  KR = 'kr',
  TW = 'tw',
}

export enum ChinaRegion {
  CN = 'cn',
}

export type Region = GlobalRegion | ChinaRegion;

/**
 * Battle.net API base URLs by region
 */
export const API_BASE_URLS: Record<Region, string> = {
  [GlobalRegion.US]: 'https://us.api.blizzard.com',
  [GlobalRegion.EU]: 'https://eu.api.blizzard.com',
  [GlobalRegion.KR]: 'https://kr.api.blizzard.com',
  [GlobalRegion.TW]: 'https://tw.api.blizzard.com',
  [ChinaRegion.CN]: 'https://gateway.battlenet.com.cn',
};

export enum Partitions {
  Global = 'global',
  China = 'china',
}

/**
 * Battle.net OAuth endpoints by region
 */
export const OAUTH_BASE_URLS: Record<Partitions, string> = {
  [Partitions.Global]: 'https://oauth.battle.net',
  [Partitions.China]: 'https://oauth.battlenet.com.cn',
};
