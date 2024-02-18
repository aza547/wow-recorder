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
   * Takes an input MP4 file, trims the footage from the start of the video so
   * that the output is desiredDuration seconds. Some ugly async/await stuff
   * here. Some interesting implementation details around ffmpeg in comments
   * below.
   *
   * @param {string} initialFile path to initial MP4 file
   * @param {string} finalDir path to output directory
   * @param {number} desiredDuration seconds to cut down to
   * @returns full path of the final video file
   */
  private static async cutVideo(
    sourceFile: string,
    outputDir: string,
    suffix: string | undefined,
    offset: number,
    duration: number
  ): Promise<string> {
    const videoFileName = path.basename(sourceFile, '.mp4');
    const videoFilenameSuffix = suffix ? ` - ${suffix}` : '';
    const baseVideoFilename = VideoProcessQueue.sanitizeFilename(
      videoFileName + videoFilenameSuffix
    );
    const finalVideoPath = path.join(outputDir, `${baseVideoFilename}.mp4`);

    return new Promise<string>((resolve) => {
      if (offset < 0) {
        console.log(
          '[VideoProcessQueue] Avoiding error by rejecting negative start',
          offset
        );

        // eslint-disable-next-line no-param-reassign
        offset = 0;
      }

      console.log(
        '[VideoProcessQueue] Desired duration:',
        duration,
        'Relative start time:',
        offset
      );

      const handleEnd = async (err: unknown) => {
        if (err) {
          console.error('[VideoProcessQueue] Cutting error (1): ', String(err));
          throw new Error('Error when cutting video');
        } else {
          console.info('[VideoProcessQueue] FFmpeg cut video succeeded');
          resolve(finalVideoPath);
        }
      };

      const handleErr = (err: unknown) => {
        console.error('[VideoProcessQueue] Cutting error (2): ', String(err));
        throw new Error('Error when cutting video');
      };

      // It's crucial that we don't re-encode the video here as that
      // would spin the CPU and delay the replay being available. Read
      // about it here: https://stackoverflow.com/questions/63997589/.
      //
      // We do need to re-encode the audio to prevent it being desynced,
      // but that's cheap so we can just do it. Read about it here:
      // https://superuser.com/questions/1001299/.
      ffmpeg(sourceFile)
        .output(finalVideoPath)
        .setStartTime(offset)
        .setDuration(duration)
        .withVideoCodec('copy')
        .withAudioCodec('aac')
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
