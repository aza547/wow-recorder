/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
import { Combatant } from './combatant';
import { recorder }  from './main';
import { battlegrounds, dungeonEncounters, dungeonsByMapId, dungeonTimersByMapId, VideoCategory }  from './constants';
import { PlayerDeathType, UnitFlags } from './types';
import { ChallengeModeDungeon, ChallengeModeTimelineSegment, TimelineSegmentType } from './keystone';

const tail = require('tail').Tail;
const glob = require('glob');
const fs = require('fs');
const tasklist = require('tasklist');

let tailHandler: any;
let currentLogFile: string;
let lastLogFile: string;
let videoStartDate: Date;
let metadata: Metadata;
let combatantMap: Map<string, Combatant> = new Map();
let playerCombatant: Combatant | undefined;
let testRunning: boolean = false;
let activeChallengeMode: ChallengeModeDungeon | undefined;

declare interface LogLineHandlerType {
    (line: LogLine): void
};

type InterestingCombatLogEventsType = { [key: string]: LogLineHandlerType }

/**
 * List of of combat events we want to handle associated with their
 * respective handler function.
 */
const interestingCombatLogEvents: InterestingCombatLogEventsType = {
    'ARENA_MATCH_START': handleArenaStartLine,
    'ARENA_MATCH_END': handleArenaStopLine,
    'CHALLENGE_MODE_START': handleChallengeModeStartLine,
    'CHALLENGE_MODE_END': handleChallengeModeEndLine,
    'ENCOUNTER_START': handleEncounterStartLine,
    'ENCOUNTER_END': handleEncounterStopLine,
    'ZONE_CHANGE': handleZoneChange,
    'COMBATANT_INFO': handleCombatantInfoLine,
    'SPELL_AURA_APPLIED': handleSpellAuraAppliedLine,
    'UNIT_DIED': handleUnitDiedLine,
};

/**
 * A parsed line from the WoW combat log
 */
class LogLine {
    constructor (
        // Timestamp in string format, as-is, from the log
        // Example: '8/3 22:09:58.548'
        public timestamp: string,

        // Multi-dimensional array of arguments
        // Example: 'ARENA_MATCH_START', '2547', '33', '2v2', '1'
        public args: any[]
    ) {}

    /**
     * Parse the timestamp from a log line and create a Date value from it
     *
     * Split the line by any delimiter that isn't a number
     */
    date (): Date {
        const timeParts = this.timestamp
            .split(/[^0-9]/, 6)
            .map(v => parseInt(v, 10))
            .reverse();
        const [msec, secs, mins, hours, day, month] = timeParts;
        const dateObj = new Date();

        if (day) dateObj.setDate(day);
        if (month) dateObj.setMonth(month - 1);
        dateObj.setHours(hours);
        dateObj.setMinutes(mins);
        dateObj.setSeconds(secs);
        dateObj.setMilliseconds(msec);

        return dateObj;
    }
}

/**
 * wowProcessStopped
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

/**
 * Is wow running? Starts false but we'll check immediately on start-up. 
 */
let isRetailRunning: boolean = false;
let isClassicRunning: boolean = false;

/**
 * Timers for poll
 */
let pollWowProcessInterval: NodeJS.Timer;
let watchLogsInterval: NodeJS.Timer;
 
/**
 * wowProcessStarted
 */
const wowProcessStarted = () => {
    console.log("[Logutils] Wow.exe is running");
    isRetailRunning = true;
    recorder.startBuffer();
};

/**
 * wowProcessStopped
 */
const wowProcessStopped = () => {
    console.log("[Logutils] Wow.exe has stopped");
    isRetailRunning = false;

    if (recorder.isRecording) {
        const videoStopDate = new Date();
        const milliSeconds = (videoStopDate.getTime() - videoStartDate.getTime()); 
        metadata.duration = Math.round(milliSeconds / 1000);
    
        // Assume loss as game was closed. 
        metadata.result = false;
        recorder.stop(metadata);
    } else if (recorder.isRecordingBuffer) {
        recorder.stopBuffer();
    }
};

/**
 * getLatestLog 
 */
