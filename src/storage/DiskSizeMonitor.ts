import { FileInfo, FileSortDirection } from '../main/types';
import ConfigService from '../config/ConfigService';
import {
  deleteVideoDisk,
  getMetadataForVideo,
  getSortedVideos,
} from '../main/util';
import DiskClient from './DiskClient';

export default class DiskSizeMonitor {
  private cfg = ConfigService.getInstance();

  public async run() {
    const storageDir = this.cfg.get<string>('storagePath');
    const maxStorageGB = this.cfg.get<number>('maxStorage');

    if (maxStorageGB === 0) {
      console.info('[DiskSizeMonitor] Limitless storage, doing nothing');
      return;
    }

    console.info(
      '[DiskSizeMonitor] Running, size limit is',
      maxStorageGB,
      'GB',
    );

    const files = await getSortedVideos(
      storageDir,
      FileSortDirection.OldestFirst,
    );

    const maxStorageBytes = maxStorageGB * 1024 ** 3;
    const usage = this.usageFromFiles(files);
    const bytesToFree = usage - maxStorageBytes * 0.95; // Remain slightly under the threshold.

    if (bytesToFree <= 0) {
      console.info('[DiskSizeMonitor] Under the limit, nothing to do');
      return;
    }

    let bytesFreed = 0;
    const toDelete: Array<FileInfo> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      try {
        const metadata = await getMetadataForVideo(file.name);
        const isProtected = Boolean(metadata.protected);

        if (!isProtected) {
          toDelete.push(file);
          bytesFreed += file.size;
        }
      } catch (err) {
        console.error(
          '[DiskSizeMonitor] Failed to get metadata for',
          file.name,
          err,
        );
      }

      if (bytesFreed >= bytesToFree) {
        break;
      }
    }

    console.info(`[DiskSizeMonitor] Deleting ${toDelete.length} old video(s)`);

    for (let i = 0; i < toDelete.length; i++) {
      const file = toDelete[i];

      try {
        await deleteVideoDisk(file.name);
      } catch (err) {
        console.error('[DiskSizeMonitor] Failed to delete', file.name, err);
      }
    }

    if (toDelete.length > 0) {
      DiskClient.getInstance().refreshStatus();
      DiskClient.getInstance().refreshVideos();
    }
  }

  public async usage() {
    const storageDir = this.cfg.get<string>('storagePath');
    const files = await getSortedVideos(storageDir);
    return this.usageFromFiles(files);
  }

  private usageFromFiles(files: Array<FileInfo>) {
    return files.map((file) => file.size).reduce((acc, num) => acc + num, 0);
  }
}
