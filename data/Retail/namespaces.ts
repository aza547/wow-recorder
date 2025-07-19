/**
 * World of Warcraft Retail API Namespaces
 *
 * These namespaces are used to categorize different types of data in the Battle.net API
 * for the retail version of World of Warcraft.
 *
 * @see https://develop.battle.net/documentation/world-of-warcraft/guides/namespaces
 */

import { NamespaceCategory } from '../namespaceCategory';
import { Region } from '../uri';

/**
 * Static namespaces contain data that changes infrequently
 */
export enum StaticNamespace {
  US = 'static-us',
  EU = 'static-eu',
  KR = 'static-kr',
  TW = 'static-tw',
  CN = 'static-cn',
}

/**
 * Dynamic namespaces contain data that changes frequently
 */
export enum DynamicNamespace {
  US = 'dynamic-us',
  EU = 'dynamic-eu',
  KR = 'dynamic-kr',
  TW = 'dynamic-tw',
  CN = 'dynamic-cn',
}

/**
 * Profile namespaces contain character and guild data
 */
export enum ProfileNamespace {
  US = 'profile-us',
  EU = 'profile-eu',
  KR = 'profile-kr',
  TW = 'profile-tw',
  CN = 'profile-cn',
}

/**
 * Retail namespaces combined
 */
export const RetailNamespaces = {
  Static: StaticNamespace,
  Dynamic: DynamicNamespace,
  Profile: ProfileNamespace,
} as const;

/**
 * Union type of all retail namespace values
 */
export type RetailNamespace =
  | StaticNamespace
  | DynamicNamespace
  | ProfileNamespace;

/**
 * Helper function to get retail namespace by type and region
 */
export function getRetailNamespace(
  type: NamespaceCategory,
  region: Region,
): RetailNamespace {
  const regionKey = region.toUpperCase() as keyof typeof StaticNamespace;

  switch (type) {
    case NamespaceCategory.Static:
      return StaticNamespace[regionKey];
    case NamespaceCategory.Dynamic:
      return DynamicNamespace[regionKey];
    case NamespaceCategory.Profile:
      return ProfileNamespace[regionKey];
  }

  throw new Error(`Invalid retail namespace configuration: ${type}-${region}`);
}
