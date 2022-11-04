import { Metadata } from "main/types";
import { raidEncountersById, raidInstances, VideoCategory } from "../main/constants";
import Activity from "./Activity";

/**
 * Class representing a raid encounter.
 */
export default class RaidEncounter extends Activity {
    private _difficultyID: number = 0;
    private _encounterID: number = 0;

    constructor(startDate: Date, 
                encounterID: number, 
                difficultyID: number) 
    {
        super(startDate, VideoCategory.Raids);

        this._difficultyID = difficultyID;
        this._encounterID = encounterID;
    }
    
    get difficultyID() { return this._difficultyID };
    get encounterID() { return this._encounterID };

    get encounterName() {
        if (!this.encounterID) {
            throw new Error("EncounterID not set, can't get name of encounter");
        }

        return raidEncountersById[this._encounterID];
    }

    get zoneID(): number {
        if (!this.encounterID) {
            throw new Error("EncounterID not set, can't get zone ID");
        }

        let zoneID = 0;

        for (const raid of raidInstances) {
            if (raid.encounters[this.encounterID]) {
                zoneID = raid.zoneId;
                break;
            }
        };

        return zoneID; 
    };

    get raidName(): string {
        if (!this.encounterID) {
            throw new Error("EncounterID not set, can't get raid name");
        }

        let raidName = "Unknown Raid";

        for (const raid of raidInstances) {
            if (raid.encounters[this.encounterID]) {
                raidName = raid.name;
                break;
            }
        };

        return raidName; 
    };

    get resultInfo() {
        if (!this.result) {
            throw new Error("[RaidEncounter] Tried to get result info but no result");
        }

        if (this.result) {
            return "Kill";
        }

        return "Wipe";
    }

    getDifficultyID(): number {
        return this._difficultyID;
    }

    getMetadata(): Metadata {
        return {
            category: VideoCategory.Raids,
            zoneID: this.zoneID,
            zoneName: this.raidName,
            encounterID: this.encounterID,
            encounterName: this.encounterName,
            difficultyID: this.difficultyID,
            duration: this.duration,
            result: this.result,
            player: this.player,
            deaths: this.deaths,
        }
    }

    getFileName(): string {
        return `${this.raidName}, ${this.encounterName} (${this.resultInfo})`;
    }
}

