import { Metadata } from './logutils';
import { writeMetadataFile, runSizeMonitor, getNewestVideo, deleteVideo, cutVideo } from './util';
import { mainWindow }  from './main';
const obsRecorder = require('./obsRecorder');
import { app } from 'electron';

/**
 * Represents an OBS recorder object.
 */
 class Recorder {
    private _isRecording: boolean = false;
    private _isRecordingBuffer: boolean = false;
    private _storageDir: string;
    private _tempStorageDir: any;
    private _maxStorage: number;
    private _bufferIntervalID?: any;

    /**
     * Constructs a new Recorder.
     */
    constructor(storageDir: string, maxStorage: number) {
        this._storageDir = storageDir;
        this._maxStorage = maxStorage;

        // Something like: 
        // C:\Users\alexa\AppData\Local\Temp
        this._tempStorageDir = app.getPath("temp");
    }

    /**
     */
     get isRecording() {
        return this._isRecording;
    }

    /**
     */
    set isRecording(value) {
        this._isRecording = value;
    }

    /**
    */
    get isRecordingBuffer() {
        return this._isRecordingBuffer;
    }
    
    /**
     */
    set isRecordingBuffer(value) {
        this._isRecordingBuffer = value;
    }

    /**
     * init
     */
    init = () => {
        console.log("Recorder: init");
        obsRecorder.initialize(this._tempStorageDir);
    }
    
    /**
     * Start recorder buffer.
     */
    startBuffer = () => {
        console.log("Recorder: Start recording buffer");
        obsRecorder.start();
        this._isRecordingBuffer = true;

        // TODO
        if (mainWindow) mainWindow.webContents.send('updateStatus', 3);
    
        this._bufferIntervalID = setInterval(() => {
            this.restartBuffer()
        }, 5* 60 * 1000); // Five mins
    }

    
    /**
     * Stop recorder buffer.
     */
    stopBuffer = () => {
        console.log("Recorder: Stop recording buffer");
        obsRecorder.stop();

        setTimeout(() => {
            deleteVideo(getNewestVideo(this._tempStorageDir));
        }, 2000);

        this.isRecordingBuffer = false;

        // TODO
        if (mainWindow) mainWindow.webContents.send('updateStatus', 0);
    }

    /**
     * Restarts the buffer recording. Fairly interesting function. 
     * Does the following:
     *   - Stop the OBS recording.
     *   - Wait a couple seconds for OBS to finish. 
     *   - Delete the most recent video. Logically it's not anything we want. 
     *   - Start the OBS recording. 
     */
    restartBuffer = () => {
        console.log("Recorder: Restart recording buffer");
        obsRecorder.stop();

        // Wait 2 seconds here just incase OBS has to do anything.
        setTimeout(() => {
            deleteVideo(getNewestVideo(this._tempStorageDir));
            obsRecorder.start();
        }, 2000); 
    }

    /**
     * Start recording for real, this basically just cancels pending 
     * buffer restarts.
     */
    start = () => {
        console.log("Recorder: Start recording");
        this._isRecording = true;
        clearInterval(this._bufferIntervalID);
        if (mainWindow) mainWindow.webContents.send('updateStatus', 1);
    }

    /**
     * Stop recording, no-op if not already recording. By this point we 
     * need to have all the Metadata. 
     */
    stop = (metadata: Metadata) => {
        console.log("Recorder: Stop recording");
        console.log("Recorder:", JSON.stringify(metadata));
        if (!this._isRecording) return;
        obsRecorder.stop();       
        this._isRecording = false;
        if (mainWindow) mainWindow.webContents.send('updateStatus', 0);
      
        setTimeout(async () => {
            const bufferedVideo = getNewestVideo(this._tempStorageDir); 
            await cutVideo(bufferedVideo, this._storageDir, metadata.duration); // TODO hardcoded duration
            writeMetadataFile(this._storageDir, metadata);
            runSizeMonitor(this._storageDir, this._maxStorage * 1000000000); // convert GB to bytes

            if (mainWindow) {
                mainWindow.webContents.send('updateStatus', 0);
                mainWindow.webContents.send('refreshState');
            }
            
            this.startBuffer(); // TODO we shouldn't wait till cutting is done for this
        }, 2000);
    }


}

export {
    Recorder
};