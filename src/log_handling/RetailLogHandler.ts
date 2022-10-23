import { Combatant } from "../main/combatant";
import { CombatLogParser, LogLine } from "../main/combatLogParser";
import { dungeonEncounters, dungeonsByMapId, dungeonTimersByMapId, VideoCategory } from "../main/constants";
import { ChallengeModeDungeon, ChallengeModeTimelineSegment, TimelineSegmentType } from "../main/keystone";
import { Recorder } from "../main/recorder";
import LogHandler from "./LogHandler";

export default class RetailLogHandler extends LogHandler {
    private activeChallengeMode: ChallengeModeDungeon | undefined;
    
    constructor(recorder: Recorder, combatLogParser: CombatLogParser) {
        super(recorder, combatLogParser);
        this.combatLogParser
            .on('ARENA_MATCH_START', this.handleArenaStartLine)
            .on('ARENA_MATCH_END', this.handleArenaStopLine)
            .on('CHALLENGE_MODE_START', this.handleChallengeModeStartLine)
            .on('CHALLENGE_MODE_END', this.handleChallengeModeEndLine)
            .on('COMBATANT_INFO', this.handleCombatantInfoLine);
    };

    handleArenaStartLine(line: LogLine): void {
        if (this.recorder.isRecording) return;
        const category = (line.arg(3) as VideoCategory);
        const zoneID = parseInt(line.arg(1), 10);

        // If all goes to plan we don't need this but we do it incase the game
        // crashes etc. so we can still get a reasonable duration.
        this.videoStartDate = line.date();

        this.metadata = {
            name: "name",
            category: category,
            zoneID: zoneID,
            duration: 0,
            result: false,
            playerDeaths: []
        }

        this.startRecording(category);
    };

    handleArenaStopLine (line: LogLine): void {
        if (!this.recorder.isRecording) return;

        this.videoStopDate = line.date();
        
        const [result, MMR] = this.determineArenaMatchResult(line); 
        this.metadata.teamMMR = MMR;

        this.endRecording({result});
    }

    handleChallengeModeStartLine (line: LogLine): void {
        // It's impossible to start a keystone dungeon while another one is in progress
        // so we'll just remove the existing one and make a new one when `CHALLENGE_MODE_START`
        // is encountered.
        if (this.activeChallengeMode) {
            console.warn("[ChallengeMode] A Challenge Mode instance is already in progress; abandoning it.")
        }

        this.videoStartDate = line.date();

        const zoneName = line.arg(2);
        const mapId = parseInt(line.arg(3), 10);
        const hasDungeonMap = (mapId in dungeonsByMapId);
        const hasTimersForDungeon = (mapId in dungeonTimersByMapId);

        if (!hasDungeonMap || !hasTimersForDungeon) {
            console.error(`[ChallengeMode] Invalid/unsupported mapId for Challenge Mode dungeon: ${mapId} ('${zoneName}')`)
        }

        const dungeonAffixes = line.arg(5).map((v: string) => parseInt(v, 10));

        this.activeChallengeMode = new ChallengeModeDungeon(
            dungeonTimersByMapId[mapId], // Dungeon timers
            parseInt(line.arg(2), 10),   // zoneId
            mapId,                       // mapId
            parseInt(line.arg(4), 10),   // Keystone Level
            dungeonAffixes,              // Array of affixes, as numbers
        )

        this.activeChallengeMode.addTimelineSegment(new ChallengeModeTimelineSegment(
            TimelineSegmentType.Trash, this.videoStartDate, 0
        ));

        console.debug("[ChallengeMode] Starting Challenge Mode instance")

        this.metadata = {
            name: line.arg(1), // Instance name (e.g. "Operation: Mechagon")
            encounterID: parseInt(line.arg(1), 10),
            category: VideoCategory.MythicPlus,
            zoneID: parseInt(line.arg(5)),
            duration: 0,
            result: false,
            challengeMode: this.activeChallengeMode,
            playerDeaths: [],
        };

        this.startRecording(VideoCategory.MythicPlus);
    };

    endChallengeModeDungeon = (): void => {
        if (!this.activeChallengeMode) {
            return;
        }

        console.debug("[ChallengeMode] Ending current timeline segment");
        this.activeChallengeMode.endCurrentTimelineSegment(this.videoStopDate);

        // If last timeline segment is less than 10 seconds long, discard it.
        // It's probably not useful
        const lastTimelineSegment = this.activeChallengeMode.getCurrentTimelineSegment();
        if (lastTimelineSegment && lastTimelineSegment.length() < 10000) {
            console.debug("[ChallengeMode] Removing last timeline segment because it's too short.");
            this.activeChallengeMode.removeLastTimelineSegment();
        }

        console.debug("[ChallengeMode] Ending Challenge Mode instance");
        this.activeChallengeMode = undefined;
    }

