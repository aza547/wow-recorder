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
  mopChallengeModes,
  specializationById,
  WoWCharacterClassType,
  WoWClassColor,
} from 'main/constants';
import {
  TimelineSegmentType,
  RawChallengeModeTimelineSegment,
} from 'main/keystone';
import {
  MarkerColors,
  DeathMarkers,
  Encoder,
  EncoderType,
  PlayerDeathType,
  RendererVideo,
  SoloShuffleTimelineSegment,
  VideoMarker,
  RawCombatant,
  StorageFilter,
  Flavour,
  AudioSource,
  AppState,
} from 'main/types';
import { ambiguate } from 'parsing/logutils';
import { VideoCategory } from 'types/VideoCategory';
import { ESupportedEncoders } from 'main/obsEnums';
import {
  PTTEventType,
  PTTKeyPressEvent,
  UiohookKeyMap,
} from 'types/KeyTypesUIOHook';
import { ConfigurationSchema } from 'config/configSchema';
import { getLocalePhrase, Language } from 'localisation/translations';
import { Phrase } from 'localisation/phrases';

const getVideoResult = (video: RendererVideo): boolean => {
  return video.result;
};

/**
 * Returns a string of the form MM:SS.
 */
const getFormattedDuration = (video: RendererVideo) => {
  const { duration } = video;

  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = Math.round(duration % 60);

  const formattedHours = hours < 10 ? `0${hours}` : hours;
  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
  const formattedSeconds = seconds < 10 ? `0${seconds}` : seconds;

  if (hours > 0) {
    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
  }

  return `${formattedMinutes}:${formattedSeconds}`;
};

/**
 * Return an array of death markers for a video.
 * @param video the RendereVideo data type for the video
 */
const getOwnDeathMarkers = (video: RendererVideo, language: Language) => {
  const videoMarkers: VideoMarker[] = [];
  const { player } = video;

  if (video.deaths === undefined) {
    return videoMarkers;
  }

  video.deaths.forEach((death: PlayerDeathType) => {
    const [name] = ambiguate(death.name);

    let markerText = getLocalePhrase(language, Phrase.Death);
    markerText += ` (${name})`;
    let color: string;

    if (death.friendly) {
      color = MarkerColors.LOSS;
    } else {
      color = MarkerColors.WIN;
    }

    if (!player || !player._name) {
      return;
    }

    if (player._name === name) {
      videoMarkers.push({
        time: death.timestamp,
        text: markerText,
        color,
        duration: 5,
      });
    }
  });

  return videoMarkers;
};

/**
 * Return an array of death markers for a video.
 * @param video the RendereVideo data type for the video
 * @param ownOnly true if should only get the players deaths
 */
const getAllDeathMarkers = (video: RendererVideo, language: Language) => {
  const videoMarkers: VideoMarker[] = [];

  if (video.deaths === undefined) {
    return videoMarkers;
  }

  const groupedDeathsByTimestamp = video.deaths.reduce(
    (acc: Record<string, PlayerDeathType[]>, obj) => {
      const { timestamp } = obj;

      if (!acc[timestamp]) {
        acc[timestamp] = [];
      }

      acc[timestamp].push(obj);
      return acc;
    },
    {},
  );

  const singleDeaths = Object.entries(groupedDeathsByTimestamp)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(([_, arr]) => arr)
    .filter((arr) => arr.length === 1)
    .map((arr) => arr[0]);

  const simultaenousDeaths = Object.entries(groupedDeathsByTimestamp)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(([_, arr]) => arr)
    .filter((arr) => arr.length !== 1)
    .map((arr) => arr[0]);

  singleDeaths.forEach((death: PlayerDeathType) => {
    const [name] = ambiguate(death.name);
    let markerText = getLocalePhrase(language, Phrase.Death);
    markerText += ` (${name})`;
    let color: string;

    if (death.friendly) {
      color = MarkerColors.LOSS;
    } else {
      color = MarkerColors.WIN;
    }

    videoMarkers.push({
      time: death.timestamp,
      text: markerText,
      color,
      duration: 5,
    });
  });

  simultaenousDeaths.forEach((death: PlayerDeathType) => {
    let markerText = getLocalePhrase(language, Phrase.Death);
    markerText += ` (multiple)`;
    let color: string;

    if (death.friendly) {
      color = MarkerColors.LOSS;
    } else {
      color = MarkerColors.WIN;
    }

    videoMarkers.push({
      time: death.timestamp,
      text: markerText,
      color,
      duration: 5,
    });
  });

  return videoMarkers;
};

