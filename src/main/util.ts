/* eslint global-require: off, no-console: off, promise/always-return: off */
import { URL } from 'url';
import path from 'path';
import { categories, months, zones, dungeonsByMapId }  from './constants';
import { Metadata }  from './types';
const byteSize = require('byte-size');
const chalk = require('chalk');

/**
 * When packaged, we need to fix some paths
 */
 const fixPathWhenPackaged = (path: string) => {
    return path.replace("app.asar", "app.asar.unpacked");
}

const { exec } = require('child_process');
import { promises as fspromise } from 'fs';
import fs from 'fs';
import { FileInfo, FileSortDirection, OurDisplayType } from './types';
import { app, BrowserWindow, Display, net, screen } from 'electron';

let videoIndex: { [category: string]: number } = {};

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
    let videoState: { [category: string]: any[] } = {};
    categories.forEach(category => videoState[category] = []);

    return videoState;
}

/**
 * Load videos from category folders in reverse chronological order.  
 */
const loadAllVideos = async (storageDir: string) => {
  console.log("ahk", storageDir);
  const videoState = getEmptyState();

  if (!storageDir) {
    return videoState;
  }
  console.log("ahk1");
  const videos = await getSortedVideos(storageDir);

  if (videos.length === 0) {
    return videoState;
  }
  console.log("ahk2");

  categories.forEach(category => videoIndex[category] = 0);

  videos.forEach(video => {
    const details = loadVideoDetails(video);
    if (!details) {
      return;
    }

    const category = (details.category as string);
    videoState[category].push({
      index: videoIndex[category]++,
      ...details,
    });
  });
  console.log("ahk3", videoState);
  return videoState;
}

/**
 * Load video details from the metadata and add it to videoState. 
 */
 const loadVideoDetails = (video: FileInfo): any | undefined => {
    const metadata = getMetadataForVideo(video.name);
    if (metadata === undefined) {
        return;
    }

    // Hilariously 5v5 is still a war game mode that will break things without this.
    if (!categories.includes(metadata.category)) {
        return;
    };

    const today = new Date();
    const videoDate = new Date(video.mtime);

    return {
        fullPath: video.name,
        ...metadata,
        encounter: getVideoEncounter(metadata),
        date: getVideoDate(videoDate),
        isFromToday: (today.toDateString() === videoDate.toDateString()),
        time: getVideoTime(videoDate),
        protected: Boolean(metadata.protected),
        playerSpecID: metadata?.playerSpecID,
        playerName: metadata?.playerName,
        playerRealm: metadata?.playerRealm,
    };
}

/**
 * Get the date a video was recorded from the date object.
 */
const getMetadataForVideo = (video: string) => {
    const metadataFile = getMetadataFileNameForVideo(video)

    if (!fs.existsSync(metadataFile)) {
        console.error(`[Util] Metadata file does not exist: ${metadataFile}`);
        return undefined;
    }

    try {
        const metadataJSON = fs.readFileSync(metadataFile);
        return JSON.parse(metadataJSON.toString());
    } catch (e) {
        console.error(`[Util] Unable to read and/or parse JSON from metadata file: ${metadataFile}`);
    }
}

/**
 * Writes video metadata asynchronously and returns a Promise
 */
 const writeMetadataFile = async (videoPath: string, metadata: any) => {
    console.info("[Util] Write Metadata file", videoPath);
    const metadataFileName = getMetadataFileNameForVideo(videoPath);
    const jsonString = JSON.stringify(metadata, null, 2);
    
    return await fspromise.writeFile(
        metadataFileName,
        jsonString, {
            encoding: 'utf-8',
        }
    );
}

