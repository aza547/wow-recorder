/**
 * Please keep this file FREE from any filesystem/Node JS process related code as it
 * is used in both the backend and the frontend, and the frontend does not have
 * access to import 'fs', for example.
 *
 * It is okay to import things from other modules that import 'fs' as long as you don't
 * import a function that uses the 'fs' module. You'll very easily find out if what you
 * did was bad, because the render process will show its "Red Screen of Death".
 */
import { dungeonsByMapId, instanceDifficulty, InstanceDifficultyType, instanceEncountersById, instanceNamesByZoneId, raidInstances, VideoCategory, zones } from "../data/constants";
import { Metadata } from "../main/types";
import { RaidInstanceType } from "../main/types";
import util from 'util';

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

export const inspectObject = (value: any): string => {
    return util.inspect(value, { colors: true, compact: false });
}
