import { Combatant } from "../main/combatant";
import { CombatLogParser, LogLine } from "../main/combatLogParser";
import ConfigService from "../main/configService";
import { battlegrounds, categoryRecordingSettings, VideoCategory } from "../main/constants";
import { ChallengeModeDungeon } from "main/keystone";
import { Recorder } from "../main/recorder";
import { PlayerDeathType, UnitFlags } from "../main/types";

type EndRecordingOptionsType = {
    result?: boolean,       // Success/Failure result for the overall activity
    closedWow?: boolean,    // If the wow process just ended
};

/**
 * Metadata type. 
 */
 type Metadata = {
    name: string;
    category: VideoCategory;
    zoneID?: number;
    encounterID?: number;
    difficultyID? : number;
    duration: number;
    result: boolean;
    playerName?: string;
    playerRealm?: string;
    playerSpecID?: number;
    teamMMR?: number;
    challengeMode?: ChallengeModeDungeon;
    playerDeaths: PlayerDeathType[];
}

export default class LogHandler {
    protected recorder;
    protected combatLogParser: CombatLogParser;
    protected videoStartDate: Date;
    protected videoStopDate: Date;
    protected metadata: Metadata;
    protected category: VideoCategory | undefined;
    protected player: Combatant | undefined;
    protected combatantMap: Map<string, Combatant> = new Map();
    protected cfg: ConfigService;

    constructor(recorder: Recorder, combatLogParser: CombatLogParser) {
        this.recorder = recorder;
        this.combatLogParser = combatLogParser;
        this.cfg = ConfigService.getInstance();

        // If we haven't received data in a while, we're probably AFK and should stop recording.
        this.combatLogParser
            .on('DataTimeout', (ms: number) => {
                console.log(`[CombatLogParser] Haven't received data for combatlog in ${ms / 1000} seconds.`)

                /**
                 * End the current challenge mode dungeon and stop recording.
                 * We'll keep the video.
                 */
                // @@@
                // if (activeChallengeMode || currentActivity === VideoCategory.Battlegrounds) {
                //     forceStopRecording();
                //     return;
                // }
            }
        );
    }

    startRecording = (category: VideoCategory) => {
        if (!this.allowRecordCategory(category)) {
            console.info("[LogUtils] Not configured to record", category);
            return;
        } else if (this.recorder.isRecording || !this.recorder.isRecordingBuffer) {
            console.error("[LogUtils] Avoiding error by not attempting to start recording",
                            this.recorder.isRecording,
                            this.recorder.isRecordingBuffer);
            return;
        }

        console.log(`[Logutils] Start recording a video for category: ${category}`)

        // Ensure combatant map and player combatant is clean before
        // starting a new recording.
        this.clearCombatants();

        this.category = category;
        this.recorder.start();
    };

    endRecording = (options?: EndRecordingOptionsType) => {
        if (!this.recorder.isRecording || !this.category) {
            console.error("[LogUtils] Avoiding error by not attempting to stop recording");
            return;
        }

        if (!this.videoStopDate) {
            this.videoStopDate = new Date();
        }

        const overrun = categoryRecordingSettings[this.category].videoOverrun;
        const videoDuration = (this.videoStopDate.getTime() - this.videoStartDate.getTime());
        const closedWow = options?.closedWow ?? false;

        this.metadata.duration = Math.round(videoDuration / 1000) + overrun;
        this.metadata.result = options?.result ?? false;

        console.log(`[Logutils] Stop recording video for category: ${this.category}`)

        this.recorder.stop(this.metadata, overrun, closedWow);
        this.category = undefined;
    }

    clearCombatants = () => {
        this.combatantMap.clear();
        this.player = undefined;
    }

    /**
     * Check and return whether we're allowed to record a certain type of content
     */
    allowRecordCategory = (category: VideoCategory): boolean => {
        const categoryConfig = categoryRecordingSettings[category];
        const categoryAllowed = this.cfg.get<boolean>(categoryConfig.configKey);

        if (!categoryAllowed) {
            // @@@
            // if (!testRunning) {
            //     console.log("[Logutils] Configured to not record", category);
            //     return false;
            // }

            console.log(`[Logutils] Configured to not record ${category}, but test is running so recording anyway.`);
        };

        return true;
    };

    handleEncounterStartLine(line: LogLine) {
        const encounterID = parseInt(line.arg(1), 10)
        const difficultyID = parseInt(line.arg(3), 10);
        const eventDate = line.date();

        this.videoStartDate = eventDate;

        this.metadata = {
            name: "name",
            category: VideoCategory.Raids,
            encounterID: encounterID,
            difficultyID: difficultyID,
            duration: 0,
            result: false,
            playerDeaths: [],
        }

        this.startRecording(VideoCategory.Raids);
    } 

    handleEncounterStopLine (line: LogLine): void {
        const eventDate = line.date();
        const result = Boolean(parseInt(line.arg(5), 10));
        this.videoStopDate = eventDate;
        this.endRecording({result});
    }

