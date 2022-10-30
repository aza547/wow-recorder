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
        const metadata: Metadata = {
            name: "some bg",
            category: this.getCategory(),
            zoneID: this.getZoneID(),
            duration: this.getDuration(),
        }

        return metadata;
    }
}

