import path from 'path';
import { promises as fspromise } from 'fs';
import { Metadata, RendererVideo } from '../main/types';
import {
  getFileInfo,
  loadVideoDetailsDisk,
  setStorageIndexHooks,
} from '../main/util';

/**
 * In-memory index of disk VOD metadata, keyed by resolved video file path.
 *
 * Motivation: previously every refresh re-listed the storage dir, stat'd every
 * file and read+parsed every .json sidecar (O(N) disk I/O), and this was
 * amplified 3-5x per operation by the DiskSizeMonitor + refreshStatus +
 * refreshVideos fan-out. On network storage each of those is a round-trip, so
 * cost grew with library size, forever.
 *
 * This index is built once (reconcile) and then kept coherent incrementally via
 * hooks on the two storage chokepoints (writeMetadataFile / deleteVideoDisk).
 * Reconcile is delta-only: a single readdir diffs the directory against the
 * index, and only NEW files are stat'd + read; existing files cost zero I/O
 * (their mtime is stable and our own metadata edits update the index via the
 * write hook). So refreshes are effectively in-memory.
 */
export default class MetadataIndex {
  private static instance: MetadataIndex;

  /**
   * key: resolved absolute path of the .mp4 -> built RendererVideo.
   */
  private entries = new Map<string, RendererVideo>();

  /**
   * The storage dir the index was last reconciled against. Used to detect a
   * storage-path change (which requires a fresh reconcile).
   */
  private reconciledDir: string | null = null;

  /**
   * In-flight reconcile, if any. Used to coalesce concurrent reconciles (e.g.
   * refreshStatus + refreshVideos firing together at startup) so we don't read
   * every metadata file twice.
   */
  private inFlight: Promise<void> | null = null;

  public static getInstance(): MetadataIndex {
    if (!this.instance) {
      this.instance = new MetadataIndex();
    }

    return this.instance;
  }

  private constructor() {
    // Keep the index coherent automatically: any metadata write or video
    // deletion anywhere in the app updates the index via these hooks. Done in
    // the constructor so simply touching getInstance() once at startup wires it
    // up before any write happens.
    setStorageIndexHooks(
      (videoPath: string, metadata: Metadata) =>
        this.onMetadataWritten(videoPath, metadata),
      (videoPath: string) => this.remove(videoPath),
    );
  }

  private static key(videoPath: string) {
    return path.resolve(videoPath);
  }

  /**
   * Build (or update) the index for the given storage dir. Delta-only: a single
   * readdir, evict entries whose file vanished, and stat+read only files not
   * already cached. Cheap enough to call on every refresh. Concurrent calls are
   * coalesced onto a single in-flight reconcile.
   */
  public async reconcile(storageDir: string): Promise<void> {
    if (this.inFlight) {
      await this.inFlight;
      return;
    }

    this.inFlight = this.doReconcile(storageDir);

    try {
      await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  private async doReconcile(storageDir: string): Promise<void> {
    let names: string[];

    try {
      names = (await fspromise.readdir(storageDir)).filter((f) =>
        f.match(/.*\.mp4$/),
      );
    } catch (error) {
      console.warn(
        '[MetadataIndex] Failed to read storage dir, keeping cache',
        storageDir,
        String(error),
      );
      return;
    }

    const resolvedDir = path.resolve(storageDir);
    const presentKeys = new Set(
      names.map((n) => MetadataIndex.key(path.join(storageDir, n))),
    );

    // Evict entries (belonging to this dir) whose file has disappeared.
    [...this.entries.keys()].forEach((k) => {
      const entry = this.entries.get(k);
      if (!entry) return;

      const entryDir = path.resolve(path.dirname(entry.videoSource));

      if (entryDir === resolvedDir && !presentKeys.has(k)) {
        this.entries.delete(k);
      }
    });

    // Load only files not already cached. Batch to avoid file-handle limits
    // (Windows has a ~16k handle limit per process).
    const newPaths = names
      .map((n) => path.join(storageDir, n))
      .filter((p) => !this.entries.has(MetadataIndex.key(p)));

    const batchSize = 1000;

    for (let i = 0; i < newPaths.length; i += batchSize) {
      const batch = newPaths.slice(i, i + batchSize);

      const infos = await Promise.all(
        batch.map((p) => getFileInfo(p).catch((e) => e)),
      );

      const built = await Promise.all(
        infos.map((info) =>
          info instanceof Error
            ? Promise.resolve(info)
            : loadVideoDetailsDisk(info).catch((e) => e),
        ),
      );

      built.forEach((rv, idx) => {
        if (rv instanceof Error) {
          return;
        }

        const info = infos[idx];

        if (!(info instanceof Error)) {
          // Prefer the real on-disk size over metadata.size (which may be
          // absent on older videos) so disk-usage accounting stays accurate.
          rv.size = info.size;
        }

        this.entries.set(MetadataIndex.key(rv.videoSource), rv);
      });
    }

    this.reconciledDir = resolvedDir;
  }

  /**
   * Ensure the index has been built for this dir at least once.
   */
  public async ready(storageDir: string): Promise<void> {
    if (this.reconciledDir === path.resolve(storageDir)) {
      return;
    }

    await this.reconcile(storageDir);
  }

  /**
   * Return all indexed videos, newest first. Pure in-memory, no disk I/O.
   */
  public list(): RendererVideo[] {
    return [...this.entries.values()].sort((a, b) => b.mtime - a.mtime);
  }

  /**
   * Update/insert an entry after its metadata file was written. Reuses the
   * cached mtime for a known file; stats the file once for a newly added video.
   */
  private async onMetadataWritten(videoPath: string, metadata: Metadata) {
    const key = MetadataIndex.key(videoPath);
    const existing = this.entries.get(key);

    let mtime = existing?.mtime;
    let size = existing?.size ?? metadata.size;

    if (mtime === undefined) {
      // New file: stat it once for mtime and real size. (Existing files reuse
      // their cached mtime/size; tag/protect/delete-flag don't change the mp4.)
      try {
        const info = await getFileInfo(videoPath);
        mtime = info.mtime;
        size = info.size;
      } catch {
        // The .mp4 should exist (metadata is written after it). If not, sort it
        // newest for now; a later reconcile will correct it.
        mtime = Date.now();
      }
    }

    const videoName = path.basename(videoPath, '.mp4');

    this.entries.set(key, {
      ...metadata,
      videoName,
      mtime,
      size,
      videoSource: videoPath,
      isProtected: Boolean(metadata.protected),
      cloud: false,
      multiPov: [],
      uniqueId: `${videoName}-disk`,
    });
  }

  /**
   * Evict an entry after its video was deleted.
   */
  public remove(videoPath: string) {
    this.entries.delete(MetadataIndex.key(videoPath));
  }
}
