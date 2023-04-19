import {
  dungeonsByZoneId,
  raidEncountersById,
  raidInstances,
  retailArenas,
} from 'main/constants';
import { RendererVideo } from 'main/types';
import { VideoCategory } from 'types/VideoCategory';

/*
 * Type representing a filter.
 */
type FilterType = {
  base: string;
  values: string[];
  fn: (video: RendererVideo) => boolean;
};

/**
 * VideoFilter class.
 *
 * TO DO:
 * - Filters player names
 * - Filters for spec names
 * - Filters for BG names
 * - Improve suggestions / autogenerate them
 * - Write UTs (lol)
 */
export default class VideoFilter {
  /*
   * Array to hold all active filters.
   */
  private filters: FilterType[] = [];

  /*
   * This is an invalid filter, this trumps everything else and if true
   * any query will return no videos.
   */
  private invalid = false;

  /*
   * Filter for pvp wins.
   */
  private static pvpWinFilter: FilterType = {
    base: 'win',
    values: ['win', 'wins', 'won'],
    fn: (video: RendererVideo) => {
      return video.result === true;
    },
  };

  /*
   * Filter for pvp losses.
   */
  private static pvpLossFilter: FilterType = {
    base: 'loss',
    values: ['loss', 'lose', 'lost', 'loses'],
    fn: (video: RendererVideo) => {
      return video.result === false;
    },
  };

  /*
   * Filter for raid kills.
   */
  private static raidKillFilter: FilterType = {
    base: 'kill',
    values: ['kill', 'killed', 'kills'],
    fn: (video: RendererVideo) => {
      return video.result === true;
    },
  };

  /*
   * Filter for pvp losses.
   */
  private static raidWipeFilter: FilterType = {
    base: 'wipe',
    values: ['wipe', 'wiped', 'wipes'],
    fn: (video: RendererVideo) => {
      return video.result === false;
    },
  };

  /*
   * Filter for raid kills.
   */
  private static mythicPlusTimedFilter: FilterType = {
    base: 'timed',
    values: ['time', 'timed', 'finished', 'complete', 'success'],
    fn: (video: RendererVideo) => {
      return video.result === true;
    },
  };

  /*
   * Filter for pvp losses.
   */
  private static mythicPlusDepleteFilter: FilterType = {
    base: 'deplete',
    values: ['deplete', 'depleted', 'depletes'],
    fn: (video: RendererVideo) => {
      return video.result === false;
    },
  };

  /*
   * Filter for mythic+ keystone level.
   */
  private static mythicPlusLevelFilterFn = (n: number) => {
    return (video: RendererVideo) => video.level === n;
  };

  /*
   * Filters for dungeon names.
   */
  private static dungeonNameFilters: FilterType[] = Object.values(
    dungeonsByZoneId
  )
    .map((s) => s.toLowerCase())
    .map((dungeonName) => {
      // Convert the dungeon name to individual words and strip out
      // common words that are unhelpfully ambigous.
      const values = dungeonName
        .split(' ')
        .filter((s) => !['of', 'the', 'to', 'the'].includes(s));

      return {
        base: dungeonName,
        values,
        fn: (video: RendererVideo) => {
          if (video.zoneID === undefined) {
            return false;
          }

          const knownDungeon = Object.prototype.hasOwnProperty.call(
            dungeonsByZoneId,
            video.zoneID
          );

          if (!knownDungeon) {
            return false;
          }

          const knownDungeonName = dungeonsByZoneId[video.zoneID].toLowerCase();
          return knownDungeonName === dungeonName;
        },
      };
    });

  /*
   * Filters for arena names.
   */
  private static arenaNameFilters: FilterType[] = Object.values(retailArenas)
    .map((s) => s.toLowerCase())
    .map((arenaName) => {
      // Convert the dungeon name to individual words and strip out
      // common words that are unhelpfully ambigous.
      const values = arenaName
        .split(' ')
        .filter((s) => !['of', 'the', 'to', 'the'].includes(s));

      return {
        base: arenaName,
        values,
        fn: (video: RendererVideo) => {
          if (video.zoneID === undefined) {
            return false;
          }

          const knownArena = Object.prototype.hasOwnProperty.call(
            retailArenas,
            video.zoneID
          );

          if (!knownArena) {
            return false;
          }

          const knownArenaName = retailArenas[video.zoneID].toLowerCase();
          return knownArenaName === arenaName;
        },
      };
    });

