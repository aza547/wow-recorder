import {
  dungeonAffixesById,
  dungeonsByZoneId,
  raidEncountersById,
  raidInstances,
  retailArenas,
  retailBattlegrounds,
  specializationById,
} from 'main/constants';
import { RendererVideo } from 'main/types';
import { VideoCategory } from 'types/VideoCategory';
import {
  isArenaUtil,
  isBattlegroundUtil,
  isMythicPlusUtil,
  isRaidUtil,
} from './rendererutils';

/**
 * VideoFilter class.
 *
 * TO DO:
 * - Improve suggestions / autogenerate them
 * - Write UTs (lol)
 */
export default class VideoFilter {
  /**
   * Valid filters.
   */
  private filters: string[] = [];

  /**
   * The query the user has entered.
   */
  private query: string;

  /**
   * Video member variable.
   */
  private video: RendererVideo;

  /**
   * Constructor. This sets up the filters for a given video.
   *
   * @param query the string the user typed into the search
   * @param video the video we're checking the query against
   */
  constructor(query: string, video: RendererVideo) {
    this.query = query.toLowerCase();
    this.video = video;

    this.setGenericFilters();

    if (isArenaUtil(this.video)) {
      this.setArenaFilters();
    } else if (isRaidUtil(this.video)) {
      this.setRaidFilters();
    } else if (isMythicPlusUtil(this.video)) {
      this.setDungeonFilters();
    } else if (isBattlegroundUtil(this.video)) {
      this.setBattlegroundFilters();
    }
  }

  /**
   * Convienence function to add to the valid filters for this video, also handles
   * undefined inputs and splits on spaces.
   */
  private addStringFilter(string: string | undefined) {
    if (string === undefined) {
      return;
    }

    string
      .toLowerCase()
      .split(' ')
      .forEach((word) => this.filters.push(word));
  }

  /**
   * Set generic filters we want for every video regardless of category.
   */
  private setGenericFilters() {
    if (this.video.combatants) {
      this.video.combatants.forEach((combatant) => {
        this.addStringFilter(combatant._name);
        this.addStringFilter(combatant._realm);

        if (combatant._specID === undefined) {
          return;
        }

        const isKnownSpec = Object.prototype.hasOwnProperty.call(
          specializationById,
          combatant._specID
        );

        if (isKnownSpec) {
          this.addStringFilter(specializationById[combatant._specID].name);
          this.addStringFilter(specializationById[combatant._specID].label);
        }
      });
    }

    const videoDate = new Date(this.video.mtime);
    const currentDate = new Date();

    const isToday =
      videoDate.getDate() === currentDate.getDate() &&
      videoDate.getMonth() === currentDate.getMonth() &&
      videoDate.getFullYear() === currentDate.getFullYear();

    const isYesterday =
      videoDate.getDate() === currentDate.getDate() - 1 &&
      videoDate.getMonth() === currentDate.getMonth() &&
      videoDate.getFullYear() === currentDate.getFullYear();

    if (isToday) {
      this.addStringFilter('today');
    } else if (isYesterday) {
      this.addStringFilter('yesterday');
    }

    if (this.video.isProtected) {
      this.addStringFilter('bookmarked');
      this.addStringFilter('saved');
      this.addStringFilter('protected');
      this.addStringFilter('favourited favorited');
    }
  }

  /**
   * Set arena filters.
   */
  private setArenaFilters() {
    if (this.video.category === VideoCategory.SoloShuffle) {
      const wins = this.video.soloShuffleRoundsWon;
      const played = this.video.soloShuffleRoundsPlayed;

      if (wins !== undefined && played !== undefined) {
        const losses = played - wins;
        this.addStringFilter(`${wins}-${losses}}`);
        this.addStringFilter(`${wins}/${losses}}`);
        this.addStringFilter(`${wins}:${losses}}`);
      }
    } else if (this.video.result) {
      this.addStringFilter('win');
    } else {
      this.addStringFilter('loss');
    }

    if (this.video.zoneID !== undefined) {
      const isKnownArena = Object.prototype.hasOwnProperty.call(
        retailArenas,
        this.video.zoneID
      );

      if (isKnownArena) {
        this.addStringFilter(retailArenas[this.video.zoneID]);
      }
    }
  }

