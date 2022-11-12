import { classicArenas, classicBattlegrounds, classicUniqueSpecSpells, VideoCategory } from "../main/constants";
import { CombatLogParser, LogLine } from "../main/combatLogParser";
import { Recorder } from "../main/recorder";
import LogHandler from "./LogHandler";
import { Flavour } from "../main/types";
import ArenaMatch from "../activitys/ArenaMatch";
import { isUnitFriendly, isUnitPlayer } from "../main/logutils";
import Battleground from "../activitys/Battleground";

/**
 * Classic log handler class.
 */
export default class ClassicLogHandler extends LogHandler {
    // It's hard to end classic arenas on time due to log flushing and no
    // ARENA_MATCH_END events. We start a 20s timer on a player death that 
    // will end the game unless another death is seen in that 20s, in which 
    // case we start the timer again.  
    private _playerDeathTimeout?: NodeJS.Timeout;

    constructor(recorder: Recorder, combatLogParser: CombatLogParser) {
        super(recorder, combatLogParser);
        this.combatLogParser
            .on('ENCOUNTER_START',    (line: LogLine) => { this.handleEncounterStartLine(line) })
            .on('ENCOUNTER_END',      (line: LogLine) => { this.handleEncounterEndLine(line) })
            .on('ZONE_CHANGE',        (line: LogLine) => { this.handleZoneChange(line) })
            .on('SPELL_AURA_APPLIED', (line: LogLine) => { this.handleSpellAuraAppliedLine(line) })
            .on('UNIT_DIED',          (line: LogLine) => { this.handleUnitDiedLine(line) })
            .on('SPELL_CAST_SUCCESS', (line: LogLine) => { this.handleSpellCastSuccess(line) })
    }

    handleEncounterStartLine(line: LogLine) {
        console.debug("[ClassicLogHandler] Handling ENCOUNTER_START line:", line);
        super.handleEncounterStartLine(line, Flavour.Classic);
        return;
    } 

    handleSpellAuraAppliedLine(line: LogLine) {
        if (!this.activity) {
            return;
        }

        if (this.isArena() && this.activity.deaths.length > 0) {
            // When exiting classic arena we get spammed with nearby players on
            // zoning into the world. We avoid including them as combatants by
            // ignoring any new players introduced after the first player death. 
            return;
        }

        const srcGUID = line.arg(1);
        const srcFlags = parseInt(line.arg(3), 16);
        const srcNameRealm = line.arg(2);
        this.processCombatant(srcGUID, srcNameRealm, srcFlags);
    }

    handleZoneChange(line: LogLine) {
        console.info("[ClassicLogHandler] Handling ZONE_CHANGE line:", line);

        const zoneID = parseInt(line.arg(1), 10);
        const isZoneArena = classicArenas.hasOwnProperty(zoneID);
        const isZoneBG = classicBattlegrounds.hasOwnProperty(zoneID);

        if (this.activity)
        {
            const isActivityBG = this.isBattleground();
            const isActivityArena = this.isArena();
            
            // Sometimes (maybe always) see a double ZONE_CHANGE fired on the way into arena.
            // Explicitly check here that the zoneID we're going to is different than that
            // of the activity we are in to avoid ending the arena on the duplicate event.
            if (isActivityArena && (zoneID !== this.activity.zoneID)) {
                console.info("[ClassicLogHandler] Zone change out of Arena");
                this.endArena(line.date());
            }

            if (isActivityBG && (zoneID !== this.activity.zoneID)) {
                console.info("[ClassicLogHandler] Zone change out of battleground");
                this.battlegroundEnd(line);
            }
        }
        else 
        {
            if (isZoneBG) 
            {
                console.info("[ClassicLogHandler] Zone change into BG");
                this.battlegroundStart(line);
            } 
            else if (isZoneArena)
            {
                console.info("[ClassicLogHandler] Zone change into Arena");
                const startDate = line.date();
                this.startArena(startDate, zoneID);
            }
            else 
            {
                console.info("[ClassicLogHandler] Uninteresting zone change");
            }
        }
    }

    handleUnitDiedLine(line: LogLine) {
        if (!this.activity) {
            return;
        }

        const unitFlags = parseInt(line.arg(7), 16);

        if (!isUnitPlayer(unitFlags)) {
            // Deliberatly not logging here as not interesting and frequent.
            return;
        }
        
        super.handleUnitDiedLine(line);

        if (this.isArena()){
            this.processArenaDeath(line.date());
        }
        
    }

    handleSpellCastSuccess(line: LogLine) {
        if (!this.activity) { 
            return;
        }

        const srcGUID = line.arg(1);
        const srcNameRealm = line.arg(2);
        const srcFlags = parseInt(line.arg(3), 16);
        const combatant = this.processCombatant(srcGUID, srcNameRealm, srcFlags);

        if (!combatant) {
            return;
        }

        if (combatant.specID !== undefined) {
            // If we already have a specID for this combatant.
            return;
        }

        const spellName = line.arg(10);

        if (classicUniqueSpecSpells.hasOwnProperty(spellName)) {
            combatant.specID = classicUniqueSpecSpells[spellName];
        }
    }

