import path from 'path';
import { ipcMain } from 'electron';
import {
  getBaseConfig,
  getStagingDir,
  shouldUpload,
} from '../utils/configUtils';
import DiskSizeMonitor from '../storage/DiskSizeMonitor';
import ConfigService from '../config/ConfigService';
import {
  CloudMetadata,
  DiskStatus,
  KillVideoQueueItem,
  KillVideoStatus,
  RelocateQueueItem,
  RendererVideo,
  SaveStatus,
  UploadQueueItem,
  VideoQueueItem,
} from './types';
import {
  writeMetadataFile,
  getMetadataForVideo,
  getMetadataFileNameForVideo,
  getSortedVideos,
  deleteVideoDisk,
  exists,
  rendererVideoToMetadata,
  getFileInfo,
  fixPathWhenPackaged,
  logAxiosError,
  buildKillVideoMetadata,
  getOBSFormattedDate,
} from './util';
import CloudClient from '../storage/CloudClient';
import { send } from './main';
import ffmpeg from 'fluent-ffmpeg';
import axios from 'axios';
import DiskClient from 'storage/DiskClient';
import Recorder from './Recorder';
import { promises as fspromise } from 'fs';

const atomicQueue = require('atomic-queue');
const devMode = process.env.NODE_ENV === 'development';
const isDebug = devMode || process.env.DEBUG_PROD === 'true';

// Use the dynamically linked ffmpeg.exe we package with OBS in noobs. This
// allows us to avoid including a static ffmpeg.exe which is an extra 60MB.
const ffmpegPathRel = 'node_modules/noobs/dist/bin/ffmpeg.exe';

let ffmpegPathAbs = devMode
  ? path.resolve(__dirname, '../../release/app/', ffmpegPathRel)
  : path.resolve(__dirname, '../../', ffmpegPathRel);

ffmpegPathAbs = fixPathWhenPackaged(ffmpegPathAbs);
ffmpeg.setFfmpegPath(ffmpegPathAbs);

/**
 * A queue for cutting videos to size.
 */
export default class VideoProcessQueue {
  /**
   * Singleton instance.
   */
  private static instance: VideoProcessQueue;

  /**
   * Singleton instance accessor.
   */
  public static getInstance() {
    if (!this.instance) this.instance = new this();
    return this.instance;
  }

  /**
   * Atomic queue object for queueing cutting of videos.
   */
  private videoQueue: any;

  /**
   * Atomic queue object for queuing upload of videos, seperated from the
   * video queue as this can take a long time and we don't want to block further
   * video cuts behind uploads.
   */
  private uploadQueue: any;

  /**
   * Atomic queue object for queuing download of videos.
   */
  private downloadQueue: any;

  /**
   * The kill video queue re-encoder a video from multiple perspectives into a
   * single video file. This is naturally computationally expensive.
   */
  private killVideoQueue: any;

  /**
   * Atomic queue for relocating freshly cut videos from the local staging dir
   * to the final storage path (e.g. a NAS). Kept separate so the slow network
   * copy doesn't block further video cuts. Used by the "review locally while
   * relocating to storage" feature.
   */
  private relocateQueue: any;

  /**
   * Config service handle.
   */
  private cfg = ConfigService.getInstance();

  /**
   * List of video file paths currently in the upload queue, or in
   * progress. Used to block subsequent attempts to queue the same
   * operation.
   */
  private inProgressUploads: string[] = [];

  /**
   * List of video names currently in the download queue, or in
   * progress. Used to block subsequent attempts to queeue the same
   * operation.
   */
  private inProgressDownloads: string[] = [];

  /**
   * List of kill video job uuids currently in in the queue for
   * processing, or in progress currently.
   */
  private inProgressKillVideos: string[] = [];

  /**
   * Resolved paths of the video sources currently loaded in the frontend
   * player(s). Reported by the renderer. Used so we never delete a local
   * staging copy that is currently being reviewed.
   */
  private activeSources = new Set<string>();

  /**
   * Staging copies that have been relocated to storage but couldn't be deleted
   * yet because they were in use. Cleaned up once playback moves off them.
   */
  private pendingStagingDeletes = new Set<string>();

  /**
   * Constructor.
   */
  private constructor() {
    this.videoQueue = this.createVideoQueue();
    this.uploadQueue = this.createUploadQueue();
    this.downloadQueue = this.createDownloadQueue();
    this.killVideoQueue = this.createKillVideoQueue();
    this.relocateQueue = this.createRelocateQueue();
    this.registerListeners();
  }

  /**
   * Register IPC listeners.
   */
  private registerListeners() {
    ipcMain.on('activeVideoSources', (_event, args) => {
      const sources = (args as string[]) ?? [];
      this.setActiveVideoSources(sources);
    });
  }

