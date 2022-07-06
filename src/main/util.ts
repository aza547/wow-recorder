/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
import { URL } from 'url';
import path from 'path';
import { categories, months, zones }  from './constants';
import { Metadata }  from './logutils';

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

    videoState[metadata.category].push({
        index: videoIndex[metadata.category]++,
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
const getMetadataForVideo = (video: any) => {
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
 const getMetadataFileForVideo = (video: any) => {
    const videoFileName = path.basename(video.name, '.mp4');
    const videoDirName = path.dirname(video.name);
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
const runSizeMonitor = async (storageDir: any, maxStorage: any) => {  
    let totalSize = 0;
    const files = fs.readdirSync(storageDir);

    files.forEach((file: any) => {
        totalSize += fs.statSync(storageDir + file).size;
    });

    if (totalSize > maxStorage) { 
        await deleteOldestVideo(storageDir);
        runSizeMonitor(storageDir, maxStorage);
    } 

    console.log("totalSize: " + totalSize);

    return;
}   

/**
 * deleteOldestVideo
 */
const deleteOldestVideo = async (storageDir: any) => {
    const oldestVideo = glob.sync(storageDir + "*.mp4")
        .map((name: any) => ({name, mtime: fs.statSync(name).mtime}))
        .sort((A: any, B: any) => B.mtime - A.mtime)
        .pop();

    const oldestMetadata = getMetadataFileForVideo(oldestVideo);

    await fs.unlink(oldestVideo.name, (err: any) => {
        if (err) throw err;
        console.log(oldestVideo.name + ' was deleted');
    });

    await fs.unlink(oldestMetadata, (err: any) => {
        if (err) throw err;
        console.log(oldestMetadata + ' was deleted');
    });
}  

export {
    getVideoState,
    writeMetadataFile,
    runSizeMonitor 
};