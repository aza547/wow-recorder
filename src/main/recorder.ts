import { Metadata } from './logutils';
import { writeMetadataFile, runSizeMonitor, getNewestVideo, deleteVideo, cutVideo, addColor, getSortedVideos } from './util';
import { mainWindow }  from './main';
import { AppStatus } from './types';
import { getDungeonByMapId, getEncounterNameById, getVideoResultText, getInstanceNameByZoneId, getRaidNameByEncounterId } from './helpers';
import { VideoCategory } from './constants';
import fs from 'fs';
import { ChallengeModeDungeon } from './keystone';

const obsRecorder = require('./obsRecorder');

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
            if (mainWindow) mainWindow.webContents.send('updateStatus', AppStatus.ReadyToRecord);

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
        const bufferedVideo = await getNewestVideo(this._options.bufferStorageDir);
        const videoPath = await cutVideo(bufferedVideo, this._options.storageDir, outputFilename, metadata.duration);

        await writeMetadataFile(videoPath, metadata);
        console.log('[Recorder] Finalized video', videoPath);

        return videoPath;
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
}

export {
    Recorder,
    RecorderOptionsType,
};
