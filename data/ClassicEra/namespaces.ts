/**
 * World of Warcraft Classic Era API Namespaces
 *
 * These namespaces are used to categorize different types of data in the Battle.net API
 * for the Classic Era version of World of Warcraft.
 *
 * @see https://develop.battle.net/documentation/world-of-warcraft/guides/namespaces
 */

import { NamespaceCategory } from '../namespaceCategory';
import { Region } from '../uri';

/**
 * Classic Era static namespaces for World of Warcraft Classic Era
 */
export enum ClassicEraStaticNamespace {
  US = 'static-classic1x-us',
  EU = 'static-classic1x-eu',
  KR = 'static-classic1x-kr',
  TW = 'static-classic1x-tw',
  CN = 'static-classic1x-cn',
}

/**
 * Classic Era dynamic namespaces for World of Warcraft Classic Era
 */
export enum ClassicEraDynamicNamespace {
  US = 'dynamic-classic1x-us',
  EU = 'dynamic-classic1x-eu',
  KR = 'dynamic-classic1x-kr',
  TW = 'dynamic-classic1x-tw',
  CN = 'dynamic-classic1x-cn',
}

/**
 * Classic Era profile namespaces for World of Warcraft Classic Era
 */
export enum ClassicEraProfileNamespace {
  US = 'profile-classic1x-us',
  EU = 'profile-classic1x-eu',
  KR = 'profile-classic1x-kr',
  TW = 'profile-classic1x-tw',
  CN = 'profile-classic1x-cn',
}

/**
 * Classic Era namespaces combined
 */
export const ClassicEraNamespaces = {
  Static: ClassicEraStaticNamespace,
  Dynamic: ClassicEraDynamicNamespace,
  Profile: ClassicEraProfileNamespace,
} as const;

/**
 * Union type of all classic era namespace values
 */
export type ClassicEraNamespace =
  | ClassicEraStaticNamespace
  | ClassicEraDynamicNamespace
  | ClassicEraProfileNamespace;

/**
 * Helper function to get classic era namespace by type and region
 */
export function getClassicEraNamespace(
  type: NamespaceCategory,
  region: Region,
): ClassicEraNamespace {
  const regionKey =
    region.toUpperCase() as keyof typeof ClassicEraStaticNamespace;

  switch (type) {
    case NamespaceCategory.Static:
      return ClassicEraStaticNamespace[regionKey];
    case NamespaceCategory.Dynamic:
      return ClassicEraDynamicNamespace[regionKey];
    case NamespaceCategory.Profile:
      return ClassicEraProfileNamespace[regionKey];
  }

  throw new Error(
    `Invalid classic era namespace configuration: ${type}-${region}`,
  );
}
