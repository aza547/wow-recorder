import { BrowserWindow } from 'electron';
import { CloudObject } from 'main/types';
import CloudClient from 'storage/CloudClient';

export default class CloudSizeMonitor {
  private mainWindow: BrowserWindow;

  private cloudClient: CloudClient;

  constructor(mainWindow: BrowserWindow, cloudClient: CloudClient) {
    this.mainWindow = mainWindow;
    this.cloudClient = cloudClient;
  }

  async run() {
    const maxStorageGB = 250;
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

    const reverseChronologicalSort = (a: CloudObject, b: CloudObject) => {
      const timeA = a.lastMod.getTime();
      const timeB = b.lastMod.getTime();
      return timeB - timeA;
    };

    const bytesToFree = usedStorageBytes - maxStorageBytes;
    let bytesReclaimed = 0;

    const filterSizeThreshold = (object: CloudObject) => {
      if (object.size === undefined) {
        return false;
      }

      bytesReclaimed += object.size;
      return bytesReclaimed < bytesToFree;
    };

    const videosToDelete = objects
      .filter(filterVideos)
      .sort(reverseChronologicalSort)
      .filter(filterSizeThreshold);

    console.info(
      `[CloudSizeMonitor] Deleting ${videosToDelete.length} old video(s)`
    );

    videosToDelete.forEach(async (blob) => {
      const videoKey = blob.key;

      if (videoKey === undefined) {
        return;
      }

      const thumbnailKey = videoKey.replace('mp4', 'png');
      const metadataKey = videoKey.replace('mp4', 'json');

      await Promise.all([
        this.cloudClient.delete(videoKey),
        this.cloudClient.delete(thumbnailKey),
        this.cloudClient.delete(metadataKey),
      ]);
    });

    this.mainWindow.webContents.send('refreshState');
  }

  public async usage() {
    const objects = await this.cloudClient.list();
    return objects.map((obj) => obj.size).reduce((acc, num) => acc + num, 0);
  }
}
