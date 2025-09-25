import Combatant from '../main/Combatant';

import {
  currentRetailEncounters,
  dungeonEncounters,
  dungeonsByMapId,
  dungeonTimersByMapId,
  instanceDifficulty,
  retailBattlegrounds,
  retailUniqueSpecSpells,
} from '../main/constants';

import ArenaMatch from '../activitys/ArenaMatch';
import LogHandler from './LogHandler';
import Battleground from '../activitys/Battleground';
import ChallengeModeDungeon from '../activitys/ChallengeModeDungeon';

import {
  ChallengeModeTimelineSegment,
  TimelineSegmentType,
} from '../main/keystone';

import { Flavour } from '../main/types';
import SoloShuffle from '../activitys/SoloShuffle';
import LogLine from './LogLine';
import { VideoCategory } from '../types/VideoCategory';
import { isUnitSelf } from './logutils';
import ConfigService from 'config/ConfigService';

/**
 * RetailLogHandler class.
 */
export default class RetailLogHandler extends LogHandler {
  private isPtr = false;

  constructor(logPath: string) {
    super(logPath, 2);

    this.combatLogWatcher
      .on('ENCOUNTER_START', async (line: LogLine) => {
        await this.handleEncounterStartLine(line);
      })
      .on('ENCOUNTER_END', async (line: LogLine) => {
        await this.handleEncounterEndLine(line);
      })
      .on('ZONE_CHANGE', async (line: LogLine) => {
        await this.handleZoneChange(line);
      })
      .on('SPELL_AURA_APPLIED', (line: LogLine) => {
        this.handleSpellAuraAppliedLine(line);
      })
      .on('UNIT_DIED', (line: LogLine) => {
        this.handleUnitDiedLine(line);
      })
      .on('ARENA_MATCH_START', async (line: LogLine) => {
        await this.handleArenaStartLine(line);
      })
      .on('ARENA_MATCH_END', async (line: LogLine) => {
        await this.handleArenaEndLine(line);
      })
      .on('CHALLENGE_MODE_START', async (line: LogLine) => {
        await this.handleChallengeModeStartLine(line);
      })
      .on('CHALLENGE_MODE_END', async (line: LogLine) => {
        await this.handleChallengeModeEndLine(line);
      })
      .on('COMBATANT_INFO', async (line: LogLine) => {
        this.handleCombatantInfoLine(line);
      })
      .on('SPELL_CAST_SUCCESS', async (line: LogLine) => {
        this.handleSpellCastSuccess(line);
      })
      .on('SPELL_DAMAGE', async (line: LogLine) => {
        this.handleSpellDamage(line);
      });
  }

  public setIsPtr() {
    this.isPtr = true;
  }

  private async handleArenaStartLine(line: LogLine) {
    console.debug('[RetailLogHandler] Handling ARENA_MATCH_START line:', line);

    // Important we don't exit if we're in a Solo Shuffle, we use the ARENA_MATCH_START
    // events to keep track of the rounds.
    if (
      LogHandler.activity &&
      LogHandler.activity.category !== VideoCategory.SoloShuffle
    ) {
      console.error(
        '[RetailLogHandler] Another activity in progress and not a Solo Shuffle',
      );
      return;
    }

    const startTime = line.date();
    const zoneID = parseInt(line.arg(1), 10);
    const arenaType = line.arg(3);
    let category;

    if (arenaType === 'Rated Solo Shuffle') {
      category = VideoCategory.SoloShuffle;
    } else if (arenaType === '2v2') {
      category = VideoCategory.TwoVTwo;
    } else if (arenaType === '3v3') {
      category = VideoCategory.ThreeVThree;
    } else if (arenaType === '5v5') {
      // For some bizzare reason, 3v3 retail war games are logged as 5v5.
      // Thanks Blizz - https://github.com/aza547/wow-recorder/issues/285.
      category = VideoCategory.ThreeVThree;
    } else if (arenaType === 'Skirmish') {
      category = VideoCategory.Skirmish;
    } else {
      console.error(
        '[RetailLogHandler] Unrecognised arena category:',
        arenaType,
      );
      return;
    }

    if (!LogHandler.activity && category === VideoCategory.SoloShuffle) {
      console.info('[RetailLogHandler] Fresh Solo Shuffle game starting');
      const activity = new SoloShuffle(startTime, zoneID);
      await LogHandler.startActivity(activity);
    } else if (LogHandler.activity && category === VideoCategory.SoloShuffle) {
      console.info(
        '[RetailLogHandler] New round of existing Solo Shuffle starting',
      );
      const soloShuffle = LogHandler.activity as SoloShuffle;
      soloShuffle.startRound(startTime);
    } else {
      console.info('[RetailLogHandler] New', category, 'arena starting');

      const activity = new ArenaMatch(
        startTime,
        category,
        zoneID,
        Flavour.Retail,
      );

      await LogHandler.startActivity(activity);
    }
  }

