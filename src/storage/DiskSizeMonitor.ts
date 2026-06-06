import { RendererVideo } from '../main/types';
import ConfigService from '../config/ConfigService';
import { deleteVideoDisk } from '../main/util';
import DiskClient from './DiskClient';
import MetadataIndex from './MetadataIndex';

export default class DiskSizeMonitor {
  private cfg = ConfigService.getInstance();

  /**
   * Sum the on-disk size of a list of indexed videos.
   */
  private static sumSizes(videos: RendererVideo[]) {
    return videos.reduce((acc, video) => acc + (video.size || 0), 0);
  }

  async run() {
    const storageDir = this.cfg.get<string>('storagePath');
    const maxStorageGB = this.cfg.get<number>('maxStorage');

    if (maxStorageGB === 0) {
      console.info('[DiskSizeMonitor] Limitless storage, doing nothing');
      return;
    }

    const maxStorageBytes = maxStorageGB * 1024 ** 3;

    // Read from the in-memory metadata index instead of scanning the storage
    // dir and reading every .json. The index is kept coherent by the storage
    // hooks (writeMetadataFile / deleteVideoDisk).
    const index = MetadataIndex.getInstance();
    await index.ready(storageDir);

    const usage = DiskSizeMonitor.sumSizes(index.list());
    const bytesToFree = usage - maxStorageBytes * 0.95; // Remain slightly under.

    console.info(
      '[DiskSizeMonitor] Running, size limit is',
      maxStorageGB,
      'GB',
    );

    if (bytesToFree <= 0) {
      return;
    }

    // Oldest first, unprotected only.
    const candidates = index
      .list()
      .sort((a, b) => a.mtime - b.mtime)
      .filter((video) => !video.isProtected);

    let bytesFreed = 0;

    const filesForDeletion = candidates.filter((video) => {
      bytesFreed += video.size || 0;
      return bytesFreed < bytesToFree;
    });

    console.info(
      `[DiskSizeMonitor] Deleting ${filesForDeletion.length} old video(s)`,
    );

    await Promise.all(
      filesForDeletion.map(async (video) => {
        // deleteVideoDisk evicts the entry from the index via the delete hook.
        await deleteVideoDisk(video.videoSource);
      }),
    );

    if (filesForDeletion.length > 0) {
      DiskClient.getInstance().refreshStatus();
      DiskClient.getInstance().refreshVideos();
    }
  }

  public async usage() {
    const storageDir = this.cfg.get<string>('storagePath');
    const index = MetadataIndex.getInstance();
    await index.ready(storageDir);
    return DiskSizeMonitor.sumSizes(index.list());
  }
}
