import { Flavour, Metadata, RaidInstanceType } from 'main/types';

import Combatant from 'main/Combatant';
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
    flavour: Flavour
  ) {
    super(startDate, VideoCategory.Raids, flavour);
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

    if (this.result) {
      return 'Kill';
    }

    return 'Wipe';
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

  end(endDate: Date, result: boolean) {
    if (result) {
      console.log('[RaidEncounter] Adding overrun as this was a kill');
      this.overrun = 15;
    }

    super.end(endDate, result);
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
    };
  }

  getFileName(): string {
    let fileName = `${this.raid.name}, ${this.encounterName} [${this.difficulty.difficulty}] (${this.resultInfo})`;

    if (this.player.name !== undefined) {
      fileName = `${this.player.name} - ${fileName}`;
    }

    return fileName;
  }
}
