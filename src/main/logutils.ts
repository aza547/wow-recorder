/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
import { Combatant } from './combatant';
import { recorder }  from './main';
import { calculateKeystoneCompletionResult, ChallengeModeDungeon, ChallengeModeVideoSegment, VideoSegmentType } from './keystone';
import { VideoCategory, battlegrounds, dungeonEncounters, dungeonTimersByMapId, dungeonsByMapId }  from './constants';

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
        if (month) dateObj.setMonth(month);
        dateObj.setHours(hours);
        dateObj.setMinutes(mins);
        dateObj.setSeconds(secs);
        dateObj.setMilliseconds(msec);

        return dateObj;
    }
}

let activeChallengeMode: ChallengeModeDungeon | undefined;

/**
 * wowProcessStopped
 */
 type Metadata = {
    name: string;
    category: string;
    zoneID?: number;
    encounterID?: number;
    challengeMode?: ChallengeModeDungeon;
    difficultyID? : number;
    duration: number;
    result: boolean;
    playerName?: string;
    playerRealm?: string;
    playerSpecID?: number;
    teamMMR?: number;
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
    console.log("Wow.exe is running");
    isRetailRunning = true;
    recorder.startBuffer();
};

/**
 * wowProcessStopped
 */
const wowProcessStopped = () => {
    console.log("Wow.exe has stopped");
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
      console.log('ERROR: ', error);
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
                    if (maxSplits && args_list.length >= maxSplits) {
                        break;
                    }
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
        category: line.args[3],
        zoneID: zoneID,
        duration: 0,
        result: false,
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

    combatantMap.clear();
    playerCombatant = undefined;

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

    if (!(mapId in dungeonTimersByMapId && mapId in dungeonsByMapId)) {
        console.error(`[ChallengeMode] Invalid/unsupported mapId for Challenge Mode dungeon: ${mapId} ('${zoneName}')`)
    }

    const dungeonAffixes = line.args[5].map((v: string) => parseInt(v, 10));

    activeChallengeMode = new ChallengeModeDungeon(
        videoStartDate.getTime(),    // Start time
        dungeonTimersByMapId[mapId], // Dungeon timers
        parseInt(line.args[2], 10),  // zoneId
        mapId,                       // mapId
        parseInt(line.args[4], 10),  // Keystone Level
        dungeonAffixes,              // Array of affixes, as numbers
    )

    activeChallengeMode.addVideoSegment(new ChallengeModeVideoSegment(
        VideoSegmentType.Trash, videoStartDate, 0
    ));

    console.debug("[ChallengeMode] Starting Challenge Mode instance")

    metadata = {
        name: line.args[1],
        encounterID: parseInt(line.args[1], 10),
        category: VideoCategory.MythicPlus,
        zoneID: parseInt(line.args[5]),
        duration: 0,
        result: false,
        challengeMode: activeChallengeMode
    };

    recorder.start();
};

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

    combatantMap.clear();
    playerCombatant = undefined;

    // The actual log duration of the dungeon, from which keystone upgrade
    // levels can be calculated
    activeChallengeMode.duration = Math.round(parseInt(line.args[4], 10) / 1000);

    // Calculate whether the key was timed or not
    activeChallengeMode.timed = calculateKeystoneCompletionResult(activeChallengeMode.allottedTime, activeChallengeMode.duration) > 0;

    console.debug("[ChallengeMode] Ending current video segment")
    activeChallengeMode.endVideoSegment(videoStopDate);

    // If last video segment is less than 10 seconds long, discard it.
    // It's probably not useful
    const lastVideoSegment = activeChallengeMode.getCurrentVideoSegment();
    if (lastVideoSegment && lastVideoSegment.length() < 10000) {
        console.debug("[ChallengeMode] Removing last video segment, because it's too short.")
        activeChallengeMode.removeLastSegment();
    }

    recorder.stop(metadata, overrun);
};