/**
 * Return an array of markers for a solo shuffle. This is markers for each
 * round, colored green for wins or red for losses.
 */
const getRoundMarkers = (video: RendererVideo) => {
  const videoMarkers: VideoMarker[] = [];

  if (video.soloShuffleTimeline === undefined) {
    return videoMarkers;
  }

  video.soloShuffleTimeline.forEach((segment: SoloShuffleTimelineSegment) => {
    let markerText = `Round ${segment.round}`;
    let color: string;

    if (segment.result) {
      markerText = `${markerText} (Win)`;
      color = MarkerColors.WIN;
    } else {
      markerText = `${markerText} (Loss)`;
      color = MarkerColors.LOSS;
    }

    // Older solo shuffle segments don't have a duration.
    const duration = segment.duration ? segment.duration : 5;

    videoMarkers.push({
      time: segment.timestamp,
      text: markerText,
      color,
      duration,
    });
  });

  return videoMarkers;
};

/**
 * Return an array of markers for a challenge mode, this highlights the boss
 * encounters as orange and the trash as purple.
 */
const getEncounterMarkers = (video: RendererVideo) => {
  const videoMarkers: VideoMarker[] = [];

  if (video.challengeModeTimeline === undefined) {
    return videoMarkers;
  }

  video.challengeModeTimeline.forEach(
    (segment: RawChallengeModeTimelineSegment) => {
      if (
        segment.logEnd === undefined ||
        segment.logStart === undefined ||
        segment.segmentType === undefined ||
        segment.segmentType !== TimelineSegmentType.BossEncounter ||
        segment.timestamp === undefined
      ) {
        return;
      }

      const segmentEnd = new Date(segment.logEnd);
      const segmentStart = new Date(segment.logStart);

      const segmentDuration = Math.floor(
        (segmentEnd.getTime() - segmentStart.getTime()) / 1000,
      );

      let markerText = '';

      if (segment.encounterId !== undefined) {
        markerText = dungeonEncounters[segment.encounterId];
      }

      videoMarkers.push({
        time: segment.timestamp,
        text: markerText,
        color: MarkerColors.ENCOUNTER,
        duration: segmentDuration,
      });
    },
  );

  return videoMarkers;
};

const getWoWClassColor = (unitClass: WoWCharacterClassType) => {
  return WoWClassColor[unitClass];
};

const getInstanceDifficultyText = (video: RendererVideo, lang: Language) => {
  const { difficultyID } = video;

  if (difficultyID === undefined) {
    return '';
  }

  const knownDifficulty = Object.prototype.hasOwnProperty.call(
    instanceDifficulty,
    difficultyID,
  );

  if (!knownDifficulty) {
    return '';
  }

  const { phrase } = instanceDifficulty[difficultyID];
  return getLocalePhrase(lang, phrase);
};

/**
 * Get the name of a boss encounter based on its encounter ID. Ideally we
 * would just write this to the metadata and not have to re-calulate on the
 * frontend.
 */
const getEncounterNameById = (encounterId: number): string => {
  const recognisedEncounter = Object.prototype.hasOwnProperty.call(
    instanceEncountersById,
    encounterId,
  );

  if (recognisedEncounter) {
    return instanceEncountersById[encounterId];
  }

  return 'Unknown Boss';
};

