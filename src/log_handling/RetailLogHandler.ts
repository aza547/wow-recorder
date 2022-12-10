import { Combatant } from "../main/combatant";
import { CombatLogParser, LogLine } from "../main/combatLogParser";
import { dungeonEncounters, dungeonsByMapId, dungeonTimersByMapId, retailBattlegrounds, retailUniqueSpecSpells, VideoCategory } from "../main/constants";
import { Recorder } from "../main/recorder";
import ArenaMatch from "../activitys/ArenaMatch";
import LogHandler from "./LogHandler";
import Battleground from "../activitys/Battleground";
import ChallengeModeDungeon from "../activitys/ChallengeModeDungeon";
import { ChallengeModeTimelineSegment, TimelineSegmentType } from "../main/keystone";
import { Flavour } from "../main/types";

/**
 * RetailLogHandler class.
 */
export default class RetailLogHandler extends LogHandler {
    // Singleton instance.
    private static _instance: RetailLogHandler;

    static getInstance(recorder: Recorder, combatLogParser: CombatLogParser) {
        if (!RetailLogHandler._instance) {
            RetailLogHandler._instance = new RetailLogHandler(recorder, combatLogParser);
        }

        return RetailLogHandler._instance;
    }

    constructor(recorder: Recorder, 
                combatLogParser: CombatLogParser) 
    {
        super(recorder, combatLogParser);
        this.combatLogParser
            .on('ENCOUNTER_START',      (line: LogLine) => { this.handleEncounterStartLine(line) })
            .on('ENCOUNTER_END',        (line: LogLine) => { this.handleEncounterEndLine(line) })
            .on('ZONE_CHANGE',          (line: LogLine) => { this.handleZoneChange(line) })
            .on('SPELL_AURA_APPLIED',   (line: LogLine) => { this.handleSpellAuraAppliedLine(line) })
            .on('UNIT_DIED',            (line: LogLine) => { this.handleUnitDiedLine(line) })
            .on('ARENA_MATCH_START',    (line: LogLine) => { this.handleArenaStartLine(line) })
            .on('ARENA_MATCH_END',      (line: LogLine) => { this.handleArenaEndLine(line) })
            .on('CHALLENGE_MODE_START', (line: LogLine) => { this.handleChallengeModeStartLine(line) })
            .on('CHALLENGE_MODE_END',   (line: LogLine) => { this.handleChallengeModeEndLine(line) })
            .on('COMBATANT_INFO',       (line: LogLine) => { this.handleCombatantInfoLine(line) })
            .on('SPELL_CAST_SUCCESS',   (line: LogLine) => { this.handleSpellCastSuccess(line) });
    };

    handleArenaStartLine(line: LogLine): void {
        if (this.activity) {
            // Solo shuffle hits this alot as it fires 6 START events and 1 END. 
            return;
        }

        console.debug("[RetailLogHandler] Handling ARENA_MATCH_START line:", line);
        
        const startTime = line.date();
        const zoneID = parseInt(line.arg(1), 10);

        let category;
        const arenaType = line.arg(3);
    
        // Dirty hack for now to fix solo shuffle as since DF prepatch it's
        // either "Brawl Solo Shuffle" or "Rated Solo Shuffle".
        if (arenaType.includes("Solo Shuffle")) {
            category = VideoCategory.SoloShuffle;
        } else {
            category = (line.arg(3) as VideoCategory);
        }

        this.activity = new ArenaMatch(startTime, category, zoneID, Flavour.Retail);
        this.startRecording(this.activity);
    };

    handleArenaEndLine (line: LogLine): void {
        console.debug("[RetailLogHandler] Handling ARENA_MATCH_END line:", line);

        if (!this.activity) {
            console.error("[RetailLogHandler] Arena stop with no active arena match");
            return;
        }

        const arenaMatch = this.activity as ArenaMatch;
        const endTime = line.date();
        const winningTeamID = parseInt(line.arg(1), 10);
        arenaMatch.endArena(endTime, winningTeamID);
        this.endRecording(arenaMatch);
    }

