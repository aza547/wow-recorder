import { BrowserWindow } from 'electron';
import path from 'path';
import SizeMonitor from '../utils/SizeMonitor';
import ConfigService from './ConfigService';
import { SaveStatus, VideoQueueItem } from './types';
import {
  fixPathWhenPackaged,
  tryUnlink,
  writeMetadataFile,
  getThumbnailFileNameForVideo,
} from './util';

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
   * Atomic queue object.
   */
  private videoQueue: any;

  /**
   * Handle to the main window for updating the saving status icon.
   */
  private mainWindow: BrowserWindow;

  /**
   * Config service handle.
   */
  private cfg = ConfigService.getInstance();

  /**
   * Queue constructor.
   */
  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;

    const worker = this.processVideoQueueItem.bind(this);
    const settings = { concurrency: 1 };
    this.videoQueue = atomicQueue(worker, settings);

    this.videoQueue
      .on('error', VideoProcessQueue.errorProcessingVideo)
      .on('idle', () => {
        this.videoQueueEmpty();
      });

    this.videoQueue.pool
      .on('start', (data: VideoQueueItem) => {
        this.startedProcessingVideo(data);
      })
      .on('finish', (_: unknown, data: VideoQueueItem) => {
        this.finishProcessingVideo(data);
      });
  }

  /**
   * Add a video to the queue for processing, the processing it undergoes is
   * dictated by the input. This is the only public method on this class.
   */
  public queueVideo = async (item: VideoQueueItem) => {
    console.log('[VideoProcessQueue] Queuing video for processing', item);
    this.videoQueue.write(item);
  };

  /**
   * Process a video by cutting it to size and saving it to disk, also
   * writes out the metadata JSON file and thumbnail PNG image.
   */
  private async processVideoQueueItem(
    data: VideoQueueItem,
    done: () => void
  ): Promise<void> {
    const outputDir = this.cfg.get<string>('storagePath');

    try {
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
    } catch (error) {
      console.error(
        '[VideoProcessQueue] Error processing video:',
        String(error)
      );
    }

    done();
  }

  /**
   * Log an error processing the video.
   */
  private static errorProcessingVideo(err: any) {
    console.error('[VideoProcessQueue] Error processing video', err);
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
    console.log('[VideoProcessQueue] Finished processing video', data.source);
    this.mainWindow.webContents.send('updateSaveStatus', SaveStatus.NotSaving);
    this.mainWindow.webContents.send('refreshState');
  }

  /**
   * Run actions on the queue being empty.
   */
  private async videoQueueEmpty() {
    console.log('[VideoProcessQueue] Video processing queue empty');
    new SizeMonitor(this.mainWindow).run();
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
