import {
  dungeonAffixesById,
  dungeonsByZoneId,
  raidEncountersById,
  raidInstances,
  retailArenas,
  retailBattlegrounds,
  specializationById,
} from 'main/constants';
import { Flavour, RendererVideo } from 'main/types';
import { VideoCategory } from 'types/VideoCategory';
import {
  isArenaUtil,
  isBattlegroundUtil,
  isMythicPlusUtil,
  isRaidUtil,
  getVideoDate,
  getPlayerClass,
  getWoWClassColor,
  getPlayerSpecID,
} from './rendererutils';
import { Tag } from 'react-tag-autocomplete';
import { specImages } from './images';

/**
 * VideoFilter class. This is one of the only places where we don't
 * handle localisation through the localisation infrastructure. It's
 * easier to just add all the languages into this class.
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
   * The lead video, used to determine the high level details.
   */
  private video: RendererVideo;

  /**
   * The POVs included in this video.
   */
  private povs: RendererVideo[];

  /**
   * Constructor. This sets up the filters for a given video.
   *
   * @param query the string the user typed into the search
   * @param video the video we're checking the query against
   */
  constructor(tags: Tag[], video: RendererVideo) {
    this.query = tags
      .map((t) => t.value)
      .filter((v): v is string => !!v)
      .map((v) => v.split('   ')[1])
      .map((t) => t.toString())
      .map((v) => v.toLowerCase())
      .join(' ');

    this.video = video;
    this.povs = [video, ...video.multiPov];

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
   * If the player is named in the video metadata, add a search filter for
   * the name and spec.
   */
  private setNameFilter(video: RendererVideo) {
    if (!video.player) {
      return;
    }

    const { player } = video;

    if (player._specID) {
      const isKnownSpec = Object.prototype.hasOwnProperty.call(
        specializationById,
        player._specID,
      );

      if (isKnownSpec) {
        this.addStringFilter(specializationById[player._specID].name);
        this.addStringFilter(specializationById[player._specID].label);
      }
    }

    this.addStringFilter(player._name);
  }

  /**
   * If the video is protected, add some key words to the filter.
   */
  private setProtectedFilter(video: RendererVideo) {
    if (video.isProtected) {
      this.addStringFilter('starred');
      this.addStringFilter('bookmarked');
      this.addStringFilter('saved');
      this.addStringFilter('protected');
      this.addStringFilter('favorited');
      this.addStringFilter('favourited');
      this.addStringFilter('북마크');
      this.addStringFilter('lezezeichen');
    }
  }

  /**
   * If the video is tagged, add the tag to the filter.
   */
  private setTagFilter(video: RendererVideo) {
    if (video.tag) {
      // Split all the words in the tag on whitespace, remove non-letter
      // characters from all the words to exclude punctuation and add
      // as filters.
      video.tag
        .split(/[\s+]/)
        .map((word) => word.replace(/[^가-힣a-zA-Z]/g, ''))
        .filter((word) => word)
        .forEach((word) => this.addStringFilter(word));
    }
  }

  /**
   * Set generic filters we want for every video regardless of category.
   */
  private setGenericFilters() {
    this.povs.forEach((pov) => this.setNameFilter(pov));
    this.povs.forEach((pov) => this.setProtectedFilter(pov));
    this.povs.forEach((pov) => this.setTagFilter(pov));

    const dateStr = getVideoDate(this.video);
    this.addStringFilter(dateStr);

    const currentDate = new Date();
    const videoDate = this.video.start
      ? new Date(this.video.start)
      : new Date(this.video.mtime);

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
      this.addStringFilter('오늘');
      this.addStringFilter('heute');
    } else if (isYesterday) {
      this.addStringFilter('yesterday');
      this.addStringFilter('어제');
      this.addStringFilter('gestern');
    }

    if (this.video.flavour === Flavour.Retail) {
      this.addStringFilter('retail');
    } else if (this.video.flavour === Flavour.Classic) {
      this.addStringFilter('classic');
    }

    if (this.video.combatants) {
      this.video.combatants.forEach((combatant) => {
        this.addStringFilter(combatant._name);
        this.addStringFilter(combatant._realm);

        if (combatant._specID === undefined) {
          return;
        }

        const isKnownSpec = Object.prototype.hasOwnProperty.call(
          specializationById,
          combatant._specID,
        );

        if (isKnownSpec) {
          this.addStringFilter(specializationById[combatant._specID].name);
          this.addStringFilter(specializationById[combatant._specID].label);
        }
      });
    }

    if (this.video.cloud) {
      this.addStringFilter('cloud');
      this.addStringFilter('pro');
    } else {
      this.addStringFilter('disk');
      this.addStringFilter('local');
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
        this.addStringFilter(`${wins}-${losses}`);
        this.addStringFilter(`${wins}/${losses}`);
        this.addStringFilter(`${wins}:${losses}`);
        this.addStringFilter(`${wins}대${losses}`);
        this.addStringFilter(`${wins}승${losses}패`);
        this.addStringFilter(`${wins}승`);
        this.addStringFilter(`${losses}패`);
      }
    } else if (this.video.result) {
      this.addStringFilter('win');
      this.addStringFilter('승리');
      this.addStringFilter('sieg');
    } else {
      this.addStringFilter('loss');
      this.addStringFilter('패배');
      this.addStringFilter('niederlage');
    }

    if (this.video.zoneID !== undefined) {
      const isKnownArena = Object.prototype.hasOwnProperty.call(
        retailArenas,
        this.video.zoneID,
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
      this.addStringFilter('킬');
      this.addStringFilter('sieg');
    } else {
      this.addStringFilter('wipe');
      this.addStringFilter('전멸');
      this.addStringFilter('niederlage');
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
        this.video.encounterID,
      );

      if (knownEncounter) {
        this.addStringFilter(raidEncountersById[this.video.encounterID]);
      }
    }

    if (this.video.encounterName !== undefined) {
      this.addStringFilter(this.video.encounterName);
    }

    if (this.video.difficultyID === 17) {
      this.addStringFilter('lfr looking for raid');
      this.addStringFilter('공찾');
      this.addStringFilter('Raid Finder');
    } else if (this.video.difficultyID === 14) {
      this.addStringFilter('normal');
      this.addStringFilter('일반');
    } else if (this.video.difficultyID === 15) {
      this.addStringFilter('heroic hc');
      this.addStringFilter('영웅');
      this.addStringFilter('heroisch');
    } else if (this.video.difficultyID === 16) {
      this.addStringFilter('mythic');
      this.addStringFilter('신화');
      this.addStringFilter('mythisch');
    }
  }

  /**
   * Set dungeon filters.
   */
  private setDungeonFilters() {
    if (!this.video.result) {
      this.addStringFilter('abandoned');
      this.addStringFilter('탈주');
      this.addStringFilter('abgebrochen');
    } else if (
      this.video.upgradeLevel !== undefined &&
      this.video.upgradeLevel < 1
    ) {
      this.addStringFilter('depleted');
      this.addStringFilter('소진');
    } else if (
      this.video.upgradeLevel !== undefined &&
      this.video.upgradeLevel > 0
    ) {
      this.addStringFilter('timed');
      this.addStringFilter('완료');
    }

    if (this.video.zoneID !== undefined) {
      const isKnownDungeon = Object.prototype.hasOwnProperty.call(
        dungeonsByZoneId,
        this.video.zoneID,
      );

      if (isKnownDungeon) {
        this.addStringFilter(dungeonsByZoneId[this.video.zoneID]);
      }
    }

    if (this.video.keystoneLevel !== undefined) {
      this.addStringFilter(`+${this.video.keystoneLevel}`);
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
      this.addStringFilter('승리');
      this.addStringFilter('sieg');
    } else {
      this.addStringFilter('loss');
      this.addStringFilter('패배');
      this.addStringFilter('niederlage');
    }

    if (this.video.zoneID !== undefined) {
      const isKnownBattleground = Object.prototype.hasOwnProperty.call(
        retailBattlegrounds,
        this.video.zoneID,
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
  static getSuggestions(categoryState: RendererVideo[]) {
    const category = categoryState[0].category;
    const suggestions: Tag[] = [];

    categoryState.forEach((video) => {
      const playerClass = getPlayerClass(video);
      const playerSpec = getPlayerSpecID(video);
      const playerClassColor = getWoWClassColor(playerClass);
      const specIcon = specImages[playerSpec as keyof typeof specImages];

      if (video.player && video.player._name) {
        const suggestion: Tag = {
          // A limitation of the react-tag-autocomplete library is that it doesn't allow
          // for custom class types, so to avoid upsetting typescript we pass some info
          // as part of the value; speically that is the icon and color of the tag.
          value: `character   ${video.player._name}   ${specIcon}   ${playerClassColor}`,
          label: video.player._name,
        };
        suggestions.push(suggestion);
      }

      if (video.encounterName) {
        const suggestion: Tag = {
          value: `encounter   ${video.encounterName}   ${specImages[0]}   #bb4420`,
          label: video.encounterName,
        };
        suggestions.push(suggestion);
      }
    });

    const uniqueSuggestions = Array.from(
      new Map(suggestions.map((item) => [item.label, item])).values(),
    );

    //TODO:
    // - Results
    // - Dates
    // - Encounters
    // - Protected
    // - Tagged
    // - Flavour
    // - Cloud / Disk

    return uniqueSuggestions;
  }
}
