/**
 * Please keep this file FREE from filesystem/Node JS process related code as it
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
  months,
  specializationById,
  WoWCharacterClassType,
  WoWClassColor,
} from 'main/constants';
import { TimelineSegmentType } from 'main/keystone';
import {
  Encoder,
  EncoderType,
  Flavour,
  IOBSDevice,
  PlayerDeathType,
  RawChallengeModeTimelineSegment,
  RendererVideo,
  RendererVideoState,
  SoloShuffleTimelineSegment,
} from 'main/types';
import { ambiguate } from 'parsing/logutils';
import { VideoCategory } from 'types/VideoCategory';
import Player from 'video.js/dist/types/player';
import { ESupportedEncoders } from 'main/obsEnums';
import * as Images from './images';

const getVideoResult = (video: RendererVideo): boolean => {
  return video.result;
};

/**
 * Returns a string of the form MM:SS.
 */
const getFormattedDuration = (video: RendererVideo) => {
  const { duration } = video;
  const durationDate = new Date(0);
  durationDate.setTime(duration * 1000);
  const formattedDuration = durationDate.toISOString().substr(14, 5);
  return formattedDuration;
};

/**
 * Return an array of death markers for a video.
 * @param video the RendereVideo data type for the video
 * @param ownOnly true if should only get the players deaths
 */
const getDeathMarkers = (video: RendererVideo, ownOnly: boolean) => {
  const videoMarkers: any[] = [];
  const { player } = video;

  if (video.deaths === undefined) {
    return videoMarkers;
  }

  video.deaths.forEach((death: PlayerDeathType) => {
    const [name] = ambiguate(death.name);
    const markerText = `Death (${name})`;
    let markerClass: string;

    if (death.friendly) {
      markerClass = 'red-video-marker-wide';
    } else {
      markerClass = 'green-video-marker-wide';
    }

    if (ownOnly) {
      if (!player || !player._name) {
        return;
      }

      if (player._name === name) {
        videoMarkers.push({
          time: death.timestamp,
          text: markerText,
          class: markerClass,
        });
      }
    } else {
      videoMarkers.push({
        time: death.timestamp,
        text: markerText,
        class: markerClass,
      });
    }
  });

  return videoMarkers;
};

/**
 * Return an array of markers for a solo shuffle. This is markers for each
 * round, colored green for wins or red for losses.
 */
