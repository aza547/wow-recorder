import { dungeonEncounters, instanceDifficulty, InstanceDifficultyType, VideoCategory } from "main/constants";

const getInstanceDifficulty = (difficultyID: number): InstanceDifficultyType | null => {
    if (instanceDifficulty.hasOwnProperty(difficultyID)) {
        return instanceDifficulty[difficultyID];
    }

    return null;
}

/**
 * getResultText
 */
 const getResultText = (category: VideoCategory, isGoodResult: boolean) => {

    // Not sure how we can decide who won or lost yet. 
    // Combat log doesn't make it obvious.
    if (category == VideoCategory.Battlegrounds || category == VideoCategory.SoloShuffle) {
        return "";
    }

    switch (category) {
        case VideoCategory.MythicPlus:
            return isGoodResult ? "Timed" : "Depleted";

        case VideoCategory.Raids:
            return isGoodResult ? "Kill" : "Wipe";

        default:
            return isGoodResult ? "Win" : "Loss";
    }
} 

const getVideoResult = (video: any): boolean => {
    if (video.challengeMode !== undefined) {
        return Boolean(video.challengeMode.timed)
    }

    return video.result
}

/**
 * getFormattedDuration
 * 
 * returns a string of the form MM:SS.
 */
 const getFormattedDuration = (duration: number) => {
    const durationDate = new Date(0);
    durationDate.setSeconds(duration);
    const formattedDuration = durationDate.toISOString().substr(14, 5);
    return formattedDuration;
}  

/**
 * Return the name of a dungeon encounter (boss) by its encounter ID
 */
 const getDungeonEncounterById = (id: number): string => {
    if (dungeonEncounters.hasOwnProperty(id)) {
      return dungeonEncounters[id]
    }

    return 'Unknown boss';
}

export {
    getResultText,
    getFormattedDuration,
    getInstanceDifficulty,
    getVideoResult,
    getDungeonEncounterById,
};
