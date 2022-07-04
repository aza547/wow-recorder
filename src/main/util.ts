/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
import { URL } from 'url';
import path from 'path';
import { categories, months, zones }  from './constants';
const fs = require('fs');

export let resolveHtmlPath: (htmlFileName: string) => string;

if (process.env.NODE_ENV === 'development') {
  const port = process.env.PORT || 1212;
  resolveHtmlPath = (htmlFileName: string) => {
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  };
} else {
  resolveHtmlPath = (htmlFileName: string) => {
    return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
  };
}

/**
 * Check for dirs we expect to exist, create them if not. 
 */
const checkDirs = (baseStoragePath: unknown) => {
    if (!baseStoragePath) return;
    const diagsPath = baseStoragePath + "/diags";
    const metadataPath = baseStoragePath + "/metadata";
    
    fs.existsSync(diagsPath) || createDirSyncRecursive(diagsPath);
    fs.existsSync(metadataPath) || createDirSyncRecursive(metadataPath);

    for (const category of categories) {
        const storagePath = baseStoragePath + "/" + category;
        fs.existsSync(storagePath) || createDirSyncRecursive(storagePath);
    }
}

/**
 * Create a directory synchronously and recursively.
 */
const createDirSyncRecursive = (dir: string) => {
    fs.mkdirSync(dir, { recursive: true });
}

/**
 * Empty video state. 
 */
const getEmptyState = () => {
    let videoState: { [category: string]: [] } = {};

    for (const category of categories) {
        videoState[category] = [];
    }

    return videoState;
}

/**
 * Get videos from folder in reverse chronological order.  
 */
 const loadVideos = (baseStoragePath: unknown, videoState: any) => {
    for (const category of categories) {
        const path = baseStoragePath + "/" + category + "/";      
        
        const videos = fs
        .readdirSync(path)
        .sort(function(A: any, B: any) {

            const timeA = fs.statSync(path + A).mtime.getTime()
            const timeB = fs.statSync(path + B).mtime.getTime()

            return (timeB - timeA);
        });
       
        loadVideoDetails(category, videos, baseStoragePath, videoState);
    }
}

/**
 * Get the date a video was recorded from the date object.
 */
const getVideoDate = (date: Date) => {
    const day = date.getDate();
    const month = months[date.getMonth()].slice(0, 3);
    const dateAsString = day + " " + month;
    return dateAsString;
}

/**
 * Get the time a video was recorded from the date object.
 */
const getVideoTime = (date: Date) => {
    const hours = date.getHours().toLocaleString('en-US', { minimumIntegerDigits: 2});
    const mins = date.getMinutes().toLocaleString('en-US', { minimumIntegerDigits: 2});
    const timeAsString = hours + ":" + mins;
    return timeAsString;
}

/**
 * Get the zoneID of a video from the file name.
 */
 const getZoneID = (videoName: string) => {
    const zoneID: number = parseInt(videoName.split("-")[0]);
    return zoneID;
}

/**
 * Get the duration of a video from the file name.
 */
 const getVideoDuration = (videoName: string) => {
    const duration: number = parseInt(videoName.split("-")[1]);
    return duration;
}

/**
 * Get the zone name.
 */
 const getVideoZone = (zoneID: number, category: string) => {
    const zone = (category === "Raids" ? "Sepulcher of the First Ones" : zones[zoneID])
    return zone;
}

/**
 * Get the encounter name.
 */
 const getVideoEncounter = (zoneID: number, category: string) => {
    const encounter = (category === "Raids" ? zones[zoneID] : category);
    return encounter;
}

/**
 * 
 */
 const loadVideoDetails = (category: string, videos: string[], baseStoragePath: unknown, videoState: any) => {
    let index: number = 0;

    for (const videoName of videos) {
        const fullVideoPath: string = baseStoragePath + "/" + category + "/" + videoName;
        const dateObject = new Date(fs.statSync(fullVideoPath).mtime)
        const zoneID: number = getZoneID(videoName);

        videoState[category].push({
            name : videoName,
            index: index++,
            fullPath: fullVideoPath,
            encounter: getVideoEncounter(zoneID, category),
            zone: getVideoZone(zoneID, category),
            zoneID: zoneID,
            duration: getVideoDuration(videoName),
            result: 0, // 0 for fail, 1 for success
            date: getVideoDate(dateObject),
            time: getVideoTime(dateObject)
        });
    }
}

/**
 * Get the state of all videos. 
 * Returns an empty array if baseStoragePath is undefined. 
 */
 const getVideoState = (baseStoragePath: unknown) => {
    let videoState = getEmptyState();
    if (!baseStoragePath) return videoState;
    loadVideos(baseStoragePath, videoState);
    return videoState;
}    

export {
    checkDirs,
    getVideoState
};