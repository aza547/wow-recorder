import {
  dungeonsByZoneId,
  instanceNamesByZoneId,
  specializationById,
} from 'main/constants';
import { Flavour, RendererVideo } from 'main/types';
import {
  isArenaUtil,
  isBattlegroundUtil,
  isMythicPlusUtil,
  isRaidUtil,
  getPlayerClass,
  getWoWClassColor,
  getPlayerSpecID,
  getPlayerName,
} from './rendererutils';
import { Tag, TagSuggestion } from 'react-tag-autocomplete';
import { specImages } from './images';

/**
 * The VideoFilter class provides a mechanism to populate the search
 * suggestions, as well as filter the list of videos based on the
 * user's search query.
 */
export default class VideoFilter {
  /**
   * A list of strings in the filter query.
   */
  private query: string[];

  /**
   * A list of query matches for this video.
   */
  private matches: string[];

  /**
   * Constructor. This sets up the query for a given video. Typical usage
   * is to call filter after this to decide if the video should be filtered
   * or not.
   */
  constructor(tags: Tag[], video: RendererVideo) {
    this.query = tags
      .map((tag) => tag.value)
      .filter((tag) => typeof tag === 'string');

    this.matches = VideoFilter.getVideoSuggestions(video)
      .map((tag) => tag.value)
      .filter((tag) => typeof tag === 'string');
  }

  /**
   * Perform the filter; check that every entry in the query matches a search
   * suggestion for this video.
   */
  public filter() {
    return this.query.every((s) => this.matches.includes(s));
  }

  /**
   * Get all the possible matches for an entire category.
   */
  public static getCategorySuggestions(state: RendererVideo[]) {
    const suggestions: Tag[] = [];

    state.forEach((video) => {
      const videoTagSuggestions = this.getVideoSuggestions(video);
      suggestions.push(...videoTagSuggestions);
    });

    const unique = Array.from(
      new Map(suggestions.map((item) => [item.label, item])).values(),
    );

    return unique;
  }

  /**
   * Get all the possible matches for a video.
   */
  private static getVideoSuggestions(video: RendererVideo) {
    const suggestions: TagSuggestion[] = [];
    suggestions.push(...this.getGenericSuggestions(video));

    if (isArenaUtil(video) || isBattlegroundUtil(video)) {
      suggestions.push(...this.getPvpSuggestions(video));
    } else if (isRaidUtil(video)) {
      suggestions.push(...this.getRaidSuggestions(video));
    } else if (isMythicPlusUtil(video)) {
      suggestions.push(...this.getDungeonSuggestions(video));
    }

    return suggestions;
  }

  /**
   * Get the generic matches for a video; that is the ones that do not
   * depend on category.
   */
  private static getGenericSuggestions(video: RendererVideo) {
    const suggestions: TagSuggestion[] = [];

    const playerName = getPlayerName(video);
    const playerClass = getPlayerClass(video);
    const playerSpecID = getPlayerSpecID(video);
    const playerClassColor = getWoWClassColor(playerClass);
    const specIcon = specImages[playerSpecID as keyof typeof specImages];

    if (playerName) {
      suggestions.push({
        value: `character   ${playerName}   ${specIcon}   ${playerClassColor}`,
        label: playerName,
      });
    }

    if (playerSpecID) {
      const specName = specializationById[playerSpecID].name;

      suggestions.push({
        value: `spec   ${specName}   ${specIcon}   ${playerClassColor}`,
        label: specName,
      });
    }

    if (video.cloud) {
      suggestions.push({
        value: `storage   cloud   <CloudIcon>   #bb4420`,
        label: 'Cloud',
      });
    } else {
      suggestions.push({
        value: `storage   disk   <SaveIcon>   #bb4420`,
        label: 'Disk',
      });
    }

    if (video.flavour === Flavour.Retail) {
      suggestions.push({
        value: `flavour   Retail   ${specImages[0]}   #bb4420`,
        label: 'Retail',
      });
    } else if (video.flavour === Flavour.Classic) {
      suggestions.push({
        value: `flavour   Classic   ${specImages[0]}   #bb4420`,
        label: 'Classic',
      });
    }

    if (video.protected) {
      suggestions.push({
        value: `metadata   Starred   <StarIcon>   #bb4420`,
        label: 'Starred',
      });
    }

    if (video.tag) {
      suggestions.push({
        value: `metadata   Tagged   <TagIcon>   #bb4420`,
        label: 'Tagged',
      });
    }

    if (video.zoneID) {
      const isKnownZone = Object.prototype.hasOwnProperty.call(
        instanceNamesByZoneId,
        video.zoneID,
      );

      if (isKnownZone) {
        const zone = instanceNamesByZoneId[video.zoneID];
        suggestions.push({
          value: `zone   ${zone}   ${specImages[0]}   #bb4420`,
          label: zone,
        });
      }
    }

    const currentDate = new Date();

    const videoDate = video.start
      ? new Date(video.start)
      : new Date(video.mtime);

    const isToday =
      videoDate.getDate() === currentDate.getDate() &&
      videoDate.getMonth() === currentDate.getMonth() &&
      videoDate.getFullYear() === currentDate.getFullYear();

    const isYesterday =
      videoDate.getDate() === currentDate.getDate() - 1 &&
      videoDate.getMonth() === currentDate.getMonth() &&
      videoDate.getFullYear() === currentDate.getFullYear();

    if (isToday) {
      suggestions.push({
        value: `date   Today   <CalendarDays>   #bb4420`,
        label: 'Today',
      });
    }

    if (isYesterday) {
      suggestions.push({
        value: `date   Yesterday   <CalendarDays>   #bb4420`,
        label: 'Yesterday',
      });
    }

    return suggestions;
  }

