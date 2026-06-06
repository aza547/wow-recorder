import path from 'path';
import ConfigService from 'config/ConfigService';
import { getStagingDir } from 'utils/configUtils';
import StorageClient from './StorageClient';
import {
  delayedDeleteVideo,
  deleteVideoDisk,
  exists,
  getMetadataForVideo,
  getSortedVideos,
  loadVideoDetailsDisk,
  markForVideoForDelete,
  openSystemExplorer,
  writeMetadataFile,
} from 'main/util';
import { DiskStatus, RendererVideo } from 'main/types';
import DiskSizeMonitor from './DiskSizeMonitor';
import MetadataIndex from './MetadataIndex';
import { ipcMain } from 'electron';
import assert from 'assert';
import { send } from 'main/main';

/**
 * A client for retrieving resources from the cloud.
 */
export default class DiskClient implements StorageClient {
  /**
   * Singleton instance.
   */
  private static instance: DiskClient;

  /**
   * Singleton instance accessor.
   */
  public static getInstance() {
    if (!this.instance) this.instance = new this();
    return this.instance;
  }

  private constructor() {
    console.info('[DiskClient] Creating disk client');
    this.setupListeners();

    // Construct the metadata index now so its storage hooks
    // (writeMetadataFile / deleteVideoDisk) are registered before any video is
    // written, keeping the index coherent from the very first write.
    MetadataIndex.getInstance();
  }

  public async ready() {
    const storageDir = ConfigService.getInstance().get<string>('storagePath');

    if (!storageDir) {
      return false;
    }

    return exists(storageDir);
  }

  /**
   * Refresh the disk status on the frontend, does not refresh the videos.
   */
  public async refreshStatus() {
    const rdy = await this.ready();

    if (!rdy) {
      console.warn('[DiskClient] Not ready, no status');
      return;
    }

    const usage = await new DiskSizeMonitor().usage();
    const cfg = ConfigService.getInstance();
    const limit = cfg.get<number>('maxStorage') * 1024 ** 3;
    const status: DiskStatus = { usage, limit };
    send('updateDiskStatus', status);
  }

  /**
   * Get the videos and set them on the frontend.
   */
  public async refreshVideos() {
    const videos = await this.getVideos();
    send('setDiskVideos', videos);
  }

  /**
   * Get the videos.
   */
  private async getVideos() {
    const rdy = await this.ready();

    if (!rdy) {
      console.warn('[DiskClient] Not ready, no videos');
      return [];
    }

    console.info('[DiskClient] Getting videos from disk');

    const cfg = ConfigService.getInstance();
    const storageDir = cfg.get<string>('storagePath');
    const stagingDir = getStagingDir(cfg);

    // Reconcile the in-memory metadata index with the storage dir. This is
    // delta-only: a single readdir, reading just the files new since last time.
    // The bulk of refreshes (after a record/clip/delete) change nothing and so
    // cost only the readdir, instead of re-stat'ing and re-parsing every video.
    const index = MetadataIndex.getInstance();
    await index.reconcile(storageDir);
    const storageVideos = index.list();

    // When the "review locally while relocating" feature is active, also surface
    // videos that currently only exist in the local staging dir. The index's
    // write hook catches staging videos cut this session, but not ones left over
    // from a previous session (e.g. a restart mid-relocation), so scan for those
    // here. Dedupe by name against what's already listed so nothing appears
    // twice, and tag the survivors as relocating.
    let stagingVideos: RendererVideo[] = [];

    if (stagingDir && (await exists(stagingDir))) {
      const alreadyListed = new Set(
        storageVideos.map((v) => path.basename(v.videoSource, '.mp4')),
      );

      const staged = await getSortedVideos(stagingDir);

      const stagingOnly = staged.filter(
        (v) => !alreadyListed.has(path.basename(v.name, '.mp4')),
      );

      const loaded = await Promise.all(
        stagingOnly.map((v) => loadVideoDetailsDisk(v).catch((e) => e)),
      );

      stagingVideos = loaded
        .filter((r): r is RendererVideo => !(r instanceof Error))
        .map((rv) => ({ ...rv, relocating: true }));
    }

    const videoDetails = [...storageVideos, ...stagingVideos];

    // Tag any videos still being served from the local staging dir, so the
    // frontend can optionally indicate they're mid-relocation to storage. This
    // catches staging videos that ARE in the index (cut this session via the
    // write hook); restart-only staging videos are already tagged above.
    if (stagingDir) {
      const resolvedStaging = path.resolve(stagingDir);

      videoDetails.forEach((video) => {
        if (path.resolve(path.dirname(video.videoSource)) === resolvedStaging) {
          video.relocating = true;
        }
      });
    }

    // Any details marked for deletion do it now. We allow for this flag to be
    // set in the metadata to give us a robust mechanism for removing a video
    // that may be open in the player. We hide it from the state as part of a
    // refresh, that guarentees it cannot be loaded in the player.
    videoDetails.filter((video) => video.delete).forEach(delayedDeleteVideo);

    // Return this list of videos without those marked for deletion which may still
    // exist for a short time.
    const toDisplay = videoDetails.filter((video) => !video.delete);
    console.info('[DiskClient] Loaded', toDisplay.length, 'videos from disk');
    return toDisplay;
  }

