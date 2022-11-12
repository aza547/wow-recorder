import { Flavour, Metadata } from "../main/types";
import { classicArenas, retailArenas, VideoCategory } from "../main/constants";
import Activity from "./Activity";

/**
 * Arena match class.
 */
export default class ArenaMatch extends Activity {
    constructor(startDate: Date, 
                category: VideoCategory, 
                zoneID: number,
                flavour: Flavour,) 
    {
        super(startDate, category, flavour);
        this._zoneID = zoneID;
    }

    get zoneID() { return this._zoneID };

    get resultInfo() {
        if (this.result === undefined) {
            throw new Error("[ArenaMatch] Tried to get result info but no result");
        }

        if (this.result) {
            return "Win";
        }

        return "Loss";
    }

    get zoneName() {
        if (!this.zoneID) {
            throw new Error("[ArenaMatch] Tried to get zoneName but no zoneID");
        }

        if (this.flavour === Flavour.Retail) {
            return retailArenas[this._zoneID as number]
        }

        return classicArenas[this._zoneID as number]
    }

    endArena(endDate: Date, winningTeamID: number) {
        const result = this.determineArenaMatchResult(winningTeamID);
        super.end(endDate, result);
    }

    determineArenaMatchResult(winningTeamID: number): boolean {
        if (!this.playerGUID) {
            console.error("[ArenaMatch] Haven't identified player so no results possible");
            return false;
        };

        const player = this.getCombatant(this.playerGUID);

        if (!player) {
            console.error("[ArenaMatch] No player combatant so no results possible");
            return false;
        }

        return (player.teamID === winningTeamID);
    }

    getMetadata(): Metadata {
        return {
            category: this.category,
            zoneID: this.zoneID,
            zoneName: this.zoneName,
            flavour: this.flavour,
            duration: this.duration,
            result: this.result,
            deaths: this.deaths,
            player: this.player,
        }
    }

    getFileName() {
        return `${this.category} ${this.zoneName} (${this.resultInfo})`;
    }
}