    handleChallengeModeStartLine (line: LogLine): void {
        console.debug("[RetailLogHandler] Handling CHALLENGE_MODE_START line:", line);

        // It's impossible to start a keystone dungeon while another one is in progress
        // so we'll just remove the existing one and make a new one when `CHALLENGE_MODE_START`
        // is encountered. If any other activity is in progress, we will just exit.
        if (this.activity) {
            const activeChallengeMode = (this.activity.category === VideoCategory.MythicPlus);

            if (activeChallengeMode) {
                console.warn("[RetailLogHandler] A challenge mode instance is already in progress; abandoning it.")
            } else {
                console.error("[RetailLogHandler] Another activity in progress, can't start challenge mode.");
                return;
            }
        }

        const zoneName = line.arg(2);
        const mapId = parseInt(line.arg(3), 10);
        const hasDungeonMap = (mapId in dungeonsByMapId);
        const hasTimersForDungeon = (mapId in dungeonTimersByMapId);

        if (!hasDungeonMap || !hasTimersForDungeon) {
            console.error(`[RetailLogHandler] Invalid/unsupported mapId for Challenge Mode dungeon: ${mapId} ('${zoneName}')`)
        }

        const startTime = line.date();
        const zoneID = parseInt(line.arg(2), 10);
        const level = parseInt(line.arg(4), 10);

        this.activity = new ChallengeModeDungeon(startTime, zoneID, mapId, level);
        const challengeModeActivity = (this.activity as ChallengeModeDungeon);

        challengeModeActivity.addTimelineSegment(new ChallengeModeTimelineSegment(
            TimelineSegmentType.Trash, this.activity.startDate, 0
        ));

        this.startRecording(this.activity);
    };

    handleChallengeModeEndLine (line: LogLine): void {
        console.debug("[RetailLogHandler] Handling CHALLENGE_MODE_END line:", line);

        if (!this.activity) {
            console.error("[RetailLogHandler] Challenge mode stop with no active ChallengeModeDungeon");
            return;
        }

        const challengeModeActivity = this.activity as ChallengeModeDungeon;
        const endDate = line.date();
        const result = Boolean(line.arg(2));

        // The actual log duration of the dungeon, from which keystone upgrade
        // levels can be calculated. This includes player death penalty. 
        const CMDuration = Math.round(parseInt(line.arg(4), 10) / 1000);

        challengeModeActivity.endChallengeMode(endDate, CMDuration, result);
        this.endRecording(this.activity);
    };

    handleEncounterStartLine(line: LogLine) {
        console.debug("[RetailLogHandler] Handling ENCOUNTER_START line:", line);
        const encounterID = parseInt(line.arg(1), 10);

        if (!this.activity) {
            if (dungeonEncounters.hasOwnProperty(encounterID)) {
                console.info("[RetailLogHandler] It's a regular dungeon encounter, don't record");
                return;
            }

            super.handleEncounterStartLine(line, Flavour.Retail);
            return;
        } 

        const category = this.activity.category;
        const isChallengeMode = (category === VideoCategory.MythicPlus);

        if (!isChallengeMode) {
            console.error("[RetailLogHandler] Encounter is already in progress and not a ChallengeMode");
            return;
        }

        const activeChallengeMode = this.activity as ChallengeModeDungeon;
        const eventDate = line.date();
        
        const segment = new ChallengeModeTimelineSegment(
            TimelineSegmentType.BossEncounter,
            eventDate,
            this.getRelativeTimestampForTimelineSegment(eventDate),
            encounterID
        );

        activeChallengeMode.addTimelineSegment(segment, eventDate);
        console.debug(`[RetailLogHandler] Starting new boss encounter: ${dungeonEncounters[encounterID]}`);
    }

    handleEncounterEndLine(line: LogLine) {
        console.debug("[RetailLogHandler] Handling ENCOUNTER_END line:", line);

        if (!this.activity) {
            console.error("[RetailLogHandler] Encounter end event spotted but not in activity");
            return;
        }

        const category = this.activity.category; 
        const isChallengeMode = (category === VideoCategory.MythicPlus);

        if (!isChallengeMode) {
            console.debug("[RetailLogHandler] Must be raid encounter, calling super method.");
            super.handleEncounterEndLine(line);
        } else {
            console.debug("[RetailLogHandler] Challenge mode boss encounter.");
            const activeChallengeMode = this.activity as ChallengeModeDungeon;
            const eventDate = line.date();
            const result = Boolean(parseInt(line.arg(5), 10));
            const encounterID = parseInt(line.arg(1), 10);
            const currentSegment = activeChallengeMode.currentSegment;

            if (currentSegment) {
                currentSegment.result = result;
            }

            const segment = new ChallengeModeTimelineSegment(
                TimelineSegmentType.Trash, 
                eventDate, 
                this.getRelativeTimestampForTimelineSegment(eventDate)
            )

            // Add a trash segment as the boss encounter ended
            activeChallengeMode.addTimelineSegment(segment, eventDate);
            console.debug(`[RetailLogHandler] Ending boss encounter: ${dungeonEncounters[encounterID]}`);
        }
    }