  private async handleArenaEndLine(line: LogLine) {
    console.debug('[RetailLogHandler] Handling ARENA_MATCH_END line:', line);

    if (!LogHandler.activity) {
      console.error('[RetailLogHandler] Arena stop with no active arena match');
      return;
    }

    if (LogHandler.activity.category === VideoCategory.SoloShuffle) {
      const soloShuffle = LogHandler.activity as SoloShuffle;
      soloShuffle.endGame(line.date());
      await LogHandler.endActivity();
    } else {
      const arenaMatch = LogHandler.activity as ArenaMatch;
      const endTime = line.date();
      const winningTeamID = parseInt(line.arg(1), 10);
      arenaMatch.endArena(endTime, winningTeamID);
      await LogHandler.endActivity();
    }
  }

  private async handleChallengeModeStartLine(line: LogLine) {
    console.debug(
      '[RetailLogHandler] Handling CHALLENGE_MODE_START line:',
      line,
    );

    if (
      LogHandler.activity &&
      LogHandler.activity.category === VideoCategory.MythicPlus
    ) {
      // This can happen if you zone in and out of a key mid pull.
      // If it's a new key, we see a CHALLENGE_MODE_END event first.
      console.info('[RetailLogHandler] Subsequent start event for dungeon');
      return;
    }

    const zoneID = parseInt(line.arg(2), 10);
    const mapID = parseInt(line.arg(3), 10);

    const unknownMap = !Object.prototype.hasOwnProperty.call(
      dungeonsByMapId,
      mapID,
    );

    if (unknownMap) {
      console.error('[RetailLogHandler] Unknown map', mapID);
      return;
    }

    const unknownTimer = !Object.prototype.hasOwnProperty.call(
      dungeonTimersByMapId,
      mapID,
    );

    if (unknownTimer) {
      console.error('[RetailLogHandler] Unknown timer', mapID);
      return;
    }

    const startTime = line.date();
    const level = parseInt(line.arg(4), 10);
    const affixes = line.arg(5).map(Number);
    const minLevelToRecord =
      ConfigService.getInstance().get<number>('minKeystoneLevel');

    if (level < minLevelToRecord) {
      console.info('[RetailLogHandler] Ignoring key below recording threshold');
      return;
    }

    const activity = new ChallengeModeDungeon(
      startTime,
      zoneID,
      mapID,
      level,
      affixes,
      Flavour.Retail,
    );

    const initialSegment = new ChallengeModeTimelineSegment(
      TimelineSegmentType.Trash,
      activity.startDate,
      0,
    );

    activity.addTimelineSegment(initialSegment);
    await LogHandler.startActivity(activity);
  }

  private async handleChallengeModeEndLine(line: LogLine) {
    console.debug('[RetailLogHandler] Handling CHALLENGE_MODE_END line:', line);

    if (!LogHandler.activity) {
      console.error(
        '[RetailLogHandler] Challenge mode stop with no active ChallengeModeDungeon',
      );
      return;
    }

    const challengeModeActivity = LogHandler.activity as ChallengeModeDungeon;
    const endDate = line.date();

    // Need to convert to int here as "0" evaluates to truthy.
    const result = Boolean(parseInt(line.arg(2), 10));

    // The actual log duration of the dungeon, from which keystone upgrade
    // levels can be calculated. This includes player death penalty.
    const CMDuration = Math.round(parseInt(line.arg(4), 10) / 1000);

    if (result) {
      const overrun = ConfigService.getInstance().get<number>('dungeonOverrun');
      challengeModeActivity.overrun = overrun;
    }

    challengeModeActivity.endChallengeMode(endDate, CMDuration, result);
    await LogHandler.endActivity();
  }