  private createVideoQueue() {
    const worker = this.processVideoQueueItem.bind(this);
    const settings = { concurrency: 1 };
    const queue = atomicQueue(worker, settings);

    /* eslint-disable prettier/prettier */
    queue
      .on('error', VideoProcessQueue.errorProcessingVideo)
      .on('idle', () => {this.videoQueueEmpty()});
         
    queue.pool
      .on('start', (data: VideoQueueItem) => { this.startedProcessingVideo(data) })
      .on('finish', (_: unknown, data: VideoQueueItem) => { this.finishProcessingVideo(data) });
    /* eslint-enable prettier/prettier */

    return queue;
  }

  private createUploadQueue() {
    const worker = this.processUploadQueueItem.bind(this);
    const settings = { concurrency: 1 };
    const queue = atomicQueue(worker, settings);

    /* eslint-disable prettier/prettier */
    queue
      .on('error', VideoProcessQueue.errorUploadingVideo)
      .on('idle', () => { this.uploadQueueEmpty() });

    queue.pool
      .on('start', (item: UploadQueueItem) => { this.startedUploadingVideo(item) })
      .on('finish', async (_: unknown, item: UploadQueueItem) => { await this.finishUploadingVideo(item) });
    /* eslint-enable prettier/prettier */

    return queue;
  }

  private createDownloadQueue() {
    const worker = this.processDownloadQueueItem.bind(this);
    const settings = { concurrency: 1 };
    const queue = atomicQueue(worker, settings);

    /* eslint-disable prettier/prettier */
    queue
      .on('error', VideoProcessQueue.errorDownloadingVideo)
      .on('idle', () => { this.downloadQueueEmpty() });

    queue.pool
      .on('start', (video: RendererVideo) => { this.startedDownloadingVideo(video) })
      .on('finish', async (_: unknown, video: RendererVideo) => { await this.finishDownloadingVideo(video) });
    /* eslint-enable prettier/prettier */

    return queue;
  }

  private createKillVideoQueue() {
    const worker = this.processKillVideoQueueItem.bind(this);
    const settings = { concurrency: 1 };
    const queue = atomicQueue(worker, settings);

    /* eslint-disable prettier/prettier */
    queue
      .on('error', VideoProcessQueue.errorKillVideo)
      .on('idle', () => { this.videoQueueEmpty() });

    queue.pool
      .on('start', (item: KillVideoQueueItem) => { this.startedProcessingKillVideo(item) })
      .on('finish', (_: unknown, item: KillVideoQueueItem) => { this.finishProcessingKillVideo(item) });
    /* eslint-enable prettier/prettier */

    return queue;
  }

  private createRelocateQueue() {
    const worker = this.processRelocateQueueItem.bind(this);
    const settings = { concurrency: 1 };
    const queue = atomicQueue(worker, settings);

    /* eslint-disable prettier/prettier */
    queue
      .on('error', VideoProcessQueue.errorRelocatingVideo)
      .on('idle', () => { this.relocateQueueEmpty() });
    /* eslint-enable prettier/prettier */

    return queue;
  }

  /**
   * Add a video to the queue for processing, the processing it undergoes is
   * dictated by the input. This is the only public method on this class.
   */
  public queueVideo = async (item: VideoQueueItem) => {
    console.info('[VideoProcessQueue] Queuing video for processing', item);
    this.videoQueue.write(item);
  };

  /**
   * Queue a video for upload.
   */
  public queueUpload = async (item: UploadQueueItem) => {
    const alreadyQueued = this.inProgressUploads.includes(item.path);

    if (alreadyQueued) {
      console.warn('[VideoProcessQueue] Upload already queued', item.path);
      return;
    }

    console.log('[VideoProcessQueue] Queuing video for upload', item.path);
    this.inProgressUploads.push(item.path);
    this.uploadQueue.write(item);

    const queued = Math.max(0, this.inProgressUploads.length);
    send('updateUploadQueueLength', queued);
  };

  /**
   * Queue a video for download.
   */
  public queueDownload = async (video: RendererVideo) => {
    const { videoName } = video;
    const alreadyQueued = this.inProgressDownloads.includes(video.videoName);

    if (alreadyQueued) {
      console.warn('[VideoProcessQueue] Download already queued', videoName);
      return;
    }

    console.log('[VideoProcessQueue] Queuing video for download', videoName);
    this.inProgressDownloads.push(videoName);
    this.downloadQueue.write(video);

    const queued = Math.max(0, this.inProgressDownloads.length);
    send('updateDownloadQueueLength', queued);
  };

