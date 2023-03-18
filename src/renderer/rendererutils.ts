import { TimelineSegmentType } from 'main/keystone';
import { VideoCategory } from 'types/VideoCategory';
import Player from 'video.js/dist/types/player';

/**
 * Get the result of a video.
 */
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

/**
 * Get a variable describing the video markers for a given solo shuffle.
 */
const getShuffleVideoMarkers = (video: any) => {
  const videoMarkers: any[] = [];

  video.timeline.forEach((segment: any) => {
    const markerText = `Round: ${segment.round}`;
    let markerClass: string;

    if (segment.result) {
      markerClass = 'green-video-marker';
    } else {
      markerClass = 'red-video-marker';
    }

    videoMarkers.push({
      time: segment.timestamp,
      text: markerText,
      class: markerClass,
    });
  });

  return videoMarkers;
};

/**
 * Get a variable describing the video markers for a given challenge mode.
 */
const getChallengeModeVideoMarkers = (video: any) => {
  const videoMarkers: any[] = [];

  video.timeline.forEach((segment: any) => {
    const markerText = segment.segmentType;
    const type = segment.segmentType as TimelineSegmentType;
    let markerClass: string;

    if (type === TimelineSegmentType.BossEncounter) {
      markerClass = 'orange-video-marker';
    } else {
      markerClass = 'purple-video-marker';
    }

    videoMarkers.push({
      time: segment.timestamp,
      text: markerText,
      class: markerClass,
    });
  });

  return videoMarkers;
};

/**
 * Add markers to a videoJS player.
 */
const addVideoMarkers = (video: any, player: Player) => {
  const category = video.category as VideoCategory;

  let videoMarkers;

  if (category === VideoCategory.SoloShuffle) {
    videoMarkers = getShuffleVideoMarkers(video);
  } else if (category === VideoCategory.MythicPlus) {
    videoMarkers = getChallengeModeVideoMarkers(video);
  } else {
    return;
  }

  player.markers({
    markerTip: {
      display: true,
      text(marker: any) {
        return marker.text;
      },
    },
    markers: videoMarkers,
  });
};

export { getFormattedDuration, getVideoResult, addVideoMarkers };
