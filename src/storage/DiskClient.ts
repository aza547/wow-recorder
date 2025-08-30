import ConfigService from 'config/ConfigService';
import StorageClient from './StorageClient';
import {
  delayedDeleteVideo,
  deleteVideoDisk,
  getSortedVideos,
  loadVideoDetailsDisk,
  markForVideoForDelete,
  openSystemExplorer,
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
   * Singleton get method.
   */
  public static getInstance() {
    if (!this.instance) this.instance = new DiskClient();
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
    const usage = await new DiskSizeMonitor(this.window).usage(); // TODO fix this? Surely the disk monitor doesn't need this.
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

  public async deleteVideos(videoNames: string[]) {
    videoNames.forEach((videoName) => this.deleteVideoDisk(videoName));
  }

  public async tagVideos(videoNames: string[], tag: string) {
    throw new Error('Method not implemented.');//TODO
  }

  public async protectVideos(videoNames: string[], protect: boolean) {
    throw new Error('Method not implemented.'); //TODO
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
      const toDelete = videos.filter((v) => !v.cloud).map((v) => v.videoName);
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
        const toProtect = disk.map((v) => v.videoName);
        this.protectVideos(toProtect, protect);
      }

      if (action === 'tag') {
        const tag = args[1] as string;
        const videos = args[2] as RendererVideo[];
        const disk = videos.filter((v) => !v.cloud);
        const toTag = disk.map((v) => v.videoName);
        this.tagVideos(toTag, tag);
      }
    });
  }
}
