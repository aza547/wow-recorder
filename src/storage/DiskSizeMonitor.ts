import { BrowserWindow } from 'electron';
import { FileInfo } from 'main/types';
import ConfigService from '../main/ConfigService';
import {
  deleteVideoDisk,
  getMetadataForVideo,
  getSortedVideos,
} from '../main/util';

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

  private mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  async run() {
    // Config might have changed, so update the limit and path.
    const storageDir = this.cfg.get<string>('storagePath');
    const maxStorageGB = this.cfg.get<number>('maxStorage');
    const maxStorageBytes = maxStorageGB * 1024 ** 3;

    console.info(
      '[DiskSizeMonitor] Running, size limit is',
      maxStorageGB,
      'GB'
    );

    if (maxStorageGB === 0) {
      console.info('[DiskSizeMonitor] Limitless storage, doing nothing');
      return;
    }

    const files = await getSortedVideos(storageDir);

    const unprotectedFiles = await asyncFilter(
      files,
      async (file: FileInfo) => {
        try {
          const metadata = await getMetadataForVideo(file.name);
          const isUnprotected = !(metadata.protected || false);

          if (!isUnprotected) {
            console.info(
              '[DiskSizeMonitor] Will not delete protected video',
              file.name
            );
          }

          return isUnprotected;
        } catch {
          console.error(
            '[DiskSizeMonitor] Failed to get metadata for',
            file.name
          );
          await deleteVideoDisk(file.name);
          return false;
        }
      }
    );

    let totalVideoFileSize = 0;

    const filesForDeletion = unprotectedFiles.filter((file) => {
      totalVideoFileSize += file.size;
      return totalVideoFileSize > maxStorageBytes;
    });

    console.info(
      `[DiskSizeMonitor] Deleting ${filesForDeletion.length} old video(s)`
    );

    await Promise.all(
      filesForDeletion.map(async (file) => {
        await deleteVideoDisk(file.name);
      })
    );

    this.mainWindow.webContents.send('refreshState');
  }

  public async usage() {
    const storageDir = this.cfg.get<string>('storagePath');
    const files = await getSortedVideos(storageDir);
    return files.map((file) => file.size).reduce((acc, num) => acc + num, 0);
  }
}
