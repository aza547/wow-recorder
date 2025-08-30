import ConfigService from 'config/ConfigService';
import StorageClient from './StorageClient';
import {
  delayedDeleteVideo,
  getSortedVideos,
  loadVideoDetailsDisk,
} from 'main/util';
import { DiskStatus, RendererVideo } from 'main/types';
import DiskSizeMonitor from './DiskSizeMonitor';

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
  }

  public ready() {
    return true;
  }

  /**
   * Refresh the disk status on the frontend, does not refresh the videos.
   */
  public async refreshStatus() {
    const usage = await new DiskSizeMonitor(this.window).usage();
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
}
