import { Metadata } from './logutils';
import { writeMetadataFile, runSizeMonitor, getNewestVideo, deleteVideo, addColor, getSortedVideos, fixPathWhenPackaged } from './util';
import { mainWindow }  from './main';
import { AppStatus } from './types';
import { getDungeonByMapId, getEncounterNameById, getVideoResultText, getInstanceNameByZoneId, getRaidNameByEncounterId } from './helpers';
import { VideoCategory } from './constants';
import fs from 'fs';
import { ChallengeModeDungeon } from './keystone';
import path from 'path';

const obsRecorder = require('./obsRecorder');

const ffmpegPath = fixPathWhenPackaged(require('@ffmpeg-installer/ffmpeg').path);
const ffprobePath = fixPathWhenPackaged(require('@ffprobe-installer/ffprobe').path);
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

type RecorderOptionsType = {
    storageDir: string;
    bufferStorageDir: string;
    maxStorage: number;
    monitorIndex: number;
    audioInputDeviceId: string;
    audioOutputDeviceId: string;
    minEncounterDuration: number;
    obsBaseResolution: string,
    obsOutputResolution: string,
    obsFPS: number;
    obsKBitRate: number;
};

/**
 * Represents an OBS recorder object.
 */
 class Recorder {
    private _isRecording: boolean = false;
    private _isRecordingBuffer: boolean = false;
    private _bufferRestartIntervalID?: any;
    private _options: RecorderOptionsType;

    /**
     * Constructs a new Recorder.
     */
    constructor(options: RecorderOptionsType) {
        this._options = options;
        console.debug("[Recorder] Constructing recorder with: ", this._options);

        if (!fs.existsSync(this._options.bufferStorageDir)) {
            console.log("[Recorder] Creating dir:", this._options.bufferStorageDir);
            fs.mkdirSync(this._options.bufferStorageDir);
        } else {
            console.log("[Recorder] Clean out buffer")
            this.cleanupBuffer(0);
        }

        obsRecorder.initialize(options);
        if (mainWindow) mainWindow.webContents.send('refreshState');
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
            console.error("[Recorder] Already recording a buffer");
            return;
        }

        console.log(addColor("[Recorder] Start recording buffer", "cyan"));
        await obsRecorder.start();
        this._isRecordingBuffer = true;
        if (mainWindow) mainWindow.webContents.send('updateStatus', AppStatus.ReadyToRecord);
    

        // We store off this timer as a member variable as we will cancel
        // it when a real game is detected. 
        this._bufferRestartIntervalID = setInterval(() => {
            this.restartBuffer();
        }, 5 * 60 * 1000); // Five mins
    }
    
    /**
     * Stop recorder buffer. Called when WoW is closed. 
     */
    stopBuffer = async () => {
        if (!this._isRecordingBuffer) {
            console.error("[Recorder] No buffer recording to stop.");
            return;
        }

        console.log(addColor("[Recorder] Stop recording buffer", "cyan"));
        clearInterval(this._bufferRestartIntervalID);
        this._isRecordingBuffer = false;   

        await obsRecorder.stop();
        if (mainWindow) mainWindow.webContents.send('updateStatus', AppStatus.WaitingForWoW);
        this.cleanupBuffer(1);
    }

    /**
     * Restarts the buffer recording. Cleans the temp dir between stop/start.
     * We wait 5s here between the stop start. I don't know why, but if we
     * don't then OBS becomes unresponsive. I spent a lot of time on this, 
     * trying all sorts of other solutions don't fuck with it unless you have 
     * to; here be dragons. 
     */
    restartBuffer = async () => {
        console.log(addColor("[Recorder] Restart recording buffer", "cyan"));
        await obsRecorder.stop();

        setTimeout(() => {
            obsRecorder.start();
        }, 5000);

        this.cleanupBuffer(1);
    }

    /**
     * Start recording for real, this basically just cancels pending 
     * buffer recording restarts. We don't need to actually start OBS 
     * recording as it's should already be running (or just about to 
     * start if we hit this in the 2s restart window). 
     */
    start = async () => {
        console.log(addColor("[Recorder] Start recording by cancelling buffer restart", "green"));
        clearInterval(this._bufferRestartIntervalID);
        this._isRecordingBuffer = false;        
        this._isRecording = true;   
        if (mainWindow) mainWindow.webContents.send('updateStatus', AppStatus.Recording);
    }

    /**
     * Stop recording, no-op if not already recording. Quite a bit happens in 
     * this function, so I've included lots of comments. The ordering is also
     * important. 
     * 
     * @param {Metadata} metadata the details of the recording
     * @param {number} overrun how long to continue recording after stop is called
     */
    stop = (metadata: Metadata, overrun: number = 0, discardVideo: boolean = false) => {
        const outputFilename = this.getFinalVideoFilename(metadata);
        console.log(addColor("[Recorder] Stop recording after overrun", "green"));
        console.info("[Recorder] Overrun:", overrun);
        console.info("[Recorder]" , JSON.stringify(metadata, null, 2));

        // Wait for a delay specificed by overrun. This lets us
        // capture the boss death animation/score screens.  
        setTimeout(async () => {           
            // Take the actions to stop the recording.
            if (!this._isRecording) return;
            await obsRecorder.stop();
            this._isRecording = false;
            this._isRecordingBuffer = false;

            // Update the GUI to show we're processing a video. 
            if (mainWindow) mainWindow.webContents.send('updateStatus', AppStatus.SavingVideo);

            const isRaid = metadata.category == VideoCategory.Raids;
            const isLongEnough = (metadata.duration - overrun) >= this._options.minEncounterDuration;

            if ((!isRaid || isLongEnough) && !discardVideo) {
                // Cut the video to length and write its metadata JSON file.
                // Await for this to finish before we return to waiting state.
                await this.finalizeVideo(metadata, outputFilename);
            } else {
                console.info("[Recorder] Raid encounter was too short, discarding");
            }

            // Run the size monitor to ensure we stay within size limit.
            // Need some maths to convert GB to bytes
            runSizeMonitor(this._options.storageDir, this._options.maxStorage)
                .then(() => {
                    if (mainWindow) mainWindow.webContents.send('refreshState');
                });

            // Clean-up the temporary recording directory. 
            this.cleanupBuffer(1);

            // Refresh the GUI
            if (mainWindow) mainWindow.webContents.send('refreshState');

            // Restart the buffer recording ready for next game.
            setTimeout(async () => {
                this.startBuffer();
            }, 5000)
        }, 
        overrun * 1000);
    }

    /**
     * Finalize the video by cutting it to size, moving it to the persistent
     * storage directory and writing the metadata JSON file. 
     * 
     * @param {Metadata} metadata the details of the recording
     */
    finalizeVideo = async (metadata: Metadata, outputFilename?: string): Promise<string> => {

        // Gnarly syntax to await for the setTimeout to finish.
        return new Promise<string> ((resolve) => {

            // It's a bit hacky that we async wait for 2 seconds for OBS to 
            // finish up with the video file. Maybe this can be done better. 
            setTimeout(async () => {
                const bufferedVideo = await getNewestVideo(this._options.bufferStorageDir);
                const videoPath = await this._cutVideo(bufferedVideo, this._options.storageDir, outputFilename, metadata.duration);
                await writeMetadataFile(videoPath, metadata);
                console.log('[Recorder] Finalized video', videoPath);
                resolve(videoPath);
                if (mainWindow) mainWindow.webContents.send('updateStatus', AppStatus.ReadyToRecord);
            }, 
            2000)
        });   
    }

    /**
     * Clean-up the buffer directory.
     * @params Number of files to leave.
     */
    cleanupBuffer = async (filesToLeave: number) => {
        // Sort newest to oldest
        const videosToDelete = await getSortedVideos(this._options.bufferStorageDir);
        if (!videosToDelete || videosToDelete.length === 0) return;
        
        videosToDelete
            .slice(filesToLeave)
            .forEach(v => deleteVideo(v.name));
    }

    /**
     * Shutdown OBS.
     */
    shutdown = () => {
        if (this._isRecording) {
            obsRecorder.stop();       
            this._isRecording = false;
        } else if (this._isRecordingBuffer) {
            this.stopBuffer()
        }

        obsRecorder.shutdown();

    }

    /**
     * Reconfigure the underlying obsRecorder. 
     */
    reconfigure = (options: RecorderOptionsType) => {
        this._options = options;

        // User might just have shrunk the size, so run the size monitor.
        runSizeMonitor(this._options.storageDir, this._options.maxStorage)
        .then(() => {
            if (mainWindow) mainWindow.webContents.send('refreshState');
        });
      
        if (this._isRecording) {
            obsRecorder.stop();       
            this._isRecording = false;
        } else if (this._isRecordingBuffer) {
            this.stopBuffer()
        }

        obsRecorder.reconfigure(this._options);
        if (mainWindow) mainWindow.webContents.send('refreshState');
    }

    /**
     * Generate a filename for the final video of a recording according
     * to its category, if possible.
     *
     * The final filename should contain adequate information to quickly be able
     * to identify the video files on the filesystem and be able to tell what it
     * was about and the result of it.
     */
    getFinalVideoFilename (metadata: Metadata): string | undefined {
        let outputFilename = '';
        const resultText = getVideoResultText(metadata.category, metadata.result);

        switch (metadata.category) {
            case VideoCategory.Raids:
                const encounterName = getEncounterNameById(metadata.encounterID);
                const raidName = getRaidNameByEncounterId(metadata.encounterID);
                outputFilename = `${raidName}, ${encounterName} (${resultText})`;
            break;

            case VideoCategory.MythicPlus:
                outputFilename = this.getFinalVideoFilenameForCM(metadata.challengeMode);
            break;

            default:
                const zoneName = getInstanceNameByZoneId(metadata.zoneID);
                outputFilename = zoneName;
                if (resultText) {
                    outputFilename += ' (' + resultText + ')'
                }
            break;
        }

        if (!outputFilename) {
            return;
        }

        return metadata.category + ' ' + outputFilename;
    }

    /**
     * Construct a video filename for a Mythic Keystone dungeon with information
     * about level, keystone upgrade levels and what have we.
     */
    getFinalVideoFilenameForCM(cm?: ChallengeModeDungeon): string {
        if (!cm) {
            return '';
        }

        const keystoneUpgradeLevel = ChallengeModeDungeon.calculateKeystoneUpgradeLevel(cm.allottedTime, cm.duration);;
        const resultText = cm?.timed ? '+' + keystoneUpgradeLevel : 'Depleted';

        return `${getDungeonByMapId(cm.mapId)} +${cm.level} (${resultText})`;
    }

    /**
     * Sanitize a filename and replace all invalid characters with a space.
     *
     * Multiple consecutive invalid characters will be replaced by a single space.
     * Multiple consecutive spaces will be replaced by a single space.
     */
    private _sanitizeFilename(filename: string): string {
        return filename
            .replace(/[<>:"/\|?*]/g, ' ')   // Replace all invalid characters with space
            .replace(/ +/g, ' ');           // Replace multiple spaces with a single space
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
        desiredDuration: number
    ): Promise<string> {

        const videoFileName = path.basename(initialFile, '.mp4');
        const videoFilenameSuffix = outputFilename ? ' - ' + outputFilename : '';
        const baseVideoFilename = this._sanitizeFilename(videoFileName + videoFilenameSuffix);
        const finalVideoPath = path.join(finalDir, baseVideoFilename + ".mp4");

        return new Promise<string>((resolve) => {

            // Use ffprobe to check the length of the initial file.
            ffmpeg.ffprobe(initialFile, (err: any, data: any) => {
                if (err) {
                    console.log("[Recorder] FFprobe error: ", err);
                    throw new Error("FFprobe error when cutting video");
                }

                // Calculate the desired start time relative to the initial file.
                const bufferedDuration = data.format.duration;
                let startTime = Math.round(bufferedDuration - desiredDuration);

                // Defensively avoid a negative start time error case.
                if (startTime < 0) {
                    console.log("[Recorder] Video start time was: ", startTime);
                    console.log("[Recorder] Avoiding error by not cutting video");
                    startTime = 0;
                }

                console.log("[Recorder] Initial duration:", bufferedDuration,
                            "Desired duration:", desiredDuration,
                            "Calculated start time:", startTime);

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
                    .inputOptions([ `-ss ${startTime}`, `-t ${desiredDuration}` ])
                    .outputOptions([ `-t ${desiredDuration}`, "-c:v copy", "-c:a copy", "-avoid_negative_ts make_zero" ])
                    .output(finalVideoPath)

                    // Handle the end of the FFmpeg cutting.
                    .on('end', async (err: any) => {
                        if (err) {
                            console.log('[Recorder] FFmpeg video cut error (1): ', err)
                            throw new Error("FFmpeg error when cutting video (1)");
                        }
                        else {
                            console.log("[Recorder] FFmpeg cut video succeeded");
                            resolve(finalVideoPath);
                        }
                    })

                    // Handle an error with the FFmpeg cutting. Not sure if we
                    // need this as well as the above but being careful.
                    .on('error', (err: any) => {
                        console.log('[Recorder] FFmpeg video cut error (2): ', err)
                        throw new Error("FFmpeg error when cutting video (2)");
                    })
                    .run()
            })
        });
    }
}

export {
    Recorder,
    RecorderOptionsType,
};
