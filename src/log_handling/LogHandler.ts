import { Combatant } from "../main/combatant";
import { CombatLogParser, LogLine } from "../main/combatLogParser";
import ConfigService from "../main/configService";
import { categoryRecordingSettings, VideoCategory } from "../main/constants";
import { Recorder } from "../main/recorder";
import { Flavour, PlayerDeathType } from "../main/types";
import Activity from "../activitys/Activity";
import RaidEncounter from "../activitys/RaidEncounter";
import { allowRecordCategory, ambiguate, isUnitFriendly, isUnitPlayer, isUnitSelf } from "../main/logutils";

/**
 * Generic LogHandler class. Everything in this class must be valid for both
 * classic and retail combat logs. 
 * 
 * If you need something flavour specific then put it in the appropriate 
 * subclass; i.e. RetailLogHandler or ClassicLogHandler.
 */
export default class LogHandler {
    protected _recorder;
    protected _combatLogParser: CombatLogParser;
    protected _player: Combatant | undefined;
    protected _cfg: ConfigService;
    protected _activity?: Activity;

    constructor(recorder: Recorder, 
                combatLogParser: CombatLogParser)
    {
        this._recorder = recorder;
        this._combatLogParser = combatLogParser;
        this._combatLogParser.on('DataTimeout', (ms: number) => { this.dataTimeout(ms)});
        this._cfg = ConfigService.getInstance();
    }

    get activity() { return this._activity };
    get combatLogParser() { return this._combatLogParser };
    get recorder() { return this._recorder };
    get cfg() { return this._cfg };
    get player() { return this._player };

    set activity(activity) { this._activity = activity };
    
    handleEncounterStartLine(line: LogLine, flavour: Flavour) {
        console.debug("[LogHandler] Handling ENCOUNTER_START line:", line);

        const startDate = line.date();
        const encounterID = parseInt(line.arg(1), 10)
        const difficultyID = parseInt(line.arg(3), 10);
        
        this.activity = new RaidEncounter(startDate,
                                          encounterID, 
                                          difficultyID,
                                          flavour);

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
        

        const unitFlags = parseInt(line.arg(7), 16);

        if (!isUnitPlayer(unitFlags)) {
            // Deliberatly not logging here as not interesting and frequent.
            return;
        }

        const isUnitUnconsciousAtDeath = Boolean(parseInt(line.arg(9), 10));

        if (isUnitUnconsciousAtDeath) {
            // Deliberatly not logging here as not interesting and frequent.
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
        let relativeTime = deathDate - activityStartDate;

        if (relativeTime < 0) {
            console.error("[LogHandler] Tried to set timestamp to", relativeTime);
            relativeTime = 0;
        }

        const playerDeath: PlayerDeathType = {
            name: playerName,
            specId: playerSpecId,
            timestamp: relativeTime,
            friendly: isUnitFriendly(unitFlags),
        }

        this.activity.addDeath(playerDeath);
    }

    startRecording = (activity: Activity) => {
        const category = activity.category;
        const allowed = allowRecordCategory(category);

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
        console.log(`[Logutils] Stop recording video for category: ${this.activity.category}`)

        this.recorder.stop(activity, false);
        this.activity = undefined;
    }

    dataTimeout(ms: number) {
        console.log(`[LogHandler] Haven't received data for combatlog in ${ms / 1000} seconds.`)

        if (!this.activity) {
            return;
        }

        const isBattleground = (this.activity.category === VideoCategory.Battlegrounds);

        if (isBattleground) {
            this.forceEndActivity(-ms / 1000);
            return;
        }
    }

    forceEndActivity = async (timedelta: number = 0) => {
        console.log("[LogHandler] Force ending activity with timedelta", timedelta);

        if (!this.activity) {
            await this.recorder.forceStop();
            return;
        }
        
        const endDate = new Date();
        endDate.setSeconds(endDate.getSeconds() + timedelta);
        this.activity.overrun = 0;
        
        this.activity.end(endDate, false);
        this.endRecording(this.activity);
        this.activity = undefined;
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

    isArena() {
        if (!this.activity) {
            return false;
        }

        const category = this.activity.category;

        return (category === VideoCategory.TwoVTwo) ||
               (category === VideoCategory.ThreeVThree) ||
               (category === VideoCategory.FiveVFive) ||
               (category === VideoCategory.Skirmish) ||
               (category === VideoCategory.SoloShuffle);
    }

    isBattleground() {
        if (!this.activity) {
            return false;
        }

        const category = this.activity.category;
        return (category === VideoCategory.Battlegrounds);
    }

    processCombatant(srcGUID: string, srcNameRealm: string, srcFlags: number) {
        if (!this.activity) {
            return;
        }

        // Logs sometimes emit this GUID and we don't want to include it.
        // No idea what causes it. Seems really common but not exlusive on 
        // "Shadow Word: Death" casts. 
        if (srcGUID === "0000000000000000") {
            return;
        }

        if (!isUnitPlayer(srcFlags)) {
            return;
        }

        // Even if the combatant exists already we still update it with the info it 
        // may not have yet. We can't tell the name, realm or if it's the player
        // from COMBATANT_INFO events. 
        const combatant = this.activity.getCombatant(srcGUID) || new Combatant(srcGUID);
        [combatant.name, combatant.realm] = ambiguate(srcNameRealm);

        if (isUnitSelf(srcFlags)) {
            this.activity.playerGUID = srcGUID;
        }

        this.activity.addCombatant(combatant);
        return combatant;
    }
}

