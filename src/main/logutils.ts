/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */

import { logStringStart, logStringStop }  from './constants';
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
    zoneID: number;
    duration: number;
    result: boolean;
}

let metadata: Metadata;

/**
 * getLatestLog 
 */
const getLatestLog = (path: unknown) => {
    const globPath = path + 'WoWCombatLog-*.txt';

    const logs = glob.sync(globPath)
        .map((name: any) => ({name, mtime: fs.statSync(name).mtime}))
        .sort((A: any, B: any) => B.mtime - A.mtime);

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
    for (const string of logStringStart) {
        if (line.includes(string)){

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
    }

    for (const string of logStringStop) {
        if (line.includes(string)) {

            const videoStopDate = new Date();
            const milliSeconds = (videoStopDate.getTime() - videoStartDate.getTime()); 
            metadata.duration = Math.round(milliSeconds / 1000);
            
            stopRecording(metadata);
        }     
    }
}    

/**
 * Watch the logs. Check every second for a new file, 
 * if there is, swap to watching that. 
 */
const watchLogs = (logdir: unknown) => {
    const checkInterval: number = 1000;
    
    setInterval(() => {
        currentLogFile = getLatestLog(logdir);
        const logFileChanged = (lastLogFile !== currentLogFile)

        if (!lastLogFile || logFileChanged) {
            tailFile(currentLogFile);
            lastLogFile = currentLogFile;
        }
    },
    checkInterval);
}

export {
    handleLogLine,
    watchLogs,
    Metadata
};