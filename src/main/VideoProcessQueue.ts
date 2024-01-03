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
  getOBSFormattedDate,
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
    const now = new Date();
    let videoFileName = getOBSFormattedDate(now);

    if (suffix) {
      videoFileName += ' - ';
      videoFileName += suffix;
    }

    const baseVideoFilename = VideoProcessQueue.sanitizeFilename(videoFileName);
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

      // It's crucial that we don't re-encode the video here as that
      // would spin the CPU and delay the replay being available. I
      // did try this with re-encoding as it has compression benefits
      // but took literally ages. My CPU was maxed out for nearly the
      // same elapsed time as the recording.
      //
      // We ensure that we don't re-encode by passing the "-c copy"
      // option to ffmpeg. Read about it here:
      // https://superuser.com/questions/377343/cut-part-from-video-file-from-start-position-to-end-position-with-ffmpeg
      //
      // This thread has a brilliant summary why we need "-avoid_negative_ts make_zero":
      // https://superuser.com/questions/1167958/video-cut-with-missing-frames-in-ffmpeg?rq=1
      ffmpeg(sourceFile)
        .inputOptions([`-ss ${offset}`, `-t ${duration}`])
        .outputOptions([
          `-t ${duration}`,
          '-c:v copy',
          '-c:a copy',
          '-avoid_negative_ts make_zero',
        ])
        .output(finalVideoPath)

        // Handle the end of the FFmpeg cutting.
        .on('end', async (err: any) => {
          if (err) {
            console.log(
              '[VideoProcessQueue] FFmpeg video cut error (1): ',
              err
            );
            throw new Error('FFmpeg error when cutting video (1)');
          } else {
            console.log('[VideoProcessQueue] FFmpeg cut video succeeded');
            resolve(finalVideoPath);
          }
        })

        // Handle an error with the FFmpeg cutting. Not sure if we
        // need this as well as the above but being careful.
        .on('error', (err: any) => {
          console.log('[VideoProcessQueue] FFmpeg video cut error (2): ', err);
          throw new Error('FFmpeg error when cutting video (2)');
        })
        .run();
    });
  }

  /**
   * Takes an input video file and writes a screenshot a second into the
   * video to disk. Going further into the file seems computationally
   * expensive, so we avoid that.
   *
   * @param {string} video full path to initial MP4 file
   * @param {string} output path to output directory
   */
  private static async getThumbnail(video: string) {
    const thumbnailPath = getThumbnailFileNameForVideo(video);
    const thumbnailFile = path.basename(thumbnailPath);
    const thumbnailDir = path.dirname(thumbnailPath);

    return new Promise<void>((resolve) => {
      ffmpeg(video)
        .on('end', () => {
          console.info('[VideoProcessQueue] Got thumbnail for', video);
          resolve();
        })
        .on('error', (err: unknown) => {
          console.error(
            '[VideoProcessQueue] Error getting thumbnail for',
            video,
            String(err)
          );

          throw new Error(String(err));
        })
        .screenshots({
          timestamps: [0],
          folder: thumbnailDir,
          filename: thumbnailFile,
        });
    });
  }
}
