import { Flavour, Metadata, RaidInstanceType } from 'main/types';

import Combatant from '../main/Combatant';
import ConfigService from '../main/ConfigService';
import {
  getLocalePhrase,
  Language,
  Phrase,
} from '../localisation/translations';
import { instanceDifficulty, raidInstances } from '../main/constants';

import { VideoCategory } from '../types/VideoCategory';
import Activity from './Activity';

/**
 * Class representing a raid encounter.
 */
export default class RaidEncounter extends Activity {
  private _difficultyID: number;

  private _encounterID: number;

  private _encounterName: string;

  constructor(
    startDate: Date,
    encounterID: number,
    encounterName: string,
    difficultyID: number,
    flavour: Flavour,
    cfg: ConfigService
  ) {
    super(startDate, VideoCategory.Raids, flavour, cfg);
    this._difficultyID = difficultyID;
    this._encounterID = encounterID;
    this._encounterName = encounterName;
    this.overrun = 0;
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
      Object.prototype.hasOwnProperty.call(raid.encounters, this.encounterID)
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
      this.difficultyID
    );

    if (!isRecognisedDifficulty) {
      throw new Error(
        `[RaidEncounters] Unknown difficulty ID: ${this.difficultyID}`
      );
    }

    return instanceDifficulty[this.difficultyID];
  }

  getMetadata(): Metadata {
    const rawCombatants = Array.from(this.combatantMap.values()).map(
      (combatant: Combatant) => combatant.getRaw()
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
}
