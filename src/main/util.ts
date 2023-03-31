/* eslint global-require: off, no-console: off, promise/always-return: off */
import { URL } from 'url';
import path from 'path';
import fs, { promises as fspromise } from 'fs';
import { app, BrowserWindow, Display, net, screen } from 'electron';
import { Metadata, FileInfo, FileSortDirection, OurDisplayType } from './types';
import { months, zones } from './constants';
import { VideoCategory } from '../types/VideoCategory';

const categories = Object.values(VideoCategory);

/**
 * When packaged, we need to fix some paths
 */
const fixPathWhenPackaged = (pathSpec: string) => {
  return pathSpec.replace('app.asar', 'app.asar.unpacked');
};

/**
 * Setup logging.
 *
 * This works by overriding console log methods. All console log method will
 * go to both the console if it exists, and a file on disk.
 *
 * This only applies to main process console logs, not the renderer logs.
 */
const setupApplicationLogging = () => {
  const log = require('electron-log');
  const date = new Date().toISOString().slice(0, 10);
  const logRelativePath = `logs/WarcraftRecorder-${date}.log`;
  const logPath = fixPathWhenPackaged(path.join(__dirname, logRelativePath));
  log.transports.file.resolvePath = () => logPath;
  Object.assign(console, log.functions);
  return path.dirname(logPath);
};

const { exec } = require('child_process');

const getResolvedHtmlPath = () => {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || 1212;

    return (htmlFileName: string) => {
      const url = new URL(`http://localhost:${port}`);
      url.pathname = htmlFileName;
      return url.href;
    };
  }

  return (htmlFileName: string) => {
    return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
  };
};

export const resolveHtmlPath = getResolvedHtmlPath();

/**
 * Empty video state.
 */
const getEmptyState = () => {
  const videoState: { [category: string]: any[] } = {};

  categories.forEach((category) => {
    videoState[category] = [];
  });

  return videoState;
};

/**
 * Return information about a file needed for various parts of the application
 */