  /**
   * Set raid filters.
   */
  private setRaidFilters() {
    if (this.video.result) {
      this.addStringFilter('kill');
    } else {
      this.addStringFilter('wipe');
    }

    if (this.video.zoneID !== undefined) {
      raidInstances.forEach((raid) => {
        if (raid.zoneId === this.video.zoneID) {
          this.addStringFilter(raid.name);
        }
      });
    }

    if (this.video.encounterID !== undefined) {
      const knownEncounter = Object.prototype.hasOwnProperty.call(
        raidEncountersById,
        this.video.encounterID
      );

      if (knownEncounter) {
        this.addStringFilter(raidEncountersById[this.video.encounterID]);
      }
    }

    if (this.video.difficultyID === 17) {
      this.addStringFilter('lfr looking for raid');
    } else if (this.video.difficultyID === 14) {
      this.addStringFilter('normal');
    } else if (this.video.difficultyID === 15) {
      this.addStringFilter('heroic hc');
    } else if (this.video.difficultyID === 16) {
      this.addStringFilter('mythic');
    }
  }

  /**
   * Set dungeon filters.
   */
  private setDungeonFilters() {
    if (this.video.result) {
      this.addStringFilter('timed');
    } else {
      this.addStringFilter('depleted');
    }

    if (this.video.zoneID !== undefined) {
      const isKnownDungeon = Object.prototype.hasOwnProperty.call(
        dungeonsByZoneId,
        this.video.zoneID
      );

      if (isKnownDungeon) {
        this.addStringFilter(dungeonsByZoneId[this.video.zoneID]);
      }
    }

    if (this.video.level !== undefined) {
      this.addStringFilter(`+${this.video.level}`);
    }

    if (this.video.affixes) {
      this.video.affixes.forEach((affixID) => {
        const affixName = dungeonAffixesById[affixID];

        if (affixName) {
          this.addStringFilter(affixName);
        }
      });
    }
  }

  /**
   * Set battleground filters.
   */
  private setBattlegroundFilters() {
    if (this.video.result) {
      this.addStringFilter('win');
    } else {
      this.addStringFilter('loss');
    }

    if (this.video.zoneID !== undefined) {
      const isKnownBattleground = Object.prototype.hasOwnProperty.call(
        retailBattlegrounds,
        this.video.zoneID
      );

      if (isKnownBattleground) {
        this.addStringFilter(retailBattlegrounds[this.video.zoneID]);
      }
    }
  }

  /**
   * Decide if the video passes the query or not.
   */
  public filter() {
    if (this.query === '') {
      return true;
    }

    let show = true;

    this.query
      .toLowerCase()
      .split(' ')
      .forEach((query) => {
        const matches = this.filters.filter((s) => s.includes(query));

        if (matches.length === 0) {
          show = false;
        }
      });

    return show;
  }

  /**
   * Get some suggestions to show in the GUI.
   */
  static getSuggestions(category: VideoCategory) {
    if (category === VideoCategory.MythicPlus) {
      return 'Suggestions: timed temple yesterday +18 priest bookmarked fortified';
    }

    if (category === VideoCategory.Raids) {
      return 'Suggestions: kill today mythic destruction bookmarked';
    }

    if (category === VideoCategory.Battlegrounds) {
      return 'Suggestions: warsong gulch bookmarked';
    }

    if (category === VideoCategory.SoloShuffle) {
      return 'Suggestions: dalaran 6-0 bookmarked';
    }

    return 'Suggestions: win enigma crucible arcane bookmarked';
  }
}