    handleZoneChange(line: LogLine) {
        console.info("[RetailLogHandler] Handling ZONE_CHANGE line:", line);
        const zoneID = parseInt(line.arg(1), 10);
        const isZoneBG = retailBattlegrounds.hasOwnProperty(zoneID);

        if (this.activity) 
        {
            const category = this.activity.category;
            const isActivityBG = (category === VideoCategory.Battlegrounds);
            const isActivityArena = 
                (category === VideoCategory.TwoVTwo) ||
                (category === VideoCategory.ThreeVThree) ||
                (category === VideoCategory.Skirmish) ||
                (category === VideoCategory.SoloShuffle);

            if (isZoneBG && isActivityBG) 
            {
                console.info("[RetailLogHandler] Internal BG zone change: ", zoneID);
            } 
            else if (!isZoneBG && isActivityBG) 
            {
                console.error("[RetailLogHandler] Zone change out of BG");
                this.battlegroundEnd(line);
            } 
            else if (isActivityArena)
            {
                console.error("[RetailLogHandler] ZONE_CHANGE out of arena");
                this.zoneChangeStop(line);
            }
            else if (isZoneBG && !isActivityBG) 
            {
                console.error("[RetailLogHandler] Zoned into BG but in a different activity");
                this.forceEndActivity();
            } 
            else 
            {
                console.info("[RetailLogHandler] Unknown zone change, no action taken: ", this.activity, zoneID);
            }
        } 
        else 
        {
            if (isZoneBG) 
            {
                console.info("[RetailLogHandler] Zone change into BG");
                this.battlegroundStart(line);
            } 
            else 
            {
                console.info("[RetailLogHandler] Uninteresting zone change");
            }
        } 
    }

    handleCombatantInfoLine (line: LogLine): void {
        if (!this.activity) {
            console.error("[RetailLogHandler] No activity in progress, ignoring COMBATANT_INFO");
            return;
        }

        const GUID = line.arg(1);

        // In Mythic+ we see COMBANTANT_INFO events for each encounter.
        // Don't bother overwriting them if we have them already. 
        if (this.activity.getCombatant(GUID)) {
            console.debug("[RetailLogHandler] Already processed this combatant, skipping");
            return;
        }

        const teamID = parseInt(line.arg(2), 10);
        const specID = parseInt(line.arg(24), 10);
        const combatantInfo = new Combatant(GUID, teamID, specID);
        this.activity.addCombatant(combatantInfo);
    }

    handleSpellAuraAppliedLine(line: LogLine) {
        if (!this.activity) {
            // Deliberately don't log anything here as we hit this a lot
            return;
        }

        const srcGUID = line.arg(1);
        const srcFlags = parseInt(line.arg(3), 16);
        const srcNameRealm = line.arg(2);
        // Maybe if BG call minimal processCombatant -- i.e. only care about self? 
        this.processCombatant(srcGUID, srcNameRealm, srcFlags);
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

        if (retailUniqueSpecSpells.hasOwnProperty(spellName)) {
            combatant.specID = retailUniqueSpecSpells[spellName];
        }
    }

    getRelativeTimestampForTimelineSegment(eventDate: Date) {
        if (!this.activity) {
            console.error("[RetailLogHandler] getRelativeTimestampForTimelineSegment called but no active activity");
            return 0;
        }

        const activityStartDate = this.activity.startDate;
        const relativeTime = (eventDate.getTime() - activityStartDate.getTime()) / 1000;
        return relativeTime;
    };

    dataTimeout(ms: number) {
        super.dataTimeout(ms);

        if (!this.activity) {
            return;
        }

        const isDungeon = (this.activity.category === VideoCategory.MythicPlus);

        if (isDungeon) {
            this.forceEndActivity(-ms / 1000);
        }
    }

    battlegroundStart(line: LogLine): void {
        if (this.activity) {
            console.error("[RetailLogHandler] Another activity in progress, can't start battleground");
            return;
        }

        const startTime = line.date();
        const category = VideoCategory.Battlegrounds;
        const zoneID = parseInt(line.arg(1), 10);

        this.activity = new Battleground(startTime, category, zoneID, Flavour.Retail);
        this.startRecording(this.activity);
    }

    battlegroundEnd(line: LogLine): void {
        if (!this.activity) {
            console.error("[RetailLogHandler] Can't stop battleground as no active activity");
            return;
        }

        const endTime = line.date();
        this.activity.end(endTime, false);
        this.endRecording(this.activity);
    }
}

