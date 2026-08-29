import { Flavour } from 'main/types';
import RaidEncounter from '../RaidEncounter';
import LogLine from 'parsing/LogLine';

/**
 * Coiled Altar has a complex progress calculation.
 *
 * Phase 2 starts on the death of Zul'Jan:
 *    8/26/2026 21:50:48.7441  UNIT_DIED,0000000000000000,nil,0x80000000,0x80000000,Vehicle-0-1631-3004-15747-257911-00000F50DB,"Zul'jan",0x10a48,0x80000000,1

 * Phase 3 starts after Ghastly Regeneration (the heal: 1304033) is removed.
 *   8/26/2026 21:53:39.6241  
 * 
 * That is a bit of a simplifcation as there is a window in the burn phase
 * where the HP will always just show 33% but I'm fine with that.
 * 
 * We attribute 33% of the encounter to each phase.
 */
export default class CoiledAltar extends RaidEncounter {
  public static encounterId = 3429;
  private static zulJanId = 257911;
  public static malacrassId = 259854;
  public static ghastlyRegeneration = 1304033;
  private phase = 1;

  constructor(
    startDate: Date,
    encounterName: string,
    difficultyID: number,
    flavour: Flavour,
  ) {
    super(
      startDate,
      CoiledAltar.encounterId,
      encounterName,
      difficultyID,
      flavour,
    );

    console.info('[CoiledAltar] Starting encounter in Phase 1');
    this.simpleEncounterProgress = false;
    this.bossUnitId = CoiledAltar.zulJanId;
  }

  public onUnitDied(unitDied: LogLine) {
    const guid = unitDied.arg(5);
    const unitId = this.getNpcIdFromGuid(guid);

    if (CoiledAltar.zulJanId === unitId) {
      console.info('[CoiledAltar] Reached Phase 2');
      this.phase = 2;
      this.setEncounterPercent((2 * 100) / 3);
      this.bossUnitId = CoiledAltar.malacrassId;
    }
  }

  public onSpellAuraRemoved(auraRemoved: LogLine) {
    const spellId = parseInt(auraRemoved.arg(9), 10);

    if (spellId === CoiledAltar.ghastlyRegeneration) {
      console.info('[CoiledAltar] Reached Phase 3');
      this.phase = 3;
      this.setEncounterPercent(100 / 3);
      // Both need to die together but Zul'jan has more HP and no shields.
      this.bossUnitId = CoiledAltar.zulJanId;
    }
  }

  public onSpellDamage(spellDamageEvent: LogLine): void {
    const guid = spellDamageEvent.arg(5);
    const unitId = this.getNpcIdFromGuid(guid);

    if (this.bossUnitId !== unitId) {
      return;
    }

    const unitMaxHp = parseInt(spellDamageEvent.arg(15), 10);
    const unitCurrentHp = parseInt(spellDamageEvent.arg(14), 10);

    const unitPerc = (100 * unitCurrentHp) / unitMaxHp;
    let phaseCorrected;

    if (this.phase === 1) {
      phaseCorrected = unitPerc / 3 + (2 * 100) / 3;
    } else if (this.phase === 2) {
      phaseCorrected = unitPerc / 3 + 100 / 3;
    } else if (this.phase === 3) {
      // Zul'jan heals from 0 to 70%, so normalize that to 100% for the last phase.
      phaseCorrected = (unitPerc / 70 / 3) * 100;
    } else {
      throw new Error('You donkey, there is only 3 phases!');
    }

    this.setEncounterPercent(phaseCorrected);
  }
}