    handleZoneChange (line: LogLine): void {
        console.log("[Logutils] Handling zone change", line);
        const zoneID = parseInt(line.arg(1), 10);
        const isNewZoneBG = battlegrounds.hasOwnProperty(zoneID);
        const isRecording = this.recorder.isRecording;

        let isRecordingBG = false;
        let isRecordingArena = false;

        if (this.metadata !== undefined) {
            isRecordingBG = (this.metadata.category === VideoCategory.Battlegrounds);
            isRecordingArena = (this.metadata.category === VideoCategory.TwoVTwo) ||
                               (this.metadata.category === VideoCategory.ThreeVThree) ||
                               (this.metadata.category === VideoCategory.SoloShuffle) ||
                               (this.metadata.category === VideoCategory.Skirmish);
        }

        if (!isRecording && isNewZoneBG) {
            console.log("[Logutils] ZONE_CHANGE into BG");
            this.battlegroundStart(line);
            return;
        }

        if (isRecording && isRecordingBG && !isNewZoneBG) {
            console.log("[Logutils] ZONE_CHANGE out of BG, stop recording");
            this.battlegroundStop(line);
            return;
        }

        if (isRecording && isRecordingArena) {
            console.log("[Logutils] ZONE_CHANGE out of arena, stop recording");
            this.zoneChangeStop(line);
            return;
        }
    }

    handleSpellAuraAppliedLine (line: LogLine): void {
        if (this.player) return;
        if (this.combatantMap.size === 0) return;

        const srcGUID = line.arg(1);
        const srcNameRealm = line.arg(2)
        const srcFlags = parseInt(line.arg(3), 16);

        const srcCombatant = this.combatantMap.get(srcGUID);
        if (srcCombatant === undefined) return;

        if (this.isUnitSelf(srcFlags)) {
            const [srcName, srcRealm] = this.ambiguate(srcNameRealm);
            srcCombatant.name = srcName;
            srcCombatant.realm = srcRealm;
            this.player = srcCombatant;

            this.metadata.playerName = this.player.name;
            this.metadata.playerRealm = this.player.realm;
            this.metadata.playerSpecID = this.player.specID;
        }
    }

    isUnitSelf = (flags: number): boolean => {
        const isFriendly = this.hasFlag(flags, UnitFlags.REACTION_FRIENDLY);
        const isMine = this.hasFlag(flags, UnitFlags.AFFILIATION_MINE)
        return (isFriendly && isMine);
    }

    isUnitPlayer = (flags: number): boolean => {
        const isPlayerControlled = this.hasFlag(flags, UnitFlags.REACTION_FRIENDLY);
        const isPlayerType = this.hasFlag(flags, UnitFlags.AFFILIATION_MINE);
        return (isPlayerControlled && isPlayerType);
    }

    hasFlag = (flags: number, flag: number): boolean => {
        return (flags & flag) !== 0;
    }

    ambiguate = (nameRealm: string): string[] => {
        const split = nameRealm.split("-");
        const name = split[0];
        const realm = split[1];
        return [name, realm];
    }

    registerPlayerDeath = (timestamp: number, name: string, specId: number): void => {
        // Ensure a timestamp cannot be negative
        timestamp = timestamp >= 0 ? timestamp : 0;
        this.metadata.playerDeaths.push({ name, specId, timestamp });
    }

    battlegroundStart (line: LogLine): void {
        const zoneID = parseInt(line.arg(1), 10);
        const battlegroundName = battlegrounds[zoneID];

        this.videoStartDate = line.date();

        this.metadata = {
            name: battlegroundName,
            category: VideoCategory.Battlegrounds,
            zoneID: zoneID,
            duration: 0,
            result: false,
            playerDeaths: [],
        }

        this.startRecording(VideoCategory.Battlegrounds);
    }

    battlegroundStop (line: LogLine): void {
        this.videoStopDate = line.date();
        this.endRecording();
    }

    zoneChangeStop (line: LogLine): void {
        this.videoStopDate = line.date();
        this.endRecording();
    }

    handleUnitDiedLine (line: LogLine): void {
        // Only handle UNIT_DIED if we have a videoStartDate AND we're recording
        // We're not interested in player deaths outside of an active activity/recording.
        if (!this.videoStartDate || !this.recorder.isRecording) {
            return;
        }
    
        const unitFlags = parseInt(line.arg(7), 16);
        const isUnitUnconsciousAtDeath = Boolean(parseInt(line.arg(9), 10));
    
        // We only want player deaths and we don't want fake deaths,
        // i.e. a hunter that feigned death
        if (!this.isUnitPlayer(unitFlags) || isUnitUnconsciousAtDeath) {
            return;
        }
    
        const playerName = line.arg(6);
        const playerGuid = line.arg(5);

        // @@@
        // const playerSpecId = this.getCombatantByGuid(playerGuid)?.specID ?? 0;
    
        // Add player death and subtract 2 seconds from the time of death to allow the
        // user to view a bit of the video before the death and not at the actual millisecond
        // it happens.
        const relativeTimeStamp = ((line.date().getTime() - 2) - this.videoStartDate.getTime()) / 1000;
        // @@@
        //this.registerPlayerDeath(relativeTimeStamp, playerName, playerSpecId);
    }

    forceStopRecording = () => {
        this.videoStopDate = new Date();
        const milliSeconds = (this.videoStopDate.getTime() - this.videoStartDate.getTime());
        this.metadata.duration = Math.round(milliSeconds / 1000);
    
        // Clear all kinds of stuff that would prevent the app from starting another
        // recording
        this.clearCombatants();
    
        // @@@
        //testRunning = false;
    
        this.recorder.stop(this.metadata, 0);
    }
}

