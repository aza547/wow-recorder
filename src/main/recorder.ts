import { Metadata } from './logutils';
import { writeMetadataFile, runSizeMonitor, getNewestVideo, deleteVideo, cutVideo } from './util';
import { mainWindow }  from './main';
import { app } from 'electron';
import path from 'path';

const obsRecorder = require('./obsRecorder');
const fs = require('fs');
const glob = require('glob');

/**
 * Represents an OBS recorder object.
 */
 class Recorder {
    private _isRecording: boolean = false;
    private _isRecordingBuffer: boolean = false;
    private _storageDir: string;
    private _maxStorage: number;
    private _bufferStorageDir: any;
    private _bufferIntervalID?: any;

    /**
     * Constructs a new Recorder.
     */
    constructor(storageDir: string, maxStorage: number) {
        this._storageDir = storageDir;
        this._maxStorage = maxStorage;       

        // Something like: C:\Users\alexa\AppData\Local\Temp\WarcraftRecorder
        this._bufferStorageDir = path.join(app.getPath("temp"), "WarcraftRecorder"); 

        if (!fs.existsSync(this._bufferStorageDir)) {
            console.log("Creating dir:", this._bufferStorageDir)
            fs.mkdirSync(this._bufferStorageDir);
        }

        obsRecorder.initialize(this._bufferStorageDir);
    }

    /**
     * Get the value of isRecording. 
     * @returns {boolean} true if currently recording a game/encounter
     */
     get isRecording() {
        return this._isRecording;
    }

    /**
     * Set the value of isRecording. 
     * @param {boolean} isRecording true if currently recording a game/encounter
     */
    set isRecording(value) {
        this._isRecording = value;
    }

    /**
     * Get the value of isRecordingBuffer. 
     * @returns {boolean} true if currently recording a buffer
     */
    get isRecordingBuffer() {
        return this._isRecordingBuffer;
    }
    
    /**
     * Set the value of isRecordingBuffer. 
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
    startBuffer = () => {
        console.log("Recorder: Start recording buffer");
        obsRecorder.start();
        this._isRecordingBuffer = true;
        if (mainWindow) mainWindow.webContents.send('updateStatus', 3);
    
        // We store off this timer as a member variable as we will cancel
        // it when a real game is detected. 
        this._bufferIntervalID = setInterval(() => {
            this.restartBuffer()
        }, 5 * 60 * 1000); // Five mins
    }

    
    /**
     * Stop recorder buffer. Called when WoW is closed. 
     */
    stopBuffer = () => {
        console.log("Recorder: Stop recording buffer");
        obsRecorder.stop();
        this.isRecordingBuffer = false;
        if (mainWindow) mainWindow.webContents.send('updateStatus', 0);

        setTimeout(() => {
            this.cleanupBuffer();
        }, 2000);
    }

    /**
     * Restarts the buffer recording. Cleans the temp dir between stop/start.
     */
    restartBuffer = () => {
        console.log("Recorder: Restart recording buffer");
        obsRecorder.stop();

        // Wait 2 seconds here just incase OBS has to do anything.
        setTimeout(() => {
            this.cleanupBuffer();
            obsRecorder.start();
        }, 2000); 
    }

    /**
     * Start recording for real, this basically just cancels pending 
     * buffer recording restarts. We don't need to actually start OBS 
     * recording as it's should already be running. 
     */
    start = () => {
        console.log("Recorder: Start recording");
        this._isRecording = true;
        clearInterval(this._bufferIntervalID);
        if (mainWindow) mainWindow.webContents.send('updateStatus', 1);
    }

    /**
     * Stop recording, no-op if not already recording. Quite a bit happens in 
     * this function, so I've included lots of comments. The ordering is also
     * important. 
     * @param {Metadata} metadata the details of the recording
     * @param {number} overrun how long to continue recording after stop is called
     */
    stop = (metadata: Metadata, overrun: number = 0) => {

        // Wait for a delay specificed by overrun. This lets us
        // Capture the boss death animation/score screens.  
        setTimeout(async () => {
            
            // Verbose logging so it's obvious what's happening. 
            console.log("Recorder: Stop recording");
            console.log("Recorder:", JSON.stringify(metadata));

            // Take the actions to stop the recording.
            if (!this._isRecording) return;
            obsRecorder.stop();       
            this._isRecording = false;

            // Update the GUI to show we're processing a video. 
            if (mainWindow) mainWindow.webContents.send('updateStatus', 4);

            // Cut the video to length and write its metadata JSON file.
            await this.finalizeVideo(metadata)

            // Run the size monitor to ensure we stay within size limit.
            // Need some maths to convert GB to bytes
            runSizeMonitor(this._storageDir, this._maxStorage); 

            // Clean-up the temporary recording directory. 
            this.cleanupBuffer();

            // Refresh the GUI
            if (mainWindow) mainWindow.webContents.send('refreshState');

            // Restart the buffer recording ready for next game.
            this.startBuffer();
        }, 
        overrun * 1000);
    }

    /**
     * Finalize the video by cutting it to size and writing the metadata JSON file. 
     * @param {Metadata} metadata the details of the recording
     */
    finalizeVideo = async (metadata: Metadata) => {

        setTimeout(async () => {
            const bufferedVideo = getNewestVideo(this._bufferStorageDir); 
            await cutVideo(bufferedVideo, this._storageDir, metadata.duration);
            writeMetadataFile(this._storageDir, metadata);            
        }, 
        2000);      
    }

    /**
     * Delete all but the most recent buffer .mp4 file. 
     */
    cleanupBuffer = () => {
        const globString = path.join(this._bufferStorageDir, "*.mp4"); 

        // Sort newest to oldest, remove newest from the list; we don't delete that. 
        const videosToDelete = glob.sync(globString) 
            .map((name: any) => ({name, mtime: fs.statSync(name).mtime}))
            .sort((A: any, B: any) => B.mtime - A.mtime)
            .slice(1);

        for (const video of videosToDelete) {
            deleteVideo(video.name);
        }
    }
}

export {
    Recorder
};