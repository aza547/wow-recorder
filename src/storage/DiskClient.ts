import ConfigService from 'config/ConfigService';
import StorageClient from './StorageClient';
import {
  delayedDeleteVideo,
  deleteVideoDisk,
  getMetadataForVideo,
  getSortedVideos,
  loadVideoDetailsDisk,
  markForVideoForDelete,
  openSystemExplorer,
  writeMetadataFile,
} from 'main/util';
import { DiskStatus, RendererVideo } from 'main/types';
import DiskSizeMonitor from './DiskSizeMonitor';
import { ipcMain } from 'electron';
import assert from 'assert';

/**
 * A client for retrieving resources from the cloud.
 */
export default class DiskClient extends StorageClient {
  /**
   * Singleton instance.
   */
  private static instance: DiskClient;

  /**
   * Singleton instance accessor.
   */
  public static getInstance() {
    if (!this.instance) this.instance = new this();
    return this.instance;
  }

  private constructor() {
    super();
    this.setupListeners();
  }

  public ready() {
    // TODO check the folder?
    return true;
  }

  /**
   * Refresh the disk status on the frontend, does not refresh the videos.
   */
  public async refreshStatus() {
    const usage = await new DiskSizeMonitor().usage();
    const cfg = ConfigService.getInstance();
    const limit = cfg.get<number>('maxStorage') * 1024 ** 3;
    const status: DiskStatus = { usage, limit };
    this.send('updateDiskStatus', status);
  }

  /**
   * Get the videos.
   */
  public async getVideos() {
    const storageDir = ConfigService.getInstance().get<string>('storagePath');

    // TODO: more validity checks?
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
  }

  public async deleteVideos(videoPaths: string[]) {
    videoPaths.forEach((videoPath) => this.deleteVideoDisk(videoPath));
  }

  public async tagVideos(videoPaths: string[], tag: string) {
    videoPaths.forEach((videoPath) => this.tagVideoDisk(videoPath, tag));
  }

  public async protectVideos(videoPaths: string[], protect: boolean) {
    videoPaths.forEach((videoPath) =>
      this.protectVideoDisk(protect, videoPath),
    );
  }

  /**
   * Put a save marker on a video, protecting it from the file monitor.
   */
  private async protectVideoDisk(protect: boolean, videoPath: string) {
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
  }

  private async tagVideoDisk(videoPath: string, tag: string) {
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
  }

  private async deleteVideoDisk(videoName: string) {
    try {
      // Bit weird we have to check a boolean here given all the error handling
      // going on. That's just me taking an easy way out rather than fixing this
      // more elegantly. TL;DR deleteVideoDisk doesn't throw anything.
      const success = await deleteVideoDisk(videoName); // TODO path not name?

      if (!success) {
        throw new Error('Failed deleting video, will mark for delete');
      }
    } catch (error) {
      // If that didn't work for any reason, try to at least mark it for deletion,
      // so that it can be picked up on refresh and we won't show videos the user
      // intended to delete
      console.warn(
        '[Manager] Failed to directly delete video on disk:',
        String(error),
      );

      markForVideoForDelete(videoName);
    }
  }

  private setupListeners() {
    ipcMain.on('deleteVideos', async (_event, args) => {
      const videos = args as RendererVideo[];
      const toDelete = videos.filter((v) => !v.cloud).map((v) => v.videoSource);
      if (toDelete.length < 1) return;
      this.deleteVideos(toDelete);
    });

    ipcMain.on('videoButton', async (_event, args) => {
      const action = args[0] as string;

      if (action === 'open') {
        // Open only called for disk based video, see openURL for cloud version.
        const src = args[1] as string;
        const cloud = args[2] as boolean;
        assert(!cloud);
        openSystemExplorer(src);
      }

      if (action === 'protect') {
        const protect = args[1] as boolean;
        const videos = args[2] as RendererVideo[];
        const disk = videos.filter((v) => !v.cloud);
        const toProtect = disk.map((v) => v.videoSource);
        this.protectVideos(toProtect, protect);
      }

      if (action === 'tag') {
        const tag = args[1] as string;
        const videos = args[2] as RendererVideo[];
        const disk = videos.filter((v) => !v.cloud);
        const toTag = disk.map((v) => v.videoSource);
        this.tagVideos(toTag, tag);
      }
    });
  }
}
