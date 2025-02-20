import { BrowserWindow } from 'electron';
import path from 'path';
import assert from 'assert';
import { shouldUpload } from '../utils/configUtils';
import DiskSizeMonitor from '../storage/DiskSizeMonitor';
import ConfigService from '../config/ConfigService';
import { promises as fs } from 'fs';
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
  keyframeRoundUp,
} from './util';
import CloudClient from '../storage/CloudClient';
import { exec } from 'child_process';
import util from 'util';
import ffmpeg from 'fluent-ffmpeg';

const execPromise = util.promisify(exec);
const atomicQueue = require('atomic-queue');

const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');

const ffmpegInstallerPath = fixPathWhenPackaged(ffmpegInstaller.path);
const ffprobeInstallerPath = fixPathWhenPackaged(ffprobeInstaller.path);

ffmpeg.setFfmpegPath(ffmpegInstallerPath);
ffmpeg.setFfprobePath(ffprobeInstallerPath);

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
   * The file we re-encode the first keyframe into, used by the
   * cutting algorithm. Relative to the buffer recording folder.
   */
  private static firstKeyframeFile = 'fkf.mp4';

  /**
   * The concat descriptor file, used by the cutting algorith. Just use a
   * fixed path in the installation folder as it's a tiny text file and saves
   * a bunch of plumbing.
   */
  private static concatDescriptorFile = fixPathWhenPackaged(
    path.join(path.normalize(__dirname), 'dscr.txt'),
  );

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
    const guildsPromise = this.cloudClient.getUserAffiliations();

    const usage = await usagePromise;
    const limit = await limitPromise;
    const guilds = await guildsPromise;

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
  private static getStartTime(offset: number) {
    if (offset > 0) {
      return offset;
    }

    console.warn('[VideoProcessQueue] Rejectiving negative start time', offset);
    return 0;
  }

  /**
   * Takes an input MP4 file and cuts it to size.
   *
   * FFmpeg likes to snap to video keyframes in MP4 files. Typically those are
   * 4s apart, so this can have a noticable desync effect on videos, especially
   * when in cloud multi-player mode.
   *
   * To avoid this, there is a cutting algorithm in play here:
   *  - Find the video keyframes neighbouring the start point with ffprobe [getKeyframeTimes].
   *  - Re-encode from the start point to the end of the first keyframe [processInitialKeyframe].
   *  - Write a concat descriptor file for the final cut [writeConcatDescriptor].
   *  - Concat the re-encoded segment onto the remainder of the video [finalVideoCut].
   *
   * Some references on this:
   *  - https://stackoverflow.com/questions/63548027/cut-a-video-in-between-key-frames-without-re-encoding-the-full-video-using-ffpme/63604858#63604858
   *  - https://github.com/fluent-ffmpeg/node-fluent-ffmpeg/issues/496#issuecomment-203005754
   *
   * Trade-offs / issues:
   *  - We have to spin the CPU to re-encode the first segment.
   *  - There is a subtle but audio glitch on the concat join. Surely solvable.
   */
  private async cutVideo(
    srcFile: string,
    outputDir: string,
    suffix: string | undefined,
    offset: number,
    duration: number,
  ): Promise<string> {
    let start = VideoProcessQueue.getStartTime(offset);

    console.info('[VideoProcessQueue] Offset:', offset);
    console.info('[VideoProcessQueue] Duration:', duration);

    const outputPath = VideoProcessQueue.getOutputVideoPath(
      srcFile,
      outputDir,
      suffix,
    );

    console.time('[VideoProcessQueue] Get keyframe times took:');
    const frames = await VideoProcessQueue.getKeyframeTimes(srcFile);
    console.timeEnd('[VideoProcessQueue] Get keyframe times took:');

    if (frames.includes(start)) {
      // Hack to avoid us having to deviate logic if we land on an exact
      // keyframe. Shift the start time by an unnoticable amount so it
      // is no longer an exact match. Realistically expect to never hit this.
      console.warn('[VideoProcessQueue] Exact keyframe match');
      start += 0.1; // Seems reasonable as 10fps is the lowest we support.
    }

    const idx = keyframeRoundUp(start, frames);

    const below = frames[idx - 1]; // Frame timestamp below start point.
    const above = frames[idx]; // Frame timestamp above start point.

    const first = above - start; // Duration from start point to end of 1st keyframe.
    const remain = duration - first; // Duration from end of first keyframe to end of video.

    // Verbose logs for debug sake.
    const ini = frames.slice(Math.max(idx - 3, 0), idx + 3); // Log the frames around the start point.
    const fin = frames.slice(-1); // Log the final frame also for good measure.
    const diags = { ini, fin, below, above, start, first, remain };
    console.info('[VideoProcessQueue] Cut algorithm data', diags);

    console.time('[VideoProcessQueue] Re-encode initial keyframe took:');
    const fkfFile = await this.processInitialKeyframe(srcFile, start, first);
    console.timeEnd('[VideoProcessQueue] Re-encode initial keyframe took:');

    await this.writeConcatDescriptor(fkfFile, srcFile, first, above, remain);

    console.time('[VideoProcessQueue] Final video cut took:');
    await VideoProcessQueue.finalVideoCut(srcFile, outputPath);
    console.timeEnd('[VideoProcessQueue] Final video cut took:');

    return outputPath;
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

  /**
   * Write the concat descriptor file, used by the video cutting algorithm.
   * https://ffmpeg.org/ffmpeg-formats.html#concat
   *
   * @param fkfFile the MP4 file containing the re-encode first keyframe
   * @param srcFile the source MP4 file
   * @param fkfDuration the duration of the first keyframe segment
   * @param inPoint the inpoint in the source file
   * @param remDuration the remaining duration
   */
  private async writeConcatDescriptor(
    fkfFile: string,
    srcFile: string,
    fkfDuration: number,
    inPoint: number,
    remDuration: number,
  ) {
    const concatDescriptorContent = [
      `file '${fkfFile}'`,
      `inpoint 0`, // Redundant but being explicit.
      `outpoint ${fkfDuration}`, // Being explicit may provide better accuracy.
      `file '${srcFile}'`,
      `inpoint ${inPoint}`,
      `outpoint ${remDuration + inPoint}`,
    ];

    console.info(
      '[VideoProcessQueue] Write concat descriptor with content:',
      concatDescriptorContent,
    );

    await fs.writeFile(
      VideoProcessQueue.concatDescriptorFile,
      concatDescriptorContent.join('\n'),
    );
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

      fn.on('start', handleStart)
        .on('end', handleEnd)
        .on('error', handleErr)
        .run();
    });
  }

  /**
   * Re-encode the initial keyframe of the video to be the correct
   * duration. This is a re-encode operation, so is technically
   * slow and CPU intensive. It's only called on very short video
   * segments.
   *
   * @param srcFile the source video file path
   * @param startTime the time to cut from, should align with a keyframe
   * @param duration the duration to cut, should be a few seconds max
   */
  private async processInitialKeyframe(
    srcFile: string,
    startTime: number,
    duration: number,
  ): Promise<string> {
    console.info(
      '[VideoProcessQueue] Process initial keyframe',
      srcFile,
      startTime,
      duration,
    );

    const bufferPath = this.cfg.get<boolean>('separateBufferPath')
      ? this.cfg.get<string>('bufferStoragePath')
      : path.join(this.cfg.get<string>('bufferStoragePath'), '.temp');

    const fkfFile = path.join(bufferPath, VideoProcessQueue.firstKeyframeFile);

    const fn = ffmpeg(srcFile)
      .setStartTime(startTime)
      .setDuration(duration)
      .output(fkfFile);

    await VideoProcessQueue.ffmpegWrapper(fn, 'Re-encoding initial keyframe');
    return fkfFile;
  }

  /**
   * Perform the final concatenate and cut. Relies on the concat descriptor
   * file created by writeConcatDescriptor.
   *
   * @param srcFile the source file, really only used to find the descr
   * @param outFile the output file path
   */
  private static async finalVideoCut(
    srcFile: string,
    outFile: string,
  ): Promise<string> {
    console.info('[VideoProcessQueue] Final video cut', srcFile);

    const fn = ffmpeg(VideoProcessQueue.concatDescriptorFile)
      .inputOption('-f concat')
      .inputOption('-safe 0')
      .withVideoCodec('copy')
      .withAudioCodec('copy')
      .output(outFile);

    await VideoProcessQueue.ffmpegWrapper(fn, 'Concatenate post reencoding');
    return outFile;
  }
}
