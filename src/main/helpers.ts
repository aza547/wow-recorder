/**
 * Please keep this file FREE from any filesystem/Node JS process related code as it
 * is used in both the backend and the frontend, and the frontend does not have
 * access to import 'fs', for example.
 *
 * It is okay to import things from other modules that import 'fs' as long as you don't
 * import a function that uses the 'fs' module. You'll very easily find out if what you
 * did was bad, because the render process will show its "Red Screen of Death".
 */
import { instanceDifficulty, instanceEncountersById, VideoCategory } from "./constants";

/**
 * Get a result text appropriate for the video category that signifies a
 * win or a loss, of some sort.
 */
export const getVideoResultText = (category: VideoCategory, 
                                   isGoodResult: boolean): string => {
    const isBattleground = (category == VideoCategory.Battlegrounds);
    const isSoloShuffle = (category == VideoCategory.SoloShuffle);
   
    if (isBattleground || isSoloShuffle) {
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

export const getInstanceDifficulty = (id: number) => {
    const knownDifficulty = instanceDifficulty.hasOwnProperty(id);

    if (!knownDifficulty) {
        return null;
    }

    return instanceDifficulty[id];
};

/**
 * Get the name of a boss encounter based on its encounter ID. Ideally we 
 * would just write this to the metadata and not have to re-calulate on the
 * frontend. 
 */
export const getEncounterNameById = (encounterId: number): string => {
    if (instanceEncountersById.hasOwnProperty(encounterId)) {
        return instanceEncountersById[encounterId];
    }

    return 'Unknown Boss';
};