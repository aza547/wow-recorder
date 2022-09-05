/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
import { Combatant } from './combatant';
import { recorder }  from './main';
import { VideoCategory, battlegrounds }  from './constants';

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

/**
 * wowProcessStopped
 */
 type Metadata = {
    name: string;
    category: string;
    zoneID?: number;
    encounterID?: number;
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
 * TODO: Implement a full split including the time stamp and
 *       log line type (e.g. ENCOUNTER_START)
 */
const splitLogLine = (line: string): any => {
    let in_quote = false;
    let list_items: string[][] = [];
    let tuple_items: string[][] = [];
    let in_what: string[] = [];
    let args_list: any = [];
    let value: any = '';

    // eslint-disable-next-line no-plusplus
    // Timestamp is always a fixed width of 18, and we want to skip that here.
    for (let ptr = 18; ptr < line.length; ptr++) {
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
                const in_what_index = in_what.length - 1
                if (in_what.length) {
                    if (in_what[in_what_index] == 'tuple') {
                        tuple_items[tuple_items.length - 1].push(value);
                    } else if (in_what[in_what_index] == 'list') {
                        list_items[list_items.length - 1].push(value);
                    }
                } else {
                    args_list.push(value);
                }

                value = '';
                continue;

            case '"':
                in_quote = true;
                continue;

            case '[':
                list_items.push([]);
                in_what.push('list');
                continue;

            case ']':
                if (!list_items.length) {
                    throw 'Unexpected ]. No list is open.';
                }

                if (value) {
                    list_items[list_items.length - 1].push(value);
                }

                value = list_items.pop();
                in_what.pop();
                continue;

            case '(':
                tuple_items.push([]);
                in_what.push('tuple');
                continue;

            case ')':
                if (!tuple_items.length) {
                    throw 'Unexpected ). No tuple is open.';
                }

                if (value) {
                    tuple_items[tuple_items.length - 1].push(value);
                }

                value = tuple_items.pop();
                in_what.pop();
                continue;
            }
        }

        value += c;
    }

    if (value) {
        args_list.push(value)
        }

    if (in_what.length) {
        throw 'Unexpected EOL. There are open tuples/lists.'
    }

    return args_list;
}

    /**
 * Handle a line from the WoW log. 
 */
const handleLogLine = (line: string) => {
    // Skip timestamp
    let lineToken = line.substring(18);
    // Get log line token
    lineToken = lineToken.substring(0, lineToken.indexOf(','));

    switch (lineToken) {
        case "ARENA_MATCH_START":
        handleArenaStartLine(line);
            break;
        case "ARENA_MATCH_END":
        handleArenaStopLine(line);
            break;
        case "ENCOUNTER_START":
        handleEncounterStartLine(line);
            break;
        case "ENCOUNTER_END":
        handleEncounterStopLine(line);
            break;
        case "ZONE_CHANGE":
        handleZoneChange(line);
            break;
        case "COMBATANT_INFO":
        handleCombatantInfoLine(line);
            break;
        case "SPELL_AURA_APPLIED":
        handleSpellAuraAppliedLine(line);
            break;
        default:
            break;
    }
}

/**
 * Handle a line from the WoW log. 
 */
const handleArenaStartLine = (line: string) => {
    if (recorder.isRecording) return; 
    const lineArgs = splitLogLine(line);
    const zoneID = parseInt(lineArgs[1], 10);

    // If all goes to plan we don't need this but we do it incase the game
    // crashes etc. so we can still get a reasonable duration.
    videoStartDate = getCombatLogDate(line);

    metadata = {
        name: "name",
        category: lineArgs[3],
        zoneID: zoneID,
        duration: 0,
        result: false,
    }
    
    recorder.start();
}

