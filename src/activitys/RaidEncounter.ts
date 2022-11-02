import { Metadata } from "main/types";
import { raidEncountersById, VideoCategory } from "../main/constants";
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
        if (!this._encounterID) {
            throw new Error("EncounterID not set, can't get name of encounter");
        }

        return raidEncountersById[this._encounterID];
    }

    get zoneID(): number {
        return 0; // @@@ TODO
    };

    getDifficultyID(): number {
        return this._difficultyID;
    }

    getMetadata(): Metadata {
        return { // @@@ encounter name? 
            category: VideoCategory.Raids,
            zoneID: this.zoneID,
            encounterID: this.encounterID,
            difficultyID: this.difficultyID,
            duration: this.duration,
            result: this.result,
            player: this.player,
            deaths: this.deaths,
        }
    }
}

