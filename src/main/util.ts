import { URL } from 'url';
import path from 'path';
import fs, { promises as fspromise } from 'fs';
import { app, BrowserWindow, Display, screen } from 'electron';
import {
  EventType,
  uIOhook,
  UiohookKeyboardEvent,
  UiohookMouseEvent,
} from 'uiohook-napi';
import checkDiskSpace from 'check-disk-space';
import { PTTEventType, PTTKeyPressEvent } from '../types/KeyTypesUIOHook';
import {
  Metadata,
  FileInfo,
  FileSortDirection,
  OurDisplayType,
  RendererVideo,
  ObsAudioConfig,
  CrashData,
  CloudSignedMetadata,
} from './types';
import { VideoCategory } from '../types/VideoCategory';

/**
 * When packaged, we need to fix some paths
 */
const fixPathWhenPackaged = (p: string) => {
  return p.replace('app.asar', 'app.asar.unpacked');
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
 * Return information about a file needed for various parts of the application
 */
export const getFileInfo = async (pathSpec: string): Promise<FileInfo> => {
  const filePath = path.resolve(pathSpec);
  const fstats = await fspromise.stat(filePath);
  const mtime = fstats.mtime.getTime();
  const birthTime = fstats.birthtime.getTime();
  const { size } = fstats;
  return { name: filePath, size, mtime, birthTime };
};

/**
 * Asynchronously find and return a list of files in the given directory,
 * that matches the given pattern sorted by modification time according
 * to `sortDirection`. Ensure to properly escape patterns, e.g. ".*\\.mp4".
 */
const getSortedFiles = async (
  dir: string,
  pattern: string,
  sortDirection: FileSortDirection = FileSortDirection.NewestFirst,
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
  sortDirection: FileSortDirection = FileSortDirection.NewestFirst,
): Promise<FileInfo[]> => {
  return getSortedFiles(storageDir, '.*\\.mp4', sortDirection);
};

/**
 * Get the filename for the metadata file associated with the given video file.
 */
const getMetadataFileNameForVideo = (video: string) => {
  const videoFileName = path.basename(video, '.mp4');
  const videoDirName = path.dirname(video);
  return path.join(videoDirName, `${videoFileName}.json`);
};

/**
 * The Korean build of WCR had translated video categories. Now that
 * they are going to use the main build with the localisation feature,
 * this translates them back to english so we can process them. This is
 * purely to bridge the gap, and in theory could be removed in the future.
 */
const convertKoreanVideoCategory = (
  metadata: Metadata | CloudSignedMetadata,
) => {
  const raw = metadata as any;

  if (raw.category === '연습전투') {
    raw.category = VideoCategory.Skirmish;
  } else if (raw.category === '1인전') {
    raw.category = VideoCategory.SoloShuffle;
  } else if (raw.category === '쐐기+') {
    raw.category = VideoCategory.MythicPlus;
  } else if (raw.category === '레이드') {
    raw.category = VideoCategory.Raids;
  } else if (raw.category === '전장') {
    raw.category = VideoCategory.Battlegrounds;
  } else if (raw.category === '클립') {
    raw.category = VideoCategory.Clips;
  }

  if (raw.parentCategory === '연습전투') {
    raw.parentCategory = VideoCategory.Skirmish;
  } else if (raw.parentCategory === '1인전') {
    raw.parentCategory = VideoCategory.SoloShuffle;
  } else if (raw.parentCategory === '쐐기+') {
    raw.parentCategory = VideoCategory.MythicPlus;
  } else if (raw.parentCategory === '레이드') {
    raw.parentCategory = VideoCategory.Raids;
  } else if (raw.parentCategory === '전장') {
    raw.parentCategory = VideoCategory.Battlegrounds;
  } else if (raw.parentCategory === '클립') {
    raw.parentCategory = VideoCategory.Clips;
  }
};

/**
 * Get the metadata object for a video from the accompanying JSON file.
 */
const getMetadataForVideo = async (video: string) => {
  const metadataFilePath = getMetadataFileNameForVideo(video);
  await fspromise.access(metadataFilePath);
  const metadataJSON = await fspromise.readFile(metadataFilePath);
  const metadata = JSON.parse(metadataJSON.toString()) as Metadata;
  convertKoreanVideoCategory(metadata);
  return metadata;
};

/**
 * Try to unlink a file and return a boolean indicating the success
 * Logs any errors to the console, if the file couldn't be deleted for some reason.
 */
const tryUnlink = async (file: string): Promise<boolean> => {
  try {
    console.info(`[Util] Deleting: ${file}`);
    await fspromise.access(file);
    await fs.promises.unlink(file);
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
const deleteVideoDisk = async (videoPath: string) => {
  console.info('[Util] Deleting video', videoPath);
  const deletedMp4 = await tryUnlink(videoPath);

  if (!deletedMp4) {
    return false;
  }

  const metadataPath = getMetadataFileNameForVideo(videoPath);
  const deletedJson = await tryUnlink(metadataPath);

  return deletedJson;
};

/**
 * Delete a video and it's accompanying files after a short delay. Use case
 * is when we are mid refresh of the frontend and spot a video marked for
 * deletion in its metadata.
 *
 * We can't always immediately delete the video because the frontend might
 * have it open, but once the refresh has kicked in we're safe as we won't
 * display a video marked for delete.
 *
 * The timeout of 2000 is somewhat arbitrary, don't want to be too long
 * in-case we go through multiple refreshes and set a bunch of timers
 * to delete the same file. Not the end of the world either way, just
 * looks ugly in logs.
 */
const delayedDeleteVideo = (video: RendererVideo) => {
  const src = video.videoSource;
  console.info('[Util] Will soon remove a video marked for deletion', src);

  setTimeout(() => {
    console.info('[Util] Removing a video marked for deletion', src);
    deleteVideoDisk(video.videoSource);
  }, 2000);
};

/**
 * Load video details from the metadata and add it to videoState.
 */
const loadVideoDetailsDisk = async (
  video: FileInfo,
): Promise<RendererVideo> => {
  try {
    const metadata = await getMetadataForVideo(video.name);
    const videoName = path.basename(video.name, '.mp4');
    const uniqueId = `${videoName}-disk`;

    return {
      ...metadata,
      videoName,
      mtime: video.mtime,
      videoSource: video.name,
      isProtected: Boolean(metadata.protected),
      cloud: false,
      multiPov: [],
      uniqueId,
    };
  } catch (error) {
    // Just log it and rethrow. Want this to be diagnosable.
    console.warn('[Util] Failed to load video:', video.name, String(error));
    throw error;
  }
};

const loadAllVideosDisk = async (
  storageDir: string,
): Promise<RendererVideo[]> => {
  if (!storageDir) {
    return [];
  }

  const videos = await getSortedVideos(storageDir);

  if (videos.length === 0) {
    return [];
  }

  const videoDetailPromises = videos.map((video) =>
    loadVideoDetailsDisk(video),
  );

  // Await all the videoDetailsPromises to settle, and then remove any
  // that were rejected. This can happen if there is a missing metadata file.
  const videoDetails: RendererVideo[] = (
    await Promise.all(videoDetailPromises.map((p) => p.catch((e) => e)))
  ).filter((result) => !(result instanceof Error));

  // Any details marked for deletion do it now. We allow for this flag to be
  // set in the metadata to give us a robust mechanism for removing a video
  // that may be open in the player. We hide it from the state as part of a
  // refresh, that guarentees it cannot be loaded in the player.
  videoDetails.filter((video) => video.delete).forEach(delayedDeleteVideo);

  // Return this list of videos without those marked for deletion which may still
  // exist for a short time.
  return videoDetails.filter((video) => !video.delete);
};

/**
 * Writes video metadata asynchronously and returns a Promise
 */
const writeMetadataFile = async (videoPath: string, metadata: Metadata) => {
  console.info('[Util] Write Metadata file', videoPath);

  const metadataFileName = getMetadataFileNameForVideo(videoPath);
  const jsonString = JSON.stringify(metadata, null, 2);

  fspromise.writeFile(metadataFileName, jsonString, {
    encoding: 'utf-8',
  });
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
const protectVideoDisk = async (protect: boolean, videoPath: string) => {
  let metadata;

  try {
    metadata = await getMetadataForVideo(videoPath);
  } catch (err) {
    console.error(
      `[Util] Metadata not found for '${videoPath}', but somehow we managed to load it. This shouldn't happen.`,
      err,
    );

    return;
  }

  if (protect) {
    console.info(`[Util] User set protected ${videoPath}`);
  } else {
    console.info(`[Util] User unprotected ${videoPath}`);
  }

  metadata.protected = protect;
  await writeMetadataFile(videoPath, metadata);
};

/**
 * Tag a video.
 */
const tagVideoDisk = async (videoPath: string, tag: string) => {
  let metadata;

  try {
    metadata = await getMetadataForVideo(videoPath);
  } catch (err) {
    console.error(
      `[Util] Metadata not found for '${videoPath}', but somehow we managed to load it. This shouldn't happen.`,
      err,
    );

    return;
  }

  if (!tag || !/\S/.test(tag)) {
    // empty or whitespace only
    console.info('[Util] User removed tag');
    metadata.tag = undefined;
  } else {
    console.info('[Util] User tagged', videoPath, 'with', tag);
    metadata.tag = tag;
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

const deferredPromiseHelper = <T>() => {
  let resolveHelper!: (value: T | PromiseLike<T>) => void;
  let rejectHelper!: (reason?: any) => void;

  const promise = new Promise<T>((resolve, reject) => {
    resolveHelper = resolve;
    rejectHelper = reject;
  });

  return { resolveHelper, rejectHelper, promise };
};

const getAssetPath = (...paths: string[]): string => {
  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  return path.join(RESOURCES_PATH, ...paths);
};

/**
 * Find and return the flavour of WoW that the log directory
 * belongs to by means of the '.flavor.info' file.
 */
const getWowFlavour = (pathSpec: string): string => {
  const flavourInfoFile = path.normalize(
    path.join(pathSpec, '../.flavor.info'),
  );

  // If this file doesn't exist, it's not a subdirectory of a WoW flavour.
  if (!fs.existsSync(flavourInfoFile)) {
    return 'unknown';
  }

  const content = fs.readFileSync(flavourInfoFile).toString().split('\n');

  return content.length > 1 ? content[1] : 'unknown';
};

/**
 * Updates the status icon for the application.
 * @param status the status number
 */
const addCrashToUI = (mainWindow: BrowserWindow, crashData: CrashData) => {
  console.info('[Util] Updating crashes with:', crashData);
  mainWindow.webContents.send('updateCrashes', crashData);
};

const isPushToTalkHotkey = (
  config: ObsAudioConfig,
  event: PTTKeyPressEvent,
) => {
  const { keyCode, mouseButton, altKey, ctrlKey, shiftKey, metaKey } = event;
  const { pushToTalkKey, pushToTalkMouseButton, pushToTalkModifiers } = config;

  const buttonMatch =
    (keyCode > 0 && keyCode === pushToTalkKey) ||
    (mouseButton > 0 && mouseButton === pushToTalkMouseButton);

  if (event.type === PTTEventType.EVENT_KEY_RELEASED) {
    // If they release the button we ignore modifier config. That covers mainline
    // use of regular key and modifier but also naked modifier key as the PTT hoykey
    // which doesnt show a modifier on release.
    return buttonMatch;
  }

  let modifierMatch = true;

  // Deliberately permissive here, we check all the modifiers we have in
  // config are met but we don't enforce the inverse, i.e. we'll accept
  // an additional modifier present (so CTRL + SHIFT + E will trigger
  // a CTRL + E hotkey).
  pushToTalkModifiers.split(',').forEach((mod) => {
    if (mod === 'alt') modifierMatch = altKey;
    if (mod === 'ctrl') modifierMatch = ctrlKey;
    if (mod === 'shift') modifierMatch = shiftKey;
    if (mod === 'win') modifierMatch = metaKey;
  });

  return buttonMatch && modifierMatch;
};

const convertUioHookKeyPressEvent = (
  event: UiohookKeyboardEvent,
  type: PTTEventType,
): PTTKeyPressEvent => {
  return {
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    keyCode: event.keycode,
    mouseButton: -1,
    type,
  };
};

const convertUioHookMousePressEvent = (
  event: UiohookMouseEvent,
  type: PTTEventType,
): PTTKeyPressEvent => {
  return {
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey,
    keyCode: -1,
    mouseButton: event.button as number,
    type,
  };
};

const convertUioHookEvent = (
  event: UiohookKeyboardEvent | UiohookMouseEvent,
): PTTKeyPressEvent => {
  if (event.type === EventType.EVENT_KEY_PRESSED) {
    return convertUioHookKeyPressEvent(
      event as UiohookKeyboardEvent,
      PTTEventType.EVENT_MOUSE_PRESSED,
    );
  }

  if (event.type === EventType.EVENT_KEY_RELEASED) {
    return convertUioHookKeyPressEvent(
      event as UiohookKeyboardEvent,
      PTTEventType.EVENT_KEY_RELEASED,
    );
  }

  if (event.type === EventType.EVENT_MOUSE_PRESSED) {
    return convertUioHookMousePressEvent(
      event as UiohookMouseEvent,
      PTTEventType.EVENT_MOUSE_PRESSED,
    );
  }

  if (event.type === EventType.EVENT_MOUSE_RELEASED) {
    return convertUioHookMousePressEvent(
      event as UiohookMouseEvent,
      PTTEventType.EVENT_MOUSE_RELEASED,
    );
  }

  return {
    altKey: false,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    keyCode: -1,
    mouseButton: -1,
    type: PTTEventType.UNKNOWN,
  };
};

const nextKeyPressPromise = (): Promise<PTTKeyPressEvent> => {
  return new Promise((resolve) => {
    uIOhook.once('keyup', (event) => {
      resolve(convertUioHookEvent(event));
    });
  });
};

const nextMousePressPromise = (): Promise<PTTKeyPressEvent> => {
  return new Promise((resolve) => {
    // Deliberatly 'mousedown' else we fire on the initial click
    // and always get mouse button 1.
    uIOhook.once('mousedown', (event) => {
      resolve(convertUioHookEvent(event));
    });
  });
};

/**
 * Returns a promise that will reject after a given fuse time. Also provides
 * handlers to pause the timer, and also to reset the timer to the initial
 * fuse.
 */
const getPromiseBomb = (fuse: number, reason: string) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => reject(reason), fuse * 1000);
  });
};

const buildClipMetadata = (initial: Metadata, duration: number, date: Date) => {
  const final = initial;
  final.duration = duration;
  final.parentCategory = initial.category;
  final.category = VideoCategory.Clips;
  final.protected = true;
  final.clippedAt = date.getTime();
  return final;
};

const getOBSFormattedDate = (date: Date) => {
  const toFixedDigits = (n: number, d: number) =>
    n.toLocaleString('en-US', { minimumIntegerDigits: d, useGrouping: false });

  const day = toFixedDigits(date.getDate(), 2);
  const month = toFixedDigits(date.getMonth() + 1, 2);
  const year = toFixedDigits(date.getFullYear(), 4);

  const secs = toFixedDigits(date.getSeconds(), 2);
  const mins = toFixedDigits(date.getMinutes(), 2);
  const hours = toFixedDigits(date.getHours(), 2);

  return `${year}-${month}-${day} ${hours}-${mins}-${secs}`;
};

/**
 * Check a disk has the required free space, including any files in the
 * directory currently.
 * @param dir folder to check
 * @param req size required in GB
 */
const checkDisk = async (dir: string, req: number) => {
  const files = await getSortedFiles(dir, '.*');
  let inUseBytes = 0;

  files.forEach((file) => {
    inUseBytes += file.size;
  });

  let space;

  try {
    space = await checkDiskSpace(dir);
  } catch (error) {
    // If we fail to check how much space is free then just log a warning and
    // return, we don't want to fail config validation in this case. See issue 478.
    console.warn('[Util] Failed to get free disk space from OS');
    console.warn(String(error));
    return;
  }

  const disk = space.diskPath;
  const freeBytes = space.free;
  const reqBytes = req * 1024 ** 3 - inUseBytes;

  if (freeBytes < reqBytes) {
    const msg = `Disk '${disk}' does not have enough free space, needs ${req}GB.`;
    console.error(`Disk check failed: ${msg}`);
    throw new Error(msg);
  }
};

/**
 * We use start as the preference here: the genuine start date of the activity.
 * It was only added for cloud support, so if it doesn't exist, fallback to
 * the mtime which is particularly worse on cloud storage. It worked fine on
 * disk storage where there is no upload delay.
 */
const reverseChronologicalVideoSort = (A: RendererVideo, B: RendererVideo) => {
  const metricA = A.start ? A.start : A.mtime;
  const metricB = B.start ? B.start : B.mtime;
  return metricB - metricA;
};

/**
 * Check if two dates are within sec of each other.
 */
const areDatesWithinSeconds = (d1: Date, d2: Date, sec: number) => {
  const differenceMilliseconds = Math.abs(d1.getTime() - d2.getTime());
  const millisecondsInMinute = sec * 1000; // 60 seconds * 1000 milliseconds
  return differenceMilliseconds <= millisecondsInMinute;
};

/**
 * Re-write the metadata file on disk with a flag saying the video should
 * NOT be loaded, and should be deleted at earliest conviencence.
 *
 * This helps us avoid any scenario where we attempt and fail to delete a
 * video open by the player.
 */
const markForVideoForDelete = async (videoPath: string) => {
  try {
    const metadata = await getMetadataForVideo(videoPath);
    metadata.delete = true;
    await writeMetadataFile(videoPath, metadata);
  } catch (error) {
    // This isn't a total disaster, but might cause some duplicates to
    // display in the UI; i.e. a cloud and disk version of the same video.
    // Just log it so it's diagnosable, a user could fix it easily with a
    // manual delete.
    console.error(
      '[Util] Failed to mark a video for deletion',
      videoPath,
      String(error),
    );
  }
};

/**
 * Convert a RendererVideo type to a Metadata type, used when downloading
 * videos from cloud to disk.
 */
const rendererVideoToMetadata = (video: RendererVideo) => {
  const data = video as any;
  delete data.videoSource;
  delete data.videoName;
  delete data.mtime;
  delete data.isProtected;
  delete data.cloud;
  delete data.multiPov;
  delete data.uniqueId;
  return data as Metadata;
};

/**
 * Convert a CloudSignedMetadata object to a RendererVideo object.
 */
const cloudSignedMetadataToRendererVideo = (metadata: CloudSignedMetadata) => {
  // For cloud videos, the signed URLs are the sources.
  const videoSource = metadata.signedVideoKey;
  const uniqueId = `${metadata.videoName}-cloud`;

  // We don't want the signed properties themselves.
  const mutable: any = metadata;
  delete mutable.signedVideoKey;

  const video: RendererVideo = {
    ...mutable,
    videoSource,
    multiPov: [],
    cloud: true,
    isProtected: Boolean(mutable.protected),
    mtime: 0,
    uniqueId,
  };

  return video;
};

/**
 * Check if a file or folder exists.
 */
const exists = async (file: string) => {
  try {
    await fs.promises.access(file);
    return true;
  } catch {
    return false;
  }
};

/**
 * Check if the folder contains the managed.txt file indicating it is owned
 * by Warcraft Recorder.
 */
const isFolderOwned = async (dir: string) => {
  const file = path.join(dir, 'managed.txt');

  if (await exists(file)) {
    console.info('[Util] Ownership file exists in', dir);
    return true;
  }

  console.info('[Util] Ownership file does not exist in', dir);
  return false;
};

/**
 * Take ownership of a directory as the storage directory by writing a file to
 * indicate our ownership. This does the necessary checks that it doesn't contain
 * files we don't recognise first, to avoid the case where a user sets a storage
 * path that contains other files which Warcraft Recorder may go on to delete.
 * More context: https://github.com/aza547/wow-recorder/issues/400.
 */
const takeOwnershipStorageDir = async (dir: string) => {
  const helptext =
    'If you are setting up Warcraft Recorder for the first time, this folder should be empty.';

  const content =
    'This folder is managed by Warcraft Recorder, files in it may be automatically created, modified or deleted.';

  const files = await fs.promises.readdir(dir);

  // Check for any files that don't match the extensions Warcraft
  // Recorder creates. We won't take ownership of a directory with
  // other files in it.
  const unexpected = files
    .filter((file) => !file.endsWith('.mp4'))
    .filter((file) => !file.endsWith('.json'))
    .filter((file) => !file.endsWith('.png'))
    .filter((file) => file !== '.temp')
    .filter((file) => file !== 'managed.txt')
    .filter((file) => file !== 'desktop.ini');

  if (unexpected.length > 0) {
    console.warn(
      '[Util] Found',
      unexpected.length,
      'unexpected files in storage dir',
      dir,
      unexpected,
    );

    throw new Error(`Can not take ownership of ${dir}. ${helptext}`);
  }

  // Ensure that every MP4 file we saw has a corresponding JSON and PNG file,
  // this covers the case that we've seen before where someone was otherwise
  // recording MP4s to the same directory as they configured Warcraft Recorder
  // to use.
  const mp4s = files.filter((file) => file.endsWith('.mp4'));

  for (let i = 0; i < mp4s.length; i++) {
    const mp4 = mp4s[i];
    const base = path.basename(mp4, '.mp4');

    const metadata = `${base}.json`;

    if (!files.includes(metadata)) {
      console.warn('[Util] Mismatch of files in storage dir', base);
      throw new Error(`Can not take ownership of ${dir}. ${helptext}`);
    }
  }

  const file = path.join(dir, 'managed.txt');
  await fs.promises.writeFile(file, content);
};

/**
 * Take ownership of a directory as the buffer directory by writing a file to
 * indicate our ownership. This does the necessary checks that it doesn't contain
 * files we don't recognise first, to avoid the case where a user sets a buffer
 * storage path that contains other files which Warcraft Recorder may go on to delete.
 * More context: https://github.com/aza547/wow-recorder/issues/400.
 */
const takeOwnershipBufferDir = async (dir: string) => {
  const helptext =
    'If you are setting up Warcraft Recorder for the first time, this folder should be empty.';

  const content =
    'This folder is managed by Warcraft Recorder, files in it may be automatically created, modified or deleted.';

  const files = await fs.promises.readdir(dir);

  const unexpected = files
    .filter((file) => !file.endsWith('.mp4'))
    .filter((file) => file !== 'managed.txt');

  if (unexpected.length > 0) {
    console.warn(
      '[Util] Found',
      unexpected.length,
      'unexpected files in buffer dir',
      dir,
      unexpected,
    );

    throw new Error(`Can not take ownership of ${dir}. ${helptext}`);
  }

  const regex = /^\d{4}-\d{2}-\d{2} \d{2}-\d{2}-\d{2}.mp4$/;

  files
    .filter((file) => file.endsWith('.mp4'))
    .forEach((file) => {
      const match = regex.test(file);

      if (!match) {
        console.warn('[Util] Unrecognized file in buffer dir', file);
        throw new Error(`Can not take ownership of ${dir}. ${helptext}`);
      }
    });

  const file = path.join(dir, 'managed.txt');
  await fs.promises.writeFile(file, content);
};

/**
 * Asynchronously moves a file. Maybe moving a file across storage devices
 * so time it for debug sake.
 */
const mv = async (src: string, dst: string) => {
  console.info('[Util] Moving file from:', src, 'to:', dst);
  console.time('[Util] Moving video file took');
  await fs.promises.rename(src, dst);
  console.timeEnd('[Util] Moving video file took');
};

export {
  setupApplicationLogging,
  loadAllVideosDisk,
  writeMetadataFile,
  deleteVideoDisk,
  openSystemExplorer,
  protectVideoDisk,
  fixPathWhenPackaged,
  getSortedVideos,
  getAvailableDisplays,
  getSortedFiles,
  tryUnlink,
  getMetadataForVideo,
  deferredPromiseHelper,
  getAssetPath,
  getWowFlavour,
  isPushToTalkHotkey,
  nextKeyPressPromise,
  nextMousePressPromise,
  convertUioHookEvent,
  getPromiseBomb,
  addCrashToUI,
  buildClipMetadata,
  getOBSFormattedDate,
  checkDisk,
  tagVideoDisk,
  getMetadataFileNameForVideo,
  loadVideoDetailsDisk,
  reverseChronologicalVideoSort,
  areDatesWithinSeconds,
  markForVideoForDelete,
  rendererVideoToMetadata,
  cloudSignedMetadataToRendererVideo,
  exists,
  isFolderOwned,
  takeOwnershipStorageDir,
  takeOwnershipBufferDir,
  convertKoreanVideoCategory,
  mv,
};
