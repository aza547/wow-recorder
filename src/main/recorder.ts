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
     * 
     */
     get isRecording() {
        return this._isRecording;
    }

    /**
     * 
     */
    set isRecording(value) {
        this._isRecording = value;
    }

    /**
     * 
     */
    get isRecordingBuffer() {
        return this._isRecordingBuffer;
    }
    
    /**
     * 
     */
    set isRecordingBuffer(value) {
        this._isRecordingBuffer = value;
    }

    /**
     * Start recorder buffer.
     */
    startBuffer = () => {
        console.log("Recorder: Start recording buffer");
        obsRecorder.start();
        this._isRecordingBuffer = true;
        if (mainWindow) mainWindow.webContents.send('updateStatus', 3);
    
        this._bufferIntervalID = setInterval(() => {
            this.restartBuffer()
        }, 5 * 60 * 1000); // Five mins
    }

    
    /**
     * Stop recorder buffer.
     */
    stopBuffer = () => {
        console.log("Recorder: Stop recording buffer");
        obsRecorder.stop();

        setTimeout(() => {
            deleteVideo(getNewestVideo(this._bufferStorageDir));
        }, 2000);

        this.isRecordingBuffer = false;

        if (mainWindow) mainWindow.webContents.send('updateStatus', 0);
    }

    /**
     * Restarts the buffer recording. Fairly interesting function. 
     * Does the following:
     *   - Stop the OBS recording.
     *   - Wait a couple seconds for OBS to finish. 
     *   - Delete the most recent video. Logically it's not anything we want. TODO fix this comment not actually true, see below comment on deleteVideo.
     *   - Start the OBS recording. 
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
     * buffer recording restarts.
     */
    start = () => {
        console.log("Recorder: Start recording");
        this._isRecording = true;
        clearInterval(this._bufferIntervalID);
        if (mainWindow) mainWindow.webContents.send('updateStatus', 1);
    }

    /**
     * Stop recording, no-op if not already recording. 
     * By this point we need to have all the Metadata. 
     */
    stop = (metadata: Metadata, overrun: number = 0) => {
        setTimeout(() => {      
            console.log("Recorder: Stop recording");
            console.log("Recorder:", JSON.stringify(metadata));
            if (!this._isRecording) return;
            obsRecorder.stop();       
            this._isRecording = false;
            if (mainWindow) mainWindow.webContents.send('updateStatus', 4);
        
            setTimeout(async () => {
                const bufferedVideo = getNewestVideo(this._bufferStorageDir); 
                await cutVideo(bufferedVideo, this._storageDir, metadata.duration);
                writeMetadataFile(this._storageDir, metadata);
                runSizeMonitor(this._storageDir, this._maxStorage * 1000000000); // convert GB to bytes

                if (mainWindow) {
                    mainWindow.webContents.send('refreshState');
                }

                this.cleanupBuffer();
                this.startBuffer();
            }, 2000);

        }, overrun * 1000);
    }

    /**
     * Delete all but the most recent buffer mp4 file. 
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