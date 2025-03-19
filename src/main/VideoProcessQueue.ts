import { BrowserWindow } from 'electron';
import path from 'path';
import assert from 'assert';
import { shouldUpload } from '../utils/configUtils';
import DiskSizeMonitor from '../storage/DiskSizeMonitor';
import ConfigService from '../config/ConfigService';
import {
  CloudMetadata,
  CloudStatus,
  DiskStatus,
  RendererVideo,
  SaveStatus,
  UploadQueueItem,
  VideoQueueItem,
} from './types';
import {
  fixPathWhenPackaged,
  tryUnlink,
  writeMetadataFile,
  getMetadataForVideo,
  rendererVideoToMetadata,
  getFileInfo,
  keyframeRound,
} from './util';
import CloudClient from '../storage/CloudClient';
import ffmpeg from 'fluent-ffmpeg';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);
const atomicQueue = require('atomic-queue');

const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');

const ffmpegInstallerPath = fixPathWhenPackaged(ffmpegInstaller.path);
const ffprobeInstallerPath = fixPathWhenPackaged(ffprobeInstaller.path);

ffmpeg.setFfmpegPath(ffmpegInstallerPath);
ffmpeg.setFfprobePath(ffprobeInstallerPath);

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

/**
 * A queue for cutting videos to size.
 */
export default class VideoProcessQueue {
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
   * Handle to the main window for updating the saving status icon.
   */
  private mainWindow: BrowserWindow;

  /**
   * Config service handle.
   */
  private cfg = ConfigService.getInstance();

  /**
   * Cloud client, defined if using cloud storage.
   */
  private cloudClient: CloudClient | undefined;

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
  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
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
   * Set the cloud client.
   */
  public setCloudClient = (cloudClient: CloudClient) => {
    this.cloudClient = cloudClient;
  };

