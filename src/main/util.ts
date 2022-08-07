/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
import { URL } from 'url';
import path from 'path';
import { categories, months, zones }  from './constants';
import { Metadata }  from './logutils';
const { exec } = require('child_process');

const fs = require('fs');
const glob = require('glob');
let videoIndex: { [category: string]: number }  = {};

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
const loadAllVideos = (storageDir: any, videoState: any) => {
    const videos = glob.sync(storageDir + "*.mp4")        
        .map((name: any) => ({name, mtime: fs.statSync(name).mtime}))
        .sort((A: any, B: any) => B.mtime - A.mtime);

    for (const category of categories) {
        videoIndex[category] = 0;
    }

    for (const video of videos) {            
        loadVideoDetails(video, videoState);
    }        
}

/**
 * Load video details from the metadata and add it to videoState. 
 */
 const loadVideoDetails = (video: any, videoState: any) => {
    const dateObject = new Date(fs.statSync(video.name).mtime)
    const metadata = getMetadataForVideo(video)

    if (metadata === undefined) return;

    videoState[metadata.category].push({
        index: videoIndex[metadata.category]++,
        fullPath: video.name,
        zone: getVideoZone(metadata.zoneID, metadata.category),
        zoneID: metadata.zoneID,
        encounter: getVideoEncounter(metadata),
        encounterID: metadata.encounterID,
        duration: metadata.duration,
        result: metadata.result, 
        date: getVideoDate(dateObject),
        time: getVideoTime(dateObject),
        protected: Boolean(metadata.protected)
    })
}

/**
 * Get the date a video was recorded from the date object.
 */
const getMetadataForVideo = (video: any) => {
    const videoFileName = path.basename(video.name, '.mp4');
    const videoDirName = path.dirname(video.name);
    const metadataFile = videoDirName + "/" + videoFileName + ".json";

    if (fs.existsSync(metadataFile)) {
        const metadataJSON = fs.readFileSync(metadataFile);
        const metadata = JSON.parse(metadataJSON);
        return metadata;
    } else {
        console.log("Metadata file does not exist: ", metadataFile);
        return undefined;
    }
}

/**
 * Get the date a video was recorded from the date object.
 */
 const getMetadataFileForVideo = (video: any) => {
    const videoFileName = path.basename(video, '.mp4');
    const videoDirName = path.dirname(video);
    const metadataFilePath = videoDirName + "/" + videoFileName + ".json";
    return metadataFilePath;
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
 * Get the zone name.
 */
const getVideoZone = (zoneID: number, category: string) => {
    const zone = (category === "Raids" ? "Sepulcher of the First Ones" : zones[zoneID])
    return zone;
}

/**
 * Get the encounter name.
 */
const getVideoEncounter = (metadata: Metadata) => {
    if (metadata.encounterID) { 
        return zones[metadata.encounterID]; 
    } else {
        return metadata.category; 
    }
}

/**
 * Get the state of all videos. 
 * Returns an empty array if storageDir is undefined. 
 */
const getVideoState = (storageDir: unknown) => {
    let videoState = getEmptyState();
    if (!storageDir) return videoState;
    loadAllVideos(storageDir, videoState);
    return videoState;
}    

/**
 *  writeMetadataFile
 */
const writeMetadataFile = (storageDir: string, metadata: Metadata) => {
    const jsonString = JSON.stringify(metadata, null, 2);

    const timeOrderedVideos = glob.sync(storageDir + "*.mp4")
        .map((name: any) => ({name, mtime: fs.statSync(name).mtime}))
        .sort((A: any, B: any) => B.mtime - A.mtime);

    const newestVideoPath = timeOrderedVideos[0].name;
    const newestVideoName = path.basename(newestVideoPath, '.mp4');

    fs.writeFileSync(storageDir + newestVideoName + ".json", jsonString);
}    

/**
 * runSizeMonitor, maxStorage in bytes
 */
const runSizeMonitor = (storageDir: any, maxStorage: any) => {  

    let totalSize = 0;
    const files = fs.readdirSync(storageDir);

    for (const file of files) {
        totalSize += fs.statSync(storageDir + file).size;
    }

    if (totalSize > maxStorage) { 
        deleteOldestVideo(storageDir);
        runSizeMonitor(storageDir, maxStorage);
    } 
}   

/**
 * Delete the oldest video, unprotected video.
 */
const deleteOldestVideo = (storageDir: any) => {
    const sortedVideos = glob.sync(storageDir + "*.mp4")
        .map((name: any) => ({name, mtime: fs.statSync(name).mtime}))
        .sort((A: any, B: any) => B.mtime - A.mtime)

    let videoForDeletion = sortedVideos.pop();
    let deleteNotAllowed = isVideoProtected(videoForDeletion.name);

    while ((deleteNotAllowed) && (sortedVideos.length > 0)) {
        videoForDeletion = sortedVideos.pop();
        deleteNotAllowed = isVideoProtected(videoForDeletion.name)
    }

    if (!deleteNotAllowed) deleteVideo(videoForDeletion.name);
}  

/**
 * isVideoProtected
 */
 const isVideoProtected = (videoPath: string) => {
    const metadataPath = getMetadataFileForVideo(videoPath);
    const metadataJSON = fs.readFileSync(metadataPath);
    const metadata = JSON.parse(metadataJSON);
    console.log(videoPath, metadata)
    return Boolean(metadata.protected);
}  

/**
 * Delete a video and its metadata file. 
 */
 const deleteVideo = (videoPath: string) => {
    const metadataPath = getMetadataFileForVideo(videoPath);

    if (!fs.existsSync(metadataPath)) {
        console.log("WTF have you done to get here?");
        return;
    }

    fs.unlinkSync(videoPath);
    console.log("Deleted: " + videoPath);
    fs.unlinkSync(metadataPath);
    console.log("Deleted: " + metadataPath);  
}  

/**
 * isConfigReady
 */
 const isConfigReady = (cfg: any) => {
    if (!cfg.get('storage-path')) return false;
    if (!cfg.get('log-path')) return false;
    if (!cfg.get('max-storage')) return false;
    return true;
}  

/**
 * Open a folder in system explorer. 
 */
 const openSystemExplorer = (filePath: string) => {
    const windowsPath = filePath.replace(/\//g,"\\");
    let cmd = 'explorer.exe /select,"' + windowsPath + '"';
    exec(cmd, () => {});
}  

/**
 * Put a save marker on a video, protecting it from the file monitor.
 */
 const toggleVideoProtected = (videoPath: string) => {
    const metadataFile = getMetadataFileForVideo(videoPath);

    if (!fs.existsSync(metadataFile)) {
        console.log("WTF have you done to get here?");
        return;
    }

    const metadataJSON = fs.readFileSync(metadataFile);
    const metadata = JSON.parse(metadataJSON);

    if (metadata.protected === undefined) {
        metadata.protected = true;
    } else {
        metadata.protected =  !Boolean(metadata.protected);
    }

    const newMetadataJsonString = JSON.stringify(metadata, null, 2);
    fs.writeFileSync(metadataFile, newMetadataJsonString);
}

export {
    getVideoState,
    writeMetadataFile,
    runSizeMonitor, 
    isConfigReady,
    deleteVideo,
    openSystemExplorer,
    toggleVideoProtected
};