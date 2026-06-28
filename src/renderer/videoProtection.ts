import { RendererVideo } from 'main/types';

type VideoProtectionPermissions = {
  write: boolean;
  del: boolean;
};

const getVideoMultiPov = (video: RendererVideo): RendererVideo[] =>
  Array.isArray(video.multiPov) ? video.multiPov : [];

const getVideoGroup = (video: RendererVideo): RendererVideo[] => [
  video,
  ...getVideoMultiPov(video),
];

const isVideoProtected = (video: RendererVideo): boolean =>
  Boolean(video.isProtected);

// A pull should remain locked if any backing POV is protected locally or in cloud.
const isVideoGroupProtected = (videos: RendererVideo[]): boolean =>
  videos.some(isVideoProtected);

// A row action unlocks a protected pull, otherwise it locks every POV in it.
const getNextVideoGroupProtected = (videos: RendererVideo[]): boolean =>
  !isVideoGroupProtected(videos);

const areVideoGroupsProtected = (videoGroups: RendererVideo[][]): boolean =>
  videoGroups.length > 0 && videoGroups.every(isVideoGroupProtected);

// A bulk action protects the selection if any selected pull is currently unlocked.
const getNextVideoGroupsProtected = (videoGroups: RendererVideo[][]): boolean =>
  !areVideoGroupsProtected(videoGroups);

const canChangeVideoProtection = (
  videos: RendererVideo[],
  protectedState: boolean,
  permissions: VideoProtectionPermissions,
): boolean => {
  const hasCloudVideos = videos.some((video) => video.cloud);

  if (!hasCloudVideos) {
    return true;
  }

  return protectedState ? permissions.write : permissions.del;
};

const withVideoProtection = (
  video: RendererVideo,
  protectedState: boolean,
): RendererVideo => ({
  ...video,
  isProtected: protectedState,
  protected: protectedState,
});

const getVideoIdentity = (video: RendererVideo): string => {
  // A video is uniquely identified by its storage type and storage-specific source.
  if (video.cloud) {
    return `cloud:${video.videoName}`;
  }

  if (video.videoSource) {
    return `disk:${video.videoSource}`;
  }

  if (video.uniqueId) {
    return `unique:${video.uniqueId}`;
  }

  return `${video.cloud ? 'cloud' : 'disk'}:${video.videoName}`;
};

const videoIdentityMatches = (a: RendererVideo, b: RendererVideo): boolean =>
  getVideoIdentity(a) === getVideoIdentity(b);

// Cloud updates can target a nested POV, so update both the row video and its multiPov entries.
const withMatchedVideoProtection = (
  video: RendererVideo,
  matches: RendererVideo[],
  protectedState: boolean,
): RendererVideo => {
  const shouldUpdate = (candidate: RendererVideo) =>
    matches.some((match) => videoIdentityMatches(candidate, match));

  const nextVideo = shouldUpdate(video)
    ? withVideoProtection(video, protectedState)
    : video;

  const multiPov = getVideoMultiPov(video);
  const nextMultiPov = multiPov.map((pov) =>
    shouldUpdate(pov) ? withVideoProtection(pov, protectedState) : pov,
  );

  const multiPovChanged = nextMultiPov.some(
    (pov, index) => pov !== multiPov[index],
  );

  if (nextVideo === video && !multiPovChanged) {
    return video;
  }

  return {
    ...nextVideo,
    multiPov: nextMultiPov,
  };
};

export {
  areVideoGroupsProtected,
  canChangeVideoProtection,
  getVideoGroup,
  getNextVideoGroupProtected,
  getNextVideoGroupsProtected,
  isVideoGroupProtected,
  isVideoProtected,
  withMatchedVideoProtection,
  withVideoProtection,
};