  /**
   * Queue up a kill video for creation.
   */
  public queueCreateKillVideo = async (item: KillVideoQueueItem) => {
    console.log('[VideoProcessQueue] Queue kill video for processing');
    this.inProgressKillVideos.push(item.uuid);
    this.killVideoQueue.write(item);
  };

  /**
   * Queue a freshly cut video for relocation from the local staging dir to the
   * final storage path.
   */
  public queueRelocate = async (item: RelocateQueueItem) => {
    console.info(
      '[VideoProcessQueue] Queuing video for relocation',
      item.stagingPath,
    );
    this.relocateQueue.write(item);
  };

  /**
   * Reconcile the local staging dir on startup. For each staged video: if it
   * already exists in storage, delete the now-redundant local copy; otherwise
   * (e.g. the app closed mid-relocation) re-queue it for relocation.
   *
   * This is a startup backstop. During a session, relocated staging copies are
   * cleaned up promptly by disposeStagingCopy once they're no longer being
   * reviewed (tracked via activeSources). Running at startup is always safe as
   * nothing can be open in the player yet.
   */
  public reconcileStaging = async () => {
    const stagingDir = getStagingDir(this.cfg);

    if (!stagingDir || !(await exists(stagingDir))) {
      return;
    }

    const storageDir = this.cfg.get<string>('storagePath');
    const staged = await getSortedVideos(stagingDir);

    await Promise.all(
      staged.map(async (file) => {
        const name = path.basename(file.name); // "<name>.mp4"
        const onStorage = await exists(path.join(storageDir, name));

        if (onStorage) {
          console.info(
            '[VideoProcessQueue] Removing relocated staging copy',
            file.name,
          );
          await deleteVideoDisk(file.name);
        } else {
          console.info(
            '[VideoProcessQueue] Re-queuing orphaned staging video',
            file.name,
          );
          this.queueRelocate({ stagingPath: file.name, storageDir });
        }
      }),
    );
  };

  /**
   * Record which video sources are currently loaded in the frontend player(s),
   * then clean up any deferred staging deletions that are no longer in use.
   */
  public setActiveVideoSources(sources: string[]) {
    this.activeSources = new Set(sources.map((s) => path.resolve(s)));
    this.cleanPendingStaging();
  }

  /**
   * Dispose of a staging copy once it has been relocated to storage. If it's
   * currently being reviewed, defer deletion until playback moves off it.
   */
  private async disposeStagingCopy(stagingPath: string) {
    if (this.activeSources.has(path.resolve(stagingPath))) {
      console.info(
        '[VideoProcessQueue] Staging copy in use, deferring cleanup',
        stagingPath,
      );

      this.pendingStagingDeletes.add(stagingPath);
      return;
    }

    console.info(
      '[VideoProcessQueue] Removing relocated staging copy',
      stagingPath,
    );

    await deleteVideoDisk(stagingPath);
  }

  /**
   * Delete any deferred staging copies that are no longer in use.
   */
  private cleanPendingStaging() {
    this.pendingStagingDeletes.forEach((stagingPath) => {
      if (this.activeSources.has(path.resolve(stagingPath))) {
        // Still being reviewed; leave it for now.
        return;
      }

      this.pendingStagingDeletes.delete(stagingPath);

      console.info(
        '[VideoProcessQueue] Removing deferred staging copy',
        stagingPath,
      );

      deleteVideoDisk(stagingPath);
    });
  }

  /**
   * Process a video by cutting it to size and saving it to disk, also
   * writes out the metadata JSON file.
   */
  private async processVideoQueueItem(
    data: VideoQueueItem,
    done: () => void,
  ): Promise<void> {
    try {
      const storagePath = this.cfg.get<string>('storagePath');
      const stagingDir = getStagingDir(this.cfg);

      // When a separate local buffer is configured we cut into a local staging
      // dir so the video can be reviewed immediately, then relocate it to the
      // (possibly slow) storage path in the background. Otherwise we cut
      // straight to storage as before.
      const outputDir = stagingDir ?? storagePath;

      if (stagingDir) {
        await fspromise.mkdir(stagingDir, { recursive: true });
      }

      // In a lot of cases this is basically just a copy. But this also
      // covers the cases where we're cutting a section off the end of
      // the video due to a timeout.
      const videoPath = await this.cutVideo(data, outputDir);

      // Add the size of the newly cut video. We can't do this earlier
      // as the size will change when we cut/remux.
      const stat = await fspromise.stat(videoPath);
      data.metadata.size = stat.size;

      await writeMetadataFile(videoPath, data.metadata);

      const readyToUpload = await CloudClient.getInstance().ready();
      const upload = readyToUpload && shouldUpload(this.cfg, data.metadata);

      if (upload) {
        const item: UploadQueueItem = { path: videoPath };
        this.queueUpload(item);
      }

      if (stagingDir) {
        // The cut MP4 now lives on the local disk and becomes reviewable as
        // soon as the frontend refreshes (finishProcessingVideo). Relocate it
        // to the final storage path in the background.
        this.queueRelocate({ stagingPath: videoPath, storageDir: storagePath });
      }
    } catch (error) {
      console.error(
        '[VideoProcessQueue] Error processing video:',
        String(error),
      );
    }

    done();
  }