/**
 * Handle a line from the WoW log. 
 */
 const handleArenaStopLine = (line: string) => {
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
        const lineArgs = splitLogLine(line);
        duration = parseInt(lineArgs[2], 10);
    } else {
        const soloShuffleStopDate = getCombatLogDate(line);
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
const determineArenaMatchResult = (line: string): any[] => {
    if (playerCombatant === undefined) return [undefined, undefined];
    const lineArgs = splitLogLine(line);
    const teamID = playerCombatant.teamID;
    const indexForMMR = (teamID == 0) ? 3 : 4; 
    const MMR = parseInt(lineArgs[indexForMMR], 10);
    const winningTeamID = parseInt(lineArgs[1], 10);
    const win = (teamID === winningTeamID)
    return [win, MMR];
}

/**
 * Handle a line from the WoW log. 
 */
 const handleEncounterStartLine = (line: string) => {
    const lineArgs = splitLogLine(line);

    videoStartDate = getCombatLogDate(line);

    metadata = {
        name: "name",
        category: VideoCategory.Raids,
        encounterID: parseInt(lineArgs[1], 10),
        duration: 0,
        result: false,
    }

    recorder.start();
}

/**
 * Handle a line from the WoW log. 
 */
 const handleEncounterStopLine = (line: string) => {
    if (!recorder.isRecording) return; 

    if (playerCombatant) {
        metadata.playerName = playerCombatant.name;
        metadata.playerRealm = playerCombatant.realm;
        metadata.playerSpecID = playerCombatant.specID;        
    }

    // Add a few seconds so we reliably see the aftermath of a kill.
    const overrun = 15;

    const lineArgs = splitLogLine(line);
    const videoStopDate = getCombatLogDate(line);
    const milliSeconds = (videoStopDate.getTime() - videoStartDate.getTime()); 
    const duration = Math.round(milliSeconds / 1000) + overrun;

    metadata.duration = duration; 
    metadata.result = Boolean(parseInt(lineArgs[5], 10));
    
    combatantMap.clear();
    playerCombatant = undefined;

    recorder.stop(metadata, overrun);
}

/**
 * Handle a line from the WoW log.
 */
 const handleZoneChange = (line: string) => {
    console.log("Handling zone change: ", line);
    const lineArgs = splitLogLine(line);
    const zoneID = parseInt(lineArgs[1], 10);
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
 const handleSpellAuraAppliedLine = (line: string) => {
    if (playerCombatant) return;
    if (combatantMap.size === 0) return;    

    const lineArgs = splitLogLine(line);
    const srcGUID = lineArgs[1];    
    const srcNameRealm = lineArgs[2]
    const srcFlags = parseInt(lineArgs[3], 10);
    
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
const handleCombatantInfoLine = (line: string) => {
    const lineArgs = splitLogLine(line);
    const GUID = lineArgs[1];
    const teamID = parseInt(lineArgs[2], 10);
    const specID = parseInt(lineArgs[24], 10);
    let combatantInfo = new Combatant(GUID, teamID, specID);
    combatantMap.set(GUID, combatantInfo);
}

/**
 * ZONE_CHANGE event into a BG.  
 */
 const battlegroundStart = (line: string) => {
    const lineArgs = splitLogLine(line);
    const zoneID = parseInt(lineArgs[1], 10);

    videoStartDate = getCombatLogDate(line);

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
 const battlegroundStop = (line: string) => {
    const videoStopDate = getCombatLogDate(line);
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
 const zoneChangeStop = (line: string) => {
    const videoStopDate = getCombatLogDate(line);
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
 * getCombatLogDate
 */
const getCombatLogDate = (line: string): Date => {
    const [month, day, hours, mins, secs, msec] = line.split(/[ \/:\.]/, 6);
    const dateObj = new Date();

    dateObj.setDate(parseInt(day, 10));
    dateObj.setMonth(parseInt(month, 10));
    dateObj.setHours(parseInt(hours, 10));
    dateObj.setMinutes(parseInt(mins, 10));
    dateObj.setSeconds(parseInt(secs, 10));
    dateObj.setMilliseconds(parseInt(msec, 10))

    return dateObj;
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

    handleArenaStartLine(testArenaStartLine);
    handleCombatantInfoLine(testArenaCombatantLine);
    handleSpellAuraAppliedLine(testArenaSpellLine);

    setTimeout(() => {
        handleArenaStopLine(testArenaStopLine);
        testRunning = false;
    }, 10 * 1000);
}

export {
    handleLogLine,
    watchLogs,
    getLatestLog,
    pollWowProcess,
    runRecordingTest,
    Metadata
};
