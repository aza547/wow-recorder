import { Flavour, Metadata, PlayerDeathType } from "../main/types";
import { classicArenas, retailArenas, VideoCategory } from "../main/constants";
import Activity from "./Activity";
import ArenaMatch from "./ArenaMatch";

/**
 * Arena match class.
 */
export default class SoloShuffle extends Activity {
    private rounds: ArenaMatch[] = [];
    private totalRounds: number = 6;

    constructor(startDate: Date, zoneID: number) {
        super(startDate, VideoCategory.SoloShuffle, Flavour.Retail);
        this._zoneID = zoneID;
        this.overrun = 3;
        this.startRound(startDate);
    }

    get zoneID() { return this._zoneID };

    get zoneName() {
        if (!this.zoneID) {
            throw new Error("[ArenaMatch] Tried to get zoneName but no zoneID");
        }

        if (this.flavour === Flavour.Retail) {
            return retailArenas[this._zoneID as number]
        }

        return classicArenas[this._zoneID as number]
    }

    get roundsWon() {
        let score = 0;

        this.rounds.forEach(((arenaMatch) => {
            if (arenaMatch.result) score++;
        }))

        return score;
    }

    get resultInfo() {
        const win = this.roundsWon;
        const loss = this.totalRounds - this.roundsWon;
        return `${win}-${loss}`;
    }

    startRound(startDate: Date)
    {
        if (!this.zoneID) {
            throw new Error("[Solo Shuffle] No zoneID set");
        }

        const newRound = new ArenaMatch(startDate, 
                                        VideoCategory.SoloShuffle, 
                                        this.zoneID,
                                        Flavour.Retail);

        newRound.combatantMap = this.combatantMap;
        newRound.playerGUID = this.playerGUID;

        this.rounds.push(newRound);
    }

    endRound(endDate: Date, winningTeamID: number) {
        const currentRound = this.rounds[this.rounds.length - 1];
        currentRound.endArena(endDate, winningTeamID); 
    }

    addDeath(death: PlayerDeathType) {
        console.info("[Solo Shuffle] Adding death to solo shuffle", death);
        
        if (!this.playerGUID) {
            return;
        }

        const player = this.getCombatant(this.playerGUID);

        if (!player || player.teamID === undefined) {
            return;
        }

        const isEnemy = !death.friendly;
        const playerTeamID = player.teamID;
        let winningTeamID;

        if (isEnemy) {
            winningTeamID = playerTeamID;
        } else {
            (playerTeamID === 0) ? (winningTeamID = 1) : (winningTeamID = 0);
        }
        
        this.endRound(death.date, winningTeamID);
        super.addDeath(death);
    }

    endGame(endDate: Date) {
        super.end(endDate, true);
    }

    determineSoloShuffleResult(): boolean {
        return true;
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
            soloShuffleRoundsWon: this.roundsWon,
            soloShuffleRoundsPlayed: this.totalRounds,
        }
    }

    getFileName() {
        return `${this.category} ${this.zoneName} (${this.resultInfo})`;
    }
}

