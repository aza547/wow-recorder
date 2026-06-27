import { RendererVideo } from '../main/types';
import { VideoCategory } from '../types/VideoCategory';
import { areDatesWithinSeconds } from './rendererutils';

const sourceStartTimeToleranceSeconds = 60;
const clippedAtSuffixPattern = /\s+-\s+Clipped At\s+.+$/i;
const videoFileExtensionPattern = /\.(m4v|mkv|mov|mp4|webm)$/i;

const normalizeParentVideoName = (videoName: string) => {
  // Clip metadata can come from old builds or hand-edited files where the
  // source was stored as a path, while renderer videos use extensionless names.
  const fileName = videoName.trim().split(/[\\/]/).pop() ?? videoName;
  return fileName.replace(videoFileExtensionPattern, '');
};

const getLegacyParentVideoName = (clip: RendererVideo) => {
  const clipVideoName = normalizeParentVideoName(clip.videoName);
  const parentVideoName = clipVideoName.replace(clippedAtSuffixPattern, '');

  return parentVideoName === clipVideoName ? undefined : parentVideoName;
};

const getClipParentOffset = (clip: RendererVideo) => {
  const offset = clip.parentOffset;

  if (offset === undefined || !Number.isFinite(offset) || offset < 0) {
    return 0;
  }

  return offset;
};

const getVideoStartTime = (video: RendererVideo) => {
  if (!video.start) return undefined;

  const startTime = new Date(video.start).getTime();
  if (Number.isNaN(startTime)) return undefined;

  return startTime;
};

const getStoragePriority = (clip: RendererVideo, candidate: RendererVideo) => {
  if (candidate.cloud === clip.cloud) return 0;
  return candidate.cloud ? 2 : 1;
};

const compareStableParentOrder = (
  clip: RendererVideo,
  first: RendererVideo,
  second: RendererVideo,
) =>
  getStoragePriority(clip, first) - getStoragePriority(clip, second) ||
  first.videoName.localeCompare(second.videoName);

const canBeClipParent = (clip: RendererVideo, candidate: RendererVideo) => {
  if (candidate.category === VideoCategory.Clips) return false;
  if (candidate.category !== clip.parentCategory) return false;
  return true;
};

const findClipParent = (
  clip: RendererVideo,
  videos: RendererVideo[],
): RendererVideo | undefined => {
  if (clip.category !== VideoCategory.Clips || !clip.parentCategory) {
    return undefined;
  }

  if (clip.parentVideoName) {
    const parentVideoName = normalizeParentVideoName(clip.parentVideoName);
    const exactParent = videos
      .filter(
        (candidate) =>
          parentVideoName &&
          normalizeParentVideoName(candidate.videoName) === parentVideoName &&
          canBeClipParent(clip, candidate),
      )
      .sort((first, second) =>
        compareStableParentOrder(clip, first, second),
      )[0];

    if (exactParent) return exactParent;
    if (parentVideoName) {
      // Explicit source metadata means a missing match should disable the
      // action instead of guessing a different recording from the same pull.
      return undefined;
    }
  }

  const legacyParentVideoName = getLegacyParentVideoName(clip);
  if (legacyParentVideoName) {
    // Existing clips did not persist parentVideoName, but their filename keeps
    // the source recording name before the " - Clipped at ..." suffix.
    const legacyParent = videos
      .filter(
        (candidate) =>
          normalizeParentVideoName(candidate.videoName) ===
            legacyParentVideoName && canBeClipParent(clip, candidate),
      )
      .sort((first, second) =>
        compareStableParentOrder(clip, first, second),
      )[0];

    if (legacyParent) return legacyParent;
  }

  if (!clip.parentVideoName && !legacyParentVideoName) {
    // Generated clips, such as kill videos, can share the source uniqueHash but
    // do not have a single trusted source recording or offset to jump to.
    return undefined;
  }

  if (!clip.uniqueHash) {
    return undefined;
  }

  const clipStart = getVideoStartTime(clip);
  if (clipStart === undefined) {
    return undefined;
  }

  // Hash and start time are only a legacy fallback, so score all matching
  // candidates first instead of letting array order decide between duplicates.
  const fallbackParents = videos
    .map((candidate) => {
      if (!canBeClipParent(clip, candidate)) return undefined;
      if (!candidate.uniqueHash) return undefined;
      if (candidate.uniqueHash !== clip.uniqueHash) return undefined;

      const candidateStart = getVideoStartTime(candidate);
      if (candidateStart === undefined) return undefined;

      if (
        !areDatesWithinSeconds(
          new Date(candidateStart),
          new Date(clipStart),
          sourceStartTimeToleranceSeconds,
        )
      ) {
        return undefined;
      }

      return {
        candidate,
        startDeltaMs: Math.abs(candidateStart - clipStart),
      };
    })
    .filter(
      (
        fallbackParent,
      ): fallbackParent is {
        candidate: RendererVideo;
        startDeltaMs: number;
      } => fallbackParent !== undefined,
    )
    .sort(
      (first, second) =>
        getStoragePriority(clip, first.candidate) -
          getStoragePriority(clip, second.candidate) ||
        first.startDeltaMs - second.startDeltaMs ||
        first.candidate.videoName.localeCompare(second.candidate.videoName),
    );

  return fallbackParents[0]?.candidate;
};

export { findClipParent, getClipParentOffset };
