import Combatant from '../main/Combatant';
import { retailBattlegrounds, retailUniqueSpecSpells } from '../main/constants';
import LogHandler from './LogHandler';
import Battleground from '../activitys/Battleground';
import { Flavour } from '../main/types';
import LogLine from './LogLine';
import { VideoCategory } from '../types/VideoCategory';
import { isUnitSelf } from './logutils';
import RaidEncounter from 'activitys/RaidEncounter';

export default class ForeverLogHandler extends LogHandler {
  constructor(logPath: string) {
    super(logPath, 10);

    /* eslint-disable prettier/prettier */
    this.combatLogWatcher
      .on('ENCOUNTER_START',      (line: LogLine) => { this.logProcessQueue.add(async () =>  this.handleEncounterStartLine(line));})
      .on('ENCOUNTER_END',        (line: LogLine) => { this.logProcessQueue.add(async () => this.handleEncounterEndLine(line)); })
      .on('ZONE_CHANGE',          (line: LogLine) => { this.logProcessQueue.add(async () => this.handleZoneChange(line)); })
      .on('SPELL_AURA_APPLIED',   (line: LogLine) => { this.logProcessQueue.add(async () => this.handleSpellAuraAppliedLine(line)); })
      .on('SPELL_AURA_REMOVED',   (line: LogLine) => { this.logProcessQueue.add(async () => this.handleSpellAuraRemovedLine(line)); })
      .on('UNIT_DIED',            (line: LogLine) => { this.logProcessQueue.add(async () => this.handleUnitDiedLine(line)); })
      .on('COMBATANT_INFO',       (line: LogLine) => { this.logProcessQueue.add(async () => this.handleCombatantInfoLine(line)); })
      .on('SPELL_CAST_START',     (line: LogLine) => { this.logProcessQueue.add(async () => this.handleSpellCastStart(line)); })
      .on('SPELL_CAST_SUCCESS',   (line: LogLine) => { this.logProcessQueue.add(async () => this.handleSpellCastSuccess(line)); })
      .on('SPELL_DAMAGE',         (line: LogLine) => { this.logProcessQueue.add(async () => this.handleSpellDamage(line)); });
    /* eslint-enable prettier/prettier */
  }

  protected async handleEncounterStartLine(line: LogLine) {
    console.debug('[ForeverLogHandler] Handling ENCOUNTER_START line:', line);

    if (this.isManual()) {
      console.info('[ForeverLogHandler] Ignoring line as in manual recording');
      return;
    }

    if (LogHandler.activity) {
      console.error('[ForeverLogHandler] Encounter is already in progress');
    } else {
      await super.handleEncounterStartLine(line, Flavour.Forever);
    }
  }

  protected async handleEncounterEndLine(line: LogLine) {
    console.debug('[ForeverLogHandler] Handling ENCOUNTER_END line:', line);

    if (this.isManual()) {
      console.info('[ForeverLogHandler] Ignoring line as in manual recording');
      return;
    }

    if (LogHandler.activity) {
      console.debug('[ForeverLogHandler] Must be raid encounter');
      await super.handleEncounterEndLine(line);
    } else {
      console.error('[ForeverLogHandler] Encounter end event but no activity');
    }
  }

