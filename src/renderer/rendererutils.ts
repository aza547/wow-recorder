import { instanceDifficulty, InstanceDifficultyType, VideoCategory } from "main/constants";

/**
 * isCategoryPVP
 */
 const isCategoryPVP = (category: VideoCategory) => {
    if (!category) return false;

    const pvpCategories = [
        VideoCategory.TwoVTwo,
        VideoCategory.ThreeVThree,
        VideoCategory.Skirmish,
        VideoCategory.SoloShuffle,
        VideoCategory.Battlegrounds,
    ];

    return pvpCategories.indexOf(category) !== -1;
}  

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

    const isPvp = isCategoryPVP(category);
    let resultText: string;

    if (isPvp && isGoodResult) {
        resultText = "Win";     
    } else if (isPvp && !isGoodResult) {
        resultText = "Loss";
    } else if (!isPvp && isGoodResult) {
        resultText = "Kill";
    } else {
        resultText = "Wipe";
    }

    return resultText;
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

export {
    isCategoryPVP,
    getResultText,
    getFormattedDuration,
    getInstanceDifficulty
};