const getLatestLog = (path: any) => {
    const globPath = path + 'WoWCombatLog*.txt';

    const logs = glob.sync(globPath)
        .map((name: any) => ({name, mtime: fs.statSync(name).mtime}))
        .sort((A: any, B: any) => B.mtime - A.mtime);

    if (logs.length === 0) {
        return false;
    }
    
    const newestLog = logs[0].name;
    return newestLog;
}    

/**
 * Tail a specific file. 
 */
const tailFile = (path: string) => {
    if (tailHandler) {
        tailHandler.unwatch();
        tailHandler = null;
    } 

    const options = { 
        flushAtEOF: true 
    }

    tailHandler = new tail(path, options);

    tailHandler.on("line", function(data: string) {
        handleLogLine(data);
    });

    tailHandler.on("error", function(error: unknown ) {
      console.log('[Logutils] ERROR: ', error);
    });
}

/**
 * Splits a WoW combat line intelligently with respect to quotes,
 * lists, tuples, and what have we.
 *
 * @param line Log line straight from the combat log
 * @param maxSplits Madximum number of elements to find (same as `limit` for `string.split()` )
 */
const splitLogLine = (line: string, maxSplits?: number): LogLine => {
    // Avoid evaluating this on each iteration of the for(..) loop below
    const line_len = line.length

    // Array of items that has been parsedin the current scope of the parsing.
    //
    // This can end up being multidimensional in the case of some combat events
    // that have complex data stored, like `COMBATANT_INFO`.
    const list_items: any[] = [];

    // Final argument list as parsed, which can contain one or more instances of `list_items`
    // depending on the complexity of the combat log line
    const args_list: any[] = [];
    let in_quote = false;
    let open_lists = 0;
    let value: any = '';

    // Combat log line always has '<timestamp>  <line>' format,
    // that is, two spaces between ts and line.
    const tsIndexEnd = line.indexOf('  ');
    const timestamp = line.substring(0, tsIndexEnd);

    for (let ptr = tsIndexEnd + 2; ptr < line_len; ptr++) {
        const c = line.charAt(ptr);
        if (c === '\n') {
            break;
        }
        if (maxSplits && args_list.length >= maxSplits) {
            break;
        }

        if (in_quote) {
            if (c === '"') {
                in_quote = false;
                continue;
            }

        } else {
            switch (c) {
            case ',':
                if (open_lists > 0) {
                    list_items.at(-1)?.push(value);
                } else {
                    args_list.push(value);
                }

                value = '';
                continue;

            case '"':
                in_quote = true;
                continue;

            case '[':
            case '(':
                list_items.push([]);
                open_lists++;
                continue;

            case ']':
            case ')':
                if (!list_items.length) {
                    throw `Unexpected ${c}. No list is open.`;
                }

                if (value) {
                    list_items.at(-1)?.push(value);
                }

                value = list_items.pop();
                open_lists--;
                continue;
            }
        }

        value += c;
    }

    if (value) {
        args_list.push(value)
    }

    if (open_lists > 0) {
        throw `Unexpected EOL. There are ${open_lists} open list(s).`
    }

    return new LogLine(timestamp, args_list)
}

/**
 * Handle a line from the WoW log. 
 */
const handleLogLine = (line: string) => {
    // Parse line, only until the line token is encountered
    let logLine = splitLogLine(line, 1)
    const logLineTypeToken = logLine.args[0]

    // Check if we are interested in this event, and if not, discard it
    if (!(logLineTypeToken in interestingCombatLogEvents)) {
        return;
    }

    // Parse the full line
    logLine = splitLogLine(line)

    // Call the handler for the given combat log line token
    // (e.g. `ENCOUNTER_START`)
    interestingCombatLogEvents[logLineTypeToken](logLine);
}

/**
 * Handle a line from the WoW log. 
 */
function handleArenaStartLine (line: LogLine): void {
    if (recorder.isRecording) return; 
    playerCombatant = undefined;
    const zoneID = parseInt(line.args[1], 10);

    // If all goes to plan we don't need this but we do it incase the game
    // crashes etc. so we can still get a reasonable duration.
    videoStartDate = line.date();

    metadata = {
        name: "name",
        category: (line.args[3] as VideoCategory),
        zoneID: zoneID,
        duration: 0,
        result: false,
        playerDeaths: []
    }
    
    recorder.start();
}

/**
 * Handle a line from the WoW log. 
 */
