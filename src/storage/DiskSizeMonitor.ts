import path from 'path';
import { FileInfo, FileSortDirection } from '../main/types';
import ConfigService from '../config/ConfigService';
import {
  deleteVideoDisk,
  getMetadataForVideo,
  getSortedVideos,
  isFolderOwned,
} from '../main/util';
import AsyncQueue from '../utils/AsyncQueue';
import DiskClient from './DiskClient';

// Had a bug here where we used filter with an async function but that isn't
// valid as it just returns a truthy promise. See issue 323. To get around
// this we do some creative stuff from here:
// https://advancedweb.hu/how-to-use-async-functions-with-array-filter-in-javascript/
const asyncFilter = async (fileStream: FileInfo[], filter: any) => {
  const results = await Promise.all(fileStream.map(filter));
  return fileStream.filter((_, index) => results[index]);
};

// All monitor instances share the queue, retaining at most one rerun while cleanup is active.
const diskSizeMonitorQueue = new AsyncQueue(1);
let pendingDiskSizeMonitorCompletion: Promise<void> | undefined;

const queueDiskSizeMonitorRun = (task: () => Promise<void>): Promise<void> => {
  if (pendingDiskSizeMonitorCompletion) {
    return pendingDiskSizeMonitorCompletion;
  }

  let resolveCompletion!: () => void;
  let rejectCompletion!: (error: unknown) => void;
  const completion = new Promise<void>((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });

  pendingDiskSizeMonitorCompletion = completion;
  diskSizeMonitorQueue.add(async () => {
    pendingDiskSizeMonitorCompletion = undefined;

    try {
      await task();
      resolveCompletion();
    } catch (error) {
      rejectCompletion(error);
      throw error;
    }
  });

  // Automatic callers may intentionally ignore the returned completion promise.
  void completion.catch(() => undefined);
  return completion;
};

export default class DiskSizeMonitor {
  private static readonly activeVideoOutputs = new Set<string>();

  private cfg = ConfigService.getInstance();

  static markVideoOutputInProgress(videoPath: string): void {
    this.activeVideoOutputs.add(path.resolve(videoPath));
  }

  static unmarkVideoOutputInProgress(videoPath: string): void {
    this.activeVideoOutputs.delete(path.resolve(videoPath));
  }

  private static isVideoOutputInProgress(videoPath: string): boolean {
    return this.activeVideoOutputs.has(path.resolve(videoPath));
  }

  run(): Promise<void> {
    return queueDiskSizeMonitorRun(() => this.runOnce());
  }

  private async runOnce() {
    const storageDir = this.cfg.get<string>('storagePath');
    const maxStorageGB = this.cfg.get<number>('maxStorage');

    if (maxStorageGB === 0) {
      console.info('[DiskSizeMonitor] Limitless storage, doing nothing');
      return;
    }

    if (!storageDir || !(await isFolderOwned(storageDir))) {
      console.warn(
        '[DiskSizeMonitor] Refusing cleanup for unowned storage directory',
        storageDir,
      );
      return;
    }

    const maxStorageBytes = maxStorageGB * 1024 ** 3;
    const usage = await this.usage(storageDir);
    const bytesToFree = usage - maxStorageBytes * 0.95; // Remain slightly under the threshold.
    let bytesFreed = 0;
    let storageChanged = false;

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
        if (DiskSizeMonitor.isVideoOutputInProgress(file.name)) {
          console.info(
            '[DiskSizeMonitor] Skipping active video output',
            file.name,
          );
          return false;
        }

        try {
          const metadata = await getMetadataForVideo(file.name);
          const isUnprotected = !(metadata.protected || false);
          return isUnprotected;
        } catch (error) {
          if (DiskSizeMonitor.isVideoOutputInProgress(file.name)) {
            console.info(
              '[DiskSizeMonitor] Skipping active video output',
              file.name,
            );
            return false;
          }

          console.error(
            '[DiskSizeMonitor] Failed to get metadata, deleting video',
            file.name,
            error,
          );
          storageChanged = true;
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

    storageChanged ||= filesForDeletion.length > 0;

    if (storageChanged) {
      await Promise.all([
        DiskClient.getInstance().refreshStatus(),
        DiskClient.getInstance().refreshVideos(),
      ]);
    }
  }

  public async usage(
    storageDir = this.cfg.get<string>('storagePath'),
  ): Promise<number> {
    const files = await getSortedVideos(storageDir);

    if (files.length < 1) {
      return 0;
    }

    return files.map((file) => file.size).reduce((acc, num) => acc + num, 0);
  }
}