  /*
   * Filters for boss names.
   */
  private static bossNameFilters: FilterType[] = Object.values(
    raidEncountersById
  )
    .map((bossName) => bossName.toLowerCase())
    .map((bossName) => {
      // Convert the dungeon name to individual words and strip out
      // common words that are unhelpfully ambigous.
      const values = bossName
        .split(' ')
        .filter((s) => !['of', 'the', 'to', 'the'].includes(s));

      return {
        base: bossName,
        values,
        fn: (video: RendererVideo) => {
          if (video.encounterID === undefined) {
            return false;
          }

          const knownBoss = Object.prototype.hasOwnProperty.call(
            raidEncountersById,
            video.encounterID
          );

          if (!knownBoss) {
            return false;
          }

          const knownBossName =
            raidEncountersById[video.encounterID].toLowerCase();
          return knownBossName === bossName;
        },
      };
    });

  /*
   * Filters for boss names.
   */
  private static raidNameFilters: FilterType[] = Object.values(
    raidInstances
  ).map((instance) => {
    const values = instance.name
      .split(' ')
      .map((s) => s.toLowerCase())
      .filter((s) => !['of', 'the', 'to', 'the'].includes(s));

    return {
      base: instance.name,
      values,
      fn: (video: RendererVideo) => {
        if (video.zoneID === undefined) {
          return false;
        }

        let knownRaidName = '';

        raidInstances.forEach((i) => {
          if (i.zoneId === video.zoneID) {
            knownRaidName = i.name.toLowerCase();
          }
        });

        return knownRaidName === instance.name.toLowerCase();
      },
    };
  });

  /*
   * Filter for lfr raid difficulty.
   */
  private static lfrRaidFilter: FilterType = {
    base: 'lfr',
    values: ['lfr'],
    fn: (video: RendererVideo) => {
      return video.difficultyID === 17;
    },
  };

  /*
   * Filter for normal raid difficulty.
   */
  private static normalRaidFilter: FilterType = {
    base: 'normal',
    values: ['normal', 'nm'],
    fn: (video: RendererVideo) => {
      return video.difficultyID === 14;
    },
  };

  /*
   * Filter for heroic raid difficulty.
   */
  private static heroicRaidFilter: FilterType = {
    base: 'heroic',
    values: ['heroic', 'hc'],
    fn: (video: RendererVideo) => {
      return video.difficultyID === 15;
    },
  };

  /*
   * Filter for mythic raid difficulty.
   */
  private static mythicRaidFilter: FilterType = {
    base: 'mythic',
    values: ['mythic'],
    fn: (video: RendererVideo) => {
      return video.difficultyID === 16;
    },
  };

  /*
   * Filter for if from today.
   */
  private static todayFilters: FilterType = {
    base: 'today',
    values: ['today', 'now'],
    fn: (video: RendererVideo) => {
      const currentDate = new Date();
      const videoDate = new Date(video.mtime);

      return (
        videoDate.getDate() === currentDate.getDate() &&
        videoDate.getMonth() === currentDate.getMonth() &&
        videoDate.getFullYear() === currentDate.getFullYear()
      );
    },
  };

  /*
   * Filter for if from yesterday.
   */
  private static yesterdayFilters: FilterType = {
    base: 'yesterday',
    values: ['yesterday', 'yday'],
    fn: (video: RendererVideo) => {
      const currentDate = new Date();
      const videoDate = new Date(video.mtime);

      return (
        videoDate.getDate() === currentDate.getDate() - 1 &&
        videoDate.getMonth() === currentDate.getMonth() &&
        videoDate.getFullYear() === currentDate.getFullYear()
      );
    },
  };

