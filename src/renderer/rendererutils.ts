const getVideoResult = (video: any): boolean => {
  return video.result;
};

/**
 * getFormattedDuration
 *
 * returns a string of the form MM:SS.
 */
const getFormattedDuration = (duration: number) => {
  const durationDate = new Date(0);
  durationDate.setTime(duration * 1000);
  const formattedDuration = durationDate.toISOString().substr(14, 5);
  return formattedDuration;
};

export { getFormattedDuration, getVideoResult };
