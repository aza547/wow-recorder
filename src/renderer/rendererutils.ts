import { VideoCategory } from "main/constants";

/**
 * getResultText
 */
 const getResultText = (category: string, isGoodResult: boolean) => {

    // Not sure how we can decide who won or lost yet. 
    // Combat log doesn't make it obvious.
    switch (category) {
        case VideoCategory.MythicPlus:
            return isGoodResult ? "Timed" : "Depleted";

        case VideoCategory.Raids:
            return isGoodResult ? "Kill" : "Wipe";

        default:
            return isGoodResult ? "Win" : "Loss";
    }
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
    getResultText,
    getFormattedDuration
};