const getRelativeTimestampForVideoSegment = (currentDate: Date): number => {
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
    const videoStopDate = line.date();

    if (recorder.isRecording && activeChallengeMode) {
        const vSegment = new ChallengeModeVideoSegment(
            VideoSegmentType.BossEncounter, videoStopDate, getRelativeTimestampForVideoSegment(videoStopDate),
            encounterID
        )
        activeChallengeMode.addVideoSegment(vSegment, videoStopDate);
        console.debug(`[ChallengeMode] Starting new boss encounter: ${dungeonEncounters[encounterID]}`)

        return;
    }

    videoStartDate = videoStopDate;

    metadata = {
        name: "name",
        category: VideoCategory.Raids,
        encounterID: encounterID,
        difficultyID: difficultyID,
        duration: 0,
        result: false,
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
        const currentSegment = activeChallengeMode.getCurrentVideoSegment()
        if (currentSegment) {
            currentSegment.result = encounterResult
        }

        const vSegment = new ChallengeModeVideoSegment(
            VideoSegmentType.Trash, videoStopDate, getRelativeTimestampForVideoSegment(videoStopDate)
        )

        // Add a trash segment as the boss encounter ended
        activeChallengeMode.addVideoSegment(vSegment, videoStopDate);
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
    
    combatantMap.clear();
    playerCombatant = undefined;

    recorder.stop(metadata, overrun);
}

/**
 * Handle a line from the WoW log.
 */
function handleZoneChange (line: LogLine): void {
    console.log("Handling zone change: ", line);
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
        console.log("ZONE_CHANGE into BG, start recording");
        battlegroundStart(line);   
    } else if (isRecording && isRecordingBG && !isNewZoneBG) {
        console.log("ZONE_CHANGE out of BG, stop recording");
        battlegroundStop(line);
    } else if (isRecording && isRecordingArena) {
        console.log("ZONE_CHANGE out of arena, stop recording");
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
    console.log("combatant map", combatantMap.keys())
    return combatantMap.get(guid);
}

/**
 * ZONE_CHANGE event into a BG.  
 */
 const battlegroundStart = (line: LogLine) => {
    const zoneID = parseInt(line.args[1], 10);

    videoStartDate = line.date();

    metadata = {
        name: battlegrounds[zoneID],
        category: VideoCategory.Battlegrounds,
        zoneID: zoneID,
        duration: 0,
        result: false,
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
 * Handle a unit dying, but only if it's a player and we're in a Mythic Keystone dungeon
 */
function handleUnitDiedLine (line: LogLine): void {
    // This is only interesting in a Mythic Keystone dungeon
    if (!activeChallengeMode) {
        return;
    }

    const unitFlags = parseInt(line.args[7], 16);

    if (!isUnitPlayer(unitFlags)) {
        return;
    }

    const playerName = line.args[6];
    const playerGuid = line.args[5];
    const playerSpecId = getCombatantByGuid(playerGuid)?.specID ?? 0;

    // Add player death and subtract 2 seconds from the time of death to allow the
    // user to view a bit of the video before the death and not at the actual millisecond
    // it happens.
    const relativeTimeStamp = ((line.date().getTime() - 2) - activeChallengeMode.startTime) / 1000;
    activeChallengeMode.addPlayerDeath(relativeTimeStamp, playerName, playerSpecId)
}

/**
 * Determine if the unit is a player
 *
 * This is determined by the unit having these flags:
 *
 * 0x00000002 = COMBATLOG_OBJECT_AFFILIATION_PARTY
 * 0x00000010 = COMBATLOG_OBJECT_REACTION_FRIENDLY
 * 0x00000100 = COMBATLOG_OBJECT_CONTROL_PLAYER
 * 0x00000400 = COMBATLOG_OBJECT_TYPE_PLAYER
 *
 * OR isUnitSelf(unitFlags)
 *
 * See more here: https://wowpedia.fandom.com/wiki/UnitFlag
 */
const isUnitPlayer = (unitFlags: number): boolean => {
    return ((unitFlags & 0x512) === 0x512) || isUnitSelf(unitFlags);
}

/**
 * Determine if the srcFlags indicate a friendly unit.
 * @param srcFlags the srcFlags bitmask
 * @returns true if self; false otherwise. 
 */
const isUnitSelf = (srcFlags: number): boolean => {
    const masked = srcFlags & 0x511;
    return masked === 0x511;
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
    console.log("User started a test!");

    if (testRunning) {
        console.info("Test already running, not starting test.");
    } 
    
    if (isRetailRunning) {
        console.info("WoW is running, starting test.");
        testRunning = true;
    } else {
        console.info("WoW isn't running, not starting test.");
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