  /**
   * Upload a video to the cloud store.
   */
  private async processUploadQueueItem(
    item: UploadQueueItem,
    done: () => void,
  ): Promise<void> {
    let lastProgress = 0;

    // Decide if we need to use a rate limit or not. Setting to -1 is unlimited.
    const rateLimit = this.cfg.get<boolean>('cloudUploadRateLimit')
      ? this.cfg.get<number>('cloudUploadRateLimitMbps')
      : -1;

    const progressCallback = (progress: number) => {
      if (progress === lastProgress) {
        return;
      }

      send('updateUploadProgress', progress);
      lastProgress = progress;
    };

    const client = CloudClient.getInstance();

    try {
      // Upload the video first, this can take a bit of time, and don't want
      // to confuse the frontend by having metadata without video.
      await client.putFile(item.path, rateLimit, progressCallback);
      progressCallback(100);

      // Now add the metadata.
      const metadata = await getMetadataForVideo(item.path);

      const cloudMetadata: CloudMetadata = {
        ...metadata,
        start: metadata.start || 0,
        uniqueHash: metadata.uniqueHash || '',
        videoName: path.basename(item.path, '.mp4'),
        videoKey: path.basename(item.path),
      };

      if (cloudMetadata.level) {
        // The string "level" isn't a valid SQL column name, in new videos we
        // use the keystoneLevel entry in the metadata, but if we're uploading
        // an old video correct it here at the point of upload.
        cloudMetadata.keystoneLevel = cloudMetadata.level;
        delete cloudMetadata.level;
      }

      if (cloudMetadata.start === 0) {
        // Another "old videos don't have..." bug, this time for the start
        // parameter, which causes dates to be wrong in the UI. Grab the date
        // from the video file on disk.
        const stats = await getFileInfo(item.path);
        cloudMetadata.start = stats.mtime;
      }

      await client.postVideo(cloudMetadata);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const msg = '[CloudClient] Axios error processing video';
        logAxiosError(msg, error);
      } else {
        console.error('[CloudClient] Error processing video', error);
      }

      progressCallback(100);
    }