const getFileInfo = async (pathSpec: string): Promise<FileInfo> => {
  const filePath = path.resolve(pathSpec);
  const fstats = await fspromise.stat(filePath);
  const mtime = fstats.mtime.getTime();
  const { size } = fstats;
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
    .filter((f) => f.match(new RegExp(pattern)))
    .map((f) => path.join(dir, f));

  const mappedFileInfo: FileInfo[] = [];

  for (let i = 0; i < files.length; i++) {
    // This loop can take a bit of time so we're deliberately
    // awaiting inside the loop to not induce a 1000ms periodic
    // freeze on the frontend. Probably can do better here,
    // suspect something in getFileInfo isn't as async as it could be.
    // If that can be solved, then we can drop the await here and then
    // do an await Promises.all() on the following line.
    // eslint-disable-next-line no-await-in-loop
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
const getSortedVideos = async (
  storageDir: string,
  sortDirection: FileSortDirection = FileSortDirection.NewestFirst
): Promise<FileInfo[]> => {
  return getSortedFiles(storageDir, '.*\\.mp4', sortDirection);
};

/**
 * Get the filename for the metadata file associated with the given video file
 */
const getMetadataFileNameForVideo = (video: string) => {
  const videoFileName = path.basename(video, '.mp4');
  const videoDirName = path.dirname(video);
  return path.join(videoDirName, `${videoFileName}.json`);
};

/**
 * Get the metadata object for a video from the accompanying JSON file.
 */
const getMetadataForVideo = async (video: string) => {
  const metadataFilePath = getMetadataFileNameForVideo(video);
  await fspromise.access(metadataFilePath);
  const metadataJSON = await fspromise.readFile(metadataFilePath);
  const metadata = JSON.parse(metadataJSON.toString()) as Metadata;
  return metadata;
};

/**
 * Get the encounter name.
 */
const getVideoEncounter = (metadata: Metadata) => {
  if (metadata.encounterID) {
    return zones[metadata.encounterID];
  }

  return metadata.category;
};

/**
 * Get the date a video was recorded from the date object.
 */
const getVideoDate = (date: Date) => {
  const day = date.getDate();
  const month = months[date.getMonth()].slice(0, 3);
  const dateAsString = `${day} ${month}`;
  return dateAsString;
};

/**
 * Get the time a video was recorded from the date object.
 */
const getVideoTime = (date: Date) => {
  const hours = date
    .getHours()
    .toLocaleString('en-US', { minimumIntegerDigits: 2 });
  const mins = date
    .getMinutes()
    .toLocaleString('en-US', { minimumIntegerDigits: 2 });
  const timeAsString = `${hours}:${mins}`;
  return timeAsString;
};

/**
 * Load video details from the metadata and add it to videoState.
 */
const loadVideoDetails = async (video: FileInfo) => {
  const metadata = await getMetadataForVideo(video.name);
  const today = new Date();
  const videoDate = new Date(video.mtime);

  return {
    fullPath: video.name,
    ...metadata,
    encounter: getVideoEncounter(metadata),
    date: getVideoDate(videoDate),
    isFromToday: today.toDateString() === videoDate.toDateString(),
    time: getVideoTime(videoDate),
    isProtected: Boolean(metadata.protected),
    size: video.size,
    dateObject: videoDate,
  };
};

/**
 * Load videos from category folders in reverse chronological order.
 */
const loadAllVideos = async (storageDir: string) => {
  const videoIndex: { [category: string]: number } = {};

  categories.forEach((category) => {
    videoIndex[category] = 0;
  });

  const videoState = getEmptyState();

  if (!storageDir) {
    return videoState;
  }

  const videos = await getSortedVideos(storageDir);

  if (videos.length === 0) {
    return videoState;
  }

  const videoDetailPromises = videos.map((video) => loadVideoDetails(video));

  // Await all the videoDetailsPromises to settle, and then remove any
  // that were rejected. This can happen if there is a missing metadata file.
  const videoDetail = (
    await Promise.all(videoDetailPromises.map((p) => p.catch((e) => e)))
  ).filter((result) => !(result instanceof Error));

  // Pass through the latest category, we already know it is index 0.
  videoState.latestCategory = videoDetail[0].category;

  videoDetail.forEach((details) => {
    const category = details.category as string;

    videoState[category].push({
      index: videoIndex[category]++,
      ...details,
    });
  });

  return videoState;
};

/**
 * Writes video metadata asynchronously and returns a Promise
 */
const writeMetadataFile = async (videoPath: string, metadata: any) => {
  console.info('[Util] Write Metadata file', videoPath);

  const metadataFileName = getMetadataFileNameForVideo(videoPath);
  const jsonString = JSON.stringify(metadata, null, 2);

  fspromise.writeFile(metadataFileName, jsonString, {
    encoding: 'utf-8',
  });
};

/**
 * Try to unlink a file and return a boolean indicating the success
 * Logs any errors to the console, if the file couldn't be deleted for some reason.
 */
const tryUnlinkSync = (file: string): boolean => {
  try {
    console.log(`[Util] Deleting: ${file}`);
    fs.unlinkSync(file);
    return true;
  } catch (e) {
    console.error(`[Util] Unable to delete file: ${file}.`);
    console.error((e as Error).message);
    return false;
  }
};

/**
 * Delete a video and its metadata file if it exists.
 */
const deleteVideo = (videoPath: string) => {
  console.info('[Util] Deleting video', videoPath);

  // If we can't delete the video file, make sure we don't delete the metadata
  // file either, which would leave the video file dangling.
  if (!tryUnlinkSync(videoPath)) {
    return;
  }

  const metadataPath = getMetadataFileNameForVideo(videoPath);
  if (fs.existsSync(metadataPath)) {
    tryUnlinkSync(metadataPath);
  }
};

/**
 * Open a folder in system explorer.
 */
const openSystemExplorer = (filePath: string) => {
  const windowsPath = filePath.replace(/\//g, '\\');
  const cmd = `explorer.exe /select,"${windowsPath}"`;
  exec(cmd, () => {});
};

/**
 * Put a save marker on a video, protecting it from the file monitor.
 */
const toggleVideoProtected = async (videoPath: string) => {
  let metadata;

  try {
    metadata = await getMetadataForVideo(videoPath);
  } catch (err) {
    console.error(
      `[Util] Metadata not found for '${videoPath}', but somehow we managed to load it. This shouldn't happen.`
    );

    return;
  }

  if (metadata.protected === undefined) {
    console.info(`[Util] User protected ${videoPath}`);
    metadata.protected = true;
  } else {
    metadata.protected = !metadata.protected;

    console.info(
      `[Util] User toggled protection on ${videoPath}, now ${metadata.protected}`
    );
  }

  await writeMetadataFile(videoPath, metadata);
};

/**
 * Get a text string that indicates the physical position of a display depending
 * on its index.
 */
const getDisplayPhysicalPosition = (count: number, index: number): string => {
  if (index === 0) return 'Left';
  if (index === count - 1) return 'Right';

  return `Middle #${index}`;
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
  const displayIdToIndex: { [key: number]: number } = {};

  allDisplays.forEach((display: Display, index: number) => {
    displayIdToIndex[display.id] = index;
  });

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
        },
      });
    });

  return ourDisplays;
};

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
    console.error(`[Main] Failed to check for updates: ${error}`);
  });

  request.end();
};

const deferredPromiseHelper = <T>() => {
  let resolveHelper!: (value: T | PromiseLike<T>) => void;
  let rejectHelper!: (reason?: any) => void;

  const promise = new Promise<T>((resolve, reject) => {
    resolveHelper = resolve;
    rejectHelper = reject;
  });

  return { resolveHelper, rejectHelper, promise };
};

export {
  setupApplicationLogging,
  loadAllVideos,
  writeMetadataFile,
  deleteVideo,
  openSystemExplorer,
  toggleVideoProtected,
  fixPathWhenPackaged,
  getSortedVideos,
  getAvailableDisplays,
  getSortedFiles,
  tryUnlinkSync,
  checkAppUpdate,
  getMetadataForVideo,
  deferredPromiseHelper,
};
