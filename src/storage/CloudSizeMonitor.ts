import { CloudObject, IBrowserWindow, ICloudClient } from 'main/types';
import path from 'path';

export default class CloudSizeMonitor {
  private mainWindow: IBrowserWindow;

  private cloudClient: ICloudClient;

  private maxSizeGB: number;

  constructor(
    mainWindow: IBrowserWindow,
    cloudClient: ICloudClient,
    maxSizeGB: number
  ) {
    this.mainWindow = mainWindow;
    this.cloudClient = cloudClient;
    this.maxSizeGB = maxSizeGB;
  }

  async run() {
    // We set this threshold a bit lower than the max storage as the ordering
    // here is that the size monitor will after videos are uploaded, so we always
    // want some leeway; we don't want the worker to reject uploads, which it will
    // do if they the max storage is hit.
    const maxStorageGB = this.maxSizeGB * 0.8;
    const maxStorageBytes = maxStorageGB * 1024 ** 3;

    console.info(
      '[CloudSizeMonitor] Running, size limit is',
      maxStorageGB,
      'GB'
    );

    const objects = await this.cloudClient.list();

    const usedStorageBytes = objects
      .map((obj) => obj.size)
      .reduce((acc, num) => acc + num, 0);

    if (usedStorageBytes < maxStorageBytes) {
      console.info(
        '[CloudSizeMonitor] Used Storage',
        usedStorageBytes / 1024 ** 3,
        '(GB) is less than limit of',
        maxStorageBytes / 1024 ** 3,
        '(GB), so no action.'
      );

      return;
    }

    const filterVideos = (object: CloudObject) => {
      if (object.key === undefined) {
        return false;
      }

      return object.key.endsWith('mp4');
    };

    const chronologicalSort = (a: CloudObject, b: CloudObject) => {
      const timeA = a.lastMod.getTime();
      const timeB = b.lastMod.getTime();
      return timeA - timeB;
    };

    const bytesToFree = usedStorageBytes - maxStorageBytes;
    let bytesReclaimed = 0;

    const filterSizeThreshold = (object: CloudObject) => {
      if (object.size === undefined) {
        return false;
      }

      if (bytesReclaimed < bytesToFree) {
        bytesReclaimed += object.size;
        return true;
      }

      return false;
    };

    const videosToDelete = objects
      .filter(filterVideos)
      .sort(chronologicalSort)
      .filter(filterSizeThreshold);

    console.info(
      `[CloudSizeMonitor] Deleting ${videosToDelete.length} old video(s)`
    );

    const deletePromises: Promise<void>[] = [];

    videosToDelete.forEach(async (blob) => {
      const videoKey = blob.key;

      if (videoKey === undefined) {
        return;
      }

      const videoName = path.basename(videoKey, '.mp4');
      const thumbnailKey = videoKey.replace('mp4', 'png');

      deletePromises.push(this.cloudClient.delete(videoKey));
      deletePromises.push(this.cloudClient.delete(thumbnailKey));
      deletePromises.push(this.cloudClient.deleteVideo(videoName));
    });

    await Promise.all(deletePromises);

    if (videosToDelete.length > 0) {
      this.mainWindow.webContents.send('refreshState');
    }
  }

  public async usage() {
    const objects = await this.cloudClient.list();
    return objects.map((obj) => obj.size).reduce((acc, num) => acc + num, 0);
  }
}
