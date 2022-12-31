import ConfigService from '../main/ConfigService';
import {
  deleteVideo,
  getMetadataForVideo,
  getSortedVideos,
} from '../main/util';

export default class SizeMonitor {
  private cfg = ConfigService.getInstance();

  private storageDir: string;

  private maxStorageGB: number;

  private maxStorageBytes: number;

  constructor() {
    this.storageDir = this.cfg.get<string>('storagePath');
    this.maxStorageGB = this.cfg.get<number>('maxStorage');
    this.maxStorageBytes = this.maxStorageGB * 1024 ** 3;
  }

  async run() {
    console.info(
      '[SizeMonitor] Running, size limit is',
      this.maxStorageGB,
      'GB'
    );

    if (this.maxStorageBytes === 0) {
      console.info('[SizeMonitor] Limitless storage, doing nothing');
      return;
    }

    const files = await getSortedVideos(this.storageDir);

    const unprotectedFiles = files.filter((file) => {
      try {
        const metadata = getMetadataForVideo(file.name);
        const isProtected = metadata.protected || false;
        return !isProtected;
      } catch {
        console.error('[SizeMonitor] Failed to get metadata for', file.name);
        deleteVideo(file.name);
        return false;
      }
    });

    let totalVideoFileSize = 0;

    const filesForDeletion = unprotectedFiles.filter((file) => {
      totalVideoFileSize += file.size;
      return totalVideoFileSize > this.maxStorageBytes;
    });

    console.info(
      `[SizeMonitor] Deleting ${filesForDeletion.length} old video(s)`
    );

    filesForDeletion.forEach((file) => {
      deleteVideo(file.name);
    });
  }
}
