/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
import { Combatant } from './combatant';
import { startRecording, stopRecording, isRecording}  from './main';
import { battlegrounds }  from './constants';

const tail = require('tail').Tail;
const glob = require('glob');
const fs = require('fs');

let tailHandler: any;
let currentLogFile: string;
let lastLogFile: string;
let videoStartDate: Date;

type Metadata = {
    name: string;
    category: string;
    zoneID?: number;
    encounterID?: number;
    duration: number;
    result: boolean;
    playerName?: string;
    playerSpecID?: number;
}

let metadata: Metadata;
let combatantMap: Map<string, Combatant> = new Map();
let playerCombatant: Combatant | undefined;

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
        handleRaidStartLine(line);
    } else if (line.includes("ENCOUNTER_END")) {
        handleRaidStopLine(line);
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
    const zoneID = parseInt(line.split(',')[1]);
    const category = line.split(',')[3];
    videoStartDate = new Date();

    metadata = {
        name: "name",
        category: category,
        zoneID: zoneID,
        duration: 0,
        result: false,
    }

    startRecording(metadata);
}

/**
 * Handle a line from the WoW log. 
 */
 const handleArenaStopLine = (line: string) => {
    if (!isRecording) return; 

    if (playerCombatant) {
        metadata.playerName = playerCombatant.name;
        metadata.playerSpecID = playerCombatant.specID;
    }

    const videoStopDate = new Date();
    const milliSeconds = (videoStopDate.getTime() - videoStartDate.getTime()); 
    const duration = Math.round(milliSeconds / 1000);
    const result = determineArenaMatchResult(line);

    metadata.duration = duration; 
    metadata.result = result;

    combatantMap.clear();
    playerCombatant = undefined;
    stopRecording(metadata);
}

/**
 * Determines the arena match result.
 * @param line the line from the WoW log. 
 * @returns true if the observer won the match; otherwise false
 */
const determineArenaMatchResult = (line: string): boolean => {
    if (playerCombatant === undefined) return false;
    const winningTeamID = parseInt(line.split(',')[1]);
    return (playerCombatant.teamID === winningTeamID);
}

/**
 * Handle a line from the WoW log. 
 */
 const handleRaidStartLine = (line: string) => {
    const encounterID = parseInt(line.split(',')[1]);
    const category = "Raids";
    videoStartDate = new Date();

    metadata = {
        name: "name",
        category: category,
        encounterID: encounterID,
        duration: 0,
        result: false,
    }

    startRecording(metadata);
}

/**
 * Handle a line from the WoW log. 
 */
 const handleRaidStopLine = (line: string) => {
    const videoStopDate = new Date();
    const milliSeconds = (videoStopDate.getTime() - videoStartDate.getTime()); 
    metadata.duration = Math.round(milliSeconds / 1000);
    metadata.result = Boolean(parseInt(line.split(',')[5]));
    stopRecording(metadata);
}

/**
 * Handle a line from the WoW log.
 */
 const handleZoneChange = (line: string) => {
    console.log("Handling zone change: ", line);
    const zoneID = parseInt(line.split(',')[1]);
    const isBG = battlegrounds.hasOwnProperty(zoneID);

    if (!isRecording && isBG) {
        battlegroundStartRecording(line);  
    } else if (isRecording && isBG) {
        battlegroundStopRecording();
    } else if (isRecording) {
        const videoStopDate = new Date();
        const milliSeconds = (videoStopDate.getTime() - videoStartDate.getTime()); 
        metadata.duration = Math.round(milliSeconds / 1000);
    
        // Assume loss if zoned out of content. 
        metadata.result = false;
        stopRecording(metadata);
    }

    if (!isRecording) return;

    return;
}

/**
 * Handles the SPELL_AURA_APPLIED line from WoW log.
 * @param line the SPELL_AURA_APPLIED line
 */
 const handleSpellAuraAppliedLine = (line: string) => {
    if (playerCombatant) return;
    if (combatantMap.size === 0) return;    

    const srcGUID = line.split(',')[1];    
    const srcName = removeQuotes(line.split(',')[2])
    const srcFlags = parseInt(line.split(',')[3]);
    
    const srcCombatant = combatantMap.get(srcGUID);
    if (srcCombatant === undefined) return;

    if (isUnitSelf(srcFlags)) {
        srcCombatant.name = srcName;
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
 const battlegroundStartRecording = (line: string) => {
    const zoneID = parseInt(line.split(',')[1]);
    const battlegroundName = battlegrounds[zoneID];
    const category = "Battlegrounds";
    videoStartDate = new Date();

    metadata = {
        name: battlegroundName,
        category: category,
        zoneID: zoneID,
        duration: 0,
        result: false,
    }

    startRecording(metadata);
}

/**
 * battlegroundStopRecording
 */
 const battlegroundStopRecording = () => {
    const videoStopDate = new Date();
    const milliSeconds = (videoStopDate.getTime() - videoStartDate.getTime()); 
    metadata.duration = Math.round(milliSeconds / 1000);

    // No idea how we can tell who has won a BG so assume loss. 
    // I've just disabled displaying this in the UI so this does nothing.
    metadata.result = false;
    stopRecording(metadata);
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

export {
    handleLogLine,
    watchLogs,
    getLatestLog,
    Metadata
};
