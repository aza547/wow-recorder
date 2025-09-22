import { FileInfo, FileSortDirection } from '../main/types';
import ConfigService from '../config/ConfigService';
import {
  deleteVideoDisk,
  getMetadataForVideo,
  getSortedVideos,
} from '../main/util';
import DiskClient from './DiskClient';

// Had a bug here where we used filter with an async function but that isn't
// valid as it just returns a truthy promise. See issue 323. To get around
// this we do some creative stuff from here:
// https://advancedweb.hu/how-to-use-async-functions-with-array-filter-in-javascript/
const asyncFilter = async (fileStream: FileInfo[], filter: any) => {
  const results = await Promise.all(fileStream.map(filter));
  return fileStream.filter((_, index) => results[index]);
};

export default class DiskSizeMonitor {
  private cfg = ConfigService.getInstance();

  async run() {
    const storageDir = this.cfg.get<string>('storagePath');
    const maxStorageGB = this.cfg.get<number>('maxStorage');

    if (maxStorageGB === 0) {
      console.info('[DiskSizeMonitor] Limitless storage, doing nothing');
      return;
    }

    const maxStorageBytes = maxStorageGB * 1024 ** 3;
    const usage = await this.usage();
    const bytesToFree = usage - maxStorageBytes * 0.95; // Remain slightly under the threshold.
    let bytesFreed = 0;

    const files = await getSortedVideos(
      storageDir,
      FileSortDirection.OldestFirst,
    );

    console.info(
      '[DiskSizeMonitor] Running, size limit is',
      maxStorageGB,
      'GB',
    );

    const unprotectedFiles = await asyncFilter(
      files,
      async (file: FileInfo) => {
        try {
          const metadata = await getMetadataForVideo(file.name);
          const isUnprotected = !(metadata.protected || false);
          return isUnprotected;
        } catch {
          console.error(
            '[DiskSizeMonitor] Failed to get metadata for',
            file.name,
          );
          await deleteVideoDisk(file.name);
          return false;
        }
      },
    );

    const filesForDeletion = unprotectedFiles.filter((file) => {
      bytesFreed += file.size;
      return bytesFreed < bytesToFree;
    });

    console.info(
      `[DiskSizeMonitor] Deleting ${filesForDeletion.length} old video(s)`,
    );

    await Promise.all(
      filesForDeletion.map(async (file) => {
        await deleteVideoDisk(file.name);
      }),
    );

    if (filesForDeletion.length > 0) {
      DiskClient.getInstance().refreshStatus();
      DiskClient.getInstance().refreshVideos();
    }
  }

  public async usage() {
    const storageDir = this.cfg.get<string>('storagePath');
    const files = await getSortedVideos(storageDir);

    if (files.length < 1) {
      return 0;
    }

    return files.map((file) => file.size).reduce((acc, num) => acc + num, 0);
  }
}
