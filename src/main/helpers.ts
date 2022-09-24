/**
 * Please keep this file FREE from any filesystem/Node JS process related code as it
 * is used in both the backend and the frontend, and the frontend does not have
 * access to import 'fs', for example.
 *
 * It is okay to import things from other modules that import 'fs' as long as you don't
 * import a function that uses the 'fs' module. You'll very easily find out if what you
 * did was bad, because the render process will show its "Red Screen of Death".
 */
import ElectronStore from "electron-store";
import { dungeonsByMapId, instanceDifficulty, InstanceDifficultyType, instanceEncountersById, instanceNamesByZoneId, raidInstances, VideoCategory, zones } from "./constants";
import { Metadata } from "./logutils";
import { RaidInstanceType } from "./types";

/** Poor man's path.join()/path.sep(). that use 'path' which uses Node JS 'process'.
 *
 * It does NOT handle '..' in the path, but it doesn't need to at this point.
 *
 * '\' only works on Windows, but this app isn't made to work on anything else so that's fine.
 */
const PATH_SEPARATOR = '\\';
const joinPath = (...args: string[]): string => {
    return args
        // Normalize path separators and replace mulitple consecutive
        // ones with a single one
        .map(v => v.replace(/[\\/]+/g, PATH_SEPARATOR))
        // Remove any trailing path separator
        .map(v => v.replace(/\\$/, ''))
        .join(PATH_SEPARATOR)
};

/**
 * Get a result text appropriate for the video category that signifies a
 * win or a loss, of some sort.
 */
export const getVideoResultText = (category: VideoCategory, isGoodResult: boolean): string => {

    // Non-trivial to determine who won a BG/SoloShuffle so just don't report it.
    if (category == VideoCategory.Battlegrounds || category == VideoCategory.SoloShuffle) {
        return "";
    }

    switch (category) {
        case VideoCategory.MythicPlus:
            return isGoodResult ? "Time" : "Depl";

        case VideoCategory.Raids:
            return isGoodResult ? "Kill" : "Wipe";

        default:
            return isGoodResult ? "Win" : "Loss";
    }
};

/**
 * Get the name of a dungeon by its map ID
 */
export const getDungeonByMapId = (mapId?: number): string => {
    if (mapId && dungeonsByMapId.hasOwnProperty(mapId)) {
        return dungeonsByMapId[mapId];
    }

    return 'Unknown Dungeon';
};

/**
 * Get the name of a boss encounter based on its encounter ID
 */
export const getEncounterNameById = (encounterId? : number): string => {
    if (encounterId && instanceEncountersById.hasOwnProperty(encounterId)) {
        return instanceEncountersById[encounterId];
    }

    return 'Unknown Boss';
};

/**
 * Get the name of a zone in WoW based on its zone ID
 */
export const getInstanceNameByZoneId = (zoneId?: number): string => {
    if (zoneId && instanceNamesByZoneId.hasOwnProperty(zoneId)) {
        return instanceNamesByZoneId[zoneId];
    }

    return 'Unknown Zone';
};

/**
 * Get the difficulty of an instance based on its difficulty ID, as found in
 * `ENCOUNTER_START` log lines.
 */
export const getInstanceDifficulty = (difficultyId: number): InstanceDifficultyType | null => {
    if (instanceDifficulty.hasOwnProperty(difficultyId)) {
        return instanceDifficulty[difficultyId];
    }

    return null;
};

/**
 * Get the zone name.
 */
export const getVideoZone = (metadata: Metadata) => {
    const zoneID = metadata.zoneID;
    const encounterID = metadata.encounterID;

    switch (metadata.category) {
        case VideoCategory.MythicPlus:
            return getInstanceNameByZoneId(zoneID);

        case VideoCategory.Raids:
            return getRaidNameByEncounterId(encounterID);

        default:
            if (zoneID && zones.hasOwnProperty(zoneID)) {
                return zones[zoneID];
            }
    }

    return "Unknown Zone";
}

/**
 * Get the raid name from the encounter ID.
 */
export const getRaidNameByEncounterId = (encounterID?: number) => {
    const raid = getRaidByEncounterId(encounterID);
    if (!raid) {
        return 'Unknown Raid';
    }

    return raid.name;
}

/**
 * Get the raid instance from an encounter ID.
 */
export const getRaidByEncounterId = (zoneID?: number): RaidInstanceType | undefined => {
    const raid = raidInstances.filter(r => zoneID && r.encounters.hasOwnProperty(zoneID))

    return raid.pop();
};

/**
 * Return a value for the `bufferStoragePath` setting, based on the given `storagePath`.
 *
 * If `bufferStoragePath` is not empty, it will simply be returned.
 * If `bufferStoragePath` is empty, and `storagePath` is empty, so will `bufferStoragePath` be.
 * If `bufferStoragePath` is empty, and `storagePath` is not empty, we'll construct
 * a default value.
 */
export const resolveBufferStoragePath = (storagePath?: string, bufferStoragePath?: string): string => {
    if (bufferStoragePath) {
        return bufferStoragePath;
    }

    // Do not use `path` here, as it uses Node JS `process` which isn't available in the render process.
    return storagePath ? joinPath(storagePath, '.temp') : '';
};

/**
 * Simple function to ensure we get a value back of a certain type from the ElectronStore.
 */
export function getElectronStoreValue<T>(configKey: string): T {
    return (window.electron.store.get(configKey) as T);
};


/**
 * Gets a path (string) value from the config in a more reliable manner.
 * @param cfg the config store
 * @param key the key
 * @returns the string config
 */
export const getPathConfigSafe = (cfg: ElectronStore, key: string): string => {
    return cfg.has(key) ? joinPath(getStringConfigSafe(cfg, key), PATH_SEPARATOR) : "";
};

/**
 * Gets number value from the config in a more reliable manner.
 * @param cfg the config store
 * @param preference the preference
 * @returns the number config
 */
export const getNumberConfigSafe = (cfg: ElectronStore, preference: string): number => {
    return cfg.has(preference) ? parseInt(getStringConfigSafe(cfg, preference)) : NaN;
};

/**
 * Gets a string value from the config in a more reliable manner.
 * @param cfg the config store
 * @param key the key
 * @param defaultValue default value, passed stright to `cfg.get()`
 * @returns the string value
 */
export const getStringConfigSafe = (cfg: ElectronStore, key: string, defaultValue?: string): string => {
    return (cfg.get(key, defaultValue) as string);
};
