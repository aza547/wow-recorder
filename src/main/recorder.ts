import { Metadata } from './logutils';
import { writeMetadataFile, runSizeMonitor, getNewestVideo, deleteVideo, cutVideo, addColor, getSortedVideos } from './util';
import { mainWindow }  from './main';
import path from 'path';
import { AppStatus } from './types';

const obsRecorder = require('./obsRecorder');
import fs from 'fs';
import glob from 'glob';
import util from 'util';
const globPromise = util.promisify(glob)

/**
 * Represents an OBS recorder object.
 */
 class Recorder {
    private _isRecording: boolean = false;
    private _isRecordingBuffer: boolean = false;
    private _storageDir: string;
    private _maxStorage: number;
    private _bufferStorageDir: any;
    private _bufferRestartIntervalID?: any;
    private _monitorIndex: number;
    private _audioInputDeviceId: string;
    private _audioOutputDeviceId: string;
    private _minEncounterDuration: number;


    /**
     * Constructs a new Recorder.
     */
    constructor(
        storageDir: string, 
        maxStorage: number,
        monitorIndex: number,
        audioInputDeviceId: string,
        audioOutputDeviceId: string,
        minEncounterDuration: number
    ) {
        console.debug("[Recorder] Construcing recorder with: ", storageDir, maxStorage, monitorIndex);
        this._storageDir = storageDir;
        this._maxStorage = maxStorage;     
        this._monitorIndex = monitorIndex;           
        this._audioInputDeviceId = audioInputDeviceId;
        this._audioOutputDeviceId = audioOutputDeviceId;
        this._minEncounterDuration = minEncounterDuration;

        // Something like: C:\Users\alexa\AppData\Local\Temp\WarcraftRecorder
        this._bufferStorageDir = path.join(this._storageDir, ".temp"); 

        if (!fs.existsSync(this._bufferStorageDir)) {
            console.log("[Recorder] Creating dir:", this._bufferStorageDir);
            fs.mkdirSync(this._bufferStorageDir);
        } else {
            console.log("[Recorder] Clean out buffer")
            this.cleanupBuffer(0);
        }

        obsRecorder.initialize(this._bufferStorageDir, this._monitorIndex, this._audioInputDeviceId, this._audioOutputDeviceId);
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
        if (this._isRecordingBuffer) {
            console.error("[Recorder] Already recording a buffer");
            return;
        }

        console.log(addColor("[Recorder] Start recording buffer", "cyan"));
        await obsRecorder.start();
        this._isRecordingBuffer = true;
        if (mainWindow) mainWindow.webContents.send('updateStatus', AppStatus.ReadyToRecord);
    
        // Guard against multiple buffer timers. 
        if (this._bufferRestartIntervalID) {
            console.error("[Recorder] Already has a buffer interval.")
            return;
        }

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
        this._bufferRestartIntervalID = undefined;

        await obsRecorder.stop();
        this._isRecordingBuffer = false;
        if (mainWindow) mainWindow.webContents.send('updateStatus', AppStatus.WaitingForWoW);
        this.cleanupBuffer(1);
    }

    /**
     * Restarts the buffer recording. Cleans the temp dir between stop/start.
     * We wait 2s here between the stop start. I don't know why, but if we
     * don't then OBS becomes unresponsive. I spent a lot of time on this, 
     * trying all sorts of other solutions don't fuck with it unless you have 
     * to; here be dragons. 
     */
    restartBuffer = async () => {
        console.log(addColor("[Recorder] Restart recording buffer", "cyan"));
        await obsRecorder.stop();
        this._isRecordingBuffer = false;
        setTimeout(() => {
            this._isRecordingBuffer = true;
            obsRecorder.start();
        }, 2000);

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
    stop = (metadata: Metadata, overrun: number = 0) => {
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

            const isRaid = metadata.category == "Raids";
            const isLongEnough = (metadata.duration - overrun) >= this._minEncounterDuration;
            if (!isRaid || isLongEnough) {
                // Cut the video to length and write its metadata JSON file.
                // Await for this to finish before we return to waiting state.
                await this.finalizeVideo(metadata);
            }

            // Run the size monitor to ensure we stay within size limit.
            // Need some maths to convert GB to bytes
            runSizeMonitor(this._storageDir, this._maxStorage)
                .then(() => {
                    if (mainWindow) mainWindow.webContents.send('refreshState');
                });

            // Clean-up the temporary recording directory. 
            this.cleanupBuffer(1);

            // Refresh the GUI
            if (mainWindow) mainWindow.webContents.send('refreshState');

            // Restart the buffer recording ready for next game.
            this.startBuffer();
        }, 
        overrun * 1000);
    }

    /**
     * Finalize the video by cutting it to size, moving it to the persistent
     * storage directory and writing the metadata JSON file. 
     * 
     * @param {Metadata} metadata the details of the recording
     */
    finalizeVideo = async (metadata: Metadata) => {

        // Gnarly syntax to await for the setTimeout to finish.
        await new Promise<void> ((resolve) => {

            // It's a bit hacky that we async wait for 2 seconds for OBS to 
            // finish up with the video file. Maybe this can be done better. 
            setTimeout(async () => {
                const bufferedVideo = await getNewestVideo(this._bufferStorageDir);
                const videoPath = await cutVideo(bufferedVideo, this._storageDir, metadata.duration);
                writeMetadataFile(videoPath, metadata).then(resolve);
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
        const videosToDelete = await getSortedVideos(this._bufferStorageDir);

        // Remove newest 2 from the list; we don't delete those.
        videosToDelete
            .slice(filesToLeave)
            .forEach((v) => deleteVideo(v.name));
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
    reconfigure = (
        outputPath: string, 
        maxStorage: number, 
        monitorIndex: number, 
        audioInputDeviceId: string, 
        audioOutputDeviceId: string, 
        minEncounterDuration: number
    ) => {
        this._maxStorage = maxStorage;
        this._minEncounterDuration = minEncounterDuration;

        // User might just have shrunk the size, so run the size monitor.
        runSizeMonitor(this._storageDir, this._maxStorage)
        .then(() => {
            if (mainWindow) mainWindow.webContents.send('refreshState');
        });
      
        if (this._isRecording) {
            obsRecorder.stop();       
            this._isRecording = false;
        } else if (this._isRecordingBuffer) {
            this.stopBuffer()
        }

        obsRecorder.reconfigure(outputPath, monitorIndex, audioInputDeviceId, audioOutputDeviceId);
        if (mainWindow) mainWindow.webContents.send('refreshState');
    }
}

export {
    Recorder
};
