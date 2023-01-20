import { Flavour, Metadata, RaidInstanceType } from 'main/types';

import {
  instanceDifficulty,
  raidEncountersById,
  raidInstances,
} from '../main/constants';

import { VideoCategory } from '../types/VideoCategory';
import Activity from './Activity';

/**
 * Class representing a raid encounter.
 */
export default class RaidEncounter extends Activity {
  private _difficultyID: number;

  private _encounterID: number;

  constructor(
    startDate: Date,
    encounterID: number,
    difficultyID: number,
    flavour: Flavour
  ) {
    super(startDate, VideoCategory.Raids, flavour);
    this._difficultyID = difficultyID;
    this._encounterID = encounterID;
    this.overrun = 15;
  }

  get difficultyID() {
    return this._difficultyID;
  }

  get encounterID() {
    return this._encounterID;
  }

  get encounterName() {
    if (!this.encounterID) {
      throw new Error("EncounterID not set, can't get name of encounter");
    }

    const isRecognisedRaidEncounter = Object.prototype.hasOwnProperty.call(
      raidEncountersById,
      this.encounterID
    );

    if (isRecognisedRaidEncounter) {
      return raidEncountersById[this.encounterID];
    }

    return 'Unknown Encounter';
  }

  get zoneID(): number {
    if (!this.encounterID) {
      throw new Error("EncounterID not set, can't get zone ID");
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
    if (!this.encounterID) {
      throw new Error("EncounterID not set, can't get raid name");
    }

    const raids = raidInstances.filter((raid) =>
      Object.prototype.hasOwnProperty.call(raid.encounters, this.encounterID)
    );

    const raid = raids.pop();

    if (!raid) {
      throw new Error('[RaidEncounter] No raids matched this encounterID.');
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

  getMetadata(): Metadata {
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
      player: this.player,
      deaths: this.deaths,
      overrun: this.overrun,
    };
  }

  getFileName(): string {
    return `${this.raid.name}, ${this.encounterName} [${this.difficulty.difficulty}] (${this.resultInfo})`;
  }
}
