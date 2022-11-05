import { Flavour, Metadata } from "main/types";
import { retailBattlegrounds, VideoCategory } from "../main/constants";
import Activity from "./Activity";

/**
 * Arena match class.
 */
export default class Battleground extends Activity {
    constructor(startDate: Date, 
                category: VideoCategory, 
                flavour: Flavour,
                zoneID: number) 
    {
        super(startDate, category, flavour);
        this.zoneID = zoneID;
    }

    get battlegroundName(): string {
        if (!this.zoneID) {
            throw new Error("zoneID not set, can't get battleground name");
        }

        if (retailBattlegrounds.hasOwnProperty(this.zoneID)) {
            return retailBattlegrounds[this.zoneID];
        }

        return 'Unknown Battleground';
    };

    getMetadata(): Metadata {
        return {
            category: this.category,
            zoneID: this.zoneID,
            duration: this.duration,
            result: this.result,
            flavour: this.flavour,
        }
    }

    getFileName(): string {
        return `${this.battlegroundName}`;
    }
}

