import { Metadata } from "main/types";
import { VideoCategory } from "../main/constants";
import Activity from "./Activity";

/**
 * Arena match class.
 */
export default class ArenaMatch extends Activity {
    constructor(startDate: Date, 
                category: VideoCategory, 
                zoneID: number) 
    {
        super(startDate, category);
        this.zoneID = zoneID;
    }

    endArenaMatch(endDate: Date, winningTeamID: number) {
        const result = this.determineArenaMatchResult(winningTeamID);
        super.end(endDate, result);
    }

    determineArenaMatchResult(winningTeamID: number): boolean {
        if (!this.playerGUID) {
            console.error("[RetailLogHandler] Haven't identified player so no results possible");
            return false;
        };

        const playerCombatant = this.getCombatant(this.playerGUID);

        if (!playerCombatant) {
            console.error("[RetailLogHandler] No player combatant so no results possible");
            return false;
        }

        return (playerCombatant.teamID === winningTeamID);
    }

    getMetadata(): Metadata {
        const metadata: Metadata = {
            name: "some arena",
            category: this.getCategory(),
            zoneID: this.getZoneID(),
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