  /**
   * Unset the cloud client.
   */
  public unsetCloudClient() {
    this.cloudClient = undefined;
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

    this.inProgressUploads.push(item.path);
    this.uploadQueue.write(item);
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

    this.inProgressDownloads.push(videoName);
    this.downloadQueue.write(video);
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

      const videoPath = await this.cutVideo(
        data.source,
        outputDir,
        data.suffix,
        data.offset,
        data.duration,
      );

      await writeMetadataFile(videoPath, data.metadata);

      if (data.deleteSource) {
        console.info('[VideoProcessQueue] Deleting source video file');
        await tryUnlink(data.source);
      }

      if (this.cloudClient && shouldUpload(this.cfg, data.metadata)) {
        const item: UploadQueueItem = {
          path: videoPath,
        };

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

      this.mainWindow.webContents.send('updateUploadProgress', progress);
      lastProgress = progress;
    };

    try {
      assert(this.cloudClient);

      // Upload the video first, this can take a bit of time, and don't want
      // to confuse the frontend by having metadata without video.
      await this.cloudClient.putFile(item.path, rateLimit, progressCallback);
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

      await this.cloudClient.postVideo(cloudMetadata);
    } catch (error) {
      console.error(
        '[VideoProcessQueue] Error processing video:',
        String(error),
        error,
      );
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

      this.mainWindow.webContents.send('updateDownloadProgress', progress);
      lastProgress = progress;
    };

    try {
      assert(this.cloudClient);

      await this.cloudClient.getAsFile(
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
    this.mainWindow.webContents.send('updateSaveStatus', SaveStatus.Saving);
  }

  /**
   * Log we are done, and update the saving status icon and refresh the
   * frontend.
   */
  private finishProcessingVideo(item: VideoQueueItem) {
    console.info('[VideoProcessQueue] Finished cutting video', item.source);
    this.mainWindow.webContents.send('updateSaveStatus', SaveStatus.NotSaving);
    this.mainWindow.webContents.send('refreshState');
  }

  /**
   * Called on the start of an upload. Set the upload bar to zero and log.
   */
  private startedUploadingVideo(item: UploadQueueItem) {
    console.info('[VideoProcessQueue] Now uploading video', item.path);
    this.mainWindow.webContents.send('updateUploadProgress', 0);
  }

  /**
   * Called on the end of an upload.
   */
  private finishUploadingVideo(item: UploadQueueItem) {
    console.info('[VideoProcessQueue] Finished uploading video', item.path);
    this.mainWindow.webContents.send('refreshState');

    this.inProgressUploads = this.inProgressUploads.filter(
      (p) => p !== item.path,
    );
  }

  /**
   * Called on the start of a download. Set the download bar to zero and log.
   */
  private startedDownloadingVideo(video: RendererVideo) {
    const { videoName } = video;
    console.info('[VideoProcessQueue] Now downloading video', videoName);
    this.mainWindow.webContents.send('updateDownloadProgress', 0);
  }

  /**
   * Called on the end of an upload.
   */
  private finishDownloadingVideo(video: RendererVideo) {
    const { videoName } = video;
    console.info('[VideoProcessQueue] Finished downloading video', videoName);
    this.mainWindow.webContents.send('refreshState');

    this.inProgressDownloads = this.inProgressDownloads.filter(
      (p) => p !== videoName,
    );
  }

  /**
   * Run actions on the queue being empty.
   */
  private async videoQueueEmpty() {
    console.info('[VideoProcessQueue] Video processing queue empty');
    const sizeMonitor = new DiskSizeMonitor(this.mainWindow);
    sizeMonitor.run();
    const usage = await sizeMonitor.usage();

    const status: DiskStatus = {
      usage,
      limit: this.cfg.get<number>('maxStorage') * 1024 ** 3,
    };

    this.mainWindow.webContents.send('updateDiskStatus', status);
  }

  /**
   * Run actions on the upload queue being empty.
   */
  private async uploadQueueEmpty() {
    console.info('[VideoProcessQueue] Upload processing queue empty');

    if (!this.cloudClient) {
      return;
    }

    await this.cloudClient.runHousekeeping();

    const usagePromise = this.cloudClient.getUsage();
    const limitPromise = this.cloudClient.getStorageLimit();
    const affiliationsPromise = this.cloudClient.getUserAffiliations();

    const usage = await usagePromise;
    const limit = await limitPromise;
    const affiliations = await affiliationsPromise;
    const guilds = affiliations.map((aff) => aff.guildName);

    const status: CloudStatus = {
      usage,
      limit,
      guilds,
    };

    this.mainWindow.webContents.send('updateCloudStatus', status);
    this.mainWindow.webContents.send('refreshState');
  }

  /**
   * Run actions on the download queue being empty.
   */
  private async downloadQueueEmpty() {
    console.info('[VideoProcessQueue] Download processing queue empty');
    const sizeMonitor = new DiskSizeMonitor(this.mainWindow);
    sizeMonitor.run();
    const usage = await sizeMonitor.usage();

    const status: DiskStatus = {
      usage,
      limit: this.cfg.get<number>('maxStorage') * 1024 ** 3,
    };

    this.mainWindow.webContents.send('updateDiskStatus', status);
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
   * Return the start time of a video, avoiding the case where the offset is
   * negative as that's obviously not a valid thing to do.
   */
  private static async getStartTime(src: string, offset: number) {
    if (offset < 0) {
      console.warn('[VideoProcessQueue] Rejecting negative start time', offset);
      offset = 0;
    }

    const frames = await VideoProcessQueue.getKeyframeTimes(src);
    const aligned = keyframeRound(offset, frames);

    console.info(
      '[VideoProcessQueue] Got keyframe aligned start time',
      aligned,
    );

    return aligned;
  }

  /**
   * Cut the video to size using ffmpeg.
   */
  private async cutVideo(
    srcFile: string,
    outputDir: string,
    suffix: string | undefined,
    offset: number,
    duration: number,
  ): Promise<string> {
    const start = await VideoProcessQueue.getStartTime(srcFile, offset);

    console.info('[VideoProcessQueue] Offset:', offset);
    console.info('[VideoProcessQueue] Duration:', duration);

    const outputPath = VideoProcessQueue.getOutputVideoPath(
      srcFile,
      outputDir,
      suffix,
    );

    // It's crucial that we don't re-encode the video here as that
    // would spin the CPU and delay the replay being available.
    const fn = ffmpeg(srcFile)
      .setStartTime(start)
      .setDuration(duration)
      .withVideoCodec('copy')
      .withAudioCodec('copy')
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

  /**
   * Return an array of timestamps corresponding to the position of the
   * keyframes in the provided video file.
   *
   * @param videoPath the MP4 file to consider
   */
  private static async getKeyframeTimes(videoPath: string): Promise<number[]> {
    const cmd = [
      `"${ffprobeInstallerPath}"`, // Directly call the ffprobe executable, ffmpeg-fluent doesn't let us pass arguments.
      '-show_frames', // What it says on the tin.
      '-select_streams v:0', // Select the video stream.
      '-skip_frame nokey', // Skip frames without a key.
      '-show_entries frame=pts_time', // Show the pts_time field only.
      '-of json', // Output JSON for ease of parsing results.
      `"${videoPath}"`, // The file we're probing.
    ];

    const { stdout } = await execPromise(cmd.join(' '));

    return JSON.parse(stdout)
      .frames.map((f: { pts_time: string }) => f.pts_time)
      .map(parseFloat);
  }
}
