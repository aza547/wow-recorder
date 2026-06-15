import { Flavour, Metadata, RaidInstanceType } from 'main/types';
import Combatant from '../main/Combatant';
import { getLocalePhrase, Language } from '../localisation/translations';
import { instanceDifficulty, raidInstances } from '../main/constants';

import { VideoCategory } from '../types/VideoCategory';
import Activity from './Activity';
import { Phrase } from 'localisation/phrases';
import { app } from 'electron';
import LogLine from 'parsing/LogLine';
import LogHandler from 'parsing/LogHandler';

/**
 * Class representing a raid encounter.
 */
export default class RaidEncounter extends Activity {
  private _difficultyID: number;

  private _encounterID: number;

  private _encounterName: string;

  private currentHp = 1;

  private maxHp = 1;

  private bossUnitId = -1;

  private bossUnitActive = true;

  private static minRetailBossHp = 100 * 10 ** 6;

  private static alleriaNpcId = 244300;

  private static belorenNpcId = 240387;

  private static belorenRebirthSpellId = 1241313;

  constructor(
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

    if (this.encounterID === 3182) {
      this.bossUnitId = RaidEncounter.belorenNpcId;
      this.bossUnitActive = false; // Starts in normal phase.
    } else if (this.encounterID === 3181) {
      // Alleria Windrunner (Voidspire)
      this.bossUnitId = RaidEncounter.alleriaNpcId;
    }
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

    const bossPercent = Math.round((100 * this.currentHp) / this.maxHp);

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
      bossPercent,
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
  private getNpcIdFromGuid(guid: string): number {
    return parseInt(guid.split('-')[5], 10);
  }

  /**
   * Update the max and current HP of the boss. Used to calculate the
   * boss HP percent at the end of the fight.
   */
  public updateBossHp(spellDamageEvent: LogLine): void {
    if (!this.bossUnitActive) {
      // Boss is explicitly flagged as inactive (e.g. Belo'ren not in egg phase).
      return;
    }

    if (this.bossUnitId > 0) {
      const guid = spellDamageEvent.arg(5);
      const unitId = this.getNpcIdFromGuid(guid);

      if (unitId !== this.bossUnitId) {
        // We know the boss unit and it's not it.
        return;
      }

      this.maxHp = parseInt(spellDamageEvent.arg(15), 10);
      this.currentHp = parseInt(spellDamageEvent.arg(14), 10);
      return;
    }

    // We don't know the boss unit name so fall back to assuming the
    // unit with the highest max HP is the boss, which is true for 90%
    // of encounters.
    const max = parseInt(spellDamageEvent.arg(15), 10);

    if (
      this.flavour === Flavour.Retail &&
      max < RaidEncounter.minRetailBossHp
    ) {
      // Assume that if the HP is less than 100 million then it's not a boss.
      // That avoids us marking bosses as 0% when they haven't been touched
      // yet, i.e. short pulls on Gallywix before the shield is broken and we are
      // yet to see SPELL_DAMAGE events (and instead get SPELL_ABSORBED). Only do
      // this for retail as classic will have lower HP bosses and I can't be
      // bothered worrying about it there.
      return;
    }

    if (max < this.maxHp) {
      // This unit has less max HP than the highest HP unit.
      return;
    }

    this.maxHp = max;
    this.currentHp = parseInt(spellDamageEvent.arg(14), 10);
  }

  /**
   * Basically exists for Belo'ren and future similar bosses where the unit
   * is the same but there is an egg phase where damage actually counts.
   */
  public updateBossStatus(line: LogLine): void {
    const event = line.arg(0);

    if (typeof event !== 'string') {
      // Obviously should never happen.
      console.error('Invalid log line event:', event);
      return;
    }

    const spellId = parseInt(line.arg(9), 10);

    if (spellId === RaidEncounter.belorenRebirthSpellId) {
      this.bossUnitActive = event === 'SPELL_CAST_START';
      return;
    }
  }
}