  protected async handleEncounterStartLine(line: LogLine) {
    console.debug('[RetailLogHandler] Handling ENCOUNTER_START line:', line);
    const encounterID = parseInt(line.arg(1), 10);

    if (!LogHandler.activity) {
      const knownDungeonEncounter = Object.prototype.hasOwnProperty.call(
        dungeonEncounters,
        encounterID,
      );

      if (knownDungeonEncounter) {
        // We can hit this branch due to a few cases:
        //   - It's a regular dungeon, we don't record those
        //   - It's a M+ below the recording threshold
        console.info(
          '[RetailLogHandler] Known dungeon encounter and not in M+, not recording',
        );

        return;
      }

      const currentRaidOnly = ConfigService.getInstance().get<boolean>(
        'recordCurrentRaidEncountersOnly',
      );

      if (
        !this.isPtr &&
        currentRaidOnly &&
        !currentRetailEncounters.includes(encounterID)
      ) {
        console.warn('[RetailLogHandler] Not a current encounter');
        return;
      }

      const logDifficultyID = parseInt(line.arg(3), 10);
      const { difficultyID } = instanceDifficulty[logDifficultyID];
      const orderedDifficulty = ['lfr', 'normal', 'heroic', 'mythic'];

      const minDifficultyToRecord = ConfigService.getInstance()
        .get<string>('minRaidDifficulty')
        .toLowerCase();

      const actualIndex = orderedDifficulty.indexOf(difficultyID);
      const configuredIndex = orderedDifficulty.indexOf(minDifficultyToRecord);

      if (actualIndex < configuredIndex) {
        console.info(
          '[RetailLogHandler] Not recording as threshold not met by',
          actualIndex,
          configuredIndex,
        );
        return;
      }

      await super.handleEncounterStartLine(line, Flavour.Retail);
      return;
    }

    const { category } = LogHandler.activity;
    const isChallengeMode = category === VideoCategory.MythicPlus;

    if (!isChallengeMode) {
      console.error(
        '[RetailLogHandler] Encounter is already in progress and not a ChallengeMode',
      );
      return;
    }

    const activeChallengeMode = LogHandler.activity as ChallengeModeDungeon;
    const eventDate = line.date();

    const segment = new ChallengeModeTimelineSegment(
      TimelineSegmentType.BossEncounter,
      eventDate,
      this.getRelativeTimestampForTimelineSegment(eventDate),
      encounterID,
    );

    activeChallengeMode.addTimelineSegment(segment, eventDate);
    console.debug(
      `[RetailLogHandler] Starting new boss encounter: ${dungeonEncounters[encounterID]}`,
    );
  }

  protected async handleEncounterEndLine(line: LogLine) {
    console.debug('[RetailLogHandler] Handling ENCOUNTER_END line:', line);

    if (!LogHandler.activity) {
      console.error(
        '[RetailLogHandler] Encounter end event spotted but not in activity',
      );

      return;
    }

    const { category } = LogHandler.activity;
    const isChallengeMode = category === VideoCategory.MythicPlus;

    if (!isChallengeMode) {
      console.debug(
        '[RetailLogHandler] Must be raid encounter, calling super method.',
      );
      await super.handleEncounterEndLine(line);
    } else {
      console.debug('[RetailLogHandler] Challenge mode boss encounter.');
      const activeChallengeMode = LogHandler.activity as ChallengeModeDungeon;
      const eventDate = line.date();
      const result = Boolean(parseInt(line.arg(5), 10));
      const encounterID = parseInt(line.arg(1), 10);
      const { currentSegment } = activeChallengeMode;

      if (currentSegment) {
        currentSegment.result = result;
      }

      const segment = new ChallengeModeTimelineSegment(
        TimelineSegmentType.Trash,
        eventDate,
        this.getRelativeTimestampForTimelineSegment(eventDate),
      );

      // Add a trash segment as the boss encounter ended
      activeChallengeMode.addTimelineSegment(segment, eventDate);
      console.debug(
        `[RetailLogHandler] Ending boss encounter: ${dungeonEncounters[encounterID]}`,
      );
    }
  }

  private async handleZoneChange(line: LogLine) {
    console.info('[RetailLogHandler] Handling ZONE_CHANGE line:', line);
    const zoneID = parseInt(line.arg(1), 10);

    const isZoneBG = Object.prototype.hasOwnProperty.call(
      retailBattlegrounds,
      zoneID,
    );

    if (LogHandler.activity) {
      const { category } = LogHandler.activity;
      const isActivityBG = category === VideoCategory.Battlegrounds;
      const isActivityArena = this.isArena();

      if (isZoneBG && isActivityBG) {
        console.info('[RetailLogHandler] Internal BG zone change: ', zoneID);
      } else if (!isZoneBG && isActivityBG) {
        console.info('[RetailLogHandler] Zone change out of BG');
        await this.battlegroundEnd(line);
      } else if (isActivityArena) {
        if (zoneID === LogHandler.activity.zoneID) {
          console.info(
            '[RetailLogHandler] ZONE_CHANGE within arena, no action taken',
          );
        } else {
          console.info(
            '[RetailLogHandler] ZONE_CHANGE out of arena, ending match',
          );
          await this.zoneChangeStop(line);
        }
      } else if (isZoneBG && !isActivityBG) {
        console.error(
          '[RetailLogHandler] Zoned into BG but in a different activity',
        );

        await LogHandler.forceEndActivity();
      } else {
        console.info(
          '[RetailLogHandler] Unknown zone change, no action taken: ',
          zoneID,
        );
      }
    } else if (isZoneBG) {
      console.info('[RetailLogHandler] Zone change into BG');
      await this.battlegroundStart(line);
    } else {
      console.info('[RetailLogHandler] Uninteresting zone change');
    }
  }

