import Combatant from '../main/Combatant';
import CombatLogParser from './CombatLogParser';
import { getSortedFiles } from '../main/util';
import {
  dungeonEncounters,
  dungeonsByMapId,
  dungeonTimersByMapId,
  retailBattlegrounds,
  retailUniqueSpecSpells,
} from '../main/constants';

import Recorder from '../main/Recorder';
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

/**
 * RetailLogHandler class.
 */
export default class RetailLogHandler extends LogHandler {
  constructor(recorder: Recorder, logPath: string) {
    super(recorder, logPath, 10);

    this.combatLogParser
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
      .on('ARENA_MATCH_START', (line: LogLine) => {
        this.handleArenaStartLine(line);
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
        await this.handleCombatantInfoLine(line);
      })
      .on('SPELL_CAST_SUCCESS', async (line: LogLine) => {
        await this.handleSpellCastSuccess(line);
      });
  }

  private handleArenaStartLine(line: LogLine): void {
    console.debug('[RetailLogHandler] Handling ARENA_MATCH_START line:', line);

    // Important we don't exit if we're in a Solo Shuffle, we use the ARENA_MATCH_START
    // events to keep track of the rounds.
    if (this.activity && this.activity.category !== VideoCategory.SoloShuffle) {
      console.error(
        '[RetailLogHandler] Another activity in progress and not a Solo Shuffle'
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
        arenaType
      );
      return;
    }

    if (!this.activity && category === VideoCategory.SoloShuffle) {
      console.info('[RetailLogHandler] Fresh Solo Shuffle game starting');
      this.activity = new SoloShuffle(startTime, zoneID);
      this.startRecording(this.activity);
    } else if (this.activity && category === VideoCategory.SoloShuffle) {
      console.info(
        '[RetailLogHandler] New round of existing Solo Shuffle starting'
      );
      const soloShuffle = this.activity as SoloShuffle;
      soloShuffle.startRound(startTime);
    } else {
      console.info('[RetailLogHandler] New', category, 'arena starting');
      this.activity = new ArenaMatch(
        startTime,
        category,
        zoneID,
        Flavour.Retail
      );
      this.startRecording(this.activity);
    }
  }

  private async handleArenaEndLine(line: LogLine) {
    console.debug('[RetailLogHandler] Handling ARENA_MATCH_END line:', line);

    if (!this.activity) {
      console.error('[RetailLogHandler] Arena stop with no active arena match');
      return;
    }

    if (this.activity.category === VideoCategory.SoloShuffle) {
      const soloShuffle = this.activity as SoloShuffle;
      soloShuffle.endGame(line.date());
      await this.endRecording(soloShuffle);
    } else {
      const arenaMatch = this.activity as ArenaMatch;
      const endTime = line.date();
      const winningTeamID = parseInt(line.arg(1), 10);
      arenaMatch.endArena(endTime, winningTeamID);
      await this.endRecording(arenaMatch);
    }
  }

  private async handleChallengeModeStartLine(line: LogLine) {
    console.debug(
      '[RetailLogHandler] Handling CHALLENGE_MODE_START line:',
      line
    );

    // It's impossible to start a keystone dungeon while another one is in progress
    // so we'll just remove the existing one and make a new one when `CHALLENGE_MODE_START`
    // is encountered. If any other activity is in progress, we will just exit.
    if (this.activity) {
      const activeChallengeMode =
        this.activity.category === VideoCategory.MythicPlus;

      if (activeChallengeMode) {
        console.warn(
          '[RetailLogHandler] A challenge mode instance is already in progress; abandoning it.'
        );
      } else {
        console.error(
          "[RetailLogHandler] Another activity in progress, can't start challenge mode."
        );
        return;
      }
    }

    const zoneName = line.arg(2);
    const mapId = parseInt(line.arg(3), 10);
    const hasDungeonMap = mapId in dungeonsByMapId;
    const hasTimersForDungeon = mapId in dungeonTimersByMapId;

    if (!hasDungeonMap || !hasTimersForDungeon) {
      console.error(
        `[RetailLogHandler] Invalid/unsupported mapId for Challenge Mode dungeon: ${mapId} ('${zoneName}')`
      );
    }

    const startTime = line.date();
    const zoneID = parseInt(line.arg(2), 10);
    const level = parseInt(line.arg(4), 10);

    this.activity = new ChallengeModeDungeon(startTime, zoneID, mapId, level);
    const challengeModeActivity = this.activity as ChallengeModeDungeon;

    challengeModeActivity.addTimelineSegment(
      new ChallengeModeTimelineSegment(
        TimelineSegmentType.Trash,
        this.activity.startDate,
        0
      )
    );

    await this.startRecording(this.activity);
  }