  private async handleZoneChange(line: LogLine) {
    console.info('[ForeverLogHandler] Handling ZONE_CHANGE line:', line);

    if (this.isManual()) {
      console.info('[ForeverLogHandler] Ignoring line as in manual recording');
      return;
    }

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
        console.info('[ForeverLogHandler] Internal BG zone change: ', zoneID);
      } else if (!isZoneBG && isActivityBG) {
        console.info('[ForeverLogHandler] Zone change out of BG');
        await this.battlegroundEnd(line);
      } else if (isActivityArena) {
        if (zoneID === LogHandler.activity.zoneID) {
          console.info(
            '[ForeverLogHandler] ZONE_CHANGE within arena, no action taken',
          );
        } else {
          console.info(
            '[ForeverLogHandler] ZONE_CHANGE out of arena, ending match',
          );
          await this.zoneChangeStop(line);
        }
      } else if (isZoneBG && !isActivityBG) {
        console.error(
          '[ForeverLogHandler] Zoned into BG but in a different activity',
        );

        await LogHandler.forceEndActivity();
        await this.battlegroundStart(line);
      } else {
        console.info(
          '[ForeverLogHandler] Unknown zone change, no action taken: ',
          zoneID,
        );
      }
    } else if (isZoneBG) {
      console.info('[ForeverLogHandler] Zone change into BG');
      await this.battlegroundStart(line);
    } else {
      console.info('[ForeverLogHandler] Uninteresting zone change');
    }
  }

  private handleCombatantInfoLine(line: LogLine): void {
    console.info('[ForeverLogHandler] Handling COMBATANT_INFO line:', line);

    if (this.isManual()) {
      console.info('[ForeverLogHandler] Ignoring line as in manual recording');
      return;
    }

    if (!LogHandler.activity) {
      console.warn(
        '[ForeverLogHandler] No activity in progress, ignoring COMBATANT_INFO',
      );
      return;
    }

    const GUID = line.arg(1);

    // In dungeons we see COMBANTANT_INFO events for each encounter.
    // Don't bother overwriting them if we have them already.
    const combatant = LogHandler.activity.getCombatant(GUID);

    if (combatant && combatant.isFullyDefined()) {
      return;
    }

    const teamID = parseInt(line.arg(2), 10);
    const specID = parseInt(line.arg(25), 10);

    console.info(
      '[ForeverLogHandler] Adding combatant from COMBATANT_INFO',
      GUID,
      teamID,
      specID,
    );

    const newCombatant = new Combatant(GUID, teamID, specID);
    LogHandler.activity.addCombatant(newCombatant);
  }

  private handleSpellAuraAppliedLine(line: LogLine) {
    if (!LogHandler.activity || this.isManual()) {
      // Deliberately don't log anything here as we can hit this a lot
      return;
    }

    const srcGUID = line.arg(1);
    const srcFlags = parseInt(line.arg(3), 16);
    const srcNameRealm = line.arg(2);

    // The isUnitSelf() check is important here as for dungeons we won't see
    // COMBATANT_INFO events till the boss is pulled, which would cause
    // us to drop the recording on an abandoned run with no boss pulls.
    // Adding the combatant here if it's ourselves ensures we atleast
    // have a partially defined combatant. See issue 650 & 683.
    const allowNew = this.isBattleground() || isUnitSelf(srcFlags);
    this.processCombatant(srcGUID, srcNameRealm, srcFlags, allowNew);

    if (this.isRaid()) {
      const raid = LogHandler.activity as RaidEncounter;
      raid.onSpellAuraApplied(line);
    }
  }

  private handleSpellAuraRemovedLine(line: LogLine) {
    if (this.isRaid()) {
      const raid = LogHandler.activity as RaidEncounter;
      raid.onSpellAuraRemoved(line);
    }
  }

  private handleSpellCastStart(line: LogLine) {
    if (this.isRaid()) {
      const raid = LogHandler.activity as RaidEncounter;
      raid.onSpellCastStart(line);
    }
  }

  private handleSpellCastSuccess(line: LogLine) {
    if (!LogHandler.activity || this.isManual()) {
      // Deliberately don't log anything here as we can hit this a lot
      return;
    }

    if (this.isRaid()) {
      const raid = LogHandler.activity as RaidEncounter;
      raid.onSpellCastSuccess(line);
    }

    const srcGUID = line.arg(1);
    const srcName = line.arg(2);
    const srcFlags = parseInt(line.arg(3), 16);

    // The isUnitSelf() check is important here as for dungeons we won't see
    // COMBATANT_INFO events till the boss is pulled, which would cause
    // us to drop the recording on an abandoned run with no boss pulls.
    // Adding the combatant here if it's ourselves ensures we atleast
    // have a partially defined combatant. See issue 650 & 683.
    const allowNew = this.isBattleground() || isUnitSelf(srcFlags);

    const combatant = this.processCombatant(
      srcGUID,
      srcName,
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

  private async battlegroundStart(line: LogLine) {
    if (LogHandler.activity) {
      console.error(
        "[ForeverLogHandler] Another activity in progress, can't start battleground",
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
      Flavour.Forever,
    );

    await LogHandler.startActivity(activity);
  }

  private async battlegroundEnd(line: LogLine) {
    if (!LogHandler.activity) {
      console.error(
        "[ForeverLogHandler] Can't stop battleground as no active activity",
      );
      return;
    }

    const endTime = line.date();
    LogHandler.activity.end(endTime, false);
    await LogHandler.endActivity();
  }
}
