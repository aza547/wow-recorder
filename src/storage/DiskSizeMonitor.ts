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
  // Multiple queued jobs can depend on the same recording.
  private static readonly videosInUse = new Map<string, number>();

  private cfg = ConfigService.getInstance();

  static markVideoInUse(videoPath: string): void {
    const resolvedPath = path.resolve(videoPath);
    const uses = this.videosInUse.get(resolvedPath) ?? 0;
    this.videosInUse.set(resolvedPath, uses + 1);
  }

  static unmarkVideoInUse(videoPath: string): void {
    const resolvedPath = path.resolve(videoPath);
    const uses = this.videosInUse.get(resolvedPath) ?? 0;

    if (uses > 1) {
      this.videosInUse.set(resolvedPath, uses - 1);
    } else {
      this.videosInUse.delete(resolvedPath);
    }
  }

  private static isVideoInUse(videoPath: string): boolean {
    return this.videosInUse.has(path.resolve(videoPath));
  }

  run(): Promise<void> {
    return queueDiskSizeMonitorRun(() => this.runOnce());
  }

  private async runOnce() {
    const storageDir = this.cfg.get<string>('storagePath');
    const maxStorageGB = this.cfg.get<number>('maxStorage');
    const storageLimit = this.cfg.get<boolean>('storageLimit');

    if (!storageLimit || maxStorageGB === 0) {
      console.info('[DiskSizeMonitor] No storage limit set, doing nothing');
      return;
    }

    if (!storageDir || !(await isFolderOwned(storageDir))) {
      console.warn(
        '[DiskSizeMonitor] Refusing cleanup for unowned storage directory',
        storageDir,
      );
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

    let bytesSelected = 0;
    let deleteCount = 0;

    for (const file of files) {
      if (DiskSizeMonitor.isVideoInUse(file.name)) {
        console.info('[DiskSizeMonitor] Skipping video in use', file.name);
        continue;
      }

      try {
        const metadata = await getMetadataForVideo(file.name);
        if (metadata.protected) continue;
      } catch (err) {
        console.error(
          '[DiskSizeMonitor] Failed to get metadata for',
          file.name,
          err,
        );
        continue;
      }

      // A job may have been queued while the metadata was being read.
      if (DiskSizeMonitor.isVideoInUse(file.name)) {
        console.info('[DiskSizeMonitor] Skipping video in use', file.name);
        continue;
      }

      try {
        await deleteVideoDisk(file.name);
      } catch (err) {
        console.error('[DiskSizeMonitor] Failed to delete', file.name, err);
      }
      deleteCount += 1;
      bytesSelected += file.size;
      if (bytesSelected >= bytesToFree) break;
    }

    if (deleteCount > 0) {
      console.info(
        `[DiskSizeMonitor] Attempted to delete ${deleteCount} old video(s)`,
      );
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
    return this.usageFromFiles(files);
  }

  private usageFromFiles(files: Array<FileInfo>) {
    return files.map((file) => file.size).reduce((acc, num) => acc + num, 0);
  }
}
