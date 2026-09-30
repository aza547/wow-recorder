import { Flavour, Metadata, RaidInstanceType } from 'main/types';
import Combatant from '../main/Combatant';
import { getLocalePhrase, Language } from '../localisation/translations';
import { instanceDifficulty, raidInstances } from '../main/constants';

import { VideoCategory } from '../types/VideoCategory';
import Activity from './Activity';
import { Phrase } from 'localisation/phrases';
import { app } from 'electron';
import LogLine from 'parsing/LogLine';

/**
 * Class representing a raid encounter.
 */
export default class RaidEncounter extends Activity {
  private _difficultyID: number;

  private _encounterID: number;

  private _encounterName: string;

  /**
   * A simple encounter can be tracked purely by the boss HP.
   */
  protected simpleEncounterProgress = true;

  /**
   * If the boss isn't the highest HP unit in the encounter, then set this.
   */
  protected bossUnitId = -1;

  /**
   * Most encounters the boss is the highest HP unit, so track that as the
   * criteria for progress updates.
   */
  private encounterMaxHp = -1;

  /**
   * The actual progress of the encounter as a percent. Usually this is just
   * boss HP but it can be more complex for some encounters.
   */
  private encounterProgressPercent = 100;

  /**
   * Exists for handling the big shield at the start of the Gallywix encounter,
   * as there are no damage SPELL_DAMAGE events for a while due to the absorb.
   */
  private static minRetailBossHp = 100 * 10 ** 6;

  public constructor(
    startDate: Date,
    encounterID: number,
    encounterName: string,
    difficultyID: number,
    flavour: Flavour,
  ) {
    super(startDate, VideoCategory.Raids, flavour);
    this._difficultyID = difficultyID;
    this._encounterID = encounterID;
    this._encounterName = encounterName;
    this.overrun = 3; // Even for wipes it's nice to have some overrun.
  }

  get difficultyID() {
    return this._difficultyID;
  }

  get encounterID() {
    return this._encounterID;
  }

  get encounterName() {
    return this._encounterName;
  }

  get zoneID(): number {
    if (!this.encounterID) {
      console.warn("[RaidEncounter] EncounterID not set, can't get zone ID");
    }

    let zoneID = 0;

    raidInstances.every((raid) => {
      if (raid.encounters[this.encounterID]) {
        zoneID = raid.zoneId;
        return false;
      }

      return true;
    });

    return zoneID;
  }

  get raid(): RaidInstanceType {
    const raids = raidInstances.filter((raid) =>
      Object.prototype.hasOwnProperty.call(raid.encounters, this.encounterID),
    );

    const raid = raids.pop();

    if (!raid) {
      console.warn("Encounter not found in known raids, can't get raid name");

      const unknownRaid: RaidInstanceType = {
        zoneId: 0,
        name: 'Unknown Raid',
        shortName: 'Unknown Raid',
        encounters: {},
      };

      return unknownRaid;
    }

    return raid;
  }

  get resultInfo() {
    if (this.result === undefined) {
      throw new Error('[RaidEncounter] Tried to get result info but no result');
    }

    const language = this.cfg.get<string>('language') as Language;

    if (this.result) {
      return getLocalePhrase(language, Phrase.Kill);
    }

    return getLocalePhrase(language, Phrase.Wipe);
  }

  get difficulty() {
    const isRecognisedDifficulty = Object.prototype.hasOwnProperty.call(
      instanceDifficulty,
      this.difficultyID,
    );

    if (!isRecognisedDifficulty) {
      throw new Error(
        `[RaidEncounters] Unknown difficulty ID: ${this.difficultyID}`,
      );
    }

    return instanceDifficulty[this.difficultyID];
  }

  getMetadata(): Metadata {
    const rawCombatants = Array.from(this.combatantMap.values()).map(
      (combatant: Combatant) => combatant.getRaw(),
    );

    return {
      category: VideoCategory.Raids,
      zoneID: this.zoneID,
      zoneName: this.raid.shortName,
      flavour: this.flavour,
      encounterID: this.encounterID,
      encounterName: this.encounterName,
      difficultyID: this.difficultyID,
      difficulty: this.difficulty.difficulty,
      duration: this.duration,
      result: this.result,
      player: this.player.getRaw(),
      deaths: this.deaths,
      overrun: this.overrun,
      combatants: rawCombatants,
      start: this.startDate.getTime(),
      uniqueHash: this.getUniqueHash(),
      bossPercent: this.encounterProgressPercent,
      appVersion: app.getVersion(),
    };
  }

  getFileName(): string {
    let fileName = `${this.encounterName} [${this.difficulty.difficulty}] (${this.resultInfo})`;

    if (this.raid.name !== 'Unknown Raid') {
      fileName = `${this.raid.name}, ${fileName}`;
    }

    try {
      if (this.player.name !== undefined) {
        fileName = `${this.player.name} - ${fileName}`;
      }
    } catch {
      console.warn('[RaidEncounter] Failed to get player combatant');
    }

    return fileName;
  }

  /**
   * Get the NPC ID from a GUID. GUID looks like:
   *  "Creature-0-4244-2913-38715-240387-000073A7B0"
   * The stable encounter ID is the 5th hypen seperated element.
   */
  protected getNpcIdFromGuid(guid: string): number {
    return parseInt(guid.split('-')[5], 10);
  }

  public onSpellDamage(spellDamageEvent: LogLine): void {
    if (!this.simpleEncounterProgress) {
      return;
    }

    const unitMaxHp = parseInt(spellDamageEvent.arg(15), 10);
    const unitCurrentHp = parseInt(spellDamageEvent.arg(14), 10);

    if (this.bossUnitId > 0) {
      const guid = spellDamageEvent.arg(5);
      const unitId = this.getNpcIdFromGuid(guid);

      if (unitId === this.bossUnitId) {
        this.encounterProgressPercent = Math.round(
          (100 * unitCurrentHp) / unitMaxHp,
        );
      }

      return;
    }

    // We don't know the boss unit name so fall back to assuming the
    // unit with the highest max HP is the boss, which is true for 90%
    // of encounters.
    if (
      this.flavour === Flavour.Retail &&
      unitMaxHp < RaidEncounter.minRetailBossHp
    ) {
      // Assume that if the HP is less than 100 million then it's not a boss.
      // That avoids us marking bosses as 0% when they haven't been touched
      // yet, i.e. short pulls on Gallywix before the shield is broken and we are
      // yet to see SPELL_DAMAGE events (and instead get SPELL_ABSORBED). Only do
      // this for retail as classic will have lower HP bosses and I can't be
      // bothered worrying about it there.
      return;
    }

    if (unitMaxHp < this.encounterMaxHp) {
      // This unit has less max HP than the highest HP unit.
      return;
    }

    this.encounterMaxHp = unitMaxHp;
    this.encounterProgressPercent = Math.round(
      (100 * unitCurrentHp) / unitMaxHp,
    );
  }

  protected setEncounterPercent(percent: number): void {
    if (this.simpleEncounterProgress) {
      throw new Error('Bad programmer, only call this on complex encounters.');
    }

    const updated = Math.round(percent);

    if (updated < this.encounterProgressPercent) {
      // Some encounters like Coiled Altar heal, don't backtrack the progress.
      this.encounterProgressPercent = updated;
    }
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  public onSpellCastStart(line: LogLine) {}

  public onSpellCastSuccess(line: LogLine) {}

  public onUnitDied(line: LogLine) {}

  public onSpellAuraApplied(line: LogLine) {}

  public onSpellAuraRemoved(line: LogLine) {}
  /* eslint-enable @typescript-eslint/no-unused-vars */
}
