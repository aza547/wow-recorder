import { Flavour, Metadata, RaidInstanceType } from "main/types";
import { instanceDifficulty, raidEncountersById, raidInstances, VideoCategory } from "../main/constants";
import Activity from "./Activity";

/**
 * Class representing a raid encounter.
 */
export default class RaidEncounter extends Activity {
    private _difficultyID: number;
    private _encounterID: number;

    constructor(startDate: Date, 
                encounterID: number, 
                flavour: Flavour,
                difficultyID: number) 
    {
        super(startDate, VideoCategory.Raids, flavour);

        this._difficultyID = difficultyID;
        this._encounterID = encounterID;
    }
    
    get difficultyID() { return this._difficultyID };
    get encounterID() { return this._encounterID };

    get encounterName() {
        if (!this.encounterID) {
            throw new Error("EncounterID not set, can't get name of encounter");
        }

        if (raidEncountersById.hasOwnProperty(this.encounterID)) {
            return raidEncountersById[this.encounterID];
        }

        return "Unknown Encounter";
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

    get raid(): RaidInstanceType {
        if (!this.encounterID) {
            throw new Error("EncounterID not set, can't get raid name");
        }

        const raids = raidInstances.filter(r => r.encounters.hasOwnProperty(this.encounterID));
        const raid = raids.pop();

        if (!raid) {
            throw new Error("[RaidEncounter] No raids matched this encounterID.")
        }

        return raid;
    };

    get resultInfo() {
        if (this.result === undefined) {
            throw new Error("[RaidEncounter] Tried to get result info but no result");
        }

        if (this.result) {
            return "Kill";
        }

        return "Wipe";
    }

    get difficulty() {
        const recognisedID = instanceDifficulty.hasOwnProperty(this.difficultyID);

        if (!recognisedID) {
            throw new Error("[RaidEncounters] Unknown difficulty ID: " + this.difficultyID);
        }
    
        return instanceDifficulty[this.difficultyID];
    }

    getMetadata(): Metadata {
        return {
            category: VideoCategory.Raids,
            zoneID: this.zoneID,
            zoneName: this.raid.name,
            encounterID: this.encounterID,
            encounterName: this.encounterName,
            difficultyID: this.difficultyID,
            difficulty: this.difficulty.difficulty,
            duration: this.duration,
            result: this.result,
            player: this.player,
            deaths: this.deaths,
            flavour: this.flavour,
        }
    }

    getFileName(): string {
        return `${this.raid.name}, ${this.encounterName} (${this.resultInfo})`;
    }
}

