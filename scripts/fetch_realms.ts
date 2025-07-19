#!/usr/bin/env node

/**
 * Script to fetch all realms from Blizzard API and save them to data/<GameVersion>/cache/realms.json
 *
 * This script fetches realms for all supported regions and game versions,
 * then saves the data to the appropriate cache directories.
 *
 * Usage:
 *   npm run fetch-realms
 *   node scripts/fetch_realms.ts
 *   ts-node scripts/fetch_realms.ts
 *
 * Environment variables required:
 *   BLIZZARD_CLIENT_ID - Blizzard API client ID
 *   BLIZZARD_CLIENT_SECRET - Blizzard API client secret
 */

import { promises as fs } from 'fs';
import path from 'path';
import { GameVersion } from '../data/gameVersions';
import { GlobalRegion, Region } from '../data/uri';
import { fetchRealmSearch } from './blizzardApi/fetchRealmSearch';
import { RealmSearchResponse } from './blizzardApi/realmSearchResponseSchema';

// Configuration
const CACHE_DIR = 'cache';
const CACHE_FILENAME = 'realms.json';
const DATA_DIR = path.join(__dirname, '..', 'data');

// All supported regions
const ALL_REGIONS: Region[] = [
  GlobalRegion.US,
  GlobalRegion.EU,
  GlobalRegion.KR,
  GlobalRegion.TW,
  // ChinaRegion.CN, I was not able to fetch anything from china API gateway
];

// All supported game versions
const ALL_GAME_VERSIONS: GameVersion[] = [
  GameVersion.Retail,
  GameVersion.Classic,
  GameVersion.ClassicEra,
];

/**
 * Interface for the cached realm data
 */
interface CachedRealmData {
  fetchedAt: string;
  regions: {
    [key in Region]?: Array<RealmSearchResponse>;
  };
}

/**
 * Ensures a directory exists, creating it if necessary
 */
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Fetches realms for a specific game version and region
 */
async function fetchRealmsForRegion(
  gameVersion: GameVersion,
  region: Region,
): Promise<RealmSearchResponse> {
  console.log(`Fetching realms for ${gameVersion} - ${region}...`);

  try {
    const response = await fetchRealmSearch(region, gameVersion);
    console.log(
      `✓ Found ${response.results.length} realms for ${gameVersion} - ${region}`,
    );
    return response;
  } catch (error) {
    console.error(
      `✗ Failed to fetch realms for ${gameVersion} - ${region}: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

/**
 * Fetches realms for all regions for a specific game version
 */
async function fetchRealmsForGameVersion(
  gameVersion: GameVersion,
): Promise<CachedRealmData> {
  console.log(`\n=== Fetching realms for ${gameVersion} ===`);

  const realmData: CachedRealmData = {
    fetchedAt: new Date().toISOString(),
    regions: {},
  };

  for (const region of ALL_REGIONS) {
    try {
      let pageNumber = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        const response = await fetchRealmsForRegion(gameVersion, region);
        if (!realmData.regions[region]) {
          realmData.regions[region] = [];
        }

        // Page Number starts with 1, but array indices start with 0
        realmData.regions[region][pageNumber - 1] = response;

        // Check if there are more pages (actually we are fetching 1000, and page size is less them 300. I believe it will never reach the limit.)
        hasMorePages = response.pageCount
          ? pageNumber < response.pageCount
          : false;

        pageNumber++;
      }

      // Add a small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.warn(
        `Skipping ${region} for ${gameVersion} due to error: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Continue with other regions even if one fails
    }
  }

  return realmData;
}

/**
 * Saves realm data to the cache file
 */
async function saveRealmData(
  gameVersion: GameVersion,
  data: CachedRealmData,
): Promise<void> {
  const gameVersionDir = path.join(DATA_DIR, gameVersion);
  const cacheDir = path.join(gameVersionDir, CACHE_DIR);
  const cacheFile = path.join(cacheDir, CACHE_FILENAME);

  console.log(`Saving realms data to: ${cacheFile}`);

  await ensureDir(cacheDir);
  await fs.writeFile(cacheFile, JSON.stringify(data, null, 2), 'utf8');

  console.log(
    `✓ Saved ${Object.keys(data.regions).length} regions to ${cacheFile}`,
  );
}

/**
 * Validates environment variables
 */
function validateEnvironment(): void {
  if (!process.env.BLIZZARD_CLIENT_ID) {
    throw new Error('BLIZZARD_CLIENT_ID environment variable is required');
  }

  if (!process.env.BLIZZARD_CLIENT_SECRET) {
    throw new Error('BLIZZARD_CLIENT_SECRET environment variable is required');
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log('🚀 Starting realm fetch process...');

  try {
    // Validate environment
    validateEnvironment();
    console.log('✓ Environment variables validated');

    // Process each game version
    for (const gameVersion of ALL_GAME_VERSIONS) {
      try {
        const realmData = await fetchRealmsForGameVersion(gameVersion);

        await saveRealmData(gameVersion, realmData);
      } catch (error) {
        console.error(`Failed to process ${gameVersion}:`, error);
        // Continue with other game versions
      }
    }

    console.log('\n🎉 Realm fetch process completed!');
    console.log('\nGenerated files:');

    for (const gameVersion of ALL_GAME_VERSIONS) {
      const cacheFile = path.join(
        DATA_DIR,
        gameVersion,
        CACHE_DIR,
        CACHE_FILENAME,
      );
      try {
        await fs.access(cacheFile);
        console.log(`  - ${path.relative(process.cwd(), cacheFile)}`);
      } catch {
        console.log(`  - ${path.relative(process.cwd(), cacheFile)} (failed)`);
      }
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Execute the main function if this script is run directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { main, fetchRealmsForGameVersion, fetchRealmsForRegion };
