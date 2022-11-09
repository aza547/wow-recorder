import { classicArenas, classicBattlegrounds, VideoCategory } from "../main/constants";
import { Combatant } from "../main/combatant";
import { CombatLogParser, LogLine } from "../main/combatLogParser";
import { Recorder } from "../main/recorder";
import LogHandler from "./LogHandler";
import { Flavour } from "../main/types";
import ArenaMatch from "../activitys/ArenaMatch";

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
    }

    handleEncounterStartLine(line: LogLine) {
        console.debug("[ClassicLogHandler] Handling ENCOUNTER_START line:", line);
        super.handleEncounterStartLine(line, Flavour.Classic);
        return;
    } 

    handleSpellAuraAppliedLine(line: LogLine) {
        if (!this.activity) {
            // Deliberately don't log anything here as we hit this a lot
            return;
        }

        if (this.activity.deaths.length > 0) {
            // When exiting classic arena we get spammed with nearby players on
            // zoning into the world. We avoid including them as combatants by
            // ignoring any new players introduced after the first player death. 
            return;
        }

        const srcGUID = line.arg(1);

        // Classic logs sometimes emit this GUID and we don't want to include it.
        // No idea what causes it. Seems really common but not exlusive on 
        // "Shadow Word: Death" casts. 
        if (srcGUID === "0000000000000000") {
            return;
        }

        const srcFlags = parseInt(line.arg(3), 16);

        if (!this.isUnitPlayer(srcFlags)) {
            return;
        }

        if (!this.activity.getCombatant(srcGUID))
        { 
            const combatant = new Combatant(srcGUID);
            [combatant.name, combatant.realm] = this.ambiguate(line.arg(2));

            // Classic doesn't have team IDs, we cheat a bit here
            // and always assign the player team 1 to share logic with
            // retail. 
            if (this.isUnitFriendly(srcFlags)) {
                combatant.teamID = 1;
            } else {
                combatant.teamID = 0;
            }

            if (this.isUnitSelf(srcFlags)) {
                this.activity.playerGUID = srcGUID;
            }

            this.activity.addCombatant(combatant);
        }
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

            if (isActivityBG) {
                // @@@ might be internal zone change, else stop
            }
        }
        else 
        {
            if (isZoneBG) 
            {
                // @@@
                // console.info("[ClassicLogHandler] Zone change into BG");
                // this.battlegroundStart(line);
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

        if (!this.isUnitPlayer(unitFlags)) {
            // Deliberatly not logging here as not interesting and frequent.
            return;
        }
        
        super.handleUnitDiedLine(line);

        if (this.isArena()){
            this.processArenaDeath(line.date());
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
        const friendsDead = arenaMatch.deaths.filter(d => d.friendly);
        const enemiesDead = arenaMatch.deaths.filter(d => !d.friendly);
        console.info("[ClassicLogHandler] Friendly deaths: ", friendsDead);
        console.info("[ClassicLogHandler] Enemy deaths: ", enemiesDead);
        const result = (friendsDead < enemiesDead) ? 1 : 0;

        arenaMatch.endArena(endDate, result);
        this.clearDeathTimeout();
        this.endRecording(arenaMatch);
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
}

