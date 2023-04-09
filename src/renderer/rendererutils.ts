/**
 * Please keep this file FREE from any filesystem/Node JS process related code as it
 * is used in both the backend and the frontend, and the frontend does not have
 * access to import 'fs', for example.
 *
 * It is okay to import things from other modules that import 'fs' as long as you don't
 * import a function that uses the 'fs' module. You'll very easily find out if what you
 * did was bad, because the render process will show its "Red Screen of Death".
 */
import {
  dungeonEncounters,
  dungeonsByMapId,
  instanceDifficulty,
  instanceEncountersById,
  specializationById,
  WoWCharacterClassType,
  WoWClassColor,
} from 'main/constants';
import { TimelineSegmentType } from 'main/keystone';
import { Flavour, RendererVideo, RendererVideoState } from 'main/types';
import { ambiguate } from 'parsing/logutils';
import { VideoCategory } from 'types/VideoCategory';
import Player from 'video.js/dist/types/player';
import * as Images from './images';

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
const getFormattedDuration = (video: RendererVideo) => {
  const { duration } = video;
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

const getWoWClassColor = (unitClass: WoWCharacterClassType) => {
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
  const videoState: RendererVideoState = {
    [VideoCategory.TwoVTwo]: [],
    [VideoCategory.ThreeVThree]: [],
    [VideoCategory.FiveVFive]: [],
    [VideoCategory.Skirmish]: [],
    [VideoCategory.SoloShuffle]: [],
    [VideoCategory.MythicPlus]: [],
    [VideoCategory.Raids]: [],
    [VideoCategory.Battlegrounds]: [],
  };

  return videoState;
};

/**
 * Get a result text appropriate for the video category that signifies a
 * win or a loss, of some sort.
 */
const getVideoResultText = (video: RendererVideo): string => {
  const {
    category,
    result,
    upgradeLevel,
    soloShuffleRoundsWon,
    soloShuffleRoundsPlayed,
  } = video;

  if (category === VideoCategory.MythicPlus && result) {
    if (upgradeLevel === undefined) {
      return '';
    }

    return `+${upgradeLevel}`;
  }

  if (category === VideoCategory.MythicPlus && !result) {
    return 'Depleted';
  }

  if (category === VideoCategory.Raids) {
    return result ? 'Kill' : 'Wipe';
  }

  if (category === VideoCategory.SoloShuffle) {
    if (
      soloShuffleRoundsWon === undefined ||
      soloShuffleRoundsPlayed === undefined
    ) {
      return '';
    }

    const wins = soloShuffleRoundsWon;
    const losses = soloShuffleRoundsPlayed - soloShuffleRoundsWon;
    return `${wins} - ${losses}`;
  }

  return result ? 'Win' : 'Loss';
};

const getInstanceDifficulty = (id: number) => {
  const knownDifficulty = Object.prototype.hasOwnProperty.call(
    instanceDifficulty,
    id
  );
  if (!knownDifficulty) {
    return null;
  }

  return instanceDifficulty[id];
};

/**
 * Get the name of a boss encounter based on its encounter ID. Ideally we
 * would just write this to the metadata and not have to re-calulate on the
 * frontend.
 */
const getEncounterNameById = (encounterId: number): string => {
  const recognisedEncounter = Object.prototype.hasOwnProperty.call(
    instanceEncountersById,
    encounterId
  );

  if (recognisedEncounter) {
    return instanceEncountersById[encounterId];
  }

  return 'Unknown Boss';
};

/**
 * Get an appropriate image for the video.
 */
const getVideoImage = (video: RendererVideo) => {
  const { category, encounterID, zoneID } = video;

  if (category === VideoCategory.Raids && encounterID !== undefined) {
    return Images.raidImages[encounterID];
  }

  if (category === VideoCategory.MythicPlus && zoneID !== undefined) {
    return Images.dungeonImages[zoneID];
  }

  if (category === VideoCategory.Battlegrounds && zoneID !== undefined) {
    return Images.battlegroundImages[zoneID];
  }

  if (zoneID !== undefined) {
    return Images.arenaImages[zoneID];
  }

  return '';
};

/**
 * Get the dungeon name if possible, else an empty string.
 */
const getDungeonName = (video: RendererVideo) => {
  const { mapID } = video;

  if (mapID !== undefined) {
    return dungeonsByMapId[mapID];
  }

  return '';
};

const isMythicPlusUtil = (video: RendererVideo) => {
  const { category } = video;
  return category === VideoCategory.MythicPlus;
};

const isRaidUtil = (video: RendererVideo) => {
  const { category } = video;
  return category === VideoCategory.Raids;
};

const isBattlegroundUtil = (video: RendererVideo) => {
  const { category } = video;
  return category === VideoCategory.Battlegrounds;
};

const isSoloShuffleUtil = (video: RendererVideo) => {
  const { category } = video;
  return category === VideoCategory.SoloShuffle;
};

const isArenaUtil = (video: RendererVideo) => {
  return (
    !isMythicPlusUtil(video) && !isRaidUtil(video) && !isBattlegroundUtil(video)
  );
};

const getResultColor = (video: RendererVideo) => {
  const { result, soloShuffleRoundsWon } = video;

  if (isSoloShuffleUtil(video)) {
    if (
      soloShuffleRoundsWon !== undefined &&
      soloShuffleRoundsWon >= 0 &&
      soloShuffleRoundsWon <= 6
    ) {
      // This is linear gradient from red to green, in RBG format as I don't know
      // a better way to pass it through. Generated with: https://cssgradient.io/.
      // The key is the number of wins.
      const soloShuffleResultColors = [
        'rgb(0,   255, 42, 0.3)',
        'rgb(34,  255,  0, 0.3)',
        'rgb(150, 255,  0, 0.3)',
        'rgb(255, 218,  0, 0.3)',
        'rgb(255, 105,  0, 0.3)',
        'rgb(255,  45,  0, 0.3)',
        'rgb(255,   0,  0, 0.3)',
      ];

      return soloShuffleResultColors[soloShuffleRoundsWon];
    }
  }

  if (result) {
    return 'rgb(53, 164, 50, 0.3)';
  }

  return 'rgb(156, 21, 21, 0.3)';
};

const getPlayerName = (video: RendererVideo) => {
  const { player } = video;

  if (player === undefined) {
    return '';
  }

  if (player.name === undefined) {
    return '';
  }

  return player.name;
};

const getPlayerRealm = (video: RendererVideo) => {
  const { player } = video;

  if (player === undefined) {
    return '';
  }

  if (player.realm === undefined) {
    return '';
  }

  return player.realm;
};

const getPlayerSpecID = (video: RendererVideo) => {
  const { player } = video;

  if (player === undefined) {
    return 0;
  }

  if (player.specID === undefined) {
    return 0;
  }

  return player.specID;
};

const getPlayerTeamID = (video: RendererVideo) => {
  const { player } = video;

  if (player === undefined) {
    return 0;
  }

  if (player.teamID === undefined) {
    return 0;
  }

  return player.teamID;
};

const getPlayerClass = (video: RendererVideo): WoWCharacterClassType => {
  const { player } = video;

  if (player === undefined) {
    return 'UNKNOWN';
  }

  if (player.specID === undefined) {
    return 'UNKNOWN';
  }

  if (specializationById[player.specID] === undefined) {
    return 'UNKNOWN';
  }

  return specializationById[player.specID].class;
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
  getVideoResultText,
  getInstanceDifficulty,
  getEncounterNameById,
  getVideoImage,
  getDungeonName,
  isMythicPlusUtil,
  isRaidUtil,
  isBattlegroundUtil,
  isSoloShuffleUtil,
  isArenaUtil,
  getResultColor,
  getPlayerName,
  getPlayerRealm,
  getPlayerSpecID,
  getPlayerTeamID,
  getPlayerClass,
};