  /**
   * Constructor.
   *
   * @param category category the user has selected
   * @param query string the user inputs
   */
  constructor(category: VideoCategory, query: string) {
    if (query === '') {
      return;
    }

    // Split the input query but space and lowercase it.
    const filterArray = query
      .split(' ')
      .filter((s) => !(s === ''))
      .map((f) => f.toLowerCase());

    // Loop through all the possible filters.
    filterArray.forEach((filter: string) => {
      const initialFilterLength = this.filters.length;

      if (category === VideoCategory.Raids) {
        if (VideoFilter.raidKillFilter.values.includes(filter)) {
          this.filters.push(VideoFilter.raidKillFilter);
        }

        if (VideoFilter.raidWipeFilter.values.includes(filter)) {
          this.filters.push(VideoFilter.raidWipeFilter);
        }

        if (VideoFilter.lfrRaidFilter.values.includes(filter)) {
          this.filters.push(VideoFilter.lfrRaidFilter);
        }

        if (VideoFilter.normalRaidFilter.values.includes(filter)) {
          this.filters.push(VideoFilter.normalRaidFilter);
        }

        if (VideoFilter.heroicRaidFilter.values.includes(filter)) {
          this.filters.push(VideoFilter.heroicRaidFilter);
        }

        if (VideoFilter.mythicRaidFilter.values.includes(filter)) {
          this.filters.push(VideoFilter.mythicRaidFilter);
        }

        VideoFilter.bossNameFilters.forEach((bossNameFilter) => {
          bossNameFilter.values.forEach((s) => {
            if (s.includes(filter)) {
              this.filters.push(bossNameFilter);
            }
          });
        });

        VideoFilter.raidNameFilters.forEach((raidNameFilter) => {
          raidNameFilter.values.forEach((s) => {
            console.log(s, filter);
            if (s.includes(filter)) {
              this.filters.push(raidNameFilter);
            }
          });
        });
      } else if (category === VideoCategory.MythicPlus) {
        VideoFilter.dungeonNameFilters.forEach((dungeonNameFilter) =>
          dungeonNameFilter.values.forEach((s) => {
            if (s.includes(filter)) {
              this.filters.push(dungeonNameFilter);
            }
          })
        );

        // Try to match to a keystone level filter, e.g. "+15".
        const keystoneUpgradeMatch = filter.match(/\+(\d+)/);

        if (keystoneUpgradeMatch) {
          const level = parseInt(keystoneUpgradeMatch[1], 10);

          const newFilter: FilterType = {
            base: `+${level}`,
            values: [`+${level}`],
            fn: VideoFilter.mythicPlusLevelFilterFn(level),
          };

          this.filters.push(newFilter);
        }

        if (VideoFilter.mythicPlusTimedFilter.values.includes(filter)) {
          this.filters.push(VideoFilter.mythicPlusTimedFilter);
        }

        if (VideoFilter.mythicPlusDepleteFilter.values.includes(filter)) {
          this.filters.push(VideoFilter.mythicPlusDepleteFilter);
        }
      } else {
        if (VideoFilter.pvpWinFilter.values.includes(filter)) {
          this.filters.push(VideoFilter.pvpWinFilter);
        }

        if (VideoFilter.pvpLossFilter.values.includes(filter)) {
          this.filters.push(VideoFilter.pvpLossFilter);
        }
      }

      if (
        category === VideoCategory.TwoVTwo ||
        category === VideoCategory.ThreeVThree ||
        category === VideoCategory.FiveVFive ||
        category === VideoCategory.SoloShuffle ||
        category === VideoCategory.Skirmish
      ) {
        VideoFilter.arenaNameFilters.forEach((arenaNameFilter) => {
          arenaNameFilter.values.forEach((s) => {
            if (s.includes(filter)) {
              this.filters.push(arenaNameFilter);
            }
          });
        });
      }

      if (VideoFilter.todayFilters.values.includes(filter)) {
        this.filters.push(VideoFilter.todayFilters);
      }

      if (VideoFilter.yesterdayFilters.values.includes(filter)) {
        this.filters.push(VideoFilter.yesterdayFilters);
      }

      if (initialFilterLength === this.filters.length) {
        // Filters haven't changed so the user must have typed something invalid.
        this.invalid = true;
      }
    });
  }

  filter(video: RendererVideo) {
    console.log('filters', this.filters);

    if (this.invalid) {
      return false;
    }

    if (this.filters.length === 0) {
      return true;
    }

    let show = true;

    this.filters.forEach((filter) => {
      if (!filter.fn(video)) {
        show = false;
      }
    });

    return show;
  }

  static getSuggestions(category: VideoCategory) {
    if (category === VideoCategory.MythicPlus) {
      return 'Suggestions: timed temple yesterday +18';
    }

    if (category === VideoCategory.Raids) {
      return 'Suggestions: kill today mythic';
    }

    return 'Suggestions: win enigma crucible';
  }
}
