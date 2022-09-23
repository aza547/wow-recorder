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

export {
    getFormattedDuration,
    getVideoResult,
};
