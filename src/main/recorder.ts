import { BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';

import {
  writeMetadataFile,
  runSizeMonitor,
  deleteVideo,
  addColor,
  getSortedVideos,
  fixPathWhenPackaged,
  tryUnlinkSync,
} from './util';

import { Metadata, RecStatus, SaveStatus, VideoQueueItem } from './types';
import { VideoCategory } from './constants';
import Activity from '../activitys/Activity';

const atomicQueue = require('atomic-queue');
const ffmpeg = require('fluent-ffmpeg');
const obsRecorder = require('./obsRecorder');

const ffmpegPath = fixPathWhenPackaged(
  require('@ffmpeg-installer/ffmpeg').path
);

ffmpeg.setFfmpegPath(ffmpegPath);

type RecorderOptionsType = {
  storageDir: string;
  bufferStorageDir: string;
  maxStorage: number;
  monitorIndex: number;
  audioInputDeviceId: string;
  audioOutputDeviceId: string;
  minEncounterDuration: number;
  obsBaseResolution: string;
  obsOutputResolution: string;
  obsFPS: number;
  obsKBitRate: number;
  obsCaptureMode: string;
  obsRecEncoder: string;
};

/**
 * Represents an OBS recorder object.
 */
class Recorder {
  private _isRecording: boolean = false;

  private _isRecordingBuffer: boolean = false;

  private _bufferRestartIntervalID?: any;

  private _bufferStartTimeoutID?: any;

  private _options: RecorderOptionsType;

  private _videoQueue;

  private _recorderStartDate = new Date();

  private _mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow, options: RecorderOptionsType) {
    this._mainWindow = mainWindow;
    this._options = options;

    console.debug('[Recorder] Constructing recorder with: ', this._options);

    this._videoQueue = atomicQueue(this._processVideoQueueItem.bind(this), {
      concurrency: 1,
    });

    this._setupVideoProcessingQueue();

    if (!fs.existsSync(this._options.bufferStorageDir)) {
      console.log('[Recorder] Creating dir:', this._options.bufferStorageDir);
      fs.mkdirSync(this._options.bufferStorageDir);
    } else {
      console.log('[Recorder] Clean out buffer');
      this.cleanupBuffer(0);
    }

    obsRecorder.initialize(options);
    mainWindow.webContents.send('refreshState');
  }

  get mainWindow() {
    return this._mainWindow;
  }

  private async _processVideoQueueItem(
    data: VideoQueueItem,
    done: Function
  ): Promise<void> {
    const videoPath = await this._cutVideo(
      data.bufferFile,
      this._options.storageDir,
      data.filename,
      data.relativeStart,
      data.metadata.duration
    );

    await writeMetadataFile(videoPath, data.metadata);

    // Delete the original buffer video
    tryUnlinkSync(data.bufferFile);

    done();
  }

  /**
   * Setup events on the videoQueue.
   */
  private _setupVideoProcessingQueue(): void {
    this._videoQueue.on('error', (err: any) => {
      console.error('[Recorder] Error occured during video processing', err);
    });

    this._videoQueue.on('idle', () => {
      console.log('[Recorder] Video processing queue empty, running clean up.');

      // Run the size monitor to ensure we stay within size limit.
      runSizeMonitor(this._options.storageDir, this._options.maxStorage).then(
        () => {
          this.mainWindow.webContents.send('refreshState');
        }
      );
    });

    this._videoQueue.pool.on('start', (data: VideoQueueItem) => {
      console.log('[Recorder] Processing video', data.bufferFile);
      this.mainWindow.webContents.send('updateSaveStatus', SaveStatus.Saving);
    });

    this._videoQueue.pool.on('finish', (_result: any, data: VideoQueueItem) => {
      console.log('[Recorder] Finished processing video', data.bufferFile);
      this.mainWindow.webContents.send(
        'updateSaveStatus',
        SaveStatus.NotSaving
      );
    });
  }

  /**
   * Get the value of isRecording.
   *
   * @returns {boolean} true if currently recording a game/encounter
   */
  get isRecording() {
    return this._isRecording;
  }

  /**
   * Set the value of isRecording.
   *
   * @param {boolean} isRecording true if currently recording a game/encounter
   */
  set isRecording(value) {
    this._isRecording = value;
  }

  /**
   * Get the value of isRecordingBuffer.
   *
   * @returns {boolean} true if currently recording a buffer
   */
  get isRecordingBuffer() {
    return this._isRecordingBuffer;
  }

  /**
   * Set the value of isRecordingBuffer.
   *
   * @param {boolean} isRecordingBuffer true if currently recording a game/encounter
   */
  set isRecordingBuffer(value) {
    this._isRecordingBuffer = value;
  }

  /**
   * Start recorder buffer. This starts OBS and records in 5 min chunks
   * to the temp buffer location. Called on start-up of application when
   * WoW is open.
   */
  startBuffer = async () => {
    // Guard against multiple buffer timers.
    if (this._isRecordingBuffer) {
      console.error('[Recorder] Already recording a buffer');
      return;
    }

    console.log(addColor('[Recorder] Start recording buffer', 'cyan'));
    await obsRecorder.start();
    this._isRecordingBuffer = true;
    this._recorderStartDate = new Date();
    this.mainWindow.webContents.send(
      'updateRecStatus',
      RecStatus.ReadyToRecord
    );

    // We store off this timer as a member variable as we will cancel
    // it when a real game is detected.
    this._bufferRestartIntervalID = setInterval(() => {
      this.restartBuffer();
    }, 5 * 60 * 1000); // Five mins
  };

  /**
   * Stop recorder buffer. Called when WoW is closed.
   */
  stopBuffer = async () => {
    this.cancelBufferTimers(true, true);

    if (this._isRecordingBuffer) {
      console.log(addColor('[Recorder] Stop recording buffer', 'cyan'));
      this._isRecordingBuffer = false;
      await obsRecorder.stop();
    } else {
      console.error('[Recorder] No buffer recording to stop.');
    }

    this.mainWindow.webContents.send(
      'updateRecStatus',
      RecStatus.WaitingForWoW
    );
    this.cleanupBuffer(1);
  };

  /**
   * Restarts the buffer recording. Cleans the temp dir between stop/start.
   * We wait 5s here between the stop start. I don't know why, but if we
   * don't then OBS becomes unresponsive. I spent a lot of time on this,
   * trying all sorts of other solutions don't fuck with it unless you have
   * to; here be dragons.
   */
  restartBuffer = async () => {
    console.log(addColor('[Recorder] Restart recording buffer', 'cyan'));
    this.isRecordingBuffer = false;
    await obsRecorder.stop();

    this._bufferStartTimeoutID = setTimeout(async () => {
      await obsRecorder.start();
      this.isRecordingBuffer = true;
      this._recorderStartDate = new Date();
    }, 5000);

    this.cleanupBuffer(1);
  };

  /**
   * Cancel buffer timers. This can include any combination of:
   *  - _bufferRestartIntervalID: the interval on which we periodically restart the buffer
   *  - _bufferStartTimeoutID: the timer we use during buffer restart to start the recorder again.
   */
  cancelBufferTimers = (
    cancelRestartInterval: boolean,
    cancelStartTimeout: boolean
  ) => {
    if (cancelRestartInterval && this._bufferRestartIntervalID) {
      console.log(
        addColor('[Recorder] Buffer restart interval cleared', 'green')
      );
      clearInterval(this._bufferRestartIntervalID);
    }

    if (cancelStartTimeout && this._bufferStartTimeoutID) {
      console.log(addColor('[Recorder] Buffer start timeout cleared', 'green'));
      clearInterval(this._bufferStartTimeoutID);
    }
  };

  /**
   * Start recording for real, this basically just cancels pending
   * buffer recording restarts. We don't need to actually start OBS
   * recording as it's should already be running (or just about to
   * start if we hit this in the 2s restart window).
   */
  start = async () => {
    console.log(
      addColor(
        '[Recorder] Start recording by cancelling buffer restart',
        'green'
      )
    );
    this.cancelBufferTimers(true, false);
    this._isRecordingBuffer = false;
    this._isRecording = true;
    this.mainWindow.webContents.send('updateRecStatus', RecStatus.Recording);
  };

  /**
   * Stop recording, no-op if not already recording. Quite a bit happens in
   * this function, so I've included lots of comments. The ordering is also
   * important.
   *
   * @param {Metadata} metadata the details of the recording
   * @param {number} overrun how long to continue recording after stop is called
   * @param {boolean} closedWow if wow has just been closed
   */
  stop = (activity: Activity, closedWow: boolean = false) => {
    console.log(addColor('[Recorder] Stop recording after overrun', 'green'));
    console.info('[Recorder] Overrun:', activity.overrun);

    // Wait for a delay specificed by overrun. This lets us
    // capture the boss death animation/score screens.
    setTimeout(async () => {
      // Take the actions to stop the recording.
      if (!this._isRecording) return;
      await obsRecorder.stop();
      this._isRecording = false;
      this._isRecordingBuffer = false;

      const isRaid = activity.category == VideoCategory.Raids;
      const duration = activity.duration;

      if (duration === null || duration === undefined) {
        console.error('[Recorder] Null or undefined duration');
        return;
      }

      const isLongEnough =
        duration - activity.overrun >= this._options.minEncounterDuration;

      if (isRaid && !isLongEnough) {
        console.info('[Recorder] Raid encounter was too short, discarding');
      } else {
        const bufferFile = obsRecorder.getObsLastRecording();
        const metadata = activity.getMetadata();
        const relativeStart =
          (activity.startDate.getTime() - this._recorderStartDate.getTime()) /
          1000;

        if (bufferFile) {
          this.queueVideo(
            bufferFile,
            metadata,
            activity.getFileName(),
            relativeStart
          );
        } else {
          console.error(
            "[Recorder] Unable to get the last recording from OBS. Can't process video."
          );
        }
      }

      // Refresh the GUI
      this.mainWindow.webContents.send('refreshState');
      this.mainWindow.webContents.send(
        'updateRecStatus',
        RecStatus.WaitingForWoW
      );

      // Restart the buffer recording ready for next game. If this function
      // has been called due to the wow process ending, don't start the buffer.
      if (!closedWow) {
        setTimeout(async () => {
          this.startBuffer();
        }, 5000);
      }
    }, activity.overrun * 1000);
  };

  /**
   * Force stop a recording, throwing it away entirely.
   */
  forceStop = async () => {
    if (!this._isRecording) return;
    await obsRecorder.stop();
    this._isRecording = false;
    this._isRecordingBuffer = false;

    // Refresh the GUI
    this.mainWindow.webContents.send('refreshState');
    this.mainWindow.webContents.send(
      'updateRecStatus',
      RecStatus.WaitingForWoW
    );

    // Restart the buffer recording ready for next game.
    setTimeout(async () => {
      this.startBuffer();
    }, 5000);
  };

  /**
   * Queue the video for processing.
   *
   * @param {Metadata} metadata the details of the recording
   */
  queueVideo = async (
    bufferFile: string,
    metadata: Metadata,
    filename: string,
    relativeStart: number
  ) => {
    // It's a bit hacky that we async wait for 2 seconds for OBS to
    // finish up with the video file. Maybe this can be done better.
    setTimeout(async () => {
      const queueItem: VideoQueueItem = {
        bufferFile,
        metadata,
        filename,
        relativeStart,
      };

      console.log('[Recorder] Queuing video for processing', queueItem);
      this._videoQueue.write(queueItem);
    }, 2000);
  };

  /**
   * Clean-up the buffer directory.
   * @params Number of files to leave.
   */
  cleanupBuffer = async (filesToLeave: number) => {
    // Sort newest to oldest
    const videosToDelete = await getSortedVideos(
      this._options.bufferStorageDir
    );
    if (!videosToDelete || videosToDelete.length === 0) return;

    videosToDelete.slice(filesToLeave).forEach((v) => deleteVideo(v.name));
  };

  /**
   * Shutdown OBS.
   */
  shutdown = async () => {
    if (this._isRecording) {
      await obsRecorder.stop();
      this._isRecording = false;
    } else if (this._isRecordingBuffer) {
      this.stopBuffer();
    }

    obsRecorder.shutdown();
  };

  /**
   * Reconfigure the underlying obsRecorder.
   */
  reconfigure = async (
    mainWindow: BrowserWindow,
    options: RecorderOptionsType
  ) => {
    this._mainWindow = mainWindow;
    this._options = options;

    // User might just have shrunk the size, so run the size monitor.
    runSizeMonitor(this._options.storageDir, this._options.maxStorage).then(
      () => {
        this.mainWindow.webContents.send('refreshState');
      }
    );

    if (this._isRecording) {
      await obsRecorder.stop();
      this._isRecording = false;
    } else if (this._isRecordingBuffer) {
      this.stopBuffer();
    }

    obsRecorder.reconfigure(this._options);
    this.mainWindow.webContents.send('refreshState');
  };

  /**
   * Sanitize a filename and replace all invalid characters with a space.
   *
   * Multiple consecutive invalid characters will be replaced by a single space.
   * Multiple consecutive spaces will be replaced by a single space.
   */
  private _sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\|?*]/g, ' ') // Replace all invalid characters with space
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
  private async _cutVideo(
    initialFile: string,
    finalDir: string,
    outputFilename: string | undefined,
    relativeStart: number,
    desiredDuration: number
  ): Promise<string> {
    const videoFileName = path.basename(initialFile, '.mp4');
    const videoFilenameSuffix = outputFilename ? ` - ${  outputFilename}` : '';
    const baseVideoFilename = this._sanitizeFilename(
      videoFileName + videoFilenameSuffix
    );
    const finalVideoPath = path.join(finalDir, `${baseVideoFilename}.mp4`);

    return new Promise<string>((resolve) => {
      // Defensively avoid a negative start time error case.
      if (relativeStart < 0) {
        console.log('[Recorder] Video start time was: ', relativeStart);
        console.log(
          '[Recorder] Avoiding error by not cutting video from start'
        );
        relativeStart = 0;
      }

      console.log(
        '[Recorder] Desired duration:',
        desiredDuration,
        'Relative start time:',
        relativeStart
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
      ffmpeg(initialFile)
        .inputOptions([`-ss ${relativeStart}`, `-t ${desiredDuration}`])
        .outputOptions([
          `-t ${desiredDuration}`,
          '-c:v copy',
          '-c:a copy',
          '-avoid_negative_ts make_zero',
        ])
        .output(finalVideoPath)

        // Handle the end of the FFmpeg cutting.
        .on('end', async (err: any) => {
          if (err) {
            console.log('[Recorder] FFmpeg video cut error (1): ', err);
            throw new Error('FFmpeg error when cutting video (1)');
          } else {
            console.log('[Recorder] FFmpeg cut video succeeded');
            resolve(finalVideoPath);
          }
        })

        // Handle an error with the FFmpeg cutting. Not sure if we
        // need this as well as the above but being careful.
        .on('error', (err: any) => {
          console.log('[Recorder] FFmpeg video cut error (2): ', err);
          throw new Error('FFmpeg error when cutting video (2)');
        })
        .run();
    });
  }
}

export { Recorder, RecorderOptionsType };