  private async handleChallengeModeEndLine(line: LogLine) {
    console.debug('[RetailLogHandler] Handling CHALLENGE_MODE_END line:', line);

    if (!this.activity) {
      console.error(
        '[RetailLogHandler] Challenge mode stop with no active ChallengeModeDungeon'
      );
      return;
    }

    const challengeModeActivity = this.activity as ChallengeModeDungeon;
    const endDate = line.date();
    const result = Boolean(line.arg(2));

    // The actual log duration of the dungeon, from which keystone upgrade
    // levels can be calculated. This includes player death penalty.
    const CMDuration = Math.round(parseInt(line.arg(4), 10) / 1000);

    challengeModeActivity.endChallengeMode(endDate, CMDuration, result);
    await this.endRecording(this.activity);
  }

  protected async handleEncounterStartLine(line: LogLine) {
    console.debug('[RetailLogHandler] Handling ENCOUNTER_START line:', line);
    const encounterID = parseInt(line.arg(1), 10);

    if (!this.activity) {
      const knownDungeonEncounter = Object.prototype.hasOwnProperty.call(
        dungeonEncounters,
        encounterID
      );

      if (knownDungeonEncounter) {
        console.info(
          "[RetailLogHandler] It's a regular dungeon encounter, don't record"
        );

        return;
      }

      await super.handleEncounterStartLine(line, Flavour.Retail);
      return;
    }

    const { category } = this.activity;
    const isChallengeMode = category === VideoCategory.MythicPlus;

    if (!isChallengeMode) {
      console.error(
        '[RetailLogHandler] Encounter is already in progress and not a ChallengeMode'
      );
      return;
    }

    const activeChallengeMode = this.activity as ChallengeModeDungeon;
    const eventDate = line.date();

    const segment = new ChallengeModeTimelineSegment(
      TimelineSegmentType.BossEncounter,
      eventDate,
      this.getRelativeTimestampForTimelineSegment(eventDate),
      encounterID
    );

    activeChallengeMode.addTimelineSegment(segment, eventDate);
    console.debug(
      `[RetailLogHandler] Starting new boss encounter: ${dungeonEncounters[encounterID]}`
    );
  }

