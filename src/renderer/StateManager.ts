import { VideoCategory } from 'types/VideoCategory';
import { RendererVideo } from '../main/types';
import { areDatesWithinSeconds } from './rendererutils';

/**
 * The video state, and utility mutation methods.
 */
export default class StateManager {
  /**
   * Walk the raw video list and correlate them into a single list. This is
   * done by looking for videos with the same hash and start time, and
   * linking them together.
   */
  public static correlate(raw: RendererVideo[]) {
    raw.forEach((rv) => {
      rv.multiPov = [];
    });

    const correlated: RendererVideo[] = [];

    const disk = raw.filter((video) => !video.cloud);
    disk.forEach((rv) => StateManager.correlateVideo(rv, correlated));

    const cloud = raw.filter((video) => video.cloud);
    cloud.forEach((rv) => StateManager.correlateVideo(rv, correlated));

    correlated.sort(StateManager.reverseChronologicalVideoSort);
    return correlated;
  }

  private static correlateVideo(video: RendererVideo, videos: RendererVideo[]) {
    if (video.uniqueHash === undefined || video.start === undefined) {
      // We don't have the fields required to correlate this video to
      // any other so just add it and move on.
      videos.push(video);
      return videos.length;
    }

    // We might be able to correlate this, so loop over each of the videos we
    // already know about and look for a match.
    for (let i = 0; i < videos.length; i++) {
      const videoToCompare = videos[i];
      const sameHash = videoToCompare.uniqueHash === video.uniqueHash;

      const isVideoClip = video.category === VideoCategory.Clips;
      const isCompareClip = videoToCompare.category === VideoCategory.Clips;

      if (
        (isVideoClip || isCompareClip) &&
        video.videoName !== videoToCompare.videoName
      ) {
        // Only correlate clips if they are the literally the same video
        // with different storage. Otherwise we end up grouping from the
        // parent hash which is confusing.

        continue;
      }

      if (!sameHash || videoToCompare.start === undefined) {
        // Mismatching hash or no start time so either these videos or
        // not correlated or we can't prove they are these are correlated.
        continue;
      }

      // The hash is the same, but it could still be similar pull from a
      // different time so check the date. Don't look for an exact match
      // here as I'm not sure how accurate the start event in the combat log
      // is between players; surely it can vary slightly depending on local
      // system clock etc.
      const d1 = new Date(video.start);
      const d2 = new Date(videoToCompare.start);
      const closeStartTime = areDatesWithinSeconds(d1, d2, 60);

      if (sameHash && closeStartTime) {
        // The video is a different POV of the same activity, link them and
        // break, we will never have more than one "parent" video so if we've
        // found it we're good to drop out and save some CPU cycles.

        videoToCompare.multiPov.push(video);
        return i;
      }
    }

    // We didn't correlate this video with another so just add it like
    // it is a normal video, this is the fallback case.
    videos.push(video);
    return videos.length;
  }

  private static reverseChronologicalVideoSort(
    A: RendererVideo,
    B: RendererVideo,
  ) {
    let metricA;
    let metricB;

    if (A.clippedAt) {
      metricA = A.clippedAt;
    } else if (A.start) {
      metricA = A.start;
    } else {
      metricA = A.mtime;
    }

    if (B.clippedAt) {
      metricB = B.clippedAt;
    } else if (B.start) {
      metricB = B.start;
    } else {
      metricB = B.mtime;
    }

    return metricB - metricA;
  }
}