const getShuffleVideoMarkers = (video: RendererVideo) => {
  const videoMarkers: any[] = [];

  if (video.soloShuffleTimeline === undefined) {
    return videoMarkers;
  }

  video.soloShuffleTimeline.forEach((segment: SoloShuffleTimelineSegment) => {
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
 * Return an array of markers for a challenge mode, this highlights the boss
 * encounters as orange and the trash as purple.
 */
const getChallengeModeVideoMarkers = (video: RendererVideo) => {
  const videoMarkers: any[] = [];

  if (video.challengeModeTimeline === undefined) {
    return videoMarkers;
  }

  video.challengeModeTimeline.forEach(
    (segment: RawChallengeModeTimelineSegment) => {
      if (
        segment.logEnd === undefined ||
        segment.logStart === undefined ||
        segment.segmentType === undefined ||
        segment.segmentType !== TimelineSegmentType.BossEncounter
      ) {
        return;
      }

      const segmentEnd = new Date(segment.logEnd);
      const segmentStart = new Date(segment.logStart);

      const segmentDuration = Math.floor(
        (segmentEnd.getTime() - segmentStart.getTime()) / 1000
      );

      let markerText = '';

      if (segment.encounterId !== undefined) {
        markerText = dungeonEncounters[segment.encounterId];
      }

      videoMarkers.push({
        time: segment.timestamp,
        text: markerText,
        class: 'purple-video-marker',
        duration: segmentDuration,
      });
    }
  );

  const deathMarkers = getDeathMarkers(video, true);

  deathMarkers.forEach((marker) => {
    videoMarkers.push(marker);
  });

  return videoMarkers;
};

/**
 * Add markers to a videoJS player.
 */
const addVideoMarkers = (video: RendererVideo, player: Player) => {
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

  let videoMarkers: any;

  if (category === VideoCategory.SoloShuffle) {
    videoMarkers = getShuffleVideoMarkers(video);
  } else if (category === VideoCategory.MythicPlus) {
    videoMarkers = getChallengeModeVideoMarkers(video);
  } else if (category === VideoCategory.Raids) {
    videoMarkers = getDeathMarkers(video, true);
  } else {
    videoMarkers = getDeathMarkers(video, false);
  }

  player.markers({
    markerTip: {
      display: true,
      text(marker: any) {
        return marker.text;
      },
    },
    markers: videoMarkers,
    onMarkerClick: () => false,
  });
};

const getWoWClassColor = (unitClass: WoWCharacterClassType) => {
  return WoWClassColor[unitClass];
};

const getNumVideos = (videoState: RendererVideoState) => {
  let numVideos = 0;

  Object.values(videoState).forEach((videoList: RendererVideo[]) => {
    Object.values(videoList).forEach(() => {
      numVideos += 1;
    });
  });

  return numVideos;
};

const getTotalDuration = (videoState: RendererVideoState) => {
  let totalDuration = 0;

  Object.values(videoState).forEach((videoList: RendererVideo[]) => {
    Object.values(videoList).forEach((video: RendererVideo) => {
      totalDuration += video.duration;
      totalDuration += video.overrun;
    });
  });

  return totalDuration;
};

const getLatestCategory = (videoState: RendererVideoState) => {
  const categories = Object.values(VideoCategory);
  const latestVideoDate: number[] = [];

  categories.forEach((category) => {
    const firstVideo = videoState[category][0];

    if (firstVideo !== undefined) {
      latestVideoDate.push(firstVideo.mtime);
    } else {
      latestVideoDate.push(0);
    }
  });

  const latestDate = Math.max(...latestVideoDate);
  const latestDateIndex = latestVideoDate.indexOf(latestDate);
  return categories[latestDateIndex];
};

const getSortedVideos = (videoState: RendererVideoState) => {
  const categories = Object.values(VideoCategory);
  const allVideos: RendererVideo[] = [];

  categories.forEach((category) => {
    videoState[category].forEach((vid) => {
      allVideos.push(vid);
    });
  });

  // Sort in reverse chronological order.
  const sortedVideos = allVideos.sort((a, b) => {
    const dateA = a.mtime;
    const dateB = b.mtime;
    return dateA > dateB ? -1 : 1;
  });

  return sortedVideos;
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

const getInstanceDifficultyText = (video: RendererVideo) => {
  const { difficultyID } = video;

  if (difficultyID === undefined) {
    return '';
  }

  const knownDifficulty = Object.prototype.hasOwnProperty.call(
    instanceDifficulty,
    difficultyID
  );

  if (!knownDifficulty) {
    return '';
  }

  return instanceDifficulty[difficultyID].difficulty;
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
        'rgb(53,  164, 50, 0.3)',
        'rgb(46,  171, 27, 0.3)',
        'rgb(112, 170, 30, 0.3)',
        'rgb(171, 150, 30, 0.3)',
        'rgb(171, 86,  26, 0.3)',
        'rgb(175, 50,  23, 0.3)',
        'rgb(156, 21,  21, 0.3)',
      ].reverse();

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

  if (player._name === undefined) {
    return '';
  }

  return player._name;
};

const getPlayerRealm = (video: RendererVideo) => {
  const { player } = video;

  if (player === undefined) {
    return '';
  }

  if (player._realm === undefined) {
    return '';
  }

  return player._realm;
};

const getPlayerSpecID = (video: RendererVideo) => {
  const { player } = video;

  if (player === undefined) {
    return 0;
  }

  if (player._specID === undefined) {
    return 0;
  }

  const knownSpec = Object.prototype.hasOwnProperty.call(
    specializationById,
    player._specID
  );

  if (!knownSpec) {
    return 0;
  }

  return player._specID;
};

const getPlayerTeamID = (video: RendererVideo) => {
  const { player } = video;

  if (player === undefined) {
    return 0;
  }

  if (player._teamID === undefined) {
    return 0;
  }

  return player._teamID;
};

const getPlayerClass = (video: RendererVideo): WoWCharacterClassType => {
  const { player } = video;

  if (player === undefined) {
    return 'UNKNOWN';
  }

  if (player._specID === undefined) {
    return 'UNKNOWN';
  }

  if (specializationById[player._specID] === undefined) {
    return 'UNKNOWN';
  }

  return specializationById[player._specID].class;
};

const getVideoTime = (video: RendererVideo) => {
  const { mtime } = video;
  const date = new Date(mtime);

  const hours = date
    .getHours()
    .toLocaleString('en-US', { minimumIntegerDigits: 2 });

  const mins = date
    .getMinutes()
    .toLocaleString('en-US', { minimumIntegerDigits: 2 });

  const timeAsString = `${hours}:${mins}`;
  return timeAsString;
};

const getVideoDate = (video: RendererVideo) => {
  const { mtime } = video;
  const date = new Date(mtime);
  const day = date.getDate();
  const month = months[date.getMonth()].slice(0, 3);
  const dateAsString = `${day} ${month}`;
  return dateAsString;
};

/**
 * Get the human readable description of a device from its id. Returns
 * unknown if not an available device.
 *
 * @param id the device id
 * @param availableAudioDevices list of available sources from OBS
 */
const getAudioDeviceDescription = (
  id: string,
  availableAudioDevices: { input: IOBSDevice[]; output: IOBSDevice[] }
) => {
  let result = 'Unknown';

  availableAudioDevices.input.forEach((device) => {
    if (device.id === id) {
      result = device.description;
    }
  });

  availableAudioDevices.output.forEach((device) => {
    if (device.id === id) {
      result = device.description;
    }
  });

  return result;
};

/**
 * Check if an id represents an available audio device.
 *
 * @param id the device id
 * @param availableAudioDevices list of available sources from OBS
 */
const isKnownAudioDevice = (
  id: string,
  availableAudioDevices: { input: IOBSDevice[]; output: IOBSDevice[] }
) => {
  if (getAudioDeviceDescription(id, availableAudioDevices) === 'Unknown') {
    return false;
  }

  return true;
};

/**
 * Standardizes device names to an array of strings and filters by known devices.
 *
 * @param deviceNames the device names to standardize
 * @param availableAudioDevices list of available sources from OBS
 * @returns the standardized device names
 */
const standardizeAudioDeviceNames = (
  deviceNames: string[] | string,
  availableAudioDevices: { input: IOBSDevice[]; output: IOBSDevice[] }
): string[] => {
  let normalizedDeviceNames: string[];

  if (typeof deviceNames === 'string') {
    normalizedDeviceNames = deviceNames.split(',');
  } else {
    normalizedDeviceNames = deviceNames;
  }

  return normalizedDeviceNames.filter((id) =>
    isKnownAudioDevice(id, availableAudioDevices)
  );
};

const encoderFilter = (enc: string) => {
  return Object.values(ESupportedEncoders).includes(enc as ESupportedEncoders);
};

const mapEncoderToString = (enc: Encoder) => {
  return `${enc.type} (${enc.name})`;
};

const mapStringToEncoder = (enc: string): Encoder => {
  const encoder = enc as ESupportedEncoders;
  const isHardwareEncoder = encoder !== ESupportedEncoders.OBS_X264;

  const encoderType = isHardwareEncoder
    ? EncoderType.HARDWARE
    : EncoderType.SOFTWARE;

  return { name: enc, type: encoderType };
};

const pathSelect = async (): Promise<string> => {
  const ipc = window.electron.ipcRenderer;
  const path = await ipc.invoke('selectPath', []);
  return path;
};

export {
  getFormattedDuration,
  getVideoResult,
  addVideoMarkers,
  getWoWClassColor,
  getNumVideos,
  getTotalDuration,
  getLatestCategory,
  getSortedVideos,
  getEmptyState,
  getVideoResultText,
  getInstanceDifficultyText,
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
  getVideoTime,
  getVideoDate,
  getAudioDeviceDescription,
  isKnownAudioDevice,
  standardizeAudioDeviceNames,
  encoderFilter,
  mapEncoderToString,
  mapStringToEncoder,
  pathSelect,
};
