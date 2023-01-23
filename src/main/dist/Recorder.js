"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var path_1 = require("path");
var fs_1 = require("fs");
var osn = require("obs-studio-node");
var wait_queue_1 = require("wait-queue");
var util_1 = require("./util");
var types_1 = require("./types");
var VideoProcessQueue_1 = require("./VideoProcessQueue");
var ConfigService_1 = require("./ConfigService");
var constants_1 = require("./constants");
var uuidfn = require('uuid').v4;
/**
 * Class for handing the interface between Warcraft Recorder and OBS.
 *
 * This works by constantly recording a "buffer" whenver WoW is open. If an
 * interesting event is spotted in the combatlog (e.g. an ENCOUNTER_START
 * event), the buffer becomes a real recording.
 *
 * This ensures we catch the start of activities, the fundamental problem
 * here being that the combatlog doesn't write in real time, and we might
 * actually see the ENCOUNTER_START event 20 seconds after it occured in
 * game.
 */
var Recorder = /** @class */ (function () {
    function Recorder(mainWindow) {
        var _this = this;
        /**
         * For quickly checking if we're recording an activity or not. This is
         * not the same as the OBS state.
         */
        this._isRecording = false;
        /**
         * Date the recording started.
         */
        this._recorderStartDate = new Date();
        /**
         * ConfigService instance.
         */
        this.cfg = ConfigService_1["default"].getInstance();
        /**
         * On creation of the recorder we generate a UUID to identify the OBS
         * server. On a change of settings, we destroy the recorder object and
         * create a new one, with a different UUID.
         */
        this.uuid = uuidfn();
        /**
         * Resolution selected by the user in settings. Defaults to 1920x1080 for
         * no good reason other than avoiding undefined. It quickly gets set to
         * what the user configured.
         */
        this.resolution = '1920x1080';
        /**
         * Scale factor for resizing the video source if a user is running
         * windowed mode and decides to resize their game. We can handle
         * this cleanly, even mid-recording.
         */
        this.videoScaleFactor = 1;
        /**
         * Arbritrarily chosen channel numbers for video input. We only ever
         * include one video source.
         */
        this.videoChannel = 1;
        /**
         * Some arbritrarily chosen channel numbers we can use for adding input
         * devices to the OBS scene. That is, adding microphone audio to the
         * recordings.
         */
        this.audioInputChannels = [2, 3, 4];
        /**
         * Array of input devices we are including in the source. This is not an
         * array of all the devices we know about.
         */
        this.audioInputDevices = [];
        /**
         * Some arbritrarily chosen channel numbers we can use for adding output
         * devices to the OBS scene. That is, adding speaker audio to the
         * recordings.
         */
        this.audioOutputChannels = [5, 6, 7, 8, 9];
        /**
         * Array of output devices we are including in the source. This is not an
         * array of all the devices we know about.
         */
        this.audioOutputDevices = [];
        /**
         * WaitQueue object for storing signalling from OBS. We only care about
         * wrote signals which indicate the video file has been written.
         */
        this.wroteQueue = new wait_queue_1["default"]();
        /**
         * The state of OBS according to its signalling.
         */
        this.obsState = "offline" /* Offline */;
        /**
         * For easy checking if OBS has been initialized.
         */
        this.obsInitialized = false;
        /**
         * For easy checking if OBS has been configured.
         */
        this.obsConfigured = false;
        /**
         * Start recorder buffer. This starts OBS and records in 5 min chunks
         * to the buffer location.
         */
        this.startBuffer = function () { return __awaiter(_this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                console.info('[Recorder] Start recording buffer');
                if (!this.obsInitialized) {
                    console.error('[Recorder] OBS not initialized');
                    return [2 /*return*/];
                }
                this.startOBS();
                this._recorderStartDate = new Date();
                // We store off this timer as a member variable as we will cancel
                // it when a real game is detected.
                this._bufferRestartIntervalID = setInterval(function () {
                    _this.restartBuffer();
                }, 5 * 60 * 1000); // Five mins
                return [2 /*return*/];
            });
        }); };
        /**
         * Stop recorder buffer.
         */
        this.stopBuffer = function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.info('[Recorder] Stop recording buffer');
                        this.cancelBufferTimers(true, true);
                        return [4 /*yield*/, this.stopOBS()];
                    case 1:
                        _a.sent();
                        this.cleanupBuffer(1);
                        return [2 /*return*/];
                }
            });
        }); };
        /**
         * Restarts the buffer recording. Cleans the temp dir between stop/start.
         * We wait 5s here between the stop start. I don't know why, but if we
         * don't then OBS becomes unresponsive.
         *
         * I spent a lot of time on this, trying all sorts of other solutions
         * don't fuck with it unless you have to; here be dragons.
         */
        this.restartBuffer = function () { return __awaiter(_this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log('[Recorder] Restart recording buffer');
                        return [4 /*yield*/, this.stopOBS()];
                    case 1:
                        _a.sent();
                        this._bufferStartTimeoutID = setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                this.startOBS();
                                this._recorderStartDate = new Date();
                                return [2 /*return*/];
                            });
                        }); }, 5000);
                        this.cleanupBuffer(1);
                        return [2 /*return*/];
                }
            });
        }); };
        /**
         * Cancel buffer timers. This can include any combination of:
         *  - _bufferRestartIntervalID: the interval on which we periodically restart the buffer
         *  - _bufferStartTimeoutID: the timer we use during buffer restart to start the recorder again.
         */
        this.cancelBufferTimers = function (cancelRestartInterval, cancelStartTimeout) {
            if (cancelRestartInterval && _this._bufferRestartIntervalID) {
                console.info('[Recorder] Buffer restart interval cleared');
                clearInterval(_this._bufferRestartIntervalID);
            }
            if (cancelStartTimeout && _this._bufferStartTimeoutID) {
                console.info('[Recorder] Buffer start timeout cleared');
                clearInterval(_this._bufferStartTimeoutID);
            }
        };
        console.info('[Recorder] Constructing recorder:', this.uuid);
        this.mainWindow = mainWindow;
        this.videoProcessQueue = new VideoProcessQueue_1["default"](mainWindow);
        this.initializeOBS();
    }
    Recorder.prototype.reconfigure = function (mainWindow) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.info('[Recorder] Reconfigure recorder');
                        // Stop and shutdown the old instance.
                        return [4 /*yield*/, this.stopBuffer()];
                    case 1:
                        // Stop and shutdown the old instance.
                        _a.sent();
                        this.shutdownOBS();
                        // Create a new uuid and re-initialize OBS.
                        this.uuid = uuidfn();
                        this.mainWindow = mainWindow;
                        this.videoProcessQueue = new VideoProcessQueue_1["default"](mainWindow);
                        this.initializeOBS();
                        return [2 /*return*/];
                }
            });
        });
    };
    Object.defineProperty(Recorder.prototype, "isRecording", {
        get: function () {
            return this._isRecording;
        },
        set: function (value) {
            this._isRecording = value;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Configure OBS. This is split out of the constructor so that we can always
     * initialize OBS upfront (without requiring any configuration from the
     * user). That lets us populate all the options in settings that we depend
     * on OBS to inform us of (encoders, audio devices). This doesn't attach
     * audio devices, that's done seperately.
     */
    Recorder.prototype.configure = function () {
        if (!this.obsInitialized) {
            throw new Error('[Recorder] OBS not initialized');
        }
        try {
            this.cfg.validate();
        }
        catch (error) {
            throw new Error('[Recorder] Configure called but config invalid');
        }
        this.bufferStorageDir = this.cfg.getPath('bufferStoragePath');
        this.createRecordingDirs();
        this.obsRecordingFactory = this.configureOBS();
        this.configureVideoOBS();
        this.obsConfigured = true;
    };
    /**
     * Create the bufferStorageDir if it doesn't already exist. Also
     * cleans it out for good measure.
     */
    Recorder.prototype.createRecordingDirs = function () {
        if (!this.bufferStorageDir) {
            throw new Error('[Recorder] bufferStorageDir not set');
        }
        if (!fs_1["default"].existsSync(this.bufferStorageDir)) {
            console.info('[Recorder] Creating dir:', this.bufferStorageDir);
            fs_1["default"].mkdirSync(this.bufferStorageDir);
        }
        else {
            console.info('[Recorder] Clean out buffer');
            this.cleanupBuffer(0);
        }
    };
    /**
     * Call through OSN to initialize OBS. This is slow and synchronous,
     * so use sparingly - it will block the main thread.
     */
    Recorder.prototype.initializeOBS = function () {
        console.info('[Recorder] Initializing OBS', this.uuid);
        try {
            osn.NodeObs.IPC.host(this.uuid);
            osn.NodeObs.SetWorkingDirectory(util_1.fixPathWhenPackaged(path_1["default"].join(__dirname, '../../', 'node_modules', 'obs-studio-node')));
            var initResult = osn.NodeObs.OBS_API_initAPI('en-US', util_1.fixPathWhenPackaged(path_1["default"].join(path_1["default"].normalize(__dirname), 'osn-data')), '1.0.0', '');
            if (initResult !== 0) {
                throw new Error("OBS process initialization failed with code " + initResult);
            }
        }
        catch (e) {
            throw new Error("Exception when initializing OBS process: " + e);
        }
        this.obsInitialized = true;
        console.info('[Recorder] OBS initialized successfully');
    };
    /**
     * Configures OBS. This does a bunch of things that we need the
     * user to have setup their config for, which is why it's split out.
     */
    Recorder.prototype.configureOBS = function () {
        var _this = this;
        console.info('[Recorder] Configuring OBS');
        this.resolution = this.cfg.get('obsOutputResolution');
        var _a = constants_1.obsResolutions[this.resolution], height = _a.height, width = _a.width;
        var fps = this.cfg.get('obsFPS');
        osn.VideoFactory.videoContext = {
            fpsNum: fps,
            fpsDen: 1,
            baseWidth: width,
            baseHeight: height,
            outputWidth: width,
            outputHeight: height,
            outputFormat: 2,
            colorspace: 2,
            range: 2,
            scaleType: 3,
            fpsType: 2
        };
        var recFactory = osn.AdvancedRecordingFactory.create();
        var bufferPath = this.cfg.getPath('bufferStoragePath');
        recFactory.path = path_1["default"].normalize(bufferPath);
        recFactory.format = "mp4" /* MP4 */;
        recFactory.useStreamEncoders = false;
        recFactory.videoEncoder = osn.VideoEncoderFactory.create(this.cfg.get('obsRecEncoder'), 'video-encoder');
        recFactory.videoEncoder.update({
            rate_control: 'VBR',
            bitrate: 1000 * this.cfg.get('obsKBitRate')
        });
        recFactory.overwrite = false;
        recFactory.noSpace = false;
        recFactory.signalHandler = function (signal) {
            _this.handleSignal(signal);
        };
        return recFactory;
    };
    Recorder.prototype.handleSignal = function (obsSignal) {
        console.info('[Recorder] Got signal:', obsSignal);
        if (obsSignal.type !== 'recording') {
            console.info('[Recorder] No action needed on this signal');
            return;
        }
        switch (obsSignal.signal) {
            case "start" /* Start */:
                this.obsState = "recording" /* Recording */;
                this.updateStatusIcon(types_1.RecStatus.ReadyToRecord);
                break;
            case "starting" /* Starting */:
                this.obsState = "starting" /* Starting */;
                this.updateStatusIcon(types_1.RecStatus.ReadyToRecord);
                break;
            case "stop" /* Stop */:
                this.obsState = "offline" /* Offline */;
                this.updateStatusIcon(types_1.RecStatus.WaitingForWoW);
                break;
            case "stopping" /* Stopping */:
                this.obsState = "stopping" /* Stopping */;
                this.updateStatusIcon(types_1.RecStatus.WaitingForWoW);
                break;
            case "wrote" /* Wrote */:
                this.wroteQueue.push(obsSignal);
                break;
            default:
                console.info('[Recorder] No action needed on this signal');
                break;
        }
        console.info('[Recorder] State is now: ', this.obsState);
    };
    /**
     * Configures the video source in OBS. Also creates the scene.
     */
    Recorder.prototype.configureVideoOBS = function () {
        console.info('[Recorder] Configuring OBS video');
        var captureMode = this.cfg.get('obsCaptureMode');
        switch (captureMode) {
            case 'monitor_capture':
                this.videoSource = this.createMonitorCaptureSource();
                break;
            case 'game_capture':
                this.videoSource = this.createGameCaptureSource();
                break;
            default:
                throw new Error('[Recorder] Unexpected default case hit');
        }
        this.scene = osn.SceneFactory.create('WR Scene');
        this.sceneItem = this.scene.add(this.videoSource);
        osn.Global.setOutputSource(this.videoChannel, this.scene);
        if (captureMode === 'game_capture') {
            this.watchVideoSourceSize();
        }
    };
    /**
     * Creates a monitor capture source.
     */
    Recorder.prototype.createMonitorCaptureSource = function () {
        console.info('[Recorder] Configuring OBS for Monitor Capture');
        var monitorCaptureSource = osn.InputFactory.create('monitor_capture', 'WR Monitor Capture');
        var settings = monitorCaptureSource.settings;
        settings.monitor = this.cfg.get('monitorIndex') - 1;
        monitorCaptureSource.update(settings);
        monitorCaptureSource.save();
        return monitorCaptureSource;
    };
    /**
     * Creates a game capture source.
     */
    Recorder.prototype.createGameCaptureSource = function () {
        console.info('[Recorder] Configuring OBS for Game Capture');
        var gameCaptureSource = osn.InputFactory.create('game_capture', 'WR Game Capture');
        var settings = gameCaptureSource.settings;
        settings.capture_cursor = true;
        settings.capture_mode = 'window';
        settings.allow_transparency = true;
        settings.priority = 1;
        settings.window = 'World of Warcraft:GxWindowClass:Wow.exe';
        gameCaptureSource.update(settings);
        gameCaptureSource.save();
        return gameCaptureSource;
    };
    /**
     * Add the configured audio sources ot the OBS scene. This is public
     * so it can be called externally when WoW is opened - see the Poller
     * class.
     */
    Recorder.prototype.addAudioSourcesOBS = function () {
        var _this = this;
        console.info('[Recorder] Configuring OBS audio sources');
        var track1 = osn.AudioTrackFactory.create(160, 'track1');
        osn.AudioTrackFactory.setAtIndex(track1, 1);
        this.cfg
            .get('audioInputDevices')
            .split(',')
            .filter(function (id) { return id; })
            .forEach(function (id) {
            console.info('[Recorder] Adding input source', id);
            var obsSource = _this.createOBSAudioSource(id, types_1.TAudioSourceType.input);
            _this.audioInputDevices.push(obsSource);
        });
        if (this.audioInputDevices.length > this.audioInputChannels.length) {
            throw new Error('[Recorder] Too many audio input devices');
        }
        this.audioInputDevices.forEach(function (device) {
            var index = _this.audioInputDevices.indexOf(device);
            var channel = _this.audioInputChannels[index];
            if (_this.cfg.get('obsForceMono')) {
                // value of osn.EsourceFlags.ForceMono
                // eslint-disable-next-line no-bitwise
                device.flags = 1 << 1;
            }
            _this.addAudioSourceOBS(device, channel);
        });
        this.cfg
            .get('audioOutputDevices')
            .split(',')
            .filter(function (id) { return id; })
            .forEach(function (id) {
            console.info('[Recorder] Adding output source', id);
            var obsSource = _this.createOBSAudioSource(id, types_1.TAudioSourceType.output);
            _this.audioOutputDevices.push(obsSource);
        });
        if (this.audioOutputDevices.length > this.audioOutputChannels.length) {
            throw new Error('[Recorder] Too many audio output devices');
        }
        this.audioOutputDevices.forEach(function (device) {
            var index = _this.audioOutputDevices.indexOf(device);
            var channel = _this.audioOutputChannels[index];
            _this.addAudioSourceOBS(device, channel);
        });
    };
    /**
     * Remove all audio sources from the OBS scene. This is public
     * so it can be called externally when WoW is closed.
     */
    Recorder.prototype.removeAudioSourcesOBS = function () {
        var _this = this;
        if (!this.obsInitialized) {
            throw new Error('[Recorder] OBS not initialized');
        }
        this.audioInputDevices.forEach(function (device) {
            var index = _this.audioInputDevices.indexOf(device);
            var channel = _this.audioInputChannels[index];
            _this.removeAudioSourceOBS(device, channel);
            _this.audioInputDevices.splice(index, 1);
        });
        this.audioOutputDevices.forEach(function (device) {
            var index = _this.audioOutputDevices.indexOf(device);
            var channel = _this.audioOutputChannels[index];
            _this.removeAudioSourceOBS(device, channel);
            _this.audioOutputDevices.splice(index, 1);
        });
    };
    /**
     * Add a single audio source to the OBS scene.
     */
    Recorder.prototype.addAudioSourceOBS = function (obsInput, channel) {
        console.info('[Recorder] Adding OBS audio source', obsInput.name, obsInput.id);
        if (!this.obsInitialized) {
            throw new Error('[Recorder] OBS not initialized');
        }
        if (channel <= 1 || channel >= 64) {
            throw new Error("[Recorder] Invalid channel number " + channel);
        }
        osn.Global.setOutputSource(channel, obsInput);
    };
    /**
     * Remove a single audio source to the OBS scene.
     */
    Recorder.prototype.removeAudioSourceOBS = function (obsInput, channel) {
        if (!this.obsInitialized) {
            throw new Error('[Recorder] OBS not initialized');
        }
        console.info('[Recorder] Removing OBS audio source', obsInput.name, obsInput.id);
        osn.Global.setOutputSource(channel, null);
        obsInput.release();
        obsInput.remove();
    };
    Recorder.prototype.shutdownOBS = function () {
        console.info('[Recorder] OBS shutting down', this.uuid);
        if (!this.obsInitialized) {
            console.info('[Recorder] OBS not initialized so not attempting shutdown');
        }
        if (this.videoSourceSizeInterval) {
            clearInterval(this.videoSourceSizeInterval);
        }
        if (this.videoSource) {
            osn.Global.setOutputSource(1, null);
            this.videoSource.release();
            this.videoSource.remove();
        }
        this.wroteQueue.empty();
        this.wroteQueue.clearListeners();
        try {
            osn.NodeObs.InitShutdownSequence();
            osn.NodeObs.RemoveSourceCallback();
            osn.NodeObs.OBS_service_removeCallback();
            osn.NodeObs.IPC.disconnect();
        }
        catch (e) {
            throw new Error("Exception shutting down OBS process: " + e);
        }
        this.obsInitialized = false;
        this.obsConfigured = false;
        console.info('[Recorder] OBS shut down successfully');
    };
    /**
     * Start recording for real, this basically just cancels pending
     * buffer recording restarts. We don't need to actually start OBS
     * recording as it's should already be running (or just about to
     * start if we hit this in the restart window).
     */
    Recorder.prototype.start = function () {
        console.info('[Recorder] Start recording by cancelling buffer restart');
        var ready = !this.isRecording && this.obsState === "recording" /* Recording */;
        if (!ready) {
            console.warn('[LogHandler] Not ready to record an activity, no-op', this.isRecording, this.obsState);
            return;
        }
        this.updateStatusIcon(types_1.RecStatus.Recording);
        this.cancelBufferTimers(true, false);
        this._isRecording = true;
    };
    /**
     * Stop recording, no-op if not already recording.
     *
     * @param {Activity} activity the details of the recording
     * @param {boolean} closedWow if wow has just been closed
     */
    Recorder.prototype.stop = function (activity, closedWow) {
        if (closedWow === void 0) { closedWow = false; }
        return __awaiter(this, void 0, void 0, function () {
            var metadata, message, bufferFile, relativeStart;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.info('[Recorder] Stop called');
                        if (!this._isRecording) {
                            console.warn('[Recorder] Stop recording called but not recording');
                            return [2 /*return*/];
                        }
                        if (!this.obsRecordingFactory) {
                            console.warn('[Recorder] Stop called but no recording factory');
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, this.stopOBS()];
                    case 1:
                        _a.sent();
                        this._isRecording = false;
                        try {
                            metadata = activity.getMetadata();
                        }
                        catch (error) {
                            message = void 0;
                            if (error instanceof Error) {
                                message = error.message;
                            }
                            else {
                                message = String(error);
                            }
                            console.warn('[Recorder] Discarding video as failed to get Metadata:', message);
                        }
                        if (metadata !== undefined) {
                            bufferFile = this.obsRecordingFactory.lastFile();
                            relativeStart = (activity.startDate.getTime() - this._recorderStartDate.getTime()) /
                                1000;
                            if (!bufferFile) {
                                console.error("[Recorder] Unable to get the last recording from OBS. Can't process video.");
                                return [2 /*return*/];
                            }
                            this.videoProcessQueue.queueVideo(bufferFile, metadata, activity.getFileName(), relativeStart);
                        }
                        // Restart the buffer recording ready for next game. If this function
                        // has been called due to the wow process ending, don't start the buffer.
                        if (!closedWow) {
                            setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    this.startBuffer();
                                    return [2 /*return*/];
                                });
                            }); }, 5000);
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Force stop a recording, throwing it away entirely.
     */
    Recorder.prototype.forceStop = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this._isRecording)
                            return [2 /*return*/];
                        return [4 /*yield*/, this.stopOBS()];
                    case 1:
                        _a.sent();
                        this._isRecording = false;
                        // Restart the buffer recording ready for next game.
                        setTimeout(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                this.startBuffer();
                                return [2 /*return*/];
                            });
                        }); }, 5000);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Clean-up the buffer directory.
     * @params Number of files to leave.
     */
    Recorder.prototype.cleanupBuffer = function (filesToLeave) {
        return __awaiter(this, void 0, void 0, function () {
            var videosToDelete;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.bufferStorageDir) {
                            console.info('[Recorder] Not attempting to clean-up');
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, util_1.getSortedVideos(this.bufferStorageDir)];
                    case 1:
                        videosToDelete = _a.sent();
                        if (!videosToDelete || videosToDelete.length === 0)
                            return [2 /*return*/];
                        videosToDelete.slice(filesToLeave).forEach(function (v) { return util_1.deleteVideo(v.name); });
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Tell OBS to start recording, and assert it signals that it has.
     */
    Recorder.prototype.startOBS = function () {
        console.info('[Recorder] Start OBS called');
        if (!this.obsRecordingFactory) {
            console.warn('[Recorder] StartOBS called but no recording factory');
            return;
        }
        if (this.obsState !== "offline" /* Offline */) {
            console.warn("[Recorder] OBS can't start, current state is: " + this.obsState);
            return;
        }
        this.obsRecordingFactory.start();
    };
    /**
     * Tell OBS to stop recording, and assert it signals that it has.
     */
    Recorder.prototype.stopOBS = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.info('[Recorder] Stop OBS called');
                        if (!this.obsRecordingFactory) {
                            console.warn('[Recorder] stopOBS called but no recording factory');
                            return [2 /*return*/];
                        }
                        if (this.obsState !== "recording" /* Recording */) {
                            console.warn("[Recorder] OBS can't stop, current state is: " + this.obsState);
                            return [2 /*return*/];
                        }
                        this.obsRecordingFactory.stop();
                        // Wait up to 30 seconds for OBS to signal it has wrote the file,
                        // otherwise, throw an exception.
                        return [4 /*yield*/, Promise.race([
                                this.wroteQueue.shift(),
                                new Promise(function (_resolve, reject) {
                                    return setTimeout(reject, 30000, '[Recorder] OBS timeout waiting for video file');
                                }),
                            ])];
                    case 1:
                        // Wait up to 30 seconds for OBS to signal it has wrote the file,
                        // otherwise, throw an exception.
                        _a.sent();
                        // Empty the queue for good measure.
                        this.wroteQueue.empty();
                        console.info('[Recorder] Wrote signal received from signal queue');
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get a list of the audio input devices. Used by the settings to populate
     * the list of devices for user selection.
     */
    Recorder.prototype.getInputAudioDevices = function () {
        console.info('[Recorder] Getting available input devices');
        if (!this.obsInitialized) {
            throw new Error('[Recorder] OBS not initialized');
        }
        var inputDevices = osn.NodeObs.OBS_settings_getInputAudioDevices();
        return inputDevices.filter(function (v) { return v.id !== 'default'; });
    };
    /**
     * Get a list of the audio output devices. Used by the settings to populate
     * the list of devices for user selection.
     */
    Recorder.prototype.getOutputAudioDevices = function () {
        console.info('[Recorder] Getting available output devices');
        if (!this.obsInitialized) {
            throw new Error('[Recorder] OBS not initialized');
        }
        var outputDevices = osn.NodeObs.OBS_settings_getOutputAudioDevices();
        return outputDevices.filter(function (v) { return v.id !== 'default'; });
    };
    /**
     * Create an OBS audio source.
     */
    Recorder.prototype.createOBSAudioSource = function (id, type) {
        console.info('[Recorder] Creating OBS audio source', id, type);
        if (!this.obsInitialized) {
            throw new Error('[Recorder] OBS not initialized');
        }
        return osn.InputFactory.create(type, type === types_1.TAudioSourceType.input ? 'mic-audio' : 'desktop-audio', { device_id: id });
    };
    /**
     * Return an array of all the encoders available to OBS.
     */
    Recorder.prototype.getAvailableEncoders = function () {
        console.info('[Recorder] Getting available encoders');
        if (!this.obsInitialized) {
            throw new Error('[Recorder] OBS not initialized');
        }
        var encoders = osn.VideoEncoderFactory.types();
        console.info('[Recorder]', encoders);
        return encoders;
    };
    /**
     * Set up an interval to run the scaleVideoSourceSize function.
     */
    Recorder.prototype.watchVideoSourceSize = function () {
        var _this = this;
        if (!this.obsInitialized) {
            throw new Error('[Recorder] OBS not initialized');
        }
        if (this.videoSourceSizeInterval) {
            clearInterval(this.videoSourceSizeInterval);
        }
        this.videoSourceSizeInterval = setInterval(function () {
            _this.scaleVideoSourceSize();
        }, 5000);
    };
    /**
     * Watch the video input source for size changes. This only matters for
     * doing game capture on a windowed instance of WoW, such that we'll scale
     * it to the size of the output video if it's resized by the player.
     */
    Recorder.prototype.scaleVideoSourceSize = function () {
        if (!this.videoSource) {
            throw new Error('[Recorder] videoSource was undefined');
        }
        if (!this.sceneItem) {
            throw new Error('[Recorder] sceneItem was undefined');
        }
        if (this.videoSource.width === 0) {
            // This happens often, suspect it's before OBS gets a hook into a game capture process.
            return;
        }
        var width = constants_1.obsResolutions[this.resolution].width;
        var scaleFactor = Math.round((width / this.videoSource.width) * 100) / 100;
        if (scaleFactor !== this.videoScaleFactor) {
            console.info('[Recorder] Rescaling OBS video from', this.videoScaleFactor, 'to', scaleFactor);
            this.videoScaleFactor = scaleFactor;
            this.sceneItem.scale = { x: scaleFactor, y: scaleFactor };
        }
    };
    Recorder.prototype.updateStatusIcon = function (status) {
        this.mainWindow.webContents.send('updateRecStatus', status);
    };
    return Recorder;
}());
exports["default"] = Recorder;
