/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
import { URL } from 'url';
import path from 'path';
import { categories, months, zones, encountersNathria, encountersSanctum, encountersSepulcher }  from './constants';
import { Metadata }  from './logutils';

const { exec } = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
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
    const today = new Date();
    const videoDate = new Date(fs.statSync(video.name).mtime)
    const isVideoFromToday = (today.toDateString() === videoDate.toDateString());

    const metadata = getMetadataForVideo(video)
    if (metadata === undefined) return;

    videoState[metadata.category].push({
        index: videoIndex[metadata.category]++,
        fullPath: video.name,
        zone: getVideoZone(metadata),
        zoneID: metadata.zoneID,
        encounter: getVideoEncounter(metadata),
        encounterID: metadata.encounterID,
        duration: metadata.duration,
        result: metadata.result, 
        date: getVideoDate(videoDate),
        isFromToday: isVideoFromToday,
        time: getVideoTime(videoDate),
        protected: Boolean(metadata.protected),
        playerSpecID: getPlayerSpec(metadata),
        playerName: getPlayerName(metadata),
        playerRealm: getPlayerRealm(metadata),
        teamMMR: metadata.teamMMR,
    });

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
const getVideoZone = (metadata: Metadata) => {
    const zoneID = metadata.zoneID;
    const encounterID = metadata.encounterID;
    const category = metadata.category;

    const isRaidEncounter = (category === "Raids") && encounterID; 
    let zone: string;
    
    if (isRaidEncounter) {
        zone = getRaidName(encounterID);
    } else if (zoneID) {
        zone = zones[zoneID];
    } else {
        zone = "Unknown";
    }

    return zone;
}

/**
 * Get the raid name from the encounter ID.
 */
 const getRaidName = (encounterID: number) => {
    let raidName: string;

    if (encountersNathria.hasOwnProperty(encounterID)) {
        raidName = "Castle Nathria";
    } else if (encountersSanctum.hasOwnProperty(encounterID)) {
        raidName = "Sanctum of Domination";
    } else if (encountersSepulcher.hasOwnProperty(encounterID)) {
        raidName = "Sepulcher of the First Ones";
    } else {
        raidName = "Unknown Raid";
    }

    return raidName;
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
 * Get the player spec ID.
 */
 const getPlayerSpec = (metadata: Metadata) => {
    if (metadata.playerSpecID) { 
        return metadata.playerSpecID; 
    } else {
        return undefined; 
    }
}

/**
 * Get the player name.
 */
 const getPlayerName = (metadata: Metadata) => {
    if (metadata.playerName) { 
        return metadata.playerName; 
    } else {
        return undefined; 
    }
}

/**
 * Get the player realm.
 */
 const getPlayerRealm = (metadata: Metadata) => {
    if (metadata.playerRealm) { 
        return metadata.playerRealm; 
    } else {
        return undefined; 
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
    const newestVideoPath = getNewestVideo(storageDir);
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
 * Get the newest video.
 */
 const getNewestVideo = (dir: any): string => {
    const globString = path.join(dir, "*.mp4"); 
    const sortedVideos = glob.sync(globString)
        .map((name: any) => ({name, mtime: fs.statSync(name).mtime}))
        .sort((A: any, B: any) => A.mtime - B.mtime)

    let videoForDeletion = sortedVideos.pop();
    return videoForDeletion.name;
}  

/**
 * isVideoProtected
 */
 const isVideoProtected = (videoPath: string) => {
    const metadataPath = getMetadataFileForVideo(videoPath);
    const metadataJSON = fs.readFileSync(metadataPath);
    const metadata = JSON.parse(metadataJSON);
    return Boolean(metadata.protected);
}  

/**
 * Delete a video and its metadata file if it exists. 
 */
 const deleteVideo = (videoPath: string) => {
    const metadataPath = getMetadataFileForVideo(videoPath);

    if (fs.existsSync(metadataPath)) {
        console.log("Deleting: " + metadataPath);  
        fs.unlinkSync(metadataPath);        
    }

    console.log("Deleting: " + videoPath);
    fs.unlinkSync(videoPath);
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
        console.log("WTF have you done to get here? (toggleVideoProtected)");
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

/**
 * When packaged, we need to fix some paths
 */
const fixPathWhenPackaged = (p) => {
    return p.replace("app.asar", "app.asar.unpacked");
}

/**
 * cutVideo
 * bit ugly async stuff but works
 * holy shit this function is a mess, need to deal with it. 
 */
const cutVideo = async (initialFile: string, finalDir: string, desiredDuration: number) => {   
    return new Promise((resolve) => {
        const videoFileName = path.basename(initialFile, '.mp4');
        const finalVideoPath = path.join(finalDir, videoFileName + ".mp4");

        ffmpeg.ffprobe(initialFile, (err: any, data: any) => {
            if (err) {
                console.log("FFprobe error: ", err);
                throw new Error("FFprobe error when cutting video");
            }

            const bufferedDuration = data.format.duration;
            let startTime = Math.round(bufferedDuration - desiredDuration);

            if (startTime < 0) {
                console.log("Video start time negative, avoiding error by not cutting video");
                startTime = 0;
            }

            console.log("Ready to cut video.");
            console.log("Initial duration:", bufferedDuration, 
                        "Desired duration:", desiredDuration,
                        "Calculated start time:", startTime);

            // It's crucial that we don't re-encode the video here as that would
            // spin the CPU and delay the replay being available. We ensure that we 
            // don't re-encode by passing the "-c copy" option to ffmpeg. Read about it here:
            // https://superuser.com/questions/377343/cut-part-from-video-file-from-start-position-to-end-position-with-ffmpeg
            ffmpeg(initialFile)
                .inputOptions([ `-ss ${startTime}`, `-t ${desiredDuration}` ])
                .outputOptions([ "-c:v copy", "-c:a copy" ])
                .output(finalVideoPath)
                .on('end', async (err: any) => {
                    if (!err) { 
                        console.log("FFmpeg cut video succeeded");
                        fs.unlinkSync(initialFile); 
                        resolve("");
                    }
                })
                .on('error', (err: any) => {
                    console.log('FFmpeg video cut error: ', err)
                    throw new Error("FFmpeg error when cutting video");
                })
                .run()    
        })
    });
}

/**
 * cleanupBuffer
 */
const cleanupBuffer = () => {

}

export {
    getVideoState,
    writeMetadataFile,
    runSizeMonitor, 
    isConfigReady,
    deleteVideo,
    openSystemExplorer,
    toggleVideoProtected,
    fixPathWhenPackaged,
    getNewestVideo,
    cutVideo,
    cleanupBuffer
};