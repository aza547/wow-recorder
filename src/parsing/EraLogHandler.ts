import LogHandler from './LogHandler';
import { Flavour } from '../main/types';
import { isUnitPlayer } from './logutils';
import LogLine from './LogLine';
import Combatant from '../main/Combatant';
import { classicUniqueSpecSpells } from '../main/constants';

/**
 * Classic era log handler class.
 */
export default class EraLogHandler extends LogHandler {
  constructor(logPath: string) {
    super(logPath, 2);

    this.combatLogWatcher
      .on('ENCOUNTER_START', async (line: LogLine) => {
        await this.handleEncounterStartLine(line);
      })
      .on('ENCOUNTER_END', async (line: LogLine) => {
        await this.handleEncounterEndLine(line);
      })
      .on('SPELL_AURA_APPLIED', (line: LogLine) => {
        this.handleSpellAuraAppliedLine(line);
      })
      .on('SPELL_CAST_SUCCESS', (line: LogLine) => {
        this.handleSpellCastSuccess(line);
      })
      .on('COMBATANT_INFO', async (line: LogLine) => {
        this.handleCombatantInfoLine(line);
      })
      .on('UNIT_DIED', (line: LogLine) => {
        this.handleUnitDiedLine(line);
      });
  }

  protected async handleEncounterStartLine(line: LogLine) {
    console.debug('[EraLogHandler] Handling ENCOUNTER_START line:', line);
    await super.handleEncounterStartLine(line, Flavour.Classic);
  }

  private handleCombatantInfoLine(line: LogLine): void {
    if (!LogHandler.activity) {
      console.warn(
        '[EraLogHandler] No activity in progress, ignoring COMBATANT_INFO',
      );
      return;
    }

    const GUID = line.arg(1);
    const teamID = parseInt(line.arg(2), 10);

    // This just gives zero in classic era annoyingly.
    const specID = parseInt(line.arg(24), 10);

    // This gives talent point breakdown, could use it in conjunction
    // with some class detection to make spec detection easier.
    //  const talents = line.arg(25);

    console.info(
      '[EraLogHandler] Adding combatant from COMBATANT_INFO',
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
    this.processCombatant(srcGUID, srcNameRealm, srcFlags, false);
  }

  private handleSpellCastSuccess(line: LogLine) {
    if (!LogHandler.activity) {
      return;
    }

    const srcGUID = line.arg(1);
    const srcNameRealm = line.arg(2);
    const srcFlags = parseInt(line.arg(3), 16);
    const spellName = line.arg(10);

    const combatant = this.processEraCombatant(srcGUID, srcNameRealm, srcFlags);

    if (combatant === undefined) {
      // Not an event we can add a combatant for.
      return;
    }

    if (!combatant.specID) {
      const knownSpell = Object.prototype.hasOwnProperty.call(
        classicUniqueSpecSpells,
        spellName,
      );

      if (knownSpell) {
        combatant.specID = classicUniqueSpecSpells[spellName];
      }
    }
  }

  protected processEraCombatant(
    srcGUID: string,
    srcNameRealm: string,
    srcFlags: number,
  ) {
    if (!LogHandler.activity) {
      return undefined;
    }

    const combatant = super.processCombatant(
      srcGUID,
      srcNameRealm,
      srcFlags,
      false,
    );

    if (combatant === undefined) {
      return combatant;
    }

    return combatant;
  }

  protected handleUnitDiedLine(line: LogLine) {
    if (!LogHandler.activity) {
      return;
    }

    const unitFlags = parseInt(line.arg(7), 16);
    const isPlayer = isUnitPlayer(unitFlags);
    const isFeignDeath = Boolean(parseInt(line.arg(9), 10));

    if (!isPlayer || isFeignDeath) {
      // Deliberatly not logging here as not interesting and frequent.
      return;
    }

    super.handleUnitDiedLine(line);
  }
}
