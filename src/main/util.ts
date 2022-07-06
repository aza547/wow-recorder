/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
import { URL } from 'url';
import path from 'path';
import { categories, months, zones }  from './constants';
import { Metadata }  from './logutils';

const fs = require('fs');
const glob = require('glob');
let videoIndex: number;

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
 * Load videos from category folders in reverse chronological order.  
 */
const loadAllVideos = (baseStoragePath: any, videoState: any) => {
    for (const category of categories) {
        const categoryPath = baseStoragePath + "/" + category + "/";      
        
        const videos = glob.sync(categoryPath + "*.mp4")        
            .map((name: any) => ({name, mtime: fs.statSync(name).mtime}))
            .sort((A: any, B: any) => B.mtime - A.mtime);

        videoIndex = 0;

        for (const video of videos) {            
            loadVideoDetails(video, videoState);
        }        
    }
}

/**
 * Load video details from the metadata and add it to videoState. 
 */
 const loadVideoDetails = (video: any, videoState: any) => {
    const dateObject = new Date(fs.statSync(video.name).mtime)
    const metadata = loadMetadataForVideo(video)

    videoState[metadata.category].push({
        index: videoIndex++,
        fullPath: video.name,
        encounter: getVideoEncounter(metadata.zoneID, metadata.category),
        zone: getVideoZone(metadata.zoneID, metadata.category),
        zoneID: metadata.zoneID,
        duration: metadata.duration,
        result: metadata.result, 
        date: getVideoDate(dateObject),
        time: getVideoTime(dateObject)
    });
}

/**
 * Get the date a video was recorded from the date object.
 */
const loadMetadataForVideo = (video: any) => {
    const videoFileName = path.basename(video.name, '.mp4');
    const videoDirName = path.dirname(video.name);
    const metadataFile = videoDirName + "/" + videoFileName + ".json";
    const metadataJSON = fs.readFileSync(metadataFile);
    const metadata = JSON.parse(metadataJSON);
    return metadata;
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
 * Get the state of all videos. 
 * Returns an empty array if baseStoragePath is undefined. 
 */
const getVideoState = (baseStoragePath: unknown) => {
    let videoState = getEmptyState();
    if (!baseStoragePath) return videoState;
    loadAllVideos(baseStoragePath, videoState);
    return videoState;
}    

/**
 *  writeMetadataFile
 */
const writeMetadataFile = (storagePath: string, metadata: Metadata) => {
    const jsonString = JSON.stringify(metadata, null, 2);
    const categoryPath = storagePath + "/" + metadata["category"] + "/";

    const timeOrderedVideos = glob.sync(categoryPath + "*.mp4")
        .map((name: any) => ({name, mtime: fs.statSync(name).mtime}))
        .sort((A: any, B: any) => B.mtime - A.mtime);

    const newestVideoPath = timeOrderedVideos[0].name;
    const newestVideoName = path.basename(newestVideoPath, '.mp4');

    fs.writeFile(categoryPath + newestVideoName + ".json", jsonString, err => {
        if (err) console.log("Error writing file", err);
    })
}    

export {
    checkDirs,
    getVideoState,
    writeMetadataFile    
};