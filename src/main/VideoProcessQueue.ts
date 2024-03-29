import { BrowserWindow } from 'electron';
import path from 'path';
import assert from 'assert';
import DiskSizeMonitor from '../storage/DiskSizeMonitor';
import ConfigService from './ConfigService';
import { CloudStatus, DiskStatus, SaveStatus, VideoQueueItem } from './types';
import {
  fixPathWhenPackaged,
  tryUnlink,
  writeMetadataFile,
  getThumbnailFileNameForVideo,
  getMetadataFileNameForVideo,
} from './util';
import CloudClient from '../storage/CloudClient';
import CloudSizeMonitor from '../storage/CloudSizeMonitor';

const atomicQueue = require('atomic-queue');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

const ffmpegInstallerPath = fixPathWhenPackaged(ffmpegInstaller.path);
ffmpeg.setFfmpegPath(ffmpegInstallerPath);

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
      .on('start', (videoPath: string) => { this.startedUploadingVideo(videoPath) })
      .on('finish', async (_: unknown, videoPath: string) => { await this.finishUploadingVideo(videoPath) });
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
      .on('start', (videoPath: string) => { this.startedDownloadingVideo(videoPath) })
      .on('finish', async (_: unknown, videoPath: string) => { await this.finishDownloadingVideo(videoPath) });
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
    this.cfg.get<string>('storagePath');
  }

  /**
   * Add a video to the queue for processing, the processing it undergoes is
   * dictated by the input. This is the only public method on this class.
   */
  public queueVideo = async (item: VideoQueueItem) => {
    console.info('[VideoProcessQueue] Queuing video for processing', item);
    this.videoQueue.write(item);
  };

  public queueUpload = async (videoPath: string) => {
    this.uploadQueue.write(videoPath);
  };

  public queueDownload = async (name: string) => {
    this.downloadQueue.write(name);
  };

  /**
   * Process a video by cutting it to size and saving it to disk, also
   * writes out the metadata JSON file and thumbnail PNG image.
   */
  private async processVideoQueueItem(
    data: VideoQueueItem,
    done: () => void
  ): Promise<void> {
    try {
      const outputDir = this.cfg.get<string>('storagePath');

      const videoPath = await VideoProcessQueue.cutVideo(
        data.source,
        outputDir,
        data.suffix,
        data.offset,
        data.duration
      );

      await writeMetadataFile(videoPath, data.metadata);
      await VideoProcessQueue.getThumbnail(videoPath);

      if (data.deleteSource) {
        console.info('[VideoProcessQueue] Deleting source video file');
        await tryUnlink(data.source);
      }

      if (this.cloudClient !== undefined) {
        this.uploadQueue.write(videoPath);
      }
    } catch (error) {
      console.error(
        '[VideoProcessQueue] Error processing video:',
        String(error)
      );
    }

    done();
  }

  /**
   * Upload a video to the cloud store.
   */
  private async processUploadQueueItem(
    videoPath: string,
    done: () => void
  ): Promise<void> {
    let lastProgress = 0;

    const progressCallback = (progress: number) => {
      if (progress === lastProgress) {
        return;
      }

      this.mainWindow.webContents.send('updateUploadProgress', progress);
      lastProgress = progress;
    };

    try {
      assert(this.cloudClient);
      const thumbNailPath = getThumbnailFileNameForVideo(videoPath);
      const metadataPath = getMetadataFileNameForVideo(videoPath);

      // Upload the video first, this can take a bit of time, and don't want
      // to confuse the frontend by having metadata without video.
      await this.cloudClient.putFile(videoPath, progressCallback);
      progressCallback(100);

      // Now the video is uploaded, also upload the metadata and thumbnail.
      await Promise.all([
        this.cloudClient.putFile(thumbNailPath),
        this.cloudClient.putFile(metadataPath),
      ]);
    } catch (error) {
      console.error(
        '[VideoProcessQueue] Error processing video:',
        String(error)
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
    name: string,
    done: () => void
  ): Promise<void> {
    const storageDir = this.cfg.get<string>('storagePath');
    const metadataName = name.replace('.mp4', '.json');
    const thumbnailName = name.replace('.mp4', '.png');

    let lastProgress = 0;

    const progressCallback = (progress: number) => {
      if (progress === lastProgress) {
        return;
      }

      this.mainWindow.webContents.send(
        'updateDownloadProgress',
        name,
        progress
      );

      lastProgress = progress;
    };

    try {
      assert(this.cloudClient);

      await Promise.all([
        await this.cloudClient.getAsFile(name, storageDir, progressCallback),
        await this.cloudClient.getAsFile(metadataName, storageDir),
        await this.cloudClient.getAsFile(thumbnailName, storageDir),
      ]);
    } catch (error) {
      console.error(
        '[VideoProcessQueue] Error downloading video:',
        String(error)
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
  private startedProcessingVideo(data: VideoQueueItem) {
    console.info('[VideoProcessQueue] Now processing video', data.source);
    this.mainWindow.webContents.send('updateSaveStatus', SaveStatus.Saving);
  }

  /**
   * Log we are done, and update the saving status icon and refresh the
   * frontend.
   */
  private finishProcessingVideo(data: VideoQueueItem) {
    console.info('[VideoProcessQueue] Finished cutting video', data.source);
    this.mainWindow.webContents.send('updateSaveStatus', SaveStatus.NotSaving);
    this.mainWindow.webContents.send('refreshState');
  }

  /**
   * Called on the start of an upload. Set the upload bar to zero and log.
   */
  private startedUploadingVideo(videoPath: string) {
    console.info('[VideoProcessQueue] Now uploading video', videoPath);
    this.mainWindow.webContents.send('updateUploadProgress', 0);
  }

  /**
   * Called on the end of an upload.
   */
  private async finishUploadingVideo(videoPath: string) {
    console.info('[VideoProcessQueue] Finished uploading video', videoPath);
    this.mainWindow.webContents.send('refreshState');
  }

  /**
   * Called on the start of a download. Set the download bar to zero and log.
   */
  private startedDownloadingVideo(videoPath: string) {
    console.info('[VideoProcessQueue] Now downloading video', videoPath);
    this.mainWindow.webContents.send('updateDownloadProgress', 0);
  }

  /**
   * Called on the end of an upload.
   */
  private async finishDownloadingVideo(videoPath: string) {
    console.info('[VideoProcessQueue] Finished downloading video', videoPath);
    this.mainWindow.webContents.send('refreshState');
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
      usageGB: usage / 1024 ** 3,
      maxUsageGB: 250,
    };

    this.mainWindow.webContents.send('updateDiskStatus', status);
  }

  /**
   * Run actions on the upload queue being empty.
   */
  private async uploadQueueEmpty() {
    console.info('[VideoProcessQueue] Upload processing queue empty');

    if (this.cloudClient === undefined) {
      return;
    }

    const sizeMonitor = new CloudSizeMonitor(this.mainWindow, this.cloudClient);
    sizeMonitor.run();
    const usage = await sizeMonitor.usage();

    const status: CloudStatus = {
      usageGB: usage / 1024 ** 3,
      maxUsageGB: 250,
    };

    this.mainWindow.webContents.send('updateCloudStatus', status);
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
      usageGB: usage / 1024 ** 3,
      maxUsageGB: 250,
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
    suffix: string | undefined
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
   * Takes an input MP4 file, trims the footage offset from the start of the
   * video so that the output is duration seconds.
   */
  private static async cutVideo(
    sourceFile: string,
    outputDir: string,
    suffix: string | undefined,
    offset: number,
    duration: number
  ): Promise<string> {
    const startTime = VideoProcessQueue.getStartTime(offset);
    const outputPath = VideoProcessQueue.getOutputVideoPath(
      sourceFile,
      outputDir,
      suffix
    );

    console.info('[VideoProcessQueue] Start time:', startTime);
    console.info('[VideoProcessQueue] Duration:', duration);

    return new Promise<string>((resolve) => {
      const handleEnd = async (err: unknown) => {
        if (err) {
          console.error('[VideoProcessQueue] Cutting error (1): ', String(err));
          throw new Error('Error when cutting video');
        }

        console.info('[VideoProcessQueue] FFmpeg cut video succeeded');
        resolve(outputPath);
      };

      const handleErr = (err: unknown) => {
        console.error('[VideoProcessQueue] Cutting error (2): ', String(err));
        throw new Error('Error when cutting video');
      };

      // It's crucial that we don't re-encode the video here as that
      // would spin the CPU and delay the replay being available. Read
      // about it here: https://stackoverflow.com/questions/63997589/.
      //
      // We need to deal with audio desync due to the cutting. We could
      // just re-encode it which is fairly cheap but for long runs
      // this can incur noticable cutting time. I saw a 20min Mythic+ take
      // approx 10s to cut which is probably not acceptable. Read about the
      // re-encoding approach here: https://superuser.com/questions/1001299/.
      //
      // This thread has a brilliant summary why we need "-avoid_negative_ts
      // make_zero": https://superuser.com/questions/1167958/.
      ffmpeg(sourceFile)
        .output(outputPath)
        .setStartTime(startTime)
        .setDuration(duration)
        .withVideoCodec('copy')
        .withAudioCodec('copy')
        .outputOptions('-avoid_negative_ts make_zero')
        .on('end', handleEnd)
        .on('error', handleErr)
        .run();
    });
  }

  /**
   * Takes an input video file and writes a screenshot a second into the
   * video to disk. Going further into the file seems computationally
   * expensive, so we avoid that.
   *
   * @param {string} video full path to initial MP4 file
   */
  private static async getThumbnail(video: string) {
    const thumbnailPath = getThumbnailFileNameForVideo(video);
    const thumbnailFile = path.basename(thumbnailPath);
    const thumbnailDir = path.dirname(thumbnailPath);

    return new Promise<void>((resolve) => {
      const handleEnd = () => {
        console.info('[VideoProcessQueue] Got thumbnail for', video);
        resolve();
      };

      const handleError = (err: unknown) => {
        console.error(
          '[VideoProcessQueue] Error getting thumbnail for',
          video,
          String(err)
        );

        throw new Error(String(err));
      };

      const screenshotConfig = {
        timestamps: [0],
        folder: thumbnailDir,
        filename: thumbnailFile,
      };

      ffmpeg(video)
        .on('end', handleEnd)
        .on('error', handleError)
        .screenshots(screenshotConfig);
    });
  }
}