    done();
  }

  /**
   * Download a video from the cloud store to disk. This won't remove it from
   * the cloud store.
   */
  private async processDownloadQueueItem(
    video: RendererVideo,
    done: () => void,
  ): Promise<void> {
    const storageDir = this.cfg.get<string>('storagePath');
    const { videoName, videoSource } = video;

    let lastProgress = 0;

    const progressCallback = (progress: number) => {
      if (progress === lastProgress) {
        return;
      }

      send('updateDownloadProgress', progress);
      lastProgress = progress;
    };

    const client = CloudClient.getInstance();

    try {
      await client.getAsFile(
        `${videoName}.mp4`,
        videoSource,
        storageDir,
        progressCallback,
      );

      // Spread to force this to be cloned, avoiding modifying the original input,
      // which is used again later. This manifested as a bug that prevented us clearing
      // the entry from the inProgressDownloads when done, meaning that a repeated
      // attempt to download would fail.
      const metadata = rendererVideoToMetadata({ ...video });
      const videoPath = path.join(storageDir, `${videoName}.mp4`);
      await writeMetadataFile(videoPath, metadata);
    } catch (error) {
      console.error(
        '[VideoProcessQueue] Error downloading video:',
        String(error),
      );
    }

    done();
  }

  /**
   * Create a kill video. This is CPU intensive and involves re-encoding. We
   * build a complex filter graph to stitch together the different perspectives
   * with video and audio transitions.
   */
  private async processKillVideoQueueItem(
    item: KillVideoQueueItem,
    done: () => void,
  ): Promise<void> {
    if (item.segments.length < 2) {
      // Programmer error. Can't make kill videos of less than 2 segments.
      console.error('[VideoProcessQueue] Less than 2 segments');
      done();
      return;
    }

    const first = item.segments[0].video;
    const videoPath = VideoProcessQueue.prepareKillVideoPath(first);
    const audioMap = VideoProcessQueue.prepareKillVideoAudioMap(item);
    const filter = VideoProcessQueue.prepareKillVideoComplexFilter(item);

    const fn = ffmpeg()
      .complexFilter(filter)
      .outputOption('-movflags +faststart')
      .outputOption('-map [v]')
      .outputOption(audioMap)
      .outputOption('-shortest')
      .outputOption('-c:v libx264')
      .outputOption('-crf 22') // Matches "Ultra" in the Recorder.
      .outputOption('-c:a aac')
      .outputOption('-preset fast')
      .outputOption('-pix_fmt yuv420p')
      .outputOption('-xerror') // Die on error.
      .output(videoPath);

    item.segments
      .map((seg) => seg.video.videoSource)
      .forEach((src) => {
        console.info('[VideoProcessQueue] Adding source to ffmpeg:', src);
        fn.input(src);
      });

    try {
      console.time(`[VideoProcessQueue] Create ${item.uuid} kill video`);

      // The ffmpeg command is constructed so now do the actual work. A
      // reminder: this is a full re-encode and is computationally expensive.
      await VideoProcessQueue.ffmpegWrapper(
        fn,
        'Make kill Video',
        (progress: number) => this.onKillVideoProgress(progress),
      );

      console.timeEnd(`[VideoProcessQueue] Create ${item.uuid} kill video`);

      // Ffmpeg is done. Write out the metadata for the newly generated clip.
      const baseMetadata = rendererVideoToMetadata({ ...first }); // Close as will mutate.
      const metadata = buildKillVideoMetadata(baseMetadata, item.segments);
      await writeMetadataFile(videoPath, metadata);

      const readyToUpload = await CloudClient.getInstance().ready();
      const upload = readyToUpload && shouldUpload(this.cfg, metadata);

      if (upload) {
        const item: UploadQueueItem = { path: videoPath };
        this.queueUpload(item);
      }
    } finally {
      done();
    }
  }

  /**
   * Relocate a freshly cut video from the local staging dir to the final
   * storage path. Publishes atomically: the MP4/JSON are first copied into a
   * hidden ".relocating" temp dir on the storage volume, then renamed into
   * place (rename is atomic on the same filesystem) so a refresh never sees a
   * half-written file. The local staging copy is left in place and cleaned up
   * at next startup (reconcileStaging) so we never delete a file mid-review.
   */
  private async processRelocateQueueItem(
    item: RelocateQueueItem,
    done: () => void,
  ): Promise<void> {
    const { stagingPath, storageDir } = item;
    const name = path.basename(stagingPath); // "<name>.mp4"
    const stagingJson = getMetadataFileNameForVideo(stagingPath);

    const tmpDir = path.join(storageDir, '.relocating');
    const tmpMp4 = path.join(tmpDir, name);
    const tmpJson = getMetadataFileNameForVideo(tmpMp4);

    const destMp4 = path.join(storageDir, name);
    const destJson = getMetadataFileNameForVideo(destMp4);

    try {
      await fspromise.mkdir(tmpDir, { recursive: true });

      // Copy both files fully into the temp dir (the slow network part).
      await fspromise.copyFile(stagingJson, tmpJson);
      await fspromise.copyFile(stagingPath, tmpMp4);

      // Sanity check the copied video size matches the source.
      const [srcStat, dstStat] = await Promise.all([
        fspromise.stat(stagingPath),
        fspromise.stat(tmpMp4),
      ]);

      if (srcStat.size !== dstStat.size) {
        throw new Error(
          `Relocated size mismatch ${srcStat.size} != ${dstStat.size} for ${name}`,
        );
      }

      // Publish: rename the JSON first, then the MP4. getSortedVideos only
      // lists .mp4 files, so the video only becomes visible on storage once
      // its metadata is already in place.
      await fspromise.rename(tmpJson, destJson);
      await fspromise.rename(tmpMp4, destMp4);

      console.info('[VideoProcessQueue] Relocated video to storage', destMp4);

      // Tell the frontend the source moved staging -> storage so any open
      // player swaps its reference to the permanent copy (and the relocating
      // badge clears). Combined with the vod:// storage fallback, this makes
      // the cutover seamless: the live media keeps streaming while state
      // catches up to the permanent path.
      send('videoSourceRelocated', { from: stagingPath, to: destMp4 });

      // Refresh so the frontend now resolves the video from storage. Any
      // in-progress playback of the local staging copy is unaffected.
      DiskClient.getInstance().refreshVideos();

      // Remove the local staging copy now it's safely in storage, unless it's
      // currently being reviewed (in which case it's cleaned up once playback
      // moves on).
      await this.disposeStagingCopy(stagingPath);
    } catch (error) {
      console.error(
        '[VideoProcessQueue] Error relocating video:',
        String(error),
      );

      // Best effort: remove any partial temp files (deletes the temp mp4 and
      // its json sibling). The staging copy remains, so the video is still
      // reviewable and reconcileStaging will retry on the next startup.
      await deleteVideoDisk(tmpMp4);
    }

    done();
  }

  /**
   * Push kill video encoding progress to the frontend.
   */
  private onKillVideoProgress(progress: number) {
    const queued = Math.max(0, this.inProgressKillVideos.length);
    const perc = Math.round(progress);
    const status: KillVideoStatus = { queued, perc };
    send('updateKillVideoStatus', status);
  }

  /**
   * Log an error processing the video.
   */
  private static errorProcessingVideo(err: unknown) {
    console.error('[VideoProcessQueue] Error processing video', String(err));
  }

  /**
   * Log an error uploading the video.
   */
  private static errorUploadingVideo(err: unknown) {
    console.error('[VideoProcessQueue] Error uploading video', String(err));
  }

  /**
   * Log an error downloading the video.
   */
  private static errorDownloadingVideo(err: unknown) {
    console.error('[VideoProcessQueue] Error downloading video', String(err));
  }

  /**
   * Log an error processing a kill video.
   */
  private static errorKillVideo(err: unknown) {
    console.error('[VideoProcessQueue] Error creating kill video', String(err));
  }

  /**
   * Log an error relocating a video.
   */
  private static errorRelocatingVideo(err: unknown) {
    console.error('[VideoProcessQueue] Error relocating video', String(err));
  }

  /**
   * Log we are starting the processing and update the saving status icon.
   */
  private startedProcessingVideo(item: VideoQueueItem) {
    console.info('[VideoProcessQueue] Now processing video', item.source);
    send('updateSaveStatus', SaveStatus.Saving);
  }

  /**
   * Log we are done, and update the saving status icon and refresh the
   * frontend.
   */
  private async finishProcessingVideo(item: VideoQueueItem) {
    console.info('[VideoProcessQueue] Finished processing video', item.source);
    send('updateSaveStatus', SaveStatus.NotSaving);
    DiskClient.getInstance().refreshStatus();
    DiskClient.getInstance().refreshVideos();
  }

  /**
   * Actions on starting the processing of a kill video.
   */
  private startedProcessingKillVideo(item: KillVideoQueueItem) {
    console.info('[VideoProcessQueue] Now processing kill video');

    const status: KillVideoStatus = {
      queued: Math.max(0, this.inProgressKillVideos.length),
      perc: 0,
    };

    send('updateKillVideoStatus', status);
  }

  /**
   * Actions on finishing processing a kill video.
   */
  private finishProcessingKillVideo(item: KillVideoQueueItem) {
    console.info('[VideoProcessQueue] Finished processing kill video');

    this.inProgressKillVideos = this.inProgressKillVideos.filter(
      (id) => id !== item.uuid,
    );

    const status: KillVideoStatus = {
      perc: 0,
      queued: Math.max(0, this.inProgressKillVideos.length),
    };

    send('updateKillVideoStatus', status);
    DiskClient.getInstance().refreshStatus();
    DiskClient.getInstance().refreshVideos();
  }

  /**
   * Called on the start of an upload. Set the upload bar to zero and log.
   */
  private startedUploadingVideo(item: UploadQueueItem) {
    console.info('[VideoProcessQueue] Now uploading video', item.path);
    const queued = Math.max(0, this.inProgressUploads.length);
    send('updateUploadProgress', 0);
    send('updateUploadQueueLength', queued);
  }

  /**
   * Called on the end of an upload.
   */
  private finishUploadingVideo(item: UploadQueueItem) {
    console.info('[VideoProcessQueue] Finished uploading video', item.path);

    this.inProgressUploads = this.inProgressUploads.filter(
      (p) => p !== item.path,
    );

    const queued = Math.max(0, this.inProgressUploads.length);
    send('updateUploadQueueLength', queued);
  }

  /**
   * Called on the start of a download. Set the download bar to zero and log.
   */
  private startedDownloadingVideo(video: RendererVideo) {
    const { videoName } = video;
    console.info('[VideoProcessQueue] Now downloading video', videoName);
    const queued = Math.max(0, this.inProgressDownloads.length);
    send('updateDownloadProgress', 0);
    send('updateDownloadQueueLength', queued);
  }

  /**
   * Called on the end of an upload.
   */
  private async finishDownloadingVideo(video: RendererVideo) {
    const { videoName } = video;
    console.info('[VideoProcessQueue] Finished downloading video', videoName);

    this.inProgressDownloads = this.inProgressDownloads.filter(
      (p) => p !== videoName,
    );

    const queued = Math.max(0, this.inProgressDownloads.length);
    send('updateDownloadQueueLength', queued);

    DiskClient.getInstance().refreshStatus();
    DiskClient.getInstance().refreshVideos();
  }

  /**
   * Run actions on the queue being empty.
   */
  private async videoQueueEmpty() {
    console.info('[VideoProcessQueue] Video processing queue empty');

    // Run the size monitor.
    const sizeMonitor = new DiskSizeMonitor();
    await sizeMonitor.run();

    // Tidy the recording dir.
    const cfg = ConfigService.getInstance();
    const { obsPath } = getBaseConfig(cfg);
    await Recorder.getInstance().cleanup(obsPath);

    // Update the frontend with the new usage.
    const usage = await sizeMonitor.usage();

    const status: DiskStatus = {
      usage,
      limit: this.cfg.get<number>('maxStorage') * 1024 ** 3,
    };

    send('updateDiskStatus', status);
  }

  /**
   * Run actions on the upload queue being empty.
   */
  private async uploadQueueEmpty() {
    console.info('[VideoProcessQueue] Upload processing queue empty');
  }

  /**
   * Run actions on the relocate queue being empty.
   */
  private async relocateQueueEmpty() {
    console.info('[VideoProcessQueue] Relocate processing queue empty');
  }

  /**
   * Run actions on the download queue being empty.
   */
  private async downloadQueueEmpty() {
    console.info('[VideoProcessQueue] Download processing queue empty');
    const sizeMonitor = new DiskSizeMonitor();
    sizeMonitor.run();
    const usage = await sizeMonitor.usage();

    const status: DiskStatus = {
      usage,
      limit: this.cfg.get<number>('maxStorage') * 1024 ** 3,
    };

    send('updateDiskStatus', status);
  }

  /**
   * Sanitize a filename and replace all invalid characters with a space.
   *
   * Multiple consecutive invalid characters will be replaced by a single space.
   * Multiple consecutive spaces will be replaced by a single space.
   */
  private static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/|?*]/g, ' ') // Replace all invalid characters with space
      .replace(/ +/g, ' '); // Replace multiple spaces with a single space
  }

  /**
   * Returns the full path for a video cut operation's output file.
   */
  private static getOutputVideoPath(data: VideoQueueItem, outputDir: string) {
    let videoName = data.name;

    if (data.suffix) {
      videoName += ' - ';
      videoName += data.suffix;
    }

    videoName = VideoProcessQueue.sanitizeFilename(videoName);

    // Always output MP4. MKV is just an intermediate format.
    return path.join(outputDir, `${videoName}.mp4`);
  }

  /**
   * This can be called either to cut a clip, or to cut a video on
   * finishing. Keep in mind that a video finishing may have a duration
   * less than the source video, if the recording was stopped by a log
   * timeout.
   */
  private async cutVideo(
    data: VideoQueueItem,
    outputDir: string,
  ): Promise<string> {
    console.info('[VideoProcessQueue] Cutting video:', {
      name: data.name,
      source: data.source,
      outputDir,
      suffix: data.suffix,
      offset: data.offset,
      duration: data.duration,
    });

    let start = data.offset;

    if (data.offset < 0) {
      console.warn('[VideoProcessQueue] Negative offset set to zero');
      start = 0; // Sanity check.
    }

    const outputPath = VideoProcessQueue.getOutputVideoPath(data, outputDir);

    const fn = ffmpeg(data.source)
      .setStartTime(start)
      .setDuration(data.duration)
      // Crucially we copy the video and audio, so we don't do any
      // re-encoding which would take time and CPU.
      .withVideoCodec('copy')
      .withAudioCodec('copy')
      // Avoid any negative timestamps, which can cause issues with
      // some players, but does extend the video slightly depending on
      // the keyframe alignment.
      .outputOption('-avoid_negative_ts make_zero')
      // Move the moov atom to the start of the file for faster playback start.
      // This means R2 doesn't need to seek to the end to start playback.
      .outputOption('-movflags +faststart')
      .output(outputPath);

    console.time('[VideoProcessQueue] Video cut took:');
    await VideoProcessQueue.ffmpegWrapper(fn, 'Video cut');
    console.timeEnd('[VideoProcessQueue] Video cut took:');
    return outputPath;
  }

  /**
   * An async wrapper around ffmpeg-fluent to avoid a bunch of horrible promise
   * wrapping indented code being repeated.
   *
   * @param fn the ffmpeg function to wrap
   * @param descr a description of the command for logging
   */
  private static async ffmpegWrapper(
    fn: ffmpeg.FfmpegCommand,
    descr: string,
    progressCallback?: (progress: number) => void,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const handleErr = (err: unknown) => {
        const msg = `[VideoProcessQueue] ${descr} failed! ${String(err)}`;
        console.error(msg);
        reject(msg);
      };

      const handleEnd = async (err: unknown) => {
        if (err) handleErr(err);
        resolve();
      };

      const handleStart = (cmd: string) =>
        console.info('[VideoProcessQueue] FFmpeg command:', cmd);

      const handleStderr = (cmd: string) => {
        // This is very verbose, so just do it if we're in debug mode.
        if (isDebug) console.info('[VideoProcessQueue] FFmpeg stderr:', cmd);
      };

      const onProgress = (progress: {
        frames: number;
        currentFps: number;
        currentKbps: number;
        targetSize: number;
        timemark: string;
        percent?: number | undefined;
      }) => {
        console.info(
          '[VideoProcessQueue] Ffmpeg task:',
          descr,
          'progress:',
          progress.percent?.toFixed(0),
          '%',
        );

        if (
          progressCallback &&
          progress.percent !== undefined && // Technically covered by isFinite but typescript is dumb.
          Number.isFinite(progress.percent) // Sometimes ffmpeg-fluent gives NaN.
        ) {
          progressCallback(progress.percent);
        }
      };

      fn.on('start', handleStart)
        .on('end', handleEnd)
        .on('error', handleErr)
        .on('stderr', handleStderr)
        .on('progress', onProgress)
        .run();
    });
  }

  /**
   * Prepare and return the audio map for a kill video.
   */
  private static prepareKillVideoPath(video: RendererVideo) {
    const videoDate = video.start ?? video.mtime;

    let videoName = getOBSFormattedDate(new Date(videoDate));
    videoName += ` - Multiview`;

    // We checked earlier that segments isn't empty so not
    // worrying about checking for undefined here.
    if (video.encounterName && video.difficulty) {
      // We should always have these fields for raids, and raids are
      // the only supported kill video category.
      videoName += ` - ${video.encounterName}`;
      videoName += ` [${video.difficulty}]`;
    }

    videoName += ` - Rendered at ${getOBSFormattedDate(new Date())}`;
    const storageDir = ConfigService.getInstance().get<string>('storagePath');
    const videoPath = path.join(storageDir, `${videoName}.mp4`);

    console.info('[VideoProcessQueue] Kill video path:', videoPath);
    return videoPath;
  }

  /**
   * Prepare and return the audio map for a kill video.
   */
  private static prepareKillVideoAudioMap(item: KillVideoQueueItem) {
    const map =
      item.audioTrackIndex === -1
        ? '-map [a]'
        : `-map ${item.audioTrackIndex}:a`;

    console.info('[VideoProcessQueue] Audio map filter:', map);
    return map;
  }

  /**
   * Prepare and return an ffmpeg complex filter graph that does the
   * appropriate trimming, scaling, padding and fading to render a kill
   * video.
   */
  private static prepareKillVideoComplexFilter(item: KillVideoQueueItem) {
    let filter = '';

    item.segments.forEach((pov, idx) => {
      const segmentDuration = pov.stop - pov.start;
      const fadeDuration = 1;
      const fadeOutStart = Math.max(0, segmentDuration - fadeDuration);

      const scale = `${item.width}:-2`;
      const pad = `${item.width}:${item.height}:(ow-iw)/2:(oh-ih)/2`;

      const fadeIn = `t=in:st=0:d=${fadeDuration}`;
      const fadeOut = `t=out:st=${fadeOutStart}:d=${fadeDuration}`;

      const trim = `start=${pov.start}:end=${pov.stop}`;

      // Video
      filter +=
        `[${idx}:v]trim=${trim},setpts=PTS-STARTPTS,` +
        `fps=${item.fps},scale=${scale},pad=${pad},` +
        `fade=${fadeIn},fade=${fadeOut}[v${idx}];`;

      if (item.audioTrackIndex === -1) {
        // Audio
        filter +=
          `[${idx}:a]atrim=${trim},asetpts=PTS-STARTPTS,` +
          `afade=${fadeIn},afade=${fadeOut}[a${idx}];`;
      }
    });

    if (item.audioTrackIndex === -1) {
      const inputs = item.segments.map((_, i) => `[v${i}][a${i}]`).join('');
      filter += `${inputs}concat=n=${item.segments.length}:v=1:a=1[v][a]`;
    } else {
      const inputs = item.segments.map((_, i) => `[v${i}]`).join('');
      filter += `${inputs}concat=n=${item.segments.length}:v=1:a=0[v]`;
    }

    console.info('[VideoProcessQueue] Generated filter:', filter);
    return filter;
  }
}