  public async deleteVideos(videoPaths: string[]) {
    videoPaths.forEach((videoPath) => this.deleteVideoDisk(videoPath));
  }

  public async tagVideos(videoPaths: string[], tag: string) {
    videoPaths.forEach((videoPath) => this.tagVideoDisk(videoPath, tag));
  }

  public async protectVideos(videoPaths: string[], protect: boolean) {
    videoPaths.forEach((videoPath) =>
      this.protectVideoDisk(protect, videoPath),
    );
  }

  public async annotateVideos(videoPaths: string[], annotations: string) {
    await Promise.all(
      videoPaths.map((videoPath) =>
        this.annotateVideoDisk(videoPath, annotations),
      ),
    );
  }

  /**
   * Put a save marker on a video, protecting it from the file monitor.
   */
  private async protectVideoDisk(protect: boolean, videoPath: string) {
    let metadata;

    try {
      metadata = await getMetadataForVideo(videoPath);
    } catch (err) {
      console.error(
        `[Util] Metadata not found for '${videoPath}', but somehow we managed to load it. This shouldn't happen.`,
        err,
      );

      return;
    }

    if (protect) {
      console.info(`[Util] User set protected ${videoPath}`);
    } else {
      console.info(`[Util] User unprotected ${videoPath}`);
    }

    metadata.protected = protect;
    await writeMetadataFile(videoPath, metadata);
  }

  private async tagVideoDisk(videoPath: string, tag: string) {
    let metadata;

    try {
      metadata = await getMetadataForVideo(videoPath);
    } catch (err) {
      console.error(
        `[Util] Metadata not found for '${videoPath}', but somehow we managed to load it. This shouldn't happen.`,
        err,
      );

      return;
    }

    if (!tag || !/\S/.test(tag)) {
      // empty or whitespace only
      console.info('[Util] User removed tag');
      metadata.tag = undefined;
    } else {
      console.info('[Util] User tagged', videoPath, 'with', tag);
      metadata.tag = tag;
    }

    await writeMetadataFile(videoPath, metadata);
  }

  private async annotateVideoDisk(videoPath: string, annotations: string) {
    let metadata;

    try {
      metadata = await getMetadataForVideo(videoPath);
    } catch (err) {
      console.error(
        `[Util] Metadata not found for '${videoPath}', but somehow we managed to load it. This shouldn't happen.`,
        err,
      );

      return;
    }

    if (!annotations || annotations === '[]') {
      // No elements; clear any existing annotations.
      console.info('[Util] User cleared annotations on', videoPath);
      metadata.annotations = undefined;
    } else {
      console.info('[Util] User annotated', videoPath);
      metadata.annotations = annotations;
    }

    await writeMetadataFile(videoPath, metadata);
  }

  private async deleteVideoDisk(videoPath: string) {
    try {
      // Bit weird we have to check a boolean here given all the error handling
      // going on. That's just me taking an easy way out rather than fixing this
      // more elegantly. TL;DR deleteVideoDisk doesn't throw anything.
      const success = await deleteVideoDisk(videoPath);

      if (!success) {
        throw new Error('Failed deleting video, will mark for delete');
      }
    } catch (error) {
      // If that didn't work for any reason, try to at least mark it for deletion,
      // so that it can be picked up on refresh and we won't show videos the user
      // intended to delete
      console.warn(
        '[Manager] Failed to directly delete video on disk:',
        String(error),
      );

      markForVideoForDelete(videoPath);
    }
  }

  private setupListeners() {
    ipcMain.on('deleteVideosDisk', async (_event, args) => {
      const videos = args as RendererVideo[];
      const toDelete = videos.filter((v) => !v.cloud).map((v) => v.videoSource);
      if (toDelete.length < 1) return;
      this.deleteVideos(toDelete);
    });

    ipcMain.on('videoButtonDisk', async (_event, args) => {
      const action = args[0] as string;

      if (action === 'open') {
        // Open only called for disk based video, see openURL for cloud version.
        const src = args[1] as string;
        const cloud = args[2] as boolean;
        assert(!cloud);
        openSystemExplorer(src);
      }

      if (action === 'protect') {
        const protect = args[1] as boolean;
        const videos = args[2] as RendererVideo[];
        const disk = videos.filter((v) => !v.cloud);
        const toProtect = disk.map((v) => v.videoSource);
        this.protectVideos(toProtect, protect);
      }

      if (action === 'tag') {
        const tag = args[1] as string;
        const videos = args[2] as RendererVideo[];
        const disk = videos.filter((v) => !v.cloud);
        const toTag = disk.map((v) => v.videoSource);
        this.tagVideos(toTag, tag);
      }

      if (action === 'annotations') {
        const annotations = args[1] as string;
        const videos = args[2] as RendererVideo[];
        const disk = videos.filter((v) => !v.cloud);
        const toAnnotate = disk.map((v) => v.videoSource);
        await this.annotateVideos(toAnnotate, annotations);

        // Refresh so the in-memory video state reflects the saved annotations.
        // Without this, reopening the VOD later in the same session (which
        // remounts the player and re-seeds from videos[0].annotations) would
        // show an empty overlay. The currently-playing player isn't disrupted
        // (its videos come from selectedVideos, and its key is unchanged).
        this.refreshVideos();
      }
    });
  }
}
