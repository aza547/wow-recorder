import { Metadata } from "main/types";
import { VideoCategory } from "../main/constants";
import Activity from "./Activity";

/**
 * Arena match class.
 */
export default class Battleground extends Activity {
    constructor(startDate: Date, 
                category: VideoCategory, 
                zoneID: number) 
    {
        super(startDate, category);
        this.zoneID = zoneID;
    }

    getMetadata(): Metadata {
        return {
            category: this.category,
            zoneID: this.zoneID,
            duration: this.duration,
            result: this.result,
        }
    }
}