/**
 * Get the filename for the metadata file associated with the given video file
 */
 const getMetadataFileNameForVideo = (video: string) => {
    const videoFileName = path.basename(video, '.mp4');
    const videoDirName = path.dirname(video);

    return path.join(videoDirName, videoFileName + '.json');
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
 * Get the encounter name.
 */
const getVideoEncounter = (metadata: Metadata) => {
    if (metadata.challengeMode !== undefined) {
        return dungeonsByMapId[metadata.challengeMode.mapID];
    }

    if (metadata.encounterID) {
        return zones[metadata.encounterID];
    }

    return metadata.category;
}

/**
 * Return information about a file needed for various parts of the application
 */
const getFileInfo = async (filePath: string): Promise<FileInfo> => {
    filePath = path.resolve(filePath);
    const fstats = await fspromise.stat(filePath);
    const mtime = fstats.mtime.getTime();
    const size = fstats.size;

    return { name: filePath, size, mtime };
};

/**
 * Asynchronously find and return a list of files in the given directory,
 * that matches the given pattern sorted by modification time according
 * to `sortDirection`. Ensure to properly escape patterns, e.g. ".*\\.mp4".
 */
 const getSortedFiles = async (
        dir: string,
        pattern: string,
        sortDirection: FileSortDirection = FileSortDirection.NewestFirst
    ): Promise<FileInfo[]> => {

    // We use fs.promises.readdir here instead of glob, which we used to
    // use but it caused problems with NFS paths, see this issue:
    // https://github.com/isaacs/node-glob/issues/74.
    const files = (await fs.promises.readdir(dir))
        .filter(f => f.match(new RegExp(pattern)))
        .map(f => path.join(dir, f));

    const mappedFileInfo: FileInfo[] = [];

    for (let i = 0; i < files.length; i++) {
        mappedFileInfo.push(await getFileInfo(files[i]));
    }

    if (sortDirection === FileSortDirection.NewestFirst) {
        return mappedFileInfo.sort((A: FileInfo, B: FileInfo) => B.mtime - A.mtime);
    }

    return mappedFileInfo.sort((A: FileInfo, B: FileInfo) => A.mtime - B.mtime);
};

/**
 * Get sorted video files. Shorthand for `getSortedFiles()` because it's used in quite a few places
 */
const getSortedVideos = async (storageDir: string, sortDirection: FileSortDirection = FileSortDirection.NewestFirst): Promise<FileInfo[]> => {
    return getSortedFiles(storageDir, '.*\\.mp4', sortDirection);
}

/**
 * Asynchronously delete the oldest, unprotected videos to ensure we don't store
 * more material than the user has allowed us.
 */
const runSizeMonitor = async (storageDir: string, maxStorageGB: number): Promise<void> => {
    let videoToDelete;
    const maxStorageBytes = maxStorageGB * Math.pow(1024, 3);
    console.debug(`[Size Monitor] Running (max size = ${byteSize(maxStorageBytes)})`);

    if (maxStorageGB == 0) {
        console.debug(`[Size Monitor] Limitless storage, doing nothing`);
        return;
    }

    let files = await getSortedVideos(storageDir);

    files = files.map(file => {
        const metadata = getMetadataForVideo(file.name);
        return { ...file, metadata, };
    });

    // Files without metadata are considered dangling and are cleaned up. 
    const danglingFiles = files.filter((file: any) => !file.hasOwnProperty('metadata') || !file.metadata);
    const unprotectedFiles = files.filter((file: any) => file.hasOwnProperty('metadata') && file.metadata && !Boolean(file.metadata.protected));

    if (danglingFiles.length !== 0) {
        console.log(`[Size Monitor] Deleting ${danglingFiles.length} dangling video(s)`);

        while (videoToDelete = danglingFiles.pop()) {
            console.log(`[Size Monitor] Delete dangling video: ${videoToDelete.name}`)
            deleteVideo(videoToDelete.name);
        }
    }

    // Filter files that doesn't cause the total video file size to exceed the maximum
    // as given by `maxStorageBytes`
    let totalVideoFileSize = 0;

    const filesOverMaxStorage = unprotectedFiles.filter((file: any) => {
        totalVideoFileSize += file.size;
        return totalVideoFileSize > maxStorageBytes;
    });

    // Calculate total file size of all unprotected files
    totalVideoFileSize = unprotectedFiles
        .map(file => file.size)
        .reduce((prev, curr) => prev + curr, 0);

    console.log(`[Size Monitor] Unprotected file(s) considered ${unprotectedFiles.length}, total size = ${byteSize(totalVideoFileSize)}`)

    if (filesOverMaxStorage.length === 0) {
        return;
    }

    console.log(`[Size Monitor] Deleting ${filesOverMaxStorage.length} old video(s)`)

    while (videoToDelete = filesOverMaxStorage.pop()) {
        console.log(`[Size Monitor] Delete oldest video: ${videoToDelete.name} (${byteSize(videoToDelete.size)})`);
        deleteVideo(videoToDelete.name);
    }
};

/**
 * Try to unlink a file and return a boolean indicating the success
 * Logs any errors to the console, if the file couldn't be deleted for some reason.
 */
 const tryUnlinkSync = (file: string): boolean => {
    try {
        console.log("[Util] Deleting: " + file);
        fs.unlinkSync(file);
        return true;
    } catch (e) {
        console.error(`[Util] Unable to delete file: ${file}.`)
        console.error((e as Error).message);
        return false;
    }
 }

/**
 * Delete a video and its metadata file if it exists. 
 */
 const deleteVideo = (videoPath: string) => {
    // If we can't delete the video file, make sure we don't delete the metadata
    // file either, which would leave the video file dangling.
    if (!tryUnlinkSync(videoPath)) {
        return;
    }

    const metadataPath = getMetadataFileNameForVideo(videoPath);
    if (fs.existsSync(metadataPath)) {
        tryUnlinkSync(metadataPath);
    }
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
    const metadata = getMetadataForVideo(videoPath);

    if (!metadata) {
        console.error(`[Util] Metadata not found for '${videoPath}', but somehow we managed to load it. This shouldn't happen.`);
        return;
    }

    if (metadata.protected === undefined) {
        metadata.protected = true;
    } else {
        metadata.protected =  !Boolean(metadata.protected);
    }

    writeMetadataFile(videoPath, metadata);
}

/**
 *  Add some escape characters to color text. Just return the string
 *  if production as don't want to litter real logs with this as it just
 *  looks messy.
 */
 const addColor = (s: string, color: string): string => {
    if (process.env.NODE_ENV === 'production') return s;

    if (color === "cyan") {
        return chalk.cyan(s);
    } else if (color === "green") {
        return chalk.green(s);
    } else {
        return s;
    }    
}

/**
 * Get a text string that indicates the physical position of a display depending
 * on its index.
 */
const getDisplayPhysicalPosition = (count: number, index: number): string => {
    if (index === 0)         return 'Left';
    if (index === count - 1) return 'Right';

    return 'Middle #' + index;
};

/**
 * Get and return a list of available displays on the system sorted by their
 * physical position.
 *
 * This makes no attempts at being perfect - it completely ignores the `bounds.y`
 * property for people who might have stacked their displays vertically rather than
 * horizontally. This is okay.
 */
const getAvailableDisplays = (): OurDisplayType[] => {
    const primaryDisplay = screen.getPrimaryDisplay();
    const allDisplays = screen.getAllDisplays();

    // Create an unsorted list of Display IDs to zero based monitor index
    // So we're can use that index later, after sorting the displays according
    // to their physical location.
    const displayIdToIndex: {[key: number]: number } = {}
    allDisplays.forEach((display: Display, index: number) => displayIdToIndex[display.id] = index)

    // Iterate over all available displays and make our own list with the
    // relevant attributes and some extra stuff to make it easier for the
    // frontend.
    const ourDisplays: OurDisplayType[] = [];
    const numberOfMonitors = allDisplays.length;

    allDisplays
        .sort((A: Display, B: Display) => A.bounds.x - B.bounds.x)
        .forEach((display: Display, index: number) => {
            const isPrimary = display.id === primaryDisplay.id;
            const displayIndex = displayIdToIndex[display.id];
            const { width, height } = display.size;

            ourDisplays.push({
                id: display.id,
                index: displayIndex,
                physicalPosition: getDisplayPhysicalPosition(numberOfMonitors, index),
                primary: isPrimary,
                displayFrequency: display.displayFrequency,
                depthPerComponent: display.depthPerComponent,
                size: display.size,
                scaleFactor: display.scaleFactor,
                aspectRatio: width / height,
                physicalSize: {
                    width: Math.floor(width * display.scaleFactor),
                    height: Math.floor(height * display.scaleFactor),
                }
            });
        });

    return ourDisplays;
}

/**
 * Checks for updates from the releases page on github, and, if there is a
 * new version, sends a message to the main window to display a notification.
 */
const checkAppUpdate = (mainWindow: BrowserWindow | null = null) => {
  const options = {
    hostname: 'api.github.com',
    protocol: 'https:',
    path: '/repos/aza547/wow-recorder/releases/latest',
    method: 'GET',
    headers: {
      'User-Agent': 'wow-recorder',
    },
  };

  const request = net.request(options);

  request.on('response', (response) => {
    let data = '';

    response.on('data', (chunk) => {
      data += chunk;
    });

    response.on('end', () => {
      if (response.statusCode !== 200) {
        console.error(
          `[Main] Failed to check for updates, status code: ${response.statusCode}`
        );
        return;
      }

      const release = JSON.parse(data);
      const latestVersion = release.tag_name;
      const downloadUrl = release.assets[0].browser_download_url;

      if (latestVersion !== app.getVersion() && latestVersion && downloadUrl) {
        console.log('[Main] New version available:', latestVersion);

        if (mainWindow) {
          mainWindow.webContents.send('updateAvailable', downloadUrl);
        }
      }
    });
  });

  request.on('error', (error) => {
    console.error(`[Main] ERROR, Failed to check for updates: ${error}`);
  });

  request.end();
};

export {
  loadAllVideos,
  writeMetadataFile,
  runSizeMonitor,
  deleteVideo,
  openSystemExplorer,
  toggleVideoProtected,
  fixPathWhenPackaged,
  addColor,
  getSortedVideos,
  getAvailableDisplays,
  getSortedFiles,
  tryUnlinkSync,
  checkAppUpdate,
};
