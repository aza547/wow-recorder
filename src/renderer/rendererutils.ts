import {
  dungeonEncounters,
  videoFilterData,
  WoWClassColor,
} from 'main/constants';
import { TimelineSegmentType } from 'main/keystone';
import { Flavour, VideoListFilters } from 'main/types';
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
    const segmentDuration =
      Date.parse(segment.logEnd) - Date.parse(segment.logStart);
    const encounterDuration = Math.floor(segmentDuration / 1000);
    const type = segment.segmentType as TimelineSegmentType;
    let markerClass: string;
    let markerText: string;

    if (type === TimelineSegmentType.BossEncounter) {
      markerClass = 'orange-video-marker';
      markerText = dungeonEncounters[segment.encounterId] || 'Boss';
    } else {
      markerClass = 'purple-video-marker';
      markerText = segment.segmentType;
    }

    videoMarkers.push({
      time: segment.timestamp,
      text: markerText,
      class: markerClass,
      duration: encounterDuration,
    });
  });

  return videoMarkers;
};

/**
 * Add markers to a videoJS player.
 */
const addVideoMarkers = (video: any, player: Player) => {
  const category = video.category as VideoCategory;
  const flavour = video.flavour as Flavour;

  if (flavour === Flavour.Classic || category === VideoCategory.Battlegrounds) {
    // Battlegrounds: Lots of deaths so don't bother making a mess of the UI
    //                and trying to display them all.
    // Classic:       Video durations are less accurate so high chance markers
    //                are misplaced, as the marker timestamps are accurate to
    //                combat log time.
    return;
  }

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

const getNumVideos = (videoState: any) => {
  let numVideos = 0;

  Object.values(videoState).forEach((category: any) => {
    Object.values(category).forEach(() => {
      numVideos += 1;
    });
  });

  return numVideos;
};

const getTotalDuration = (videoState: any) => {
  let totalDuration = 0;

  Object.values(videoState).forEach((category: any) => {
    Object.values(category).forEach((video: any) => {
      totalDuration += video.duration;
      totalDuration += video.overrun;
    });
  });

  return totalDuration;
};

const getLatestCategory = (videoState: any) => {
  let latestDate = new Date(2000, 1, 1);
  let latestCategory = VideoCategory.TwoVTwo;

  Object.keys(videoState).forEach((category: string) => {
    const video = videoState[category][0];

    if (video === undefined) {
      return;
    }

    const date = videoState[category][0].dateObject;

    if (date === undefined) {
      return;
    }

    if (date.getTime() > latestDate.getTime()) {
      latestDate = date;
      latestCategory = category as VideoCategory;
    }
  });

  return latestCategory;
};

/**
 * Get empty video state. This is duplicated here because we can't access
 * it in utils.ts on the frontend.
 */
const getEmptyState = () => {
  const videoState: { [category: string]: any[] } = {};

  const categories = Object.values(VideoCategory);

  categories.forEach((category) => {
    videoState[category] = [];
  });

  return videoState;
};

const parseVideoFilters = (filterText: string) => {
  const filterArray = filterText.split(' ').map((f) => f.toLowerCase());
  const filters: VideoListFilters[] = [];

  if (filterText === '') {
    return filters;
  }

  // Loop through the filter data and check for all the filters
  // we know about and their synonyms.
  Object.keys(videoFilterData).forEach((key) => {
    videoFilterData[key].forEach((synonym: string) => {
      if (filterArray.includes(synonym)) {
        filters.push(key as VideoListFilters);
        filterArray.splice(filterArray.indexOf(synonym), 1);
      }
    });
  });

  // If we've not recognised all the filters, add the invalid filter.
  // This will remove all the videos and prompt the user to re-evaluate
  // their query.
  if (filterArray.length > 0) {
    filters.push(VideoListFilters.Invalid);
  }

  return filters;
};

const filterVideos = (video: any, filters: VideoListFilters[]) => {
  console.log(video);
  const currentDate = new Date();

  if (filters.includes(VideoListFilters.Invalid)) {
    return false;
  }

  if (filters.includes(VideoListFilters.Win) && !video.result) {
    return false;
  }

  if (filters.includes(VideoListFilters.Loss) && video.result) {
    return false;
  }

  if (filters.includes(VideoListFilters.Today)) {
    const videoDate: Date = video.dateObject;
    const isFromToday =
      videoDate.getDay() === currentDate.getDay() &&
      videoDate.getMonth() === currentDate.getMonth() &&
      videoDate.getFullYear() === currentDate.getFullYear();

    if (!isFromToday) {
      return false;
    }
  }

  if (filters.includes(VideoListFilters.Yesterday)) {
    const videoDate: Date = video.dateObject;
    const isFromYesterday =
      videoDate.getDay() === currentDate.getDay() - 1 &&
      videoDate.getMonth() === currentDate.getMonth() &&
      videoDate.getFullYear() === currentDate.getFullYear();

    if (!isFromYesterday) {
      return false;
    }
  }

  return true;
};

export {
  getFormattedDuration,
  getVideoResult,
  addVideoMarkers,
  getWoWClassColor,
  getNumVideos,
  getTotalDuration,
  getLatestCategory,
  getEmptyState,
  parseVideoFilters,
  filterVideos,
};