/**
 * Get the dungeon name if possible, else an empty string.
 */
const getDungeonName = (video: RendererVideo) => {
  const { mapID } = video;

  if (mapID === undefined) {
    return '';
  }

  if (video.flavour === Flavour.Retail) {
    return dungeonsByMapId[mapID];
  }

  if (video.flavour === Flavour.Classic) {
    return mopChallengeModes[mapID];
  }
};

const isMythicPlusUtil = (video: RendererVideo) => {
  const { category, parentCategory } = video;

  return (
    category === VideoCategory.MythicPlus ||
    parentCategory === VideoCategory.MythicPlus
  );
};

const isRaidUtil = (video: RendererVideo) => {
  const { category, parentCategory } = video;

  return (
    category === VideoCategory.Raids || parentCategory === VideoCategory.Raids
  );
};

const isBattlegroundUtil = (video: RendererVideo) => {
  const { category, parentCategory } = video;

  return (
    category === VideoCategory.Battlegrounds ||
    parentCategory === VideoCategory.Battlegrounds
  );
};

const isSoloShuffleUtil = (video: RendererVideo) => {
  const { category, parentCategory } = video;

  return (
    category === VideoCategory.SoloShuffle ||
    parentCategory === VideoCategory.SoloShuffle
  );
};

const isArenaUtil = (video: RendererVideo) => {
  return (
    !isMythicPlusUtil(video) && !isRaidUtil(video) && !isBattlegroundUtil(video)
  );
};

const isClip = (video: RendererVideo) => {
  const { category } = video;
  return category === VideoCategory.Clips;
};

const getResultColor = (video: RendererVideo) => {
  const { result, soloShuffleRoundsWon, upgradeLevel } = video;

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
        'rgb(53,  164, 50)',
        'rgb(46,  171, 27)',
        'rgb(112, 170, 30)',
        'rgb(171, 150, 30)',
        'rgb(171, 86,  26)',
        'rgb(175, 50,  23)',
        'rgb(156, 21,  21)',
      ].reverse();

      return soloShuffleResultColors[soloShuffleRoundsWon];
    }
  }

  if (
    isMythicPlusUtil(video) &&
    result &&
    upgradeLevel !== undefined &&
    upgradeLevel < 1
  ) {
    // It's a completed, but depleted mythic+.
    return 'hsl(var(--warning))';
  }

  if (result) {
    return 'hsl(var(--success))';
  }

  if (isRaidUtil(video)) {
    const bossPercent = raidResultToPercent(video);

    if (bossPercent !== undefined) {
      let color = '';

      if (bossPercent > 99) {
        color = '#ccc';
      } else if (bossPercent > 75) {
        color = '#0f8000';
      } else if (bossPercent > 50) {
        color = '#0070ff';
      } else if (bossPercent > 25) {
        color = '#a335ee';
      } else if (bossPercent > 5) {
        color = '#ff8000';
      } else {
        color = '#e268a8';
      }

      return color;
    }
  }

  return 'hsl(var(--error))';
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
    player._specID,
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

const getSpecClass = (specId: number | undefined): WoWCharacterClassType => {
  if (specId === undefined) {
    return 'UNKNOWN';
  }

  if (specializationById[specId] === undefined) {
    return 'UNKNOWN';
  }

  return specializationById[specId].class;
};

const getPlayerClass = (video: RendererVideo): WoWCharacterClassType => {
  const { player } = video;

  if (player === undefined) {
    return 'UNKNOWN';
  }

  return getSpecClass(player._specID);
};

const getVideoTime = (video: RendererVideo) => {
  const { start, mtime } = video;
  const date = start ? new Date(start) : new Date(mtime);

  const hours = date
    .getHours()
    .toLocaleString('en-US', { minimumIntegerDigits: 2 });

  const mins = date
    .getMinutes()
    .toLocaleString('en-US', { minimumIntegerDigits: 2 });

  const timeAsString = `${hours}:${mins}`;
  return timeAsString;
};