function handleArenaStopLine (line: LogLine): void {
    if (!recorder.isRecording) return; 

    if (playerCombatant) {
        metadata.playerName = playerCombatant.name;
        metadata.playerRealm = playerCombatant.realm;
        metadata.playerSpecID = playerCombatant.specID;        
    }

    let duration; 
    
    // Helpfully ARENA_MATCH_END events contain the game duration. Solo shuffle
    // ARENA_MATCH_END duration only counts the last game so needs special handling. 
    if (metadata.category !== VideoCategory.SoloShuffle) {
        duration = parseInt(line.args[2], 10);
    } else {
        const soloShuffleStopDate = line.date();
        const milliSeconds = (soloShuffleStopDate.getTime() - videoStartDate.getTime()); 
        duration = Math.round(milliSeconds / 1000);
    }     

    // Add a few seconds so we reliably can see the end screen.
    const overrun = 3;   
    metadata.duration = duration + overrun; 

    const [result, MMR] = determineArenaMatchResult(line); 
    metadata.result = result;
    metadata.teamMMR = MMR;

    clearCombatants();

    recorder.stop(metadata, overrun);
}

/**
 * Determines the arena match result.
 * @param line the line from the WoW log. 
 * @returns [win: boolean, newRating: number]
 */
const determineArenaMatchResult = (line: LogLine): any[] => {
    if (playerCombatant === undefined) return [undefined, undefined];
    const teamID = playerCombatant.teamID;
    const indexForMMR = (teamID == 0) ? 3 : 4; 
    const MMR = parseInt(line.args[indexForMMR], 10);
    const winningTeamID = parseInt(line.args[1], 10);
    const win = (teamID === winningTeamID)
    return [win, MMR];
}

/**
 * Handle a log line for CHALLENGE_MODE_START
 */
function handleChallengeModeStartLine (line: LogLine): void {
    // It's impossible to start a keystone dungeon while another one is in progress
    // so we'll just remove the existing one and make a new one when `CHALLENGE_MODE_START`
    // is encountered.
    if (activeChallengeMode) {
        console.warn("[ChallengeMode] A Challenge Mode instance is already in progress; abandoning it.")
    }
    videoStartDate = line.date();

    const zoneName = line.args[2];
    const mapId = parseInt(line.args[3], 10);
    const hasDungeonMap = (mapId in dungeonsByMapId);
    const hasTimersForDungeon = (mapId in dungeonTimersByMapId);

    if (!hasDungeonMap || !hasTimersForDungeon) {
        console.error(`[ChallengeMode] Invalid/unsupported mapId for Challenge Mode dungeon: ${mapId} ('${zoneName}')`)
    }

    clearCombatants();

    const dungeonAffixes = line.args[5].map((v: string) => parseInt(v, 10));

    activeChallengeMode = new ChallengeModeDungeon(
        dungeonTimersByMapId[mapId], // Dungeon timers
        parseInt(line.args[2], 10),  // zoneId
        mapId,                       // mapId
        parseInt(line.args[4], 10),  // Keystone Level
        dungeonAffixes,              // Array of affixes, as numbers
    )

    activeChallengeMode.addTimelineSegment(new ChallengeModeTimelineSegment(
        TimelineSegmentType.Trash, videoStartDate, 0
    ));

    console.debug("[ChallengeMode] Starting Challenge Mode instance")

    metadata = {
        name: line.args[1], // Instance name (e.g. "Operation: Mechagon")
        encounterID: parseInt(line.args[1], 10),
        category: VideoCategory.MythicPlus,
        zoneID: parseInt(line.args[5]),
        duration: 0,
        result: false,
        challengeMode: activeChallengeMode,
        playerDeaths: [],
    };

    recorder.start();
};

/**
 * Handle a log line for CHALLENGE_MODE_END
 */
