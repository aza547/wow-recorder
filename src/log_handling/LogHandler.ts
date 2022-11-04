import { Combatant } from "../main/combatant";
import { CombatLogParser, LogLine } from "../main/combatLogParser";
import ConfigService from "../main/configService";
import { categoryRecordingSettings, VideoCategory } from "../main/constants";
import { Recorder } from "../main/recorder";
import { UnitFlags } from "../main/types";
import Activity from "../activitys/Activity";
import RaidEncounter from "../activitys/RaidEncounter";

/**
 * Generic LogHandler class. Everything in this class must be valid for both
 * classic and retail combat logs. 
 * 
 * If you need something flavour specific then put it in the appropriate 
 * subclass; i.e. RetailLogHandler or ClassicLogHandler.
 */
export default class LogHandler {
    protected recorder;
    protected combatLogParser: CombatLogParser;
    protected player: Combatant | undefined;
    protected cfg: ConfigService;
    protected _activity?: Activity;

    constructor(recorder: Recorder, 
                combatLogParser: CombatLogParser)
    {
        this.recorder = recorder;
        this.combatLogParser = combatLogParser;
        this.combatLogParser.on('DataTimeout', (ms: number) => { this.dataTimeout(ms)});
        this.cfg = ConfigService.getInstance();
    }

    get activity() { return this._activity };
    set activity(activity) { this._activity = activity };

    handleEncounterStartLine(line: LogLine) {
        console.debug("[LogHandler] Handling ENCOUNTER_START line:", line);

        const startDate = line.date();
        const encounterID = parseInt(line.arg(1), 10)
        const difficultyID = parseInt(line.arg(3), 10);
        
        this.activity = new RaidEncounter(startDate,
                                          encounterID, 
                                          difficultyID);

        this.startRecording(this.activity);
    } 

    handleEncounterEndLine (line: LogLine): void {
        console.debug("[LogHandler] Handling ENCOUNTER_END line:", line);

        if (!this.activity) {
            console.error("[LogHandler] Encounter stop with no active encounter");
            return;
        }

        const result = Boolean(parseInt(line.arg(5), 10));
        this.activity.end(line.date(), result)
        this.endRecording(this.activity);
    }

    handleUnitDiedLine (line: LogLine): void {
        if (!this.activity) {
            console.info("[LogHandler] Ignoring UNIT_DIED line as no active activity");
            return;
        }

        console.debug("[RetailLogHandler] Handling UNIT_DIED line:", line);
        const unitFlags = parseInt(line.arg(7), 16);

        if (!this.isUnitPlayer(unitFlags)) {
            console.info("[LogHandler] Ignoring UNIT_DIED line as non-player");
            return;
        }

        const isUnitUnconsciousAtDeath = Boolean(parseInt(line.arg(9), 10));

        if (isUnitUnconsciousAtDeath) {
            console.info("[LogHandler] Ignoring UNIT_DIED line as not really dead");
            return;
        }
    
        const playerName = line.arg(6);
        const playerGUID = line.arg(5);
        const playerSpecId = this.activity.getCombatant(playerGUID)?.specID ?? 0;
    
        // Add player death and subtract 2 seconds from the time of death to allow the
        // user to view a bit of the video before the death and not at the actual millisecond
        // it happens.
        const deathDate = (line.date().getTime() - 2) / 1000;
        const activityStartDate = this.activity.startDate.getTime() / 1000;
        const relativeTime = deathDate - activityStartDate;
        
        this.registerPlayerDeath(relativeTime, playerName, playerSpecId);
    }

    startRecording = (activity: Activity) => {
        const category = activity.category;
        const allowed = this.allowRecordCategory(category);

        if (!allowed) {
            console.info("[LogHandler] Not configured to record", category);
            return;
        } 
        
        const recorderReady = (!this.recorder.isRecording) && (this.recorder.isRecordingBuffer);
        
        if (!recorderReady) {
            console.error("[LogHandler] Avoiding error by not attempting to start recording",
                            this.recorder.isRecording,
                            this.recorder.isRecordingBuffer);
            return;
        }

        console.log(`[Logutils] Start recording a video for category: ${category}`)
        this.recorder.start();
    };

    endRecording = (activity: Activity) => {
        if (!this.activity) {
            console.error("[LogUtils] No active activity so can't stop");
            return;
        }

        const category = activity.category;
        const overrun = categoryRecordingSettings[category].videoOverrun;

        console.log(`[Logutils] Stop recording video for category: ${this.activity.category}`)

        this.recorder.stop(activity, overrun, false);
        this.activity = undefined;
    }

    dataTimeout(ms: number) {
        console.log(`[LogHandler] Haven't received data for combatlog in ${ms / 1000} seconds.`)

        if (!this.activity) {
            return;
        }

        const isBattleground = (this.activity.category === VideoCategory.Battlegrounds);

        if (isBattleground) {
            this.forceStopRecording();
            return;
        }
    }
    
    // candidate for helper? 
    isUnitSelf = (flags: number): boolean => {
        const isFriendly = this.hasFlag(flags, UnitFlags.REACTION_FRIENDLY);
        const isMine = this.hasFlag(flags, UnitFlags.AFFILIATION_MINE)
        return (isFriendly && isMine);
    }

    // candidate for helper? 
    isUnitPlayer = (flags: number): boolean => {
        const isPlayerControlled = this.hasFlag(flags, UnitFlags.CONTROL_PLAYER);
        const isPlayerType = this.hasFlag(flags, UnitFlags.TYPE_PLAYER);
        return (isPlayerControlled && isPlayerType);
    }

    // candidate for helper? 
    hasFlag = (flags: number, flag: number): boolean => {
        return (flags & flag) !== 0;
    }

    // candidate for helper? 
    ambiguate = (nameRealm: string): string[] => {
        const split = nameRealm.split("-");
        const name = split[0];
        const realm = split[1];
        return [name, realm];
    }

    registerPlayerDeath = (timestamp: number, name: string, specId: number): void => {
        if (!this.activity) {
            console.info("[LogHandler] Can't register player death as no active activity");
            return;
        }

        if (timestamp < 0) {
            console.error("[LogHandler] Tried to set timestamp to", timestamp);
            timestamp = 0;
        }

        this.activity.addDeath({ name, specId, timestamp });
    }

    // candidate for helper? / logutils?
    allowRecordCategory = (category: VideoCategory): boolean => {
        const categoryConfig = categoryRecordingSettings[category];
        const categoryAllowed = this.cfg.get<boolean>(categoryConfig.configKey);

        if (!categoryAllowed) {
            console.info("[LogHandler] Configured to not record:", category);
            return false;
        };

        console.info("[LogHandler] Good to record:", category);
        return true;
    };

    forceStopRecording = () => {
        if (!this.activity) {
            this.recorder.forceStop();
            return;
        }

        this.activity.end(new Date(), false);
        this.endRecording(this.activity);
        this.activity = undefined
    }

    zoneChangeStop(line: LogLine) {
        if (!this.activity) {
            console.error("[RetailLogHandler] No active activity on force zone change stop");
            return;
        }

        const endDate = line.date();
        this.activity.end(endDate, false);
        this.endRecording(this.activity);
    }
}