  protected async handleEncounterEndLine(line: LogLine) {
    console.debug('[RetailLogHandler] Handling ENCOUNTER_END line:', line);

    if (!this.activity) {
      console.error(
        '[RetailLogHandler] Encounter end event spotted but not in activity'
      );

      return;
    }

    const { category } = this.activity;
    const isChallengeMode = category === VideoCategory.MythicPlus;

    if (!isChallengeMode) {
      console.debug(
        '[RetailLogHandler] Must be raid encounter, calling super method.'
      );
      await super.handleEncounterEndLine(line);
    } else {
      console.debug('[RetailLogHandler] Challenge mode boss encounter.');
      const activeChallengeMode = this.activity as ChallengeModeDungeon;
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
        this.getRelativeTimestampForTimelineSegment(eventDate)
      );

      // Add a trash segment as the boss encounter ended
      activeChallengeMode.addTimelineSegment(segment, eventDate);
      console.debug(
        `[RetailLogHandler] Ending boss encounter: ${dungeonEncounters[encounterID]}`
      );
    }
  }

  private async handleZoneChange(line: LogLine) {
    console.info('[RetailLogHandler] Handling ZONE_CHANGE line:', line);
    const zoneID = parseInt(line.arg(1), 10);

    const isZoneBG = Object.prototype.hasOwnProperty.call(
      retailBattlegrounds,
      zoneID
    );

    if (this.activity) {
      const { category } = this.activity;
      const isActivityBG = category === VideoCategory.Battlegrounds;
      const isActivityArena = this.isArena();

      if (isZoneBG && isActivityBG) {
        console.info('[RetailLogHandler] Internal BG zone change: ', zoneID);
      } else if (!isZoneBG && isActivityBG) {
        console.info('[RetailLogHandler] Zone change out of BG');
        await this.battlegroundEnd(line);
      } else if (isActivityArena) {
        if (zoneID === this.activity.zoneID) {
          console.info(
            '[RetailLogHandler] ZONE_CHANGE within arena, no action taken'
          );
        } else {
          console.info(
            '[RetailLogHandler] ZONE_CHANGE out of arena, ending match'
          );
          await this.zoneChangeStop(line);
        }
      } else if (isZoneBG && !isActivityBG) {
        console.error(
          '[RetailLogHandler] Zoned into BG but in a different activity'
        );

        await this.forceEndActivity();
      } else {
        console.info(
          '[RetailLogHandler] Unknown zone change, no action taken: ',
          zoneID
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
    if (!this.activity) {
      console.error(
        '[RetailLogHandler] No activity in progress, ignoring COMBATANT_INFO'
      );
      return;
    }

    const GUID = line.arg(1);

    // In Mythic+ we see COMBANTANT_INFO events for each encounter.
    // Don't bother overwriting them if we have them already.
    if (this.activity.getCombatant(GUID)) {
      return;
    }

    const teamID = parseInt(line.arg(2), 10);
    const specID = parseInt(line.arg(24), 10);
    const combatantInfo = new Combatant(GUID, teamID, specID);
    this.activity.addCombatant(combatantInfo);
  }

  private handleSpellAuraAppliedLine(line: LogLine) {
    if (!this.activity) {
      // Deliberately don't log anything here as we hit this a lot
      return;
    }

    const srcGUID = line.arg(1);
    const srcFlags = parseInt(line.arg(3), 16);
    const srcNameRealm = line.arg(2);
    // Maybe if BG call minimal processCombatant -- i.e. only care about self?
    this.processCombatant(srcGUID, srcNameRealm, srcFlags);
  }

  private handleSpellCastSuccess(line: LogLine) {
    if (!this.activity) {
      return;
    }

    const srcGUID = line.arg(1);
    const srcNameRealm = line.arg(2);
    const srcFlags = parseInt(line.arg(3), 16);
    const combatant = this.processCombatant(srcGUID, srcNameRealm, srcFlags);

    if (!combatant) {
      return;
    }

    if (combatant.specID !== undefined) {
      // If we already have a specID for this combatant.
      return;
    }

    const spellName = line.arg(10);

    const knownSpell = Object.prototype.hasOwnProperty.call(
      retailUniqueSpecSpells,
      spellName
    );

    if (knownSpell) {
      combatant.specID = retailUniqueSpecSpells[spellName];
    }
  }

  private getRelativeTimestampForTimelineSegment(eventDate: Date) {
    if (!this.activity) {
      console.error(
        '[RetailLogHandler] getRelativeTimestampForTimelineSegment called but no active activity'
      );

      return 0;
    }

    const activityStartDate = this.activity.startDate;
    const relativeTime =
      (eventDate.getTime() - activityStartDate.getTime()) / 1000;
    return relativeTime;
  }

  protected async dataTimeout(ms: number) {
    await super.dataTimeout(ms);

    if (!this.activity) {
      return;
    }

    const isDungeon = this.activity.category === VideoCategory.MythicPlus;

    if (isDungeon) {
      await this.forceEndActivity(-ms / 1000);
    }
  }

  private async battlegroundStart(line: LogLine) {
    if (this.activity) {
      console.error(
        "[RetailLogHandler] Another activity in progress, can't start battleground"
      );
      return;
    }

    const startTime = line.date();
    const category = VideoCategory.Battlegrounds;
    const zoneID = parseInt(line.arg(1), 10);

    this.activity = new Battleground(
      startTime,
      category,
      zoneID,
      Flavour.Retail
    );

    await this.startRecording(this.activity);
  }

  private async battlegroundEnd(line: LogLine) {
    if (!this.activity) {
      console.error(
        "[RetailLogHandler] Can't stop battleground as no active activity"
      );
      return;
    }

    const endTime = line.date();
    this.activity.end(endTime, false);
    await this.endRecording(this.activity);
  }
}