function handleChallengeModeEndLine (line: LogLine): void {
    if (!recorder.isRecording || !activeChallengeMode) {
        return;
    }

    if (playerCombatant) {
        metadata.playerName = playerCombatant.name;
        metadata.playerRealm = playerCombatant.realm;
        metadata.playerSpecID = playerCombatant.specID;
    }

    // Add a few seconds so we reliably see the aftermath of a kill.
    const overrun = 5;

    const videoStopDate = line.date();
    const milliSeconds = (videoStopDate.getTime() - videoStartDate.getTime());
    const duration = Math.round(milliSeconds / 1000);

    metadata.duration = duration + overrun;
    metadata.result = Boolean(parseInt(line.args[1]));

    clearCombatants();

    // The actual log duration of the dungeon, from which keystone upgrade
    // levels can be calculated
    activeChallengeMode.duration = Math.round(parseInt(line.args[4], 10) / 1000);

    // Calculate whether the key was timed or not
    activeChallengeMode.timed = ChallengeModeDungeon.calculateKeystoneUpgradeLevel(activeChallengeMode.allottedTime, activeChallengeMode.duration) > 0;

    console.debug("[ChallengeMode] Ending current timeline segment")
    activeChallengeMode.endCurrentTimelineSegment(videoStopDate);

    // If last timeline segment is less than 10 seconds long, discard it.
    // It's probably not useful
    const lastTimelineSegment = activeChallengeMode.getCurrentTimelineSegment();
    if (lastTimelineSegment && lastTimelineSegment.length() < 10000) {
        console.debug("[ChallengeMode] Removing last timeline segment, because it's too short.")
        activeChallengeMode.removeLastTimelineSegment();
    }

    console.debug("[ChallengeMode] Ending Challenge Mode instance");

    recorder.stop(metadata, overrun);
};

const getRelativeTimestampForTimelineSegment = (currentDate: Date): number => {
    if (!videoStartDate) {
        return 0;
    }

    return (currentDate.getTime() - videoStartDate.getTime()) / 1000;
};

/**
 * Handle a line from the WoW log. 
 */
function handleEncounterStartLine (line: LogLine): void {
    const encounterID = parseInt(line.args[1], 10)
    const difficultyID = parseInt(line.args[3], 10);
    const eventDate = line.date();

    // If we're recording _and_ has an active challenge mode dungeon,
    // add a new boss encounter timeline segment.
    if (recorder.isRecording && activeChallengeMode) {
        const vSegment = new ChallengeModeTimelineSegment(
            TimelineSegmentType.BossEncounter,
            eventDate,
            getRelativeTimestampForTimelineSegment(eventDate),
            encounterID
        );

        activeChallengeMode.addTimelineSegment(vSegment, eventDate);
        console.debug(`[ChallengeMode] Starting new boss encounter: ${dungeonEncounters[encounterID]}`)

        return;
    }

    videoStartDate = eventDate;

    metadata = {
        name: "name",
        category: VideoCategory.Raids,
        encounterID: encounterID,
        difficultyID: difficultyID,
        duration: 0,
        result: false,
        playerDeaths: [],
    }

    recorder.start();
}

/**
 * Handle a line from the WoW log. 
 */
function handleEncounterStopLine (line: LogLine): void {
    const videoStopDate = line.date();
    const encounterResult = Boolean(parseInt(line.args[5], 10));
    const encounterID = parseInt(line.args[1], 10);

    if (recorder.isRecording && activeChallengeMode) {
        const currentSegment = activeChallengeMode.getCurrentTimelineSegment()
        if (currentSegment) {
            currentSegment.result = encounterResult
        }

        const vSegment = new ChallengeModeTimelineSegment(
            TimelineSegmentType.Trash, videoStopDate, getRelativeTimestampForTimelineSegment(videoStopDate)
        )

        // Add a trash segment as the boss encounter ended
        activeChallengeMode.addTimelineSegment(vSegment, videoStopDate);
        console.debug(`[ChallengeMode] Ending boss encounter: ${dungeonEncounters[encounterID]}`)
        return;
    }

    if (playerCombatant) {
        metadata.playerName = playerCombatant.name;
        metadata.playerRealm = playerCombatant.realm;
        metadata.playerSpecID = playerCombatant.specID;        
    }

    // Add a few seconds so we reliably see the aftermath of a kill.
    const overrun = 15;

    const milliSeconds = (videoStopDate.getTime() - videoStartDate.getTime()); 
    const duration = Math.round(milliSeconds / 1000) + overrun;

    metadata.duration = duration; 
    metadata.result = encounterResult
    
    clearCombatants();

    recorder.stop(metadata, overrun);
}

