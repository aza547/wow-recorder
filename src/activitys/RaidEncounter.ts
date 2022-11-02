import { Metadata } from "main/types";
import { raidEncountersById, VideoCategory } from "../main/constants";
import Activity from "./Activity";

/**
 * Class representing a raid encounter.
 */
export default class RaidEncounter extends Activity {
    private difficultyID: number = 0;
    private encounterID: number = 0;

    constructor(startDate: Date, 
                encounterID: number, 
                difficultyID: number) 
    {
        super(startDate, VideoCategory.Raids);
        this.difficultyID = difficultyID;
        this.encounterID = encounterID;
    }

    getEncounterID() {
        return this.encounterID;
    }

    getRaidEncounterName(): string {
        if (!this.encounterID) {
            console.error("[RaidEncounter] EncounterID not set, can't get name of encounter");
            return "Unknown";
        }

        return raidEncountersById[this.encounterID];
    }

    getRaidZoneID(): number {
        return 0; // @@@ TODO
    };

    getDifficultyID(): number {
        return this.difficultyID;
    }

    getMetadata(): Metadata {
        const metadata: Metadata = {
            name: this.getRaidEncounterName(),
            category: VideoCategory.Raids,
            zoneID: this.getRaidZoneID(),
            encounterID: this.getEncounterID(),
            difficultyID: this.getDifficultyID(),
            duration: this.getDuration(),
            result: this.getResult(),
            playerDeaths: this.getPlayerDeaths(),
            playerName: this.getPlayerName(),
            playerRealm: this.getPlayerRealm(),
            playerSpecID: this.getPlayerSpecID(),
        }

        return metadata;
    }
}

