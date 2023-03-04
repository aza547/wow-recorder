import { BrowserWindow } from 'electron';
import { FileInfo } from 'main/types';
import ConfigService from '../main/ConfigService';
import {
  deleteVideo,
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

export default class SizeMonitor {
  private cfg = ConfigService.getInstance();

  private storageDir: string;

  private maxStorageGB: number;

  private maxStorageBytes: number;

  private mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.storageDir = this.cfg.get<string>('storagePath');
    this.maxStorageGB = this.cfg.get<number>('maxStorage');
    this.maxStorageBytes = this.maxStorageGB * 1024 ** 3;
    this.mainWindow = mainWindow;
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

    const unprotectedFiles = await asyncFilter(
      files,
      async (file: FileInfo) => {
        try {
          const metadata = await getMetadataForVideo(file.name);
          const isUnprotected = !(metadata.protected || false);

          if (!isUnprotected) {
            console.info(
              '[SizeMonitor] Will not delete protected video',
              file.name
            );
          }

          return isUnprotected;
        } catch {
          console.error('[SizeMonitor] Failed to get metadata for', file.name);
          deleteVideo(file.name);
          return false;
        }
      }
    );

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

    this.mainWindow.webContents.send('refreshState');
  }
}
