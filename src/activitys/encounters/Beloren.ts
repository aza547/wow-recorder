import { Flavour } from 'main/types';
import LogLine from 'parsing/LogLine';
import RaidEncounter from '../RaidEncounter';

export default class Beloren extends RaidEncounter {
  public static encounterId = 3182;

  private static npcId = 240387;

  private static rebirthSpellId = 1241313;

  private bossUnitActive = false;

  constructor(
    startDate: Date,
    encounterName: string,
    difficultyID: number,
    flavour: Flavour,
  ) {
    super(startDate, Beloren.encounterId, encounterName, difficultyID, flavour);
    this.bossUnitId = Beloren.npcId;
    this.simpleEncounterProgress = false;
  }

  public onSpellCastStart(line: LogLine): void {
    const spellId = parseInt(line.arg(9), 10);

    if (spellId === Beloren.rebirthSpellId) {
      console.info('[Beloren] Egg phase started');
      this.bossUnitActive = true;
    }
  }

  public onSpellCastSuccess(line: LogLine): void {
    const spellId = parseInt(line.arg(9), 10);

    if (spellId === Beloren.rebirthSpellId) {
      console.info('[Beloren] Egg phase over, boss is now active');
      this.bossUnitActive = false;
    }
  }

  public onSpellDamage(spellDamageEvent: LogLine): void {
    if (!this.bossUnitActive) {
      // Only damage in the egg phase counts to progress.
      return;
    }

    const guid = spellDamageEvent.arg(5);
    const unitId = this.getNpcIdFromGuid(guid);

    if (this.bossUnitId !== unitId) {
      return;
    }

    const unitMaxHp = parseInt(spellDamageEvent.arg(15), 10);
    const unitCurrentHp = parseInt(spellDamageEvent.arg(14), 10);

    const unitPerc = Math.round((100 * unitCurrentHp) / unitMaxHp);
    this.setEncounterPercent(unitPerc);
  }
}
