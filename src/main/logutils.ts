/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
import { Combatant } from './combatant';
import { recorder }  from './main';
import { battlegrounds }  from './constants';

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
let isWowRunning: boolean = false;

/**
 * wowProcessStarted
 */
const wowProcessStarted = () => {
    console.log("Wow.exe has started");
    isWowRunning = true;
    recorder.startBuffer();
};

/**
 * wowProcessStopped
 */
const wowProcessStopped = () => {
    console.log("Wow.exe has stopped");
    isWowRunning = false;

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
    const globPath = path + 'WoWCombatLog-*.txt';

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
 * Handle a line from the WoW log. 
 */
const handleLogLine = (line: string) => {
    if (line.includes("ARENA_MATCH_START")) {
        handleArenaStartLine(line);
    } else if (line.includes("ARENA_MATCH_END")) {
        handleArenaStopLine(line);
    } else if (line.includes("ENCOUNTER_START")) {
        handleEncounterStartLine(line);
    } else if (line.includes("ENCOUNTER_END")) {
        handleEncounterStopLine(line);
    } else if (line.includes("ZONE_CHANGE")) {
        handleZoneChange(line);
    } else if (line.includes("COMBATANT_INFO")) {
        handleCombatantInfoLine(line);
    } else if (line.includes("SPELL_AURA_APPLIED")){
        handleSpellAuraAppliedLine(line);
    }
}

/**
 * Handle a line from the WoW log. 
 */
const handleArenaStartLine = (line: string) => {
    if (recorder.isRecording) return; 
    const zoneID = parseInt(line.split(',')[1]);
    const category = line.split(',')[3];

    // If all goes to plan we don't need this but we do it incase the game
    // crashes etc. so we can still get a reasonable duration.
    videoStartDate = getCombatLogDate(line);

    metadata = {
        name: "name",
        category: category,
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
    if (metadata.category !== "Solo Shuffle") {
        duration = parseInt(line.split(',')[2]);
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
    const teamID = playerCombatant.teamID;
    const indexForMMR = (teamID == 0) ? 3 : 4; 
    const MMR = parseInt(line.split(',')[indexForMMR]);    
    const winningTeamID = parseInt(line.split(',')[1]);
    const win = (teamID === winningTeamID)
    return [win, MMR];
}

/**
 * Determines the raid encounter result.
 * @param line the ENCOUNTER_END event from the WoW log. 
 * @returns true if wipe, else false
 */
 const determineRaidEncounterResult = (line: string): boolean => {
    return Boolean(parseInt(line.split(',')[5]));
}

/**
 * Handle a line from the WoW log. 
 */
 const handleEncounterStartLine = (line: string) => {
    const encounterID = parseInt(line.split(',')[1]);
    const category = "Raids";

    videoStartDate = getCombatLogDate(line);

    metadata = {
        name: "name",
        category: category,
        encounterID: encounterID,
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

    const videoStopDate = getCombatLogDate(line);
    const milliSeconds = (videoStopDate.getTime() - videoStartDate.getTime()); 
    const duration = Math.round(milliSeconds / 1000) + overrun;

    metadata.duration = duration; 
    metadata.result = determineRaidEncounterResult(line);
    
    combatantMap.clear();
    playerCombatant = undefined;

    recorder.stop(metadata, overrun);
}

/**
 * Handle a line from the WoW log.
 */
 const handleZoneChange = (line: string) => {
    console.log("Handling zone change: ", line);
    const zoneID = parseInt(line.split(',')[1]);
    const isNewZoneBG = battlegrounds.hasOwnProperty(zoneID);
    const isRecording = recorder.isRecording;

    let isRecordingBG = false;

    // This is super hacky but it's late and I'm tired. 
    // TODO come back and fix this. 
    if (metadata !== undefined) {
        isRecordingBG = (metadata.category === "Battlegrounds"); 
    }

    if (!isRecording && isNewZoneBG) {
        console.log("ZONE_CHANGE into BG, start recording");
        battlegroundStart(line);   
    } else if (isRecording && isRecordingBG && !isNewZoneBG) {
        console.log("ZONE_CHANGE out of BG, stop recording");
        battlegroundStop(line);
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

    const srcGUID = line.split(',')[1];    
    const srcNameRealm = removeQuotes(line.split(',')[2])
    const srcFlags = parseInt(line.split(',')[3]);
    
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
    const GUID = line.split(',')[1];
    const teamID = parseInt(line.split(',')[2]);
    const specID = parseInt(line.split(',')[24]);
    let combatantInfo = new Combatant(GUID, teamID, specID);
    combatantMap.set(GUID, combatantInfo);
}

/**
 * ZONE_CHANGE event into a BG.  
 */
 const battlegroundStart = (line: string) => {
    const zoneID = parseInt(line.split(',')[1]);
    const battlegroundName = battlegrounds[zoneID];
    const category = "Battlegrounds";

    videoStartDate = getCombatLogDate(line);

    metadata = {
        name: battlegroundName,
        category: category,
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
    const checkInterval: number = 1000;
    
    setInterval(() => {
        currentLogFile = getLatestLog(logdir);
        const logFileChanged = (lastLogFile !== currentLogFile)

        if (!lastLogFile || logFileChanged) {
            tailFile(currentLogFile);
            lastLogFile = currentLogFile;
        }
    }, checkInterval);

    return true;
}

/**
 * Removes double and single quotes from the given string value.
 * @param value the string value
 * @returns the string value with quotes removed.
 */
const removeQuotes = (value: string): string => {
    return value.replace(/['"]+/g, '');
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
 */
const checkWoWProcess = async () => {
    let wowRunning = false;
    const taskList = await tasklist(); 

    taskList.forEach((process: any) => {
        if (process.imageName === "Wow.exe") {
            wowRunning = true;
        }
    });
  
    return wowRunning;
}

/**
 * pollWoWProcess
 */
const pollWowProcess = () => {
    setInterval(async () => {
        const wowProcessFound = await checkWoWProcess();
        const wowProcessChanged = (wowProcessFound !== isWowRunning);    
        if (!wowProcessChanged) return;
          
        if (wowProcessFound) {
            wowProcessStarted();
        } else {
            wowProcessStopped();
        }
    }, 5000);
}

/**
 * getCombatLogDate
 */
const getCombatLogDate = (line: string) => {
    const [date, time] = line.split(" ");
    const [month, day] = date.split("/");
    const [hours, mins, secs] = time.split(":");

    const dateObj = new Date();
    dateObj.setDate(parseInt(day));
    dateObj.setMonth(parseInt(month));
    dateObj.setHours(parseInt(hours));
    dateObj.setMinutes(parseInt(mins));
    dateObj.setSeconds(parseInt(secs));

    return dateObj;
}

export {
    handleLogLine,
    watchLogs,
    getLatestLog,
    pollWowProcess,
    Metadata
};