const videoToDate = (video: RendererVideo) => {
  let date;

  if (video.clippedAt) {
    date = new Date(video.clippedAt);
  } else if (video.start) {
    date = new Date(video.start);
  } else {
    date = new Date(video.mtime);
  }

  return date;
};

const dateToHumanReadable = (date: Date) => {
  const day = date.getDate();
  const month = months[date.getMonth()].slice(0, 3);
  // const year = date.getFullYear().toString().slice(2, 4);
  const dateAsString = `${day} ${month}`;

  const hours = date
    .getHours()
    .toLocaleString('en-US', { minimumIntegerDigits: 2 });

  const mins = date
    .getMinutes()
    .toLocaleString('en-US', { minimumIntegerDigits: 2 });

  const timeAsString = `${hours}:${mins}`;

  return `${timeAsString} ${dateAsString}`;
};

const getVideoDate = (video: RendererVideo) => {
  let date;

  if (video.clippedAt) {
    date = new Date(video.clippedAt);
  } else if (video.start) {
    date = new Date(video.start);
  } else {
    date = new Date(video.mtime);
  }

  const day = date.getDate();
  const month = months[date.getMonth()].slice(0, 3);
  const dateAsString = `${day} ${month}`;
  return dateAsString;
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
): string[] => {
  let normalizedDeviceNames: string[];

  if (typeof deviceNames === 'string') {
    normalizedDeviceNames = deviceNames.split(',');
  } else {
    normalizedDeviceNames = deviceNames;
  }

  return normalizedDeviceNames;
};

const isHighRes = (res: string) => {
  const resolutions = res.split('x');
  const [width, height] = resolutions;

  if (parseInt(width, 10) >= 4000 || parseInt(height, 10) >= 4000) {
    return true;
  }

  return false;
};

const encoderFilter = (enc: string, highRes: boolean) => {
  const encoder = enc as ESupportedEncoders;

  if (!Object.values(ESupportedEncoders).includes(encoder)) {
    return false;
  }

  // If we have a resolution above 4k, only the software and AV1 hardware encoders are valid.
  if (highRes) {
    return (
      encoder === ESupportedEncoders.OBS_X264 ||
      encoder === ESupportedEncoders.JIM_AV1_NVENC ||
      encoder === ESupportedEncoders.AMD_AMF_AV1
    );
  }

  return true;
};

