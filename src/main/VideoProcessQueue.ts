import path from 'path';
import { shouldUpload } from '../utils/configUtils';
import DiskSizeMonitor from '../storage/DiskSizeMonitor';
import ConfigService from '../config/ConfigService';
import {
  CloudMetadata,
  DiskStatus,
  RendererVideo,
  SaveStatus,
  UploadQueueItem,
  VideoQueueItem,
} from './types';
import {
  writeMetadataFile,
  getMetadataForVideo,
  rendererVideoToMetadata,
  getFileInfo,
  fixPathWhenPackaged,
  logAxiosError,
} from './util';
import CloudClient from '../storage/CloudClient';
import { send } from './main';
import ffmpeg from 'fluent-ffmpeg';
import axios from 'axios';
import DiskClient from 'storage/DiskClient';

const atomicQueue = require('atomic-queue');

const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffmpegInstallerPath = fixPathWhenPackaged(ffmpegInstaller.path);
ffmpeg.setFfmpegPath(ffmpegInstallerPath);

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

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
   * Constructor.
   */
  private constructor() {
    this.videoQueue = this.createVideoQueue();
    this.uploadQueue = this.createUploadQueue();
    this.downloadQueue = this.createDownloadQueue();
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
   * Process a video by cutting it to size and saving it to disk, also
   * writes out the metadata JSON file.
   */
  private async processVideoQueueItem(
    data: VideoQueueItem,
    done: () => void,
  ): Promise<void> {
    try {
      const outputDir = this.cfg.get<string>('storagePath');

      // In a lot of cases this is basically just a copy. But this also
      // covers the cases where we're cutting a section off the end of
      // the video due to a timeout.
      const videoPath = await this.cutVideo(
        data.source,
        outputDir,
        data.suffix,
        data.offset,
        data.duration,
      );

      await writeMetadataFile(videoPath, data.metadata);

      const readyToUpload = await CloudClient.getInstance().ready();
      const upload = readyToUpload && shouldUpload(this.cfg, data.metadata);

      if (upload) {
        const item: UploadQueueItem = { path: videoPath };
        this.queueUpload(item);
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
   * Run actions on the upload queue being empty.
   */
  private async uploadQueueEmpty() {
    console.info('[VideoProcessQueue] Upload processing queue empty');
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
  private static getOutputVideoPath(
    sourceFile: string,
    outputDir: string,
    suffix: string | undefined,
  ) {
    let videoName = path.basename(sourceFile, '.mp4');

    if (suffix) {
      videoName += ' - ';
      videoName += suffix;
    }

    videoName = VideoProcessQueue.sanitizeFilename(videoName);
    return path.join(outputDir, `${videoName}.mp4`);
  }

  /**
   * This can be called either to cut a clip, or to cut a video on
   * finishing. Keep in mind that a video finishing may have a duration
   * less than the source video, if the recording was stopped by a log
   * timeout.
   */
  private async cutVideo(
    srcFile: string,
    outputDir: string,
    suffix: string | undefined,
    offset: number,
    duration: number,
  ): Promise<string> {
    console.info('[VideoProcessQueue] Cutting video:', {
      srcFile,
      outputDir,
      suffix,
      offset,
      duration,
    });

    let start = offset;

    if (offset < 0) {
      console.warn('[VideoProcessQueue] Negative offset set to zero');
      start = 0; // Sanity check.
    }

    const outputPath = VideoProcessQueue.getOutputVideoPath(
      srcFile,
      outputDir,
      suffix,
    );

    const fn = ffmpeg(srcFile)
      .setStartTime(start)
      .setDuration(duration)
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
  private static async ffmpegWrapper(fn: ffmpeg.FfmpegCommand, descr: string) {
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
      };

      fn.on('start', handleStart)
        .on('end', handleEnd)
        .on('error', handleErr)
        .on('stderr', handleStderr)
        .on('progress', onProgress)
        .run();
    });
  }
}