  /**
   * Get the matches for a dungeon video.
   */
  private static getDungeonSuggestions(video: RendererVideo) {
    // TODO keystone level
    // TODO affixes
    const suggestions: TagSuggestion[] = [];

    if (video.zoneID) {
      const isKnownDungeon = Object.prototype.hasOwnProperty.call(
        dungeonsByZoneId,
        video.zoneID,
      );

      if (isKnownDungeon) {
        const dungeon = dungeonsByZoneId[video.zoneID];
        suggestions.push({
          value: `dungeon   ${dungeon}   ${specImages[0]}   #bb4420`,
          label: dungeon,
        });
      }
    }

    if (!video.result) {
      suggestions.push({
        value: `result   Abandoned   ${specImages[0]}   red`,
        label: 'Abandoned',
      });
    } else if (video.upgradeLevel && video.upgradeLevel > 0) {
      suggestions.push({
        value: `result   ${video.upgradeLevel} Chest   ${specImages[0]}   green`,
        label: `${video.upgradeLevel} Chest`,
      });

      suggestions.push({
        value: `result   Timed   ${specImages[0]}   green`,
        label: `Timed`,
      });
    } else {
      suggestions.push({
        value: `result   Depleted   ${specImages[0]}   yellow`,
        label: 'Depleted',
      });
    }

    return suggestions;
  }

  /**
   * Get the matches for a raid video.
   */
  private static getRaidSuggestions(video: RendererVideo) {
    const suggestions: TagSuggestion[] = [];

    if (video.encounterName) {
      suggestions.push({
        value: `encounter   ${video.encounterName}   <DragonIcon>   #bb4420`,
        label: video.encounterName,
      });
    }

    if (video.result) {
      suggestions.push({
        value: `result   Kill   ${specImages[0]}   #bb4420`,
        label: 'Kill',
      });
    } else {
      suggestions.push({
        value: `result   Wipe   ${specImages[0]}   #bb4420`,
        label: 'Wipe',
      });
    }

    if (video.difficultyID === 17) {
      suggestions.push({
        value: `difficulty   Raid Finder   ${specImages[0]}   #bb4420`,
        label: 'Raid Finder',
      });
    } else if (video.difficultyID === 14) {
      suggestions.push({
        value: `difficulty   Normal   ${specImages[0]}   #bb4420`,
        label: 'Normal',
      });
    } else if (video.difficultyID === 15) {
      suggestions.push({
        value: `difficulty   Heroic   ${specImages[0]}   #bb4420`,
        label: 'Heroic',
      });
    } else if (video.difficultyID === 16) {
      suggestions.push({
        value: `difficulty   Mythic   ${specImages[0]}   #bb4420`,
        label: 'Mythic',
      });
    }

    return suggestions;
  }

  /**
   * Get the matches for a PvP video; that is arenas and battlegrounds,
   * which are basically the same in the context of search filters.
   */
  private static getPvpSuggestions(video: RendererVideo) {
    const suggestions: TagSuggestion[] = [];

    if (video.result) {
      suggestions.push({
        value: `result   Win   ${specImages[0]}   #bb4420`,
        label: 'Win',
      });
    } else {
      suggestions.push({
        value: `result   Loss   ${specImages[0]}   #bb4420`,
        label: 'Loss',
      });
    }

    return suggestions;
  }
}
