import { Metadata, PlayerDeathType } from "main/types";
import { Combatant } from "../main/combatant";
import { VideoCategory } from "../main/constants";

/**
 * Abstract activity class.
 */
export default class Activity {
    protected category: VideoCategory;
    protected result: boolean;
    protected combatantMap: Map<string, Combatant>;
    protected startDate: Date;
    protected playerDeaths: PlayerDeathType[];
    protected endDate?: Date;
    protected zoneID?: number;
    protected playerGUID?: string;

    constructor(startDate: Date, 
                category: VideoCategory) 
    {
        this.result = false;
        this.combatantMap = new Map();
        this.startDate = startDate;
        this.category = category;
        this.playerDeaths = [];
    }

    end(endDate: Date, result: boolean) {
        this.endDate = endDate;
        this.result = result;
    }

    getZoneID() {
        return this.zoneID;
    }

    setZoneID(zoneID: number) {
        this.zoneID = zoneID; 
    }

    getDuration() {
        if (!this.endDate) {
            console.error("[Activity] Failed to get duration of in-progress activity");
            throw new Error("[Activity] Failed to get duration of in-progress activity");
        }

        const duration = (this.endDate.getTime() - this.startDate.getTime()) / 1000;
        return duration;
    }

    getCategory() {
        return this.category;
    }

    getStartDate() {
        return this.startDate;
    }

    getResult() {
        return this.result;
    }

    setResult(result: boolean) {
        this.result = result;
    }

    addCombatant(combatant: Combatant) {
        this.combatantMap.set(combatant.GUID, combatant);
    }

    getCombatant(GUID: string) {
        return this.combatantMap.get(GUID);
    }

    addPlayerDeath(death: PlayerDeathType) {
        this.playerDeaths.push(death);
    }

    getPlayerDeaths() {
        return this.playerDeaths;
    }

    // overriden by subclasses
    getMetadata(): Metadata {
        return { 
            name: "abc", 
            category: VideoCategory.TwoVTwo, 
            duration: 0
        };
    }

    getPlayerGUID() {
        return this.playerGUID; 
    }

    setPlayerGUID(guid: string) {
        this.playerGUID = guid; 
    }
    
    getPlayerName(): string {
        if (!this.playerGUID) {
            console.error("[Activity] No player GUID set.");
            return "Unknown"
        }

        const playerCombatant = this.getCombatant(this.playerGUID);

        if (!playerCombatant) {
            console.error("[Activity] No playerCombatant found.");
            return "Unknown"
        }

        const playerName = playerCombatant.name;

        if (!playerName) {
            console.error("[Activity] No playerName found.");
            return "Unknown"
        }

        return playerName;
    }

    getPlayerRealm() {
        if (!this.playerGUID) {
            console.error("[Activity] No player GUID set.");
            return "Unknown"
        }

        const playerCombatant = this.getCombatant(this.playerGUID);

        if (!playerCombatant) {
            console.error("[Activity] No playerCombatant found.");
            return "Unknown"
        }

        const playerRealm = playerCombatant.realm;

        if (!playerRealm) {
            console.error("[Activity] No playerRealm found.");
            return "Unknown"
        }

        return playerRealm;
    }

    getPlayerSpecID() {
        if (!this.playerGUID) {
            console.error("[Activity] No player GUID set.");
            return 0;
        }

        const playerCombatant = this.getCombatant(this.playerGUID);

        if (!playerCombatant) {
            console.error("[Activity] No playerCombatant found.");
            return 0;
        }

        const playerSpecID = playerCombatant.specID;

        if (!playerSpecID) {
            console.error("[Activity] No playerSpecID found.");
            return 0;
        }

        return playerSpecID;
    }
}