const mapEncoderToString = (enc: Encoder, lang: Language) => {
  let encoderAsString = enc.name;

  switch (enc.type) {
    case EncoderType.HARDWARE:
      encoderAsString += ` (${getLocalePhrase(lang, Phrase.Hardware)})`;
      break;
    case EncoderType.SOFTWARE:
      encoderAsString += ` (${getLocalePhrase(lang, Phrase.Software)})`;
      break;
    default:
      break;
  }

  return encoderAsString;
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

const fileSelect = async (): Promise<string> => {
  const ipc = window.electron.ipcRenderer;
  const path = await ipc.invoke('selectFile', []);
  return path;
};

const convertNumToDeathMarkers = (n: number) => {
  if (n === 2) return DeathMarkers.ALL;
  if (n === 1) return DeathMarkers.OWN;
  return DeathMarkers.NONE;
};

const convertDeathMarkersToNum = (d: DeathMarkers) => {
  if (d === DeathMarkers.ALL) return 2;
  if (d === DeathMarkers.OWN) return 1;
  return 0;
};

const getPTTKeyPressEventFromConfig = (
  config: ConfigurationSchema,
): PTTKeyPressEvent => {
  const ctrl = config.pushToTalkModifiers.includes('ctrl');
  const win = config.pushToTalkModifiers.includes('win');
  const shift = config.pushToTalkModifiers.includes('shift');
  const alt = config.pushToTalkModifiers.includes('alt');

  const type =
    config.pushToTalkKey > 0
      ? PTTEventType.EVENT_KEY_PRESSED
      : PTTEventType.EVENT_MOUSE_PRESSED;

  return {
    altKey: alt,
    ctrlKey: ctrl,
    metaKey: win,
    shiftKey: shift,
    keyCode: config.pushToTalkKey,
    mouseButton: config.pushToTalkMouseButton,
    type,
  };
};

const getManualRecordHotKeyFromConfig = (
  config: ConfigurationSchema,
): PTTKeyPressEvent => {
  const ctrl = config.manualRecordHotKeyModifiers.includes('ctrl');
  const win = config.manualRecordHotKeyModifiers.includes('win');
  const shift = config.manualRecordHotKeyModifiers.includes('shift');
  const alt = config.manualRecordHotKeyModifiers.includes('alt');

  return {
    altKey: alt,
    ctrlKey: ctrl,
    metaKey: win,
    shiftKey: shift,
    keyCode: config.manualRecordHotKey,
    mouseButton: -1, // No mouse click support for manual record.
    type: PTTEventType.EVENT_KEY_PRESSED,
  };
};

const getKeyByValue = (object: any, value: any) => {
  return Object.keys(object).find((key) => object[key] === value);
};

const getKeyModifiersString = (keyevent: PTTKeyPressEvent) => {
  const modifiers: string[] = [];

  if (keyevent.altKey) {
    modifiers.push('alt');
  }
  if (keyevent.ctrlKey) {
    modifiers.push('ctrl');
  }
  if (keyevent.shiftKey) {
    modifiers.push('shift');
  }
  if (keyevent.metaKey) {
    modifiers.push('win');
  }

  return modifiers.join(',');
};

const getNextKeyOrMouseEvent = async (): Promise<PTTKeyPressEvent> => {
  const ipc = window.electron.ipcRenderer;
  return ipc.invoke('getNextKeyPress', []);
};

const secToMmSs = (s: number) => {
  const rounded = Math.round(s);
  const mins = Math.floor(rounded / 60);
  const secs = rounded - mins * 60;

  const ss = secs.toLocaleString('en-US', {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });

  const mm = mins.toLocaleString('en-US', {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });

  return `${mm}:${ss}`;
};

/**
 * Get a result text appropriate for the video category that signifies a
 * win or a loss, of some sort.
 */
const getVideoResultText = (
  video: RendererVideo,
  language: Language,
): string => {
  const {
    result,
    upgradeLevel,
    soloShuffleRoundsWon,
    soloShuffleRoundsPlayed,
  } = video;

  if (isMythicPlusUtil(video)) {
    if (!result) {
      return getLocalePhrase(language, Phrase.Abandoned);
    }

    if (upgradeLevel === undefined) {
      return '';
    }

    if (upgradeLevel < 1) {
      return getLocalePhrase(language, Phrase.Depleted);
    }

    return String(`+${upgradeLevel}`);
  }

  if (isRaidUtil(video)) {
    if (result) {
      return getLocalePhrase(language, Phrase.Kill);
    }

    const bossPercent = raidResultToPercent(video);

    if (bossPercent !== undefined) {
      return `${bossPercent}%`;
    }

    return getLocalePhrase(language, Phrase.Wipe);
  }

  if (isSoloShuffleUtil(video)) {
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

  return result
    ? getLocalePhrase(language, Phrase.Win)
    : getLocalePhrase(language, Phrase.Loss);
};

const getCategoryFromConfig = (config: ConfigurationSchema) => {
  const categories = Object.values(VideoCategory);
  return categories[config.selectedCategory];
};

const getCategoryIndex = (category: VideoCategory) => {
  const categories = Object.values(VideoCategory);
  return categories.indexOf(category);
};

const getVideoCategoryFilter = (category: VideoCategory) => {
  return (video: RendererVideo) => video.category === category;
};

const getVideoStorageFilter = (filter: StorageFilter) => {
  if (filter === StorageFilter.DISK) return (rv: RendererVideo) => !rv.cloud;
  if (filter === StorageFilter.CLOUD) return (rv: RendererVideo) => rv.cloud;
  return () => true;
};

const getFirstInCategory = (
  videos: RendererVideo[],
  category: VideoCategory,
) => {
  return videos.find((video) => video.category === category);
};

/**
 * Stop an event propogating higher.
 */
const stopPropagation = (event: React.MouseEvent<HTMLElement>) => {
  event.stopPropagation();
  event.preventDefault();
};

const povNameSort = (a: RendererVideo, b: RendererVideo) => {
  const playerA = a.player?._name;
  const playerB = b.player?._name;

  if (!playerA || !playerB) return 0;
  return playerA.localeCompare(playerB);
};

const povDiskFirstNameSort = (a: RendererVideo, b: RendererVideo) => {
  const diskA = !a.cloud;
  const diskB = !b.cloud;

  if (diskA && !diskB) {
    return -1;
  }

  if (diskB && !diskA) {
    return 1;
  }

  return povNameSort(a, b);
};

const povCloudFirstNameSort = (a: RendererVideo, b: RendererVideo) => {
  const diskA = !a.cloud;
  const diskB = !b.cloud;

  if (diskA && !diskB) {
    return 1;
  }

  if (diskB && !diskA) {
    return -1;
  }

  return povNameSort(a, b);
};

const combatantNameSort = (a: RawCombatant, b: RawCombatant) => {
  const playerA = a._name;
  const playerB = b._name;
  if (!playerA || !playerB) return 0;
  return playerA.localeCompare(playerB);
};

const areDatesWithinSeconds = (d1: Date, d2: Date, sec: number) => {
  const differenceMilliseconds = Math.abs(d1.getTime() - d2.getTime());
  return differenceMilliseconds <= sec * 1000;
};

const toFixedDigits = (n: number, d: number) =>
  n.toLocaleString('en-US', { minimumIntegerDigits: d, useGrouping: false });

const getPullNumber = (video: RendererVideo, videoState: RendererVideo[]) => {
  const videoDate = video.start ? new Date(video.start) : new Date(video.mtime);

  const dailyVideosInOrder: RendererVideo[] = [];

  const raidCategoryState = videoState.filter(
    (video) => video.category === VideoCategory.Raids,
  );

  raidCategoryState.forEach((neighbourVideo) => {
    const bestDate = neighbourVideo.start
      ? neighbourVideo.start
      : neighbourVideo.mtime;

    const neighbourDate = new Date(bestDate);

    // Pulls longer than 6 hours apart are considered from different
    // sessions and will reset the pull counter.
    //
    // This logic is really janky and should probably be rewritten. The
    // problem here is that if checks for any videos within 6 hours.
    //
    // If there are videos on the border (e.g. day raiding) then the
    // pull count can do weird things like decrement or not increment given
    // the right timing conditions of the previous sessions raids.
    const withinThreshold = areDatesWithinSeconds(
      videoDate,
      neighbourDate,
      3600 * 6,
    );

    if (
      video.encounterID === undefined ||
      neighbourVideo.encounterID === undefined
    ) {
      return;
    }

    const sameEncounter = video.encounterID === neighbourVideo.encounterID;

    if (
      video.difficultyID === undefined ||
      neighbourVideo.difficultyID === undefined
    ) {
      return;
    }

    const sameDifficulty = video.difficultyID === neighbourVideo.difficultyID;

    if (withinThreshold && sameEncounter && sameDifficulty) {
      dailyVideosInOrder.push(neighbourVideo);
    }
  });

  dailyVideosInOrder.sort((A: RendererVideo, B: RendererVideo) => {
    const bestTimeA = A.start ? A.start : A.mtime;
    const bestTimeB = B.start ? B.start : B.mtime;
    return bestTimeA - bestTimeB;
  });

  return dailyVideosInOrder.indexOf(video) + 1;
};

const countUniqueViewpoints = (video: RendererVideo) => {
  const povs = [video, ...video.multiPov];

  const unique = povs.filter(
    (item, index, self) =>
      self.findIndex((i) => i.player?._name === item.player?._name) === index,
  );

  return unique.length;
};

const raidResultToPercent = (video: RendererVideo) => {
  if (video.result) {
    // For the sake of sorting. A kill should win over a 0% wipe.
    // We should never display -1 on the UI though.
    return -1;
  }

  // Look for the boss percent in any of the viewpoints. That is really
  // just to make this nicer over upgrade of the app; this way we will
  // show the percent if it exists on any video and not just the first one.
  const bossPercent = [video, ...video.multiPov]
    .map((rv) => rv.bossPercent)
    .find((bp) => typeof bp === 'number');

  return bossPercent;
};

// Retrieve the available choices for this source from libobs.
const fetchAudioSourceChoices = async (src: AudioSource) => {
  const ipc = window.electron.ipcRenderer;
  const properties = await ipc.getAudioSourceProperties(src.id);

  const devices = properties.find(
    (prop) => prop.name === 'device_id' || prop.name === 'window',
  );

  if (!devices || devices.type !== 'list') {
    return [];
  }

  return devices.items;
};

const getKeyPressEventString = (
  event: PTTKeyPressEvent,
  appState: AppState,
) => {
  const keys: string[] = [];

  if (event.altKey) keys.push('Alt');
  if (event.ctrlKey) keys.push('Ctrl');
  if (event.shiftKey) keys.push('Shift');
  if (event.metaKey) keys.push('Win');

  const { keyCode, mouseButton } = event;

  if (keyCode > 0) {
    const key = getKeyByValue(UiohookKeyMap, keyCode);
    if (key !== undefined) keys.push(key);
  } else if (mouseButton > 0) {
    keys.push(
      `${getLocalePhrase(appState.language, Phrase.Mouse)} ${
        event.mouseButton
      }`,
    );
  }

  return keys.join('+');
};

export {
  getFormattedDuration,
  getVideoResult,
  getWoWClassColor,
  getVideoResultText,
  getInstanceDifficultyText,
  getEncounterNameById,
  getDungeonName,
  isMythicPlusUtil,
  isRaidUtil,
  isBattlegroundUtil,
  isSoloShuffleUtil,
  isArenaUtil,
  isClip,
  getResultColor,
  getPlayerName,
  getPlayerRealm,
  getPlayerSpecID,
  getPlayerTeamID,
  getPlayerClass,
  getVideoTime,
  getVideoDate,
  standardizeAudioDeviceNames,
  encoderFilter,
  mapEncoderToString,
  mapStringToEncoder,
  pathSelect,
  fileSelect,
  convertNumToDeathMarkers,
  convertDeathMarkersToNum,
  getAllDeathMarkers,
  getOwnDeathMarkers,
  getRoundMarkers,
  getEncounterMarkers,
  isHighRes,
  getPTTKeyPressEventFromConfig,
  getManualRecordHotKeyFromConfig,
  getKeyByValue,
  getKeyModifiersString,
  getNextKeyOrMouseEvent,
  secToMmSs,
  getCategoryFromConfig,
  getVideoCategoryFilter,
  getCategoryIndex,
  getFirstInCategory,
  stopPropagation,
  povCloudFirstNameSort,
  povDiskFirstNameSort,
  areDatesWithinSeconds,
  toFixedDigits,
  getPullNumber,
  combatantNameSort,
  countUniqueViewpoints,
  videoToDate,
  dateToHumanReadable,
  getSpecClass,
  raidResultToPercent,
  getVideoStorageFilter,
  fetchAudioSourceChoices,
  getKeyPressEventString,
};
