import ConfigService from 'config/ConfigService';
import StorageClient from './StorageClient';
import {
  delayedDeleteVideo,
  deleteVideoDisk,
  exists,
  getMetadataForVideo,
  getSortedVideos,
  loadVideoDetailsDisk,
  markForVideoForDelete,
  openSystemExplorer,
  writeMetadataFile,
} from 'main/util';
import { DiskStatus, RendererVideo, VideoAction } from 'main/types';
import DiskSizeMonitor from './DiskSizeMonitor';
import { ipcMain } from 'electron';
import assert from 'assert';
import fs from 'fs';
import { send } from 'main/main';

/**
 * A client for retrieving resources from the cloud.
 */
export default class DiskClient implements StorageClient {
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
    console.info('[DiskClient] Creating disk client');
    this.setupListeners();
  }

  public async ready() {
    const storageDir = ConfigService.getInstance().get<string>('storagePath');

    if (!storageDir) {
      return false;
    }

    return exists(storageDir);
  }

  /**
   * Refresh the disk status on the frontend, does not refresh the videos.
   */
  public async refreshStatus() {
    const rdy = await this.ready();

    if (!rdy) {
      console.warn('[DiskClient] Not ready, no status');
      return;
    }

    const usage = await new DiskSizeMonitor().usage();
    const cfg = ConfigService.getInstance();
    const limit = cfg.get<number>('maxStorage') * 1024 ** 3;
    const status: DiskStatus = { usage, limit };
    send('updateDiskStatus', status);
  }

  /**
   * Get the videos and set them on the frontend.
   */
  public async refreshVideos() {
    const videos = await this.getVideos();
    send('setDiskVideos', videos);
  }

  /**
   * Get the videos.
   */
  private async getVideos() {
    const rdy = await this.ready();

    if (!rdy) {
      console.warn('[DiskClient] Not ready, no videos');
      return [];
    }

    console.info('[DiskClient] Getting videos from disk');

    const storageDir = ConfigService.getInstance().get<string>('storagePath');
    const videos = await getSortedVideos(storageDir);

    if (videos.length === 0) {
      return [];
    }

    // Windows has a 16k file handle limit per process. Load in batches
    // of 1000 to be safe. The real fix here would be to have a local database
    // for managing this stuff rather than reading many thousand files here.
    const batchSize = 1000;
    const videoDetails: RendererVideo[] = [];

    for (let i = 0; i < videos.length; i += batchSize) {
      console.info('[DiskClient] Batch loading videos', i, 'to', i + batchSize);
      const batch = videos.slice(i, i + batchSize);

      const batchPromises = batch.map((video) =>
        loadVideoDetailsDisk(video).catch((e) => e),
      );

      const batchResults = await Promise.all(batchPromises);

      videoDetails.push(
        ...batchResults.filter((result) => !(result instanceof Error)),
      );
    }

    // Any details marked for deletion do it now. We allow for this flag to be
    // set in the metadata to give us a robust mechanism for removing a video
    // that may be open in the player. We hide it from the state as part of a
    // refresh, that guarentees it cannot be loaded in the player.
    videoDetails.filter((video) => video.delete).forEach(delayedDeleteVideo);

    // Return this list of videos without those marked for deletion which may still
    // exist for a short time.
    const toDisplay = videoDetails.filter((video) => !video.delete);
    console.info('[DiskClient] Loaded', toDisplay.length, 'videos from disk');
    return toDisplay;
  }

  public async deleteVideos(videoPaths: string[]) {
    return this.applyToVideos('delete', videoPaths, (videoPath) =>
      this.deleteVideoDisk(videoPath),
    );
  }

  public async tagVideos(videoPaths: string[], tag: string) {
    return this.applyToVideos('tag', videoPaths, (videoPath) =>
      this.tagVideoDisk(videoPath, tag),
    );
  }

  public async protectVideos(videoPaths: string[], protect: boolean) {
    return this.applyToVideos('protect', videoPaths, (videoPath) =>
      this.protectVideoDisk(protect, videoPath),
    );
  }

  private async applyToVideos(
    action: VideoAction['type'],
    videoPaths: string[],
    callback: (videoPath: string) => Promise<void>,
  ): Promise<string[]> {
    const results = await Promise.all(
      videoPaths.map(async (videoPath) => {
        try {
          await callback(videoPath);
          return videoPath;
        } catch (error) {
          console.error(`[DiskClient] Failed to ${action} video`, {
            path: videoPath,
            error: String(error),
          });
          return undefined;
        }
      }),
    );

    return results.filter((path): path is string => path !== undefined);
  }

  /**
   * Put a save marker on a video, protecting it from the file monitor.
   */
  private async protectVideoDisk(protect: boolean, videoPath: string) {
    const metadata = await getMetadataForVideo(videoPath);

    if (protect) {
      console.info(`[Util] User set protected ${videoPath}`);
    } else {
      console.info(`[Util] User unprotected ${videoPath}`);
    }

    metadata.protected = protect;
    await writeMetadataFile(videoPath, metadata);
  }

  private async tagVideoDisk(videoPath: string, tag: string) {
    const metadata = await getMetadataForVideo(videoPath);

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

  private async deleteVideoDisk(videoPath: string) {
    const success = await deleteVideoDisk(videoPath);

    if (success) {
      return;
    }

    try {
      await fs.promises.stat(videoPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }

    // If the video is open in the player, hide it on the next refresh and
    // delete it once the player releases the file.
    await markForVideoForDelete(videoPath);
  }

  private setupListeners() {
    ipcMain.handle('videoActionDisk', async (_event, args) => {
      const action = args[0] as VideoAction;
      const videos = (args[1] as RendererVideo[]).filter((v) => !v.cloud);
      const videoPaths = videos.map((v) => v.videoSource);

      if (videos.length === 0) {
        return [];
      }

      if (!(await this.ready())) {
        console.error('[DiskClient] Failed to process video action', {
          action: action.type,
          paths: videoPaths,
          error: 'Disk client is not ready',
        });
        return [];
      }

      let successfulPaths: string[];

      if (action.type === 'protect') {
        successfulPaths = await this.protectVideos(videoPaths, action.value);
      } else if (action.type === 'tag') {
        successfulPaths = await this.tagVideos(videoPaths, action.value);
      } else if (action.type === 'delete') {
        successfulPaths = await this.deleteVideos(videoPaths);
      } else {
        console.error('[DiskClient] Unsupported video action');
        return [];
      }

      const successful = new Set(successfulPaths);
      return videos
        .filter((video) => successful.has(video.videoSource))
        .map((video) => video.uniqueId);
    });

    ipcMain.on('videoButtonDisk', async (_event, args) => {
      const action = args[0] as string;

      if (action === 'open') {
        // Open only called for disk based video, see openURL for cloud version.
        const src = args[1] as string;
        const cloud = args[2] as boolean;
        assert(!cloud);
        openSystemExplorer(src);
      }
    });
  }
}