/**
 * Handle a line from the WoW log.
 */
function handleZoneChange (line: LogLine): void {
    console.log("[Logutils] Handling zone change: ", line);
    const zoneID = parseInt(line.args[1], 10);
    const isNewZoneBG = battlegrounds.hasOwnProperty(zoneID);
    const isRecording = recorder.isRecording;

    let isRecordingBG = false;
    let isRecordingArena = false;

    if (metadata !== undefined) {
        isRecordingBG = (metadata.category === VideoCategory.Battlegrounds);
        isRecordingArena = (metadata.category === VideoCategory.TwoVTwo) ||
                           (metadata.category === VideoCategory.ThreeVThree) ||
                           (metadata.category === VideoCategory.SoloShuffle) ||
                           (metadata.category === VideoCategory.Skirmish);
    }

    if (!isRecording && isNewZoneBG) {
        console.log("[Logutils] ZONE_CHANGE into BG, start recording");
        battlegroundStart(line);   
    } else if (isRecording && isRecordingBG && !isNewZoneBG) {
        console.log("[Logutils] ZONE_CHANGE out of BG, stop recording");
        battlegroundStop(line);
    } else if (isRecording && isRecordingArena) {
        console.log("[Logutils] ZONE_CHANGE out of arena, stop recording");
        zoneChangeStop(line);
    }

    // TODO there is the case here where a tilted raider hearths 
    // out mid-pull. I think the correct way to handle is just a 
    // log inactivity stop, else raid encounters with ZONE_CHANGES
    // internally will always stop recording. That's a bit of work
    // so I'm skipping the implementation for now and making a 
    // quick fix. For now, hearting out mid-encounter won't stop
    // the recording and the user will need to restart the app.  
}

/**
 * Handles the SPELL_AURA_APPLIED line from WoW log.
 * @param line the SPELL_AURA_APPLIED line
 */
function handleSpellAuraAppliedLine (line: LogLine): void {
    if (playerCombatant) return;
    if (combatantMap.size === 0) return;    

    const srcGUID = line.args[1];
    const srcNameRealm = line.args[2]
    const srcFlags = parseInt(line.args[3], 16);
    
    const srcCombatant = combatantMap.get(srcGUID);
    if (srcCombatant === undefined) return;

    if (isUnitSelf(srcFlags)) {
        const [srcName, srcRealm] = ambiguate(srcNameRealm);
        srcCombatant.name = srcName;
        srcCombatant.realm = srcRealm;
        playerCombatant = srcCombatant;
    }
}

/**
 * Handles the COMBATANT_INFO line from WoW log by creating a Combatant and 
 * adding it to combatantMap.
 * @param line the COMBATANT_INFO line
 */
function handleCombatantInfoLine (line: LogLine): void {
    const GUID = line.args[1];
    const teamID = parseInt(line.args[2], 10);
    const specID = parseInt(line.args[24], 10);
    let combatantInfo = new Combatant(GUID, teamID, specID);
    combatantMap.set(GUID, combatantInfo);
}

/**
 * Return a combatant by guid, if it exists.
 */
function getCombatantByGuid(guid: string): Combatant | undefined {
    return combatantMap.get(guid);
}

/**
 * Clear combatants map and the current player combatant, if any.
 */
const clearCombatants = () => {
    combatantMap.clear();
    playerCombatant = undefined;
}

/**
 * ZONE_CHANGE event into a BG.  
 */
function battlegroundStart (line: LogLine): void {
    const zoneID = parseInt(line.args[1], 10);
    const battlegroundName = battlegrounds[zoneID];

    videoStartDate = line.date();

    metadata = {
        name: battlegroundName,
        category: VideoCategory.Battlegrounds,
        zoneID: zoneID,
        duration: 0,
        result: false,
        playerDeaths: [],
    }

    recorder.start();
}

/**
 * battlegroundStop
 */
function battlegroundStop (line: LogLine): void {
    const videoStopDate = line.date();
    const milliSeconds = (videoStopDate.getTime() - videoStartDate.getTime()); 
    metadata.duration = Math.round(milliSeconds / 1000);

    // No idea how we can tell who has won a BG so assume loss. 
    // I've just disabled displaying this in the UI so this does nothing.
    metadata.result = false;
    recorder.stop(metadata);
}