  private handleCombatantInfoLine(line: LogLine): void {
    if (!LogHandler.activity) {
      console.warn(
        '[RetailLogHandler] No activity in progress, ignoring COMBATANT_INFO',
      );
      return;
    }

    const GUID = line.arg(1);

    // In Mythic+ we see COMBANTANT_INFO events for each encounter.
    // Don't bother overwriting them if we have them already.
    const combatant = LogHandler.activity.getCombatant(GUID);

    if (combatant && combatant.isFullyDefined()) {
      return;
    }

    const teamID = parseInt(line.arg(2), 10);
    const specID = parseInt(line.arg(24), 10);

    console.info(
      '[RetailLogHandler] Adding combatant from COMBATANT_INFO',
      GUID,
      teamID,
      specID,
    );

    const newCombatant = new Combatant(GUID, teamID, specID);
    LogHandler.activity.addCombatant(newCombatant);
  }

  private handleSpellAuraAppliedLine(line: LogLine) {
    if (!LogHandler.activity) {
      // Deliberately don't log anything here as we hit this a lot
      return;
    }

    const srcGUID = line.arg(1);
    const srcFlags = parseInt(line.arg(3), 16);
    const srcNameRealm = line.arg(2);

    // The isUnitSelf() check is important here as for M+ we won't see
    // COMBATANT_INFO events till the boss is pulled, which would cause
    // us to drop the recording on an abandoned key with no boss pulls.
    // Adding the combatant here if it's ourselves ensures we atleast
    // have a partially defined combatant. See issue 650 & 683.
    const allowNew = this.isBattleground() || isUnitSelf(srcFlags);
    this.processCombatant(srcGUID, srcNameRealm, srcFlags, allowNew);
  }

  private handleSpellCastSuccess(line: LogLine) {
    if (!LogHandler.activity) {
      return;
    }

    const srcGUID = line.arg(1);
    const srcNameRealm = line.arg(2);
    const srcFlags = parseInt(line.arg(3), 16);

    // The isUnitSelf() check is important here as for M+ we won't see
    // COMBATANT_INFO events till the boss is pulled, which would cause
    // us to drop the recording on an abandoned key with no boss pulls.
    // Adding the combatant here if it's ourselves ensures we atleast
    // have a partially defined combatant. See issue 650 & 683.
    const allowNew = this.isBattleground() || isUnitSelf(srcFlags);

    const combatant = this.processCombatant(
      srcGUID,
      srcNameRealm,
      srcFlags,
      allowNew,
    );

    if (
      combatant === undefined ||
      combatant.specID !== undefined ||
      !this.isBattleground()
    ) {
      // Nothing to do here either of:
      //   - No combatant was processed (e.g. it's not a player)
      //   - We already know their spec (we've already processed them)
      //   - It's not a BG (every other retail activity fires COMBATANT_INFO)
      return;
    }

    const spellName = line.arg(10);

    const knownSpell = Object.prototype.hasOwnProperty.call(
      retailUniqueSpecSpells,
      spellName,
    );

    if (knownSpell) {
      combatant.specID = retailUniqueSpecSpells[spellName];
    }
  }

  private getRelativeTimestampForTimelineSegment(eventDate: Date) {
    if (!LogHandler.activity) {
      console.error(
        '[RetailLogHandler] getRelativeTimestampForTimelineSegment called but no active activity',
      );

      return 0;
    }

    const activityStartDate = LogHandler.activity.startDate;
    const relativeTime =
      (eventDate.getTime() - activityStartDate.getTime()) / 1000;
    return relativeTime;
  }

  private async battlegroundStart(line: LogLine) {
    if (LogHandler.activity) {
      console.error(
        "[RetailLogHandler] Another activity in progress, can't start battleground",
      );
      return;
    }

    const startTime = line.date();
    const category = VideoCategory.Battlegrounds;
    const zoneID = parseInt(line.arg(1), 10);

    const activity = new Battleground(
      startTime,
      category,
      zoneID,
      Flavour.Retail,
    );

    await LogHandler.startActivity(activity);
  }

  private async battlegroundEnd(line: LogLine) {
    if (!LogHandler.activity) {
      console.error(
        "[RetailLogHandler] Can't stop battleground as no active activity",
      );
      return;
    }

    const endTime = line.date();
    LogHandler.activity.end(endTime, false);
    await LogHandler.endActivity();
  }
}
