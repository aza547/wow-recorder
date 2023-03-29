import { WoWClassColor, daysOfWeek } from 'main/constants';
import { TimelineSegmentType } from 'main/keystone';
import { ambiguate } from 'parsing/logutils';
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
 * Return death markers for a video.
 */
const getDeathMarkers = (video: any) => {
  const videoMarkers: any[] = [];

  video.deaths.forEach((death: any) => {
    const [name] = ambiguate(death.name);
    const markerText = `Death (${name})`;
    let markerClass: string;

    if (death.friendly) {
      markerClass = 'red-video-marker-wide';
    } else {
      markerClass = 'green-video-marker-wide';
    }

    videoMarkers.push({
      time: death.timestamp,
      text: markerText,
      class: markerClass,
    });
  });

  return videoMarkers;
};

/**
 * Get a variable describing the video markers for a given solo shuffle.
 */
const getShuffleVideoMarkers = (video: any) => {
  const videoMarkers: any[] = [];

  video.timeline.forEach((segment: any) => {
    let markerText = `Round ${segment.round}`;
    let markerClass: string;

    if (segment.result) {
      markerText = `${markerText} (Win)`;
      markerClass = 'green-video-marker';
    } else {
      markerText = `${markerText} (Loss)`;
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
    videoMarkers = getDeathMarkers(video);
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

const getWoWClassColor = (unitClass: string) => {
  return WoWClassColor[unitClass];
};

const getTotalUsage = (videoState: any) => {
  delete videoState.latestCategory;
  let totalUsage = 0;

  Object.values(videoState).forEach((category: any) => {
    Object.values(category).forEach((video: any) => {
      totalUsage += video.size;
    });
  });

  return totalUsage;
};

const getNumVideos = (videoState: any) => {
  delete videoState.latestCategory;
  let numVideos = 0;

  Object.values(videoState).forEach((category: any) => {
    Object.values(category).forEach((video: any) => {
      numVideos += 1;
    });
  });

  return numVideos;
};

const getTotalDuration = (videoState: any) => {
  delete videoState.latestCategory;
  let totalDuration = 0;

  Object.values(videoState).forEach((category: any) => {
    Object.values(category).forEach((video: any) => {
      totalDuration += video.duration;
      totalDuration += video.overrun;
    });
  });

  return totalDuration;
};

/**
 * This might be the worst code I've ever written. I'm going to fix it later.
 */
const getRecentActivityStats = (videoState: any) => {
  delete videoState.latestCategory;
  const currentDate = new Date();
  const todayIndex = currentDate.getDay();
  const activityStats = [];
  const range = [...Array(7).keys()];
  const oneDay = 24 * 60 * 60 * 1000;

  range.forEach((i: number) => {
    let offsetDayIndex = todayIndex - i;

    if (offsetDayIndex < 0) {
      offsetDayIndex += 6;
    }

    activityStats.push({
      name: daysOfWeek[offsetDayIndex].slice(0, 3),
      Recordings: 0,
    });
  });

  Object.values(videoState).forEach((category: any) => {
    Object.values(category).forEach((video: any) => {
      const diffDays = Math.round(
        Math.abs((currentDate - video.dateObject) / oneDay)
      );

      if (diffDays >= 0 && diffDays <= 6) {
        activityStats[diffDays].Recordings++;
      }
    });
  });

  return activityStats.reverse();
};

export {
  getFormattedDuration,
  getVideoResult,
  addVideoMarkers,
  getWoWClassColor,
  getTotalUsage,
  getNumVideos,
  getTotalDuration,
  getRecentActivityStats,
};