    /**
     * Handle a log line for CHALLENGE_MODE_END
     */
    handleChallengeModeEndLine (line: LogLine): void {
        if (!this.recorder.isRecording || !this.activeChallengeMode) {
            return;
        }

        this.videoStopDate = line.date();

        // The actual log duration of the dungeon, from which keystone upgrade
        // levels can be calculated.
        //
        // It's included separate from `metadata.duration` because the duration of the
        // dungeon, as the game sees it, is what is important for this value to make sense.
        this.activeChallengeMode.duration = Math.round(parseInt(line.arg(4), 10) / 1000);

        // Calculate whether the key was timed or not
        this.activeChallengeMode.timed = 
            ChallengeModeDungeon.calculateKeystoneUpgradeLevel(
                this.activeChallengeMode.allottedTime, 
                this.activeChallengeMode.duration
            ) > 0;

        this.endChallengeModeDungeon();

        const result = Boolean(parseInt(line.arg(1)));

        this.endRecording({result});
    };

    getRelativeTimestampForTimelineSegment = (currentDate: Date): number => {
        if (!this.videoStartDate) {
            return 0;
        }

        return (currentDate.getTime() - this.videoStartDate.getTime()) / 1000;
    };

    handleEncounterStartLine(line: LogLine) {
        const encounterID = parseInt(line.arg(1), 10)
        const eventDate = line.date();

        // If we're recording _and_ has an active challenge mode dungeon,
        // add a new boss encounter timeline segment.
        if (this.recorder.isRecording && this.activeChallengeMode) {
            const vSegment = new ChallengeModeTimelineSegment(
                TimelineSegmentType.BossEncounter,
                eventDate,
                this.getRelativeTimestampForTimelineSegment(eventDate),
                encounterID
            );

            this.activeChallengeMode.addTimelineSegment(vSegment, eventDate);
            console.debug(`[ChallengeMode] Starting new boss encounter: ${dungeonEncounters[encounterID]}`)

            return;
        }

        super.handleEncounterStartLine(line);
    }

    handleEncounterStopLine(line: LogLine) {
        const eventDate = line.date();
        const result = Boolean(parseInt(line.arg(5), 10));
        const encounterID = parseInt(line.arg(1), 10);

        if (this.recorder.isRecording && this.activeChallengeMode) {
            const currentSegment = this.activeChallengeMode.getCurrentTimelineSegment()

            if (currentSegment) {
                currentSegment.result = result;
            }

            const vSegment = new ChallengeModeTimelineSegment(
                TimelineSegmentType.Trash, 
                eventDate, 
                this.getRelativeTimestampForTimelineSegment(eventDate)
            )

            // Add a trash segment as the boss encounter ended
            this.activeChallengeMode.addTimelineSegment(vSegment, eventDate);
            console.debug(`[ChallengeMode] Ending boss encounter: ${dungeonEncounters[encounterID]}`)
            return;
        }

        super.handleEncounterStopLine(line);
    }

    handleZoneChange(line: LogLine) {
        // do stuff
    }

    handleCombatantInfoLine (line: LogLine): void {
        const GUID = line.arg(1);
        const teamID = parseInt(line.arg(2), 10);
        const specID = parseInt(line.arg(24), 10);
        let combatantInfo = new Combatant(GUID, teamID, specID);
        this.combatantMap.set(GUID, combatantInfo);
    }

    handleSpellAuraAppliedLine(line: LogLine) {
        // do stuff
    }

    handleUnitDiedLine(line: LogLine) {
        // do stuff
    }

    determineArenaMatchResult = (line: LogLine): any[] => {
        if (this.player === undefined) return [undefined, undefined];
        const teamID = this.player.teamID;
        const indexForMMR = (teamID == 0) ? 3 : 4;
        const MMR = parseInt(line.arg(indexForMMR), 10);
        const winningTeamID = parseInt(line.arg(1), 10);
        const win = (teamID === winningTeamID)
        return [win, MMR];
    }

    getCombatantByGuid(guid: string): Combatant | undefined {
        return this.combatantMap.get(guid);
    }

    forceStopRecording = () => {
        this.videoStopDate = new Date();
        const milliSeconds = (this.videoStopDate.getTime() - this.videoStartDate.getTime());
        this.metadata.duration = Math.round(milliSeconds / 1000);
    
        // If a Keystone Dungeon is in progress, end it properly before we stop recording
        if (this.activeChallengeMode) {
            this.endChallengeModeDungeon();
        }
    
        // Clear all kinds of stuff that would prevent the app from starting another
        // recording
        this.clearCombatants();
    
        // Regardless of what happens above these lines, _ensure_ that these variables
        // are cleared.
        this.activeChallengeMode = undefined;

        // @@@
        // testRunning = false;
    
        this.recorder.stop(this.metadata, 0);
    }
}

