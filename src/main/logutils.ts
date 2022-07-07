/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
import { startRecording, stopRecording}  from './main';

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
}

let metadata: Metadata;

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
    const videoStopDate = new Date();
    const milliSeconds = (videoStopDate.getTime() - videoStartDate.getTime()); 
    metadata.duration = Math.round(milliSeconds / 1000);
    stopRecording(metadata);
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

export {
    handleLogLine,
    watchLogs,
    getLatestLog,
    Metadata
};