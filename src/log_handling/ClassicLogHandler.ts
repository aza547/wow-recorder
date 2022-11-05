import { classicArenas, classicBattlegrounds, VideoCategory } from "../main/constants";
import { Combatant } from "../main/combatant";
import { CombatLogParser, LogLine } from "../main/combatLogParser";
import { Recorder } from "../main/recorder";
import LogHandler from "./LogHandler";

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

    handleSpellAuraAppliedLine(line: LogLine) {
        if (!this.activity) {
            console.error("[ClassicLogHandler] Ignoring SPELL_AURA_APPLIED line as no active activity");
            return;
        }

        if (this.activity.playerGUID) {
            // Deliberately don't log anything here as we hit this a lot. 
            return;
        }

        const srcGUID = line.arg(1);
        const srcNameRealm = line.arg(2)
        const [name, realm] = this.ambiguate(srcNameRealm);
        const srcFlags = parseInt(line.arg(3), 16);

        const combatant = new Combatant(srcGUID);
        combatant.name = name;
        combatant.realm = realm; 

        this.activity.addCombatant(combatant);

        if (this.isUnitSelf(srcFlags)) {
            this.activity.playerGUID = srcGUID;
        }
    }

    handleZoneChange(line: LogLine) {
        console.info("[RetailLogHandler] Handling ZONE_CHANGE line:", line);

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
            
            if (isActivityArena) {
                // @@@ stop the arena
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
                // console.info("[RetailLogHandler] Zone change into BG");
                // this.battlegroundStart(line);
            } 
            else if (isZoneArena)
            {
                // @@@
            }
            else 
            {
                console.info("[RetailLogHandler] Uninteresting zone change");
            }
        }
    }
}

