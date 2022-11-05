import { classicArenas, classicBattlegrounds, VideoCategory } from "../main/constants";
import { Combatant } from "../main/combatant";
import { CombatLogParser, LogLine } from "../main/combatLogParser";
import { Recorder } from "../main/recorder";
import LogHandler from "./LogHandler";
import { Flavour } from "../main/types";
import ArenaMatch from "../activitys/ArenaMatch";

/**
 * Classic log handler class.
 * // @@@ make singleton
 * // @@@ consider 5v5 arena
 */
export default class ClassicLogHandler extends LogHandler {
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
        const srcFlags = parseInt(line.arg(3), 16);

        if (!this.isUnitPlayer(srcFlags)) {
            return;
        }

        if (!this.activity.getCombatant(srcGUID))
        { 
            const combatant = new Combatant(srcGUID);
            [combatant.name, combatant.realm] = this.ambiguate(line.arg(2));
    
            if (this.isUnitSelf(srcFlags)) {
                this.activity.playerGUID = srcGUID;

                // Classic doesn't have team IDs, we cheat a bit here
                // and always assign the player team 1 to share logic with
                // retail. 
                combatant.teamID = 1;
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
            const category = this.activity.category;
            const isActivityBG = (category === VideoCategory.Battlegrounds);
            const isActivityArena = 
                (category === VideoCategory.TwoVTwo) ||
                (category === VideoCategory.ThreeVThree) ||
                (category === VideoCategory.Skirmish) ||
                (category === VideoCategory.SoloShuffle);
            
            // Sometimes (maybe always) see a double ZONE_CHANGE fired on the way into arena.
            // Explicitly check here that the zoneID we're going to is different than that
            // of the activity we are in to avoid ending the arena on the duplicate event.
            if (isActivityArena && (zoneID !== this.activity.zoneID)) {
                console.info("[ClassicLogHandler] Zone change out of Arena");
                this.endArena(line);
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
                this.startArena(line);
            }
            else 
            {
                console.info("[ClassicLogHandler] Uninteresting zone change");
            }
        }
    }

    startArena(line: LogLine) {
        if (this.activity) {
            console.error("[ClassicLogHandler] Another activity in progress, can't start arena"); 
            return;
        }

        console.debug("[ClassicLogHandler] Handling ZONE_CHANGE into arena:", line);
        
        // Add 60 seconds to skip the waiting room. 
        const startTime = new Date(line.date().getTime() + 60000);

        const zoneID = parseInt(line.arg(1), 10);
        let category = VideoCategory.TwoVTwo

        this.activity = new ArenaMatch(startTime, category, zoneID, Flavour.Classic);
        this.startRecording(this.activity);
    }

    endArena(line: LogLine) {
        console.debug("[ClassicLogHandler] Handling ZONE_CHANGE out of arena", line);

        if (!this.activity) {
            console.error("[ClassicLogHandler] Arena stop with no active arena match");
            return;
        }

        const arenaMatch = this.activity as ArenaMatch;
        const endTime = line.date();

        // We decide at the end of the game what bracket it was by counting 
        // the players as classic logs don't tell us upfront. 
        const combatantMapSize = arenaMatch.combatantMap.size;

        if (combatantMapSize < 5) {
            arenaMatch.category = VideoCategory.TwoVTwo;
        } else if (combatantMapSize < 7) {
            arenaMatch.category = VideoCategory.ThreeVThree;
        } else {
            arenaMatch.category = VideoCategory.FiveVFive;
        }

        // We decide who won by counting the deaths. The winner is the 
        // team with the least deaths. Classic doesn't have team IDs
        // but we cheated a bit earlier always assigning the player as 
        // team 1. So effectively 0 is a loss and 1 is a win here.      
        const friendsDead = arenaMatch.deaths.filter(d => d.friendly);
        const enemiesDead = arenaMatch.deaths.filter(d => !d.friendly);
        const result = (friendsDead < enemiesDead) ? 1 : 0;
        
        arenaMatch.endArena(endTime, result);
        this.endRecording(arenaMatch);
    }
}

