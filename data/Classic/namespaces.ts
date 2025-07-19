/**
 * World of Warcraft Classic API Namespaces
 *
 * These namespaces are used to categorize different types of data in the Battle.net API
 * for the Classic version of World of Warcraft.
 *
 * @see https://develop.battle.net/documentation/world-of-warcraft/guides/namespaces
 */

import { NamespaceCategory } from '../namespaceCategory';
import { Region } from '../uri';

/**
 * Classic static namespaces for World of Warcraft Classic
 */
export enum ClassicStaticNamespace {
  US = 'static-classic-us',
  EU = 'static-classic-eu',
  KR = 'static-classic-kr',
  TW = 'static-classic-tw',
  CN = 'static-classic-cn',
}

/**
 * Classic dynamic namespaces for World of Warcraft Classic
 */
export enum ClassicDynamicNamespace {
  US = 'dynamic-classic-us',
  EU = 'dynamic-classic-eu',
  KR = 'dynamic-classic-kr',
  TW = 'dynamic-classic-tw',
  CN = 'dynamic-classic-cn',
}

/**
 * Classic profile namespaces for World of Warcraft Classic
 */
export enum ClassicProfileNamespace {
  US = 'profile-classic-us',
  EU = 'profile-classic-eu',
  KR = 'profile-classic-kr',
  TW = 'profile-classic-tw',
  CN = 'profile-classic-cn',
}

/**
 * Classic namespaces combined
 */
export const ClassicNamespaces = {
  Static: ClassicStaticNamespace,
  Dynamic: ClassicDynamicNamespace,
  Profile: ClassicProfileNamespace,
} as const;

/**
 * Union type of all classic namespace values
 */
export type ClassicNamespace =
  | ClassicStaticNamespace
  | ClassicDynamicNamespace
  | ClassicProfileNamespace;

/**
 * Helper function to get classic namespace by type and region
 */
export function getClassicNamespace(
  type: NamespaceCategory,
  region: Region,
): ClassicNamespace {
  const regionKey = region.toUpperCase() as keyof typeof ClassicStaticNamespace;

  switch (type) {
    case NamespaceCategory.Static:
      return ClassicStaticNamespace[regionKey];
    case NamespaceCategory.Dynamic:
      return ClassicDynamicNamespace[regionKey];
    case NamespaceCategory.Profile:
      return ClassicProfileNamespace[regionKey];
  }

  throw new Error(`Invalid classic namespace configuration: ${type}-${region}`);
}