    startArena(startDate: Date, zoneID: number) {
        if (this.activity) {
            console.error("[ClassicLogHandler] Another activity in progress, can't start arena"); 
            return;
        }

        console.debug("[ClassicLogHandler] Starting arena at date:", startDate);
        let category = VideoCategory.TwoVTwo
        this.activity = new ArenaMatch(startDate, category, zoneID, Flavour.Classic);
        this.startRecording(this.activity);
    }

    endArena(endDate: Date) {
        if (!this.activity) {
            console.error("[ClassicLogHandler] Arena stop with no active arena match");
            return;
        }

        console.debug("[ClassicLogHandler] Stopping arena at date:", endDate);
        const arenaMatch = this.activity as ArenaMatch;

        // We decide at the end of the game what bracket it was by counting 
        // the players as classic logs don't tell us upfront. 
        const combatantMapSize = arenaMatch.combatantMap.size;
        console.info("[ClassicLogHandler] Number of combatants found: ", combatantMapSize);

        if (combatantMapSize < 5) {
            arenaMatch.category = VideoCategory.TwoVTwo;
        } else if (combatantMapSize < 7) {
            arenaMatch.category = VideoCategory.ThreeVThree;
        } else {
            arenaMatch.category = VideoCategory.FiveVFive;
        }

        // Verbose logging to make it super obvious what's happened. 
        console.info("[ClassicLogHandler] Logging combatants");
        arenaMatch.combatantMap.forEach((k, v) => { console.log(k, v)});

        // We decide who won by counting the deaths. The winner is the 
        // team with the least deaths. Classic doesn't have team IDs
        // but we cheated a bit earlier always assigning the player as 
        // team 1. So effectively 0 is a loss and 1 is a win here. 
        const friendsDead = arenaMatch.deaths.filter(d => d.friendly).length;
        const enemiesDead = arenaMatch.deaths.filter(d => !d.friendly).length;
        console.info("[ClassicLogHandler] Friendly deaths: ", friendsDead);
        console.info("[ClassicLogHandler] Enemy deaths: ", enemiesDead);
        const result = (friendsDead < enemiesDead) ? 1 : 0;

        arenaMatch.endArena(endDate, result);
        this.clearDeathTimeout();
        this.endRecording(arenaMatch);
    }

    processCombatant(srcGUID: string, srcNameRealm: string, srcFlags: number) {
        if (!this.activity) {
            return;
        }

        const combatant = super.processCombatant(srcGUID, srcNameRealm, srcFlags);

        if (!combatant){
            return;
        }

        // Classic doesn't have team IDs, we cheat a bit here
        // and always assign the player team 1 to share logic with
        // retail. 
        if (isUnitFriendly(srcFlags)) {
            combatant.teamID = 1;
        } else {
            combatant.teamID = 0;
        }

        return combatant;
    }

    setDeathTimeout(ms: number) {
        this.clearDeathTimeout();

        this._playerDeathTimeout = setTimeout(() => {
            this.endArena(new Date());
        }, ms)
    }

    clearDeathTimeout() {
        if (this._playerDeathTimeout) {
            clearTimeout(this._playerDeathTimeout);
        }
    }

    processArenaDeath(deathDate: Date) {
        if (!this.activity) {
            return;
        }

        this.setDeathTimeout(20000);

        let totalFriends = 0;
        let totalEnemies = 0;

        this.activity.combatantMap.forEach((combatant) => {
            if (combatant.teamID === 1) {
                totalFriends++;
            } else {
                totalEnemies++;
            }
        });

        const deadFriends = this.activity.deaths.filter(d => d.friendly).length;
        const aliveFriends = totalFriends - deadFriends;

        if (aliveFriends < 1) {
            console.info("[ClassicLogHandler] No friendly players left so ending game.");
            this.endArena(deathDate);
            return;
        }

        const deadEnemies = this.activity.deaths.filter(d => !d.friendly).length;        
        const aliveEnemies = totalEnemies - deadEnemies;

        if (aliveEnemies < 1) {
            console.info("[ClassicLogHandler] No enemy players left so ending game.");
            this.endArena(deathDate);
            return;
        }
    }

    battlegroundStart(line: LogLine): void {
        if (this.activity) {
            console.error("[ClassicLogHandler] Another activity in progress, can't start battleground");
            return;
        }

        const startTime = line.date();
        const category = VideoCategory.Battlegrounds;
        const zoneID = parseInt(line.arg(1), 10);

        this.activity = new Battleground(startTime, category, zoneID, Flavour.Classic);
        this.startRecording(this.activity);
    }

    battlegroundEnd(line: LogLine): void {
        if (!this.activity) {
            console.error("[ClassicLogHandler] Can't stop battleground as no active activity");
            return;
        }

        const endTime = line.date();
        this.activity.end(endTime, false);
        this.endRecording(this.activity);
    }
}

