import { Metadata } from './logutils';
import { writeMetadataFile, runSizeMonitor, getNewestVideo, deleteVideo, cutVideo, addColor, getSortedVideos, fixPathWhenPackaged, parseResolutionsString, getClosestResolution, displayInfo} from './util';
import { mainWindow }  from './main';
import { AppStatus } from './types';
import { getDungeonByMapId, getEncounterNameById, getVideoResultText, getInstanceNameByZoneId, getRaidNameByEncounterId } from './helpers';
import { VideoCategory } from './constants';
import fs from 'fs';
import { ChallengeModeDungeon } from './keystone';
import WaitQueue from 'wait-queue';
import { IScene } from 'obs-studio-node';
import { Size } from 'electron';
import { getAvailableAudioInputDevices, getAvailableAudioOutputDevices } from "./obsAudioDeviceUtils";

const osn = require("obs-studio-node");
const obsRecorder = require('./obsRecorder');
const path = require('path');
const { v4: uuid } = require('uuid');

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
    private _obsInitialized: boolean = false;
    private _waitQueue = new WaitQueue<any>();
    private _scene: IScene | null = null;

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
                const videoPath = await cutVideo(bufferedVideo, this._options.storageDir, outputFilename, metadata.duration);
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
     * Initialize OBS.
     */
    initOBS(options: RecorderOptionsType): void {
        if (this._obsInitialized) {
            console.warn("[Recorder] OBS is already initialized");
            return;
        }
        
        console.debug('[Recorder] Initializing OBS...');
        osn.NodeObs.IPC.host(`warcraft-recorder-${uuid()}`);
        osn.NodeObs.SetWorkingDirectory(fixPathWhenPackaged(path.join(__dirname,'../../', 'node_modules', 'obs-studio-node')));
        
        const obsDataPath = fixPathWhenPackaged(path.join(__dirname, 'osn-data')); 
        const initResult = osn.NodeObs.OBS_API_initAPI('en-US', obsDataPath, '1.0.0');

        if (initResult !== 0) {
            const errorReasons = {
            '-2': 'DirectX could not be found on your system. Please install the latest version of DirectX for your machine here <https://www.microsoft.com/en-us/download/details.aspx?id=35?> and try again.',
            '-5': 'Failed to initialize OBS. Your video drivers may be out of date, or Warcraft Recorder may not be supported on your system.',
            }

            // @ts-ignore
            const errorMessage = errorReasons[initResult.toString()] ||
             `An unknown error #${initResult} was encountered while initializing OBS.`;
            console.error('[OBS] OBS init failure', errorMessage);
            this.shutdownOBS();
            throw Error(errorMessage);
        }

        osn.NodeObs.OBS_service_connectOutputSignals((signalInfo: any) => {
            this._waitQueue.push(signalInfo);
        });

        console.debug('[OBS] OBS initialized');
        this.configureOBS(options);
        this._obsInitialized = true;
    }

    /**
     * Shutdown OBS.
     */
    shutdownOBS(): void {
        if (!this._obsInitialized) {
            console.debug('[Recorder] OBS is already shut down!');
            return;
        }
        
        console.debug('[Recorder]  Shutting down OBS...');
        
        try {
            osn.NodeObs.OBS_service_removeCallback();
            osn.NodeObs.IPC.disconnect();
            this._obsInitialized = false;
        } catch(e) {
            throw Error('Exception when shutting down OBS process' + e);
        }
        
        console.debug('[Recorder]  OBS shutdown successfully');
    }

    /**
     * Configure OBS.
     */
    configureOBS(options: RecorderOptionsType): void {
        const baseResolution = parseResolutionsString(options.obsBaseResolution);
        const outputResolution = parseResolutionsString(options.obsOutputResolution);
      
        console.debug('[OBS] Configuring OBS');
        this.setSettingOBS('Output', 'Mode', 'Advanced');

        // Get a list of available encoders.
        const availableEncoders = this.getAvailableValuesOBS('Output', 'Recording', 'RecEncoder');
        console.debug("[OBS] Available encoder: " + JSON.stringify(availableEncoders));
        const selectedEncoder = availableEncoders.slice(-1)[0] || 'x264';

        // Select the last one, for some reason this is always AMF or NVENC if available. 
        console.debug("[OBS] Selected encoder: " + selectedEncoder);
        this.setSettingOBS('Output', 'RecEncoder', selectedEncoder);

        // Set output path and video format.
        this.setSettingOBS('Output', 'RecFilePath', options.bufferStorageDir);
        this.setSettingOBS('Output', 'RecFormat', 'mp4');

        // VBR is "Variable Bit Rate", read about it here:
        // https://blog.mobcrush.com/using-the-right-rate-control-in-obs-for-streaming-or-recording-4737e22895ed
        this.setSettingOBS('Output', 'Recrate_control', 'VBR');
        this.setSettingOBS('Output', 'Recbitrate', options.obsKBitRate * 1024);

        // Without this, we'll never exceed the default max which is 5000.
        this.setSettingOBS('Output', 'Recmax_bitrate', 300000);
        
        // FPS for the output video file. 
        this.setSettingOBS('Video', 'FPSCommon', options.obsFPS);

        console.debug('[OBS] OBS Configured');

        this._scene = this.setupSceneOBS(options.monitorIndex, baseResolution, outputResolution);
        this.setupSourcesOBS(this._scene, options.audioInputDeviceId, options.audioOutputDeviceId);
    }

    /*
    * setSettingOBS
    */
    setSettingOBS(category: string, parameter: string, value: string | number): void {
        let oldValue;
        console.debug('[OBS] OBS: setSetting', category, parameter, value);
        const settings = osn.NodeObs.OBS_settings_getSettings(category).data;
    
        settings.forEach((subCategory: any) => {
            subCategory.parameters.forEach((param: any) => {
                if (param.name === parameter) {        
                oldValue = param.currentValue;
                param.currentValue = value;
                }
            });
        });
    
        if (value != oldValue) {
            osn.NodeObs.OBS_settings_saveSettings(category, settings);
        }
    }

    /*
    * getAvailableValuesOBS
    */
    getAvailableValuesOBS(category: any, subcategory: any, parameter: any): any {
        const categorySettings = osn.NodeObs.OBS_settings_getSettings(category).data;

        if (!categorySettings) {
          console.warn(`[OBS] There is no category ${category} in OBS settings`);
          return;
        }
      
        const subcategorySettings = categorySettings.find((sub: any) => sub.nameSubCategory === subcategory);
      
        if (!subcategorySettings) {
          console.warn(`[OBS] There is no subcategory ${subcategory} for OBS settings category ${category}`);
          return;
        }
      
        const parameterSettings = subcategorySettings.parameters.find((param: any) => param.name === parameter);
        
        if (!parameterSettings) {
          console.warn(`[OBS] There is no parameter ${parameter} for OBS settings category ${category}.${subcategory}`);
          return;
        }
      
        return parameterSettings.values.map( (value: any) => Object.values(value)[0]);
    }

    /*
    * setupSceneOBS
    */
    setupSceneOBS(monitorIndex: number, baseResolution: Size, outputResolution: Size): IScene {

        this.setOBSVideoResolution(outputResolution, 'Output');

        // Correct the monitorIndex. In config we start a 1 so it's easy for users. 
        const monitorIndexFromZero = monitorIndex - 1;
        console.info("[OBS] monitorIndexFromZero:", monitorIndexFromZero);
        const selectedDisplay = displayInfo(monitorIndexFromZero);
        if (!selectedDisplay) {
            throw Error(`[OBS] No such display with index: ${monitorIndexFromZero}.`)
        }

        this.setOBSVideoResolution(selectedDisplay.physicalSize, 'Base');

        const videoSource = osn.InputFactory.create('monitor_capture', 'desktop-video');

        // Update source settings:
        let settings = videoSource.settings;
        settings['monitor'] = monitorIndexFromZero;
        videoSource.update(settings);
        videoSource.save();

        // A scene is necessary here to properly scale captured screen size to output video size
        const scene = osn.SceneFactory.create('test-scene');
        const sceneItem = scene.add(videoSource);
        sceneItem.scale = { x: 1.0, y: 1.0 };

        return scene;
    }

    setupSourcesOBS(scene: any, audioInputDeviceId: string, audioOutputDeviceId: string): void {
        osn.Global.setOutputSource(1, this._scene);

        this.setSettingOBS('Output', 'Track1Name', 'Mixed: all sources');
        let currentTrack = 2;
      
        getAvailableAudioInputDevices()
            .forEach(device => {
                const source = osn.InputFactory.create('wasapi_input_capture', 'mic-audio', { device_id: device.id });
                this.setSettingOBS('Output', `Track${currentTrack}Name`, device.name);
                source.audioMixers = 1 | (1 << currentTrack-1); // Bit mask to output to only tracks 1 and current track
                source.muted = audioInputDeviceId === 'none' || (audioInputDeviceId !== 'all' && device.id !== audioInputDeviceId);
                console.log(`[OBS] Selecting audio input device: ${device.name} ${source.muted ? ' [MUTED]' : ''}`)
                osn.Global.setOutputSource(currentTrack, source);
                source.release()
                currentTrack++;
            });
      
        getAvailableAudioOutputDevices()
            .forEach(device => {
                const source = osn.InputFactory.create('wasapi_output_capture', 'desktop-audio', { device_id: device.id });
                this.setSettingOBS('Output', `Track${currentTrack}Name`, device.name);
                source.audioMixers = 1 | (1 << currentTrack-1); // Bit mask to output to only tracks 1 and current track
                source.muted = audioOutputDeviceId === 'none' || (audioOutputDeviceId !== 'all' && device.id !== audioOutputDeviceId);
                console.log(`[OBS] Selecting audio output device: ${device.name} ${source.muted ? ' [MUTED]' : ''}`)
                osn.Global.setOutputSource(currentTrack, source);
                source.release()
                currentTrack++;
            });
      
        this.setSettingOBS('Output', 'RecTracks', parseInt('1'.repeat(currentTrack-1), 2)); // Bit mask of used tracks: 1111 to use first four (from available six)
    }

    /*
    * Given a none-whole monitor resolution, find the closest one that 
    * OBS supports and set the corospoding setting in Video.Untitled.{paramString}
    * 
    * @remarks
    * Useful when windows scaling is not set to 100% (125%, 150%, etc) on higher resolution monitors, 
    * meaning electron screen.getAllDisplays() will return a none integer scaleFactor, causing 
    * the calucated monitor resolution to be none-whole.
    *
    * @throws
    * Throws an error if no matching resolution is found.
    */
    setOBSVideoResolution(res: Size, paramString: string): void {
        const availableResolutions = this.getAvailableValuesOBS('Video', 'Untitled', paramString);
        const closestResolution = getClosestResolution(availableResolutions, res);
        this.setSettingOBS('Video', paramString, closestResolution);
    }
}

export {
    Recorder,
    RecorderOptionsType,
};