/**
 * zoneChangeStop
 */
function zoneChangeStop (line: LogLine): void {
    const videoStopDate = line.date();
    const milliSeconds = (videoStopDate.getTime() - videoStartDate.getTime()); 
    metadata.duration = Math.round(milliSeconds / 1000);

    if (playerCombatant) {
        metadata.playerName = playerCombatant.name;
        metadata.playerRealm = playerCombatant.realm;
        metadata.playerSpecID = playerCombatant.specID;        
    }

    // Assume loss if zoned out of content. 
    metadata.result = false;
    recorder.stop(metadata);
}

/**
 * Register a player death in the video metadata
 */
const registerPlayerDeath = (timestamp: number, name: string, specId: number): void => {
    // Ensure a timestamp cannot be negative
    timestamp = timestamp >= 0 ? timestamp : 0;

    metadata.playerDeaths.push({ name, specId, timestamp });
}

/**
 * Handle a unit dying, but only if it's a player.
 */
 function handleUnitDiedLine (line: LogLine): void {
    const unitFlags = parseInt(line.args[7], 16);
    const isUnitUnconsciousAtDeath = Boolean(parseInt(line.args[9], 10));

    // We only want player deaths and we don't want fake deaths,
    // i.e. a hunter that feigned death
    if (!isUnitPlayer(unitFlags) || isUnitUnconsciousAtDeath) {
        return;
    }

    const playerName = line.args[6];
    const playerGuid = line.args[5];
    const playerSpecId = getCombatantByGuid(playerGuid)?.specID ?? 0;

    // Add player death and subtract 2 seconds from the time of death to allow the
    // user to view a bit of the video before the death and not at the actual millisecond
    // it happens.
    const relativeTimeStamp = ((line.date().getTime() - 2) - videoStartDate.getTime()) / 1000;
    registerPlayerDeath(relativeTimeStamp, playerName, playerSpecId);
}

/**
 * Return whether the bitmask `flags` contain the bitmask `flag`
 */
const hasFlag = (flags: number, flag: number): boolean => {
    return (flags & flag) !== 0;
}

/**
 * Determine if the `flags` value indicate our own unit.
 * This is determined by the unit being a player and having the
 * flags `AFFILIATION_MINE` and `REACTION_FRIENDLY`.
 */
const isUnitSelf = (flags: number): boolean => {
    return isUnitPlayer(flags) && (
        hasFlag(flags, UnitFlags.REACTION_FRIENDLY) &&
        hasFlag(flags, UnitFlags.AFFILIATION_MINE)
    );
}

/**
* Determine if the unit is a player.
*
* See more here: https://wowpedia.fandom.com/wiki/UnitFlag
*/
const isUnitPlayer = (flags: number): boolean => {
    return (
        hasFlag(flags, UnitFlags.CONTROL_PLAYER) &&
        hasFlag(flags, UnitFlags.TYPE_PLAYER)
    );
}

/**
 * Watch the logs. Check every second for a new file, 
 * if there is, swap to watching that. 
 */
const watchLogs = (logdir: any) => {
    if (watchLogsInterval) clearInterval(watchLogsInterval);

    watchLogsInterval = setInterval(() => {
        currentLogFile = getLatestLog(logdir);

        // Handle the case where there is no logs in the WoW log directory.
        if (!currentLogFile) return;
        
        const logFileChanged = (lastLogFile !== currentLogFile);

        if (!lastLogFile || logFileChanged) {
            tailFile(currentLogFile);
            lastLogFile = currentLogFile;
        }
    }, 1000);
}

/**
 * Split name and realm. Name stolen from:
 * https://wowpedia.fandom.com/wiki/API_Ambiguate
 * @param nameRealm string containing name and realm
 * @returns array containing name and realm
 */
 const ambiguate = (nameRealm: string): string[] => {
    const split = nameRealm.split("-");
    const name = split[0];
    const realm = split[1];
    return [name, realm];
}

/**
 * checkWoWProcess
 * @returns {[boolean, boolean]} retailRunning, classicRunning
 */
const checkWoWProcess = async (): Promise<[boolean, boolean]> => {
    let retailRunning = false;
    let classicRunning = false;

    const taskList = await tasklist(); 

    taskList.forEach((process: any) => {
        if (process.imageName === "Wow.exe") {
            retailRunning = true;
        } else if (process.imageName === "WowClassic.exe") {
            classicRunning = true;
        }
    });

    return [retailRunning, classicRunning]
}

/**
 * pollWoWProcessLogic
 */
const pollWoWProcessLogic = async (startup: boolean) => {
    const [retailFound, classicFound] = await checkWoWProcess();
    const retailProcessChanged = (retailFound !== isRetailRunning);    
    // TODO classic support
    const classicProcessChanged = (classicFound !== isClassicRunning);  
    const processChanged = (retailProcessChanged || classicProcessChanged);
    if (!retailProcessChanged && !startup) return;
    (retailFound) ? wowProcessStarted() : wowProcessStopped();
}

/**
 * pollWoWProcess
 */
const pollWowProcess = () => {
    pollWoWProcessLogic(true);
    if (pollWowProcessInterval) clearInterval(pollWowProcessInterval);
    pollWowProcessInterval = setInterval(() => pollWoWProcessLogic(false), 5000);
}

/**
 * Function to invoke if the user clicks the "run a test" button 
 * in the GUI. Uses some sample log lines from 2v2.txt.
 */
const runRecordingTest = () => {
    console.log("[Logutils] User started a test!");

    if (testRunning) {
        console.info("[Logutils] Test already running, not starting test.");
    } 
    
    if (isRetailRunning) {
        console.info("[Logutils] WoW is running, starting test.");
        testRunning = true;
    } else {
        console.info("[Logutils] WoW isn't running, not starting test.");
        return;
    }

    const testArenaStartLine = "8/3 22:09:58.548  ARENA_MATCH_START,2547,33,2v2,1"; 
    const testArenaCombatantLine = "8/3 22:09:58.548  COMBATANT_INFO,Player-1084-08A89569,0,194,452,3670,2353,0,0,0,111,111,111,0,0,632,632,632,0,345,1193,1193,1193,779,256,(102351,102401,197491,5211,158478,203651,155675),(0,203553,203399,353114),[4,4,[],[(1123),(1124),(1129),(1135),(1136),(1819),(1122),(1126),(1128),(1820)],[(256,200),(278,200),(276,200),(275,200),(271,200)]],[(188847,265,(),(7578,8151,7899,1472,6646),()),(186787,265,(),(7578,7893,1524,6646),()),(172319,291,(),(7098,7882,8156,6649,6650,1588),()),(44693,1,(),(),()),(188849,265,(),(8153,7899,1472,6646),()),(186819,265,(),(8136,8137,7578,7896,1524,6646),()),(188848,265,(),(8155,7899,1472,6646),()),(186809,265,(),(8136,8137,7896,1524,6646),()),(186820,265,(),(8136,8138,7578,7893,1524,6646),()),(188853,265,(),(8154,7896,1472,6646),()),(178926,291,(),(8121,7882,8156,6649,6650,1588,6935),()),(186786,265,(),(7579,7893,1524,6646),()),(185304,233,(),(7305,1492,6646),()),(186868,262,(),(7534,1521,6646),()),(186782,265,(),(8136,8138,7893,1524,6646),()),(186865,275,(),(7548,6652,1534,6646),()),(0,0,(),(),()),(147336,37,(),(),())],[Player-1084-08A89569,768,Player-1084-08A89569,5225],327,33,767,1";
    const testArenaSpellLine = "8/3 22:09:59.365  SPELL_AURA_APPLIED,Player-1084-08A89569,\"Alexsmite-TarrenMill\",0x511,0x0,Player-1084-08A89569,\"Alexsmite-TarrenMill\",0x511,0x0,110310,\"Dampening\",0x1,DEBUFF";
    const testArenaStopLine = "8/3 22:12:14.889  ARENA_MATCH_END,0,8,1673,1668";

    handleLogLine(testArenaStartLine);
    handleLogLine(testArenaCombatantLine);
    handleLogLine(testArenaSpellLine);

    setTimeout(() => {
        handleLogLine(testArenaStopLine);
        testRunning = false;
    }, 10 * 1000);
}

export {
    handleLogLine,
    watchLogs,
    getLatestLog,
    pollWowProcess,
    runRecordingTest,
    Metadata,
};
