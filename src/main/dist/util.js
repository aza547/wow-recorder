"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.tryUnlinkSync = exports.getSortedFiles = exports.getAvailableDisplays = exports.getSortedVideos = exports.addColor = exports.fixPathWhenPackaged = exports.toggleVideoProtected = exports.openSystemExplorer = exports.deleteVideo = exports.runSizeMonitor = exports.writeMetadataFile = exports.loadAllVideos = exports.resolveHtmlPath = void 0;
/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
var url_1 = require("url");
var path_1 = require("path");
var constants_1 = require("./constants");
var byteSize = require('byte-size');
var chalk = require('chalk');
/**
 * When packaged, we need to fix some paths
 */
var fixPathWhenPackaged = function (path) {
    return path.replace("app.asar", "app.asar.unpacked");
};
exports.fixPathWhenPackaged = fixPathWhenPackaged;
var exec = require('child_process').exec;
var util_1 = require("util");
var fs_1 = require("fs");
var glob_1 = require("glob");
var fs_2 = require("fs");
var types_1 = require("./types");
var electron_1 = require("electron");
var globPromise = util_1["default"].promisify(glob_1["default"]);
var videoIndex = {};
if (process.env.NODE_ENV === 'development') {
    var port_1 = process.env.PORT || 1212;
    exports.resolveHtmlPath = function (htmlFileName) {
        var url = new url_1.URL("http://localhost:" + port_1);
        url.pathname = htmlFileName;
        return url.href;
    };
}
else {
    exports.resolveHtmlPath = function (htmlFileName) {
        return "file://" + path_1["default"].resolve(__dirname, '../renderer/', htmlFileName);
    };
}
/**
 * Empty video state.
 */
var getEmptyState = function () {
    var videoState = {};
    constants_1.categories.forEach(function (category) { return videoState[category] = []; });
    return videoState;
};
/**
 * Load videos from category folders in reverse chronological order.
 */
var loadAllVideos = function (storageDir) { return __awaiter(void 0, void 0, Promise, function () {
    var videoState, videos;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                videoState = getEmptyState();
                if (!storageDir) {
                    return [2 /*return*/, videoState];
                }
                return [4 /*yield*/, getSortedVideos(storageDir)];
            case 1:
                videos = _a.sent();
                if (videos.length == 0) {
                    return [2 /*return*/, videoState];
                }
                constants_1.categories.forEach(function (category) { return videoIndex[category] = 0; });
                videos.forEach(function (video) {
                    var details = loadVideoDetails(video);
                    if (!details) {
                        return;
                    }
                    var category = details.category;
                    videoState[category].push(__assign({ index: videoIndex[category]++ }, details));
                });
                return [2 /*return*/, videoState];
        }
    });
}); };
exports.loadAllVideos = loadAllVideos;
/**
 * Load video details from the metadata and add it to videoState.
 */
var loadVideoDetails = function (video) {
    var metadata = getMetadataForVideo(video.name);
    if (metadata === undefined) {
        // Don't bother loading videos without metadata. 
        return;
    }
    if (!constants_1.categories.includes(metadata.category)) {
        // Don't try to load a category we don't know about.
        return;
    }
    ;
    var videoDate = new Date(video.mtime);
    var videoData = __assign(__assign({ fullPath: video.name }, metadata), { date: getVideoDate(videoDate), time: getVideoTime(videoDate), protected: Boolean(metadata.protected) });
    return videoData;
};
/**
 * Get the date a video was recorded from the date object.
 */
var getMetadataForVideo = function (video) {
    var metadataFile = getMetadataFileForVideo(video);
    if (!fs_2["default"].existsSync(metadataFile)) {
        console.error("[Util] Metadata file does not exist: " + metadataFile);
        return undefined;
    }
    try {
        var metadataJSON = fs_2["default"].readFileSync(metadataFile);
        return JSON.parse(metadataJSON.toString());
    }
    catch (e) {
        console.error("[Util] Unable to read and/or parse JSON from metadata file: " + metadataFile);
    }
};
/**
 * Writes video metadata asynchronously and returns a Promise
 */
var writeMetadataFile = function (videoPath, metadata) { return __awaiter(void 0, void 0, void 0, function () {
    var metadataFileName, jsonString;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                metadataFileName = getMetadataFileForVideo(videoPath);
                jsonString = JSON.stringify(metadata, null, 2);
                return [4 /*yield*/, fs_1.promises.writeFile(metadataFileName, jsonString, {
                        encoding: 'utf-8'
                    })];
            case 1: return [2 /*return*/, _a.sent()];
        }
    });
}); };
exports.writeMetadataFile = writeMetadataFile;
/**
 * Get the filename for the metadata file associated with the given video file
 */
var getMetadataFileForVideo = function (video) {
    var videoFileName = path_1["default"].basename(video, '.mp4');
    var videoDirName = path_1["default"].dirname(video);
    return path_1["default"].join(videoDirName, videoFileName + '.json');
};
/**
 * Get the date a video was recorded from the date object.
 */
var getVideoDate = function (date) {
    var day = date.getDate();
    var month = constants_1.months[date.getMonth()].slice(0, 3);
    var dateAsString = day + " " + month;
    return dateAsString;
};
/**
 * Get the time a video was recorded from the date object.
 */
var getVideoTime = function (date) {
    var hours = date.getHours().toLocaleString('en-US', { minimumIntegerDigits: 2 });
    var mins = date.getMinutes().toLocaleString('en-US', { minimumIntegerDigits: 2 });
    var timeAsString = hours + ":" + mins;
    return timeAsString;
};
/**
 * Return information about a file needed for various parts of the application
 */
var getFileInfo = function (filePath) { return __awaiter(void 0, void 0, Promise, function () {
    var fstats, mtime, size;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                filePath = path_1["default"].resolve(filePath);
                return [4 /*yield*/, fs_1.promises.stat(filePath)];
            case 1:
                fstats = _a.sent();
                mtime = fstats.mtime.getTime();
                size = fstats.size;
                return [2 /*return*/, { name: filePath, size: size, mtime: mtime }];
        }
    });
}); };
/**
 * Asynchronously find and return a list of files in the given directory, that matches
 * the given pattern (e.g '*.mp4'), sorted by modification time according to `sortDirection`.
 */
var getSortedFiles = function (dir, pattern, sortDirection) {
    if (sortDirection === void 0) { sortDirection = types_1.FileSortDirection.NewestFirst; }
    return __awaiter(void 0, void 0, Promise, function () {
        var files, mappedFiles;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, globPromise(path_1["default"].join(dir, pattern))];
                case 1:
                    files = (_a.sent())
                        .map(getFileInfo);
                    return [4 /*yield*/, Promise.all(files)];
                case 2:
                    mappedFiles = _a.sent();
                    if (sortDirection === types_1.FileSortDirection.NewestFirst) {
                        return [2 /*return*/, mappedFiles.sort(function (A, B) { return B.mtime - A.mtime; })];
                    }
                    return [2 /*return*/, mappedFiles.sort(function (A, B) { return A.mtime - B.mtime; })];
            }
        });
    });
};
exports.getSortedFiles = getSortedFiles;
/**
 * Get sorted video files. Shorthand for `getSortedFiles()` because it's used in quite a few places
 */
var getSortedVideos = function (storageDir, sortDirection) {
    if (sortDirection === void 0) { sortDirection = types_1.FileSortDirection.NewestFirst; }
    return __awaiter(void 0, void 0, Promise, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, getSortedFiles(storageDir, '*.mp4', sortDirection)];
        });
    });
};
exports.getSortedVideos = getSortedVideos;
/**
 * Asynchronously delete the oldest, unprotected videos to ensure we don't store
 * more material than the user has allowed us.
 */
var runSizeMonitor = function (storageDir, maxStorageGB) { return __awaiter(void 0, void 0, Promise, function () {
    var videoToDelete, maxStorageBytes, files, danglingFiles, unprotectedFiles, totalVideoFileSize, filesOverMaxStorage;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                maxStorageBytes = maxStorageGB * Math.pow(1024, 3);
                console.debug("[Size Monitor] Running (max size = " + byteSize(maxStorageBytes) + ")");
                if (maxStorageGB == 0) {
                    console.debug("[Size Monitor] Limitless storage, doing nothing");
                    return [2 /*return*/];
                }
                return [4 /*yield*/, getSortedVideos(storageDir)];
            case 1:
                files = _a.sent();
                files = files.map(function (file) {
                    var metadata = getMetadataForVideo(file.name);
                    return __assign(__assign({}, file), { metadata: metadata });
                });
                danglingFiles = files.filter(function (file) { return !file.hasOwnProperty('metadata') || !file.metadata; });
                unprotectedFiles = files.filter(function (file) { return file.hasOwnProperty('metadata') && file.metadata && !Boolean(file.metadata.protected); });
                if (danglingFiles.length !== 0) {
                    console.log("[Size Monitor] Deleting " + danglingFiles.length + " dangling video(s)");
                    while (videoToDelete = danglingFiles.pop()) {
                        console.log("[Size Monitor] Delete dangling video: " + videoToDelete.name);
                        deleteVideo(videoToDelete.name);
                    }
                }
                totalVideoFileSize = 0;
                filesOverMaxStorage = unprotectedFiles.filter(function (file) {
                    totalVideoFileSize += file.size;
                    return totalVideoFileSize > maxStorageBytes;
                });
                // Calculate total file size of all unprotected files
                totalVideoFileSize = unprotectedFiles
                    .map(function (file) { return file.size; })
                    .reduce(function (prev, curr) { return prev + curr; }, 0);
                console.log("[Size Monitor] Unprotected file(s) considered " + unprotectedFiles.length + ", total size = " + byteSize(totalVideoFileSize));
                if (filesOverMaxStorage.length === 0) {
                    return [2 /*return*/];
                }
                console.log("[Size Monitor] Deleting " + filesOverMaxStorage.length + " old video(s)");
                while (videoToDelete = filesOverMaxStorage.pop()) {
                    console.log("[Size Monitor] Delete oldest video: " + videoToDelete.name + " (" + byteSize(videoToDelete.size) + ")");
                    deleteVideo(videoToDelete.name);
                }
                return [2 /*return*/];
        }
    });
}); };
exports.runSizeMonitor = runSizeMonitor;
/**
 * Try to unlink a file and return a boolean indicating the success
 * Logs any errors to the console, if the file couldn't be deleted for some reason.
 */
var tryUnlinkSync = function (file) {
    try {
        console.log("[Util] Deleting: " + file);
        fs_2["default"].unlinkSync(file);
        return true;
    }
    catch (e) {
        console.error("[Util] Unable to delete file: " + file + ".");
        console.error(e.message);
        return false;
    }
};
exports.tryUnlinkSync = tryUnlinkSync;
/**
 * Delete a video and its metadata file if it exists.
 */
var deleteVideo = function (videoPath) {
    // If we can't delete the video file, make sure we don't delete the metadata
    // file either, which would leave the video file dangling.
    if (!tryUnlinkSync(videoPath)) {
        return;
    }
    var metadataPath = getMetadataFileForVideo(videoPath);
    if (fs_2["default"].existsSync(metadataPath)) {
        tryUnlinkSync(metadataPath);
    }
};
exports.deleteVideo = deleteVideo;
/**
 * Open a folder in system explorer.
 */
var openSystemExplorer = function (filePath) {
    var windowsPath = filePath.replace(/\//g, "\\");
    var cmd = 'explorer.exe /select,"' + windowsPath + '"';
    exec(cmd, function () { });
};
exports.openSystemExplorer = openSystemExplorer;
/**
 * Put a save marker on a video, protecting it from the file monitor.
 */
var toggleVideoProtected = function (videoPath) {
    var metadata = getMetadataForVideo(videoPath);
    if (!metadata) {
        console.error("[Util] Metadata not found for '" + videoPath + "', but somehow we managed to load it. This shouldn't happen.");
        return;
    }
    if (metadata.protected === undefined) {
        metadata.protected = true;
    }
    else {
        metadata.protected = !Boolean(metadata.protected);
    }
    writeMetadataFile(videoPath, metadata);
};
exports.toggleVideoProtected = toggleVideoProtected;
/**
 *  Add some escape characters to color text. Just return the string
 *  if production as don't want to litter real logs with this as it just
 *  looks messy.
 */
var addColor = function (s, color) {
    if (process.env.NODE_ENV === 'production')
        return s;
    if (color === "cyan") {
        return chalk.cyan(s);
    }
    else if (color === "green") {
        return chalk.green(s);
    }
    else {
        return s;
    }
};
exports.addColor = addColor;
/**
 * Get a text string that indicates the physical position of a display depending
 * on its index.
 */
var getDisplayPhysicalPosition = function (count, index) {
    if (index === 0)
        return 'Left';
    if (index === count - 1)
        return 'Right';
    return 'Middle #' + index;
};
/**
 * Get and return a list of available displays on the system sorted by their
 * physical position.
 *
 * This makes no attempts at being perfect - it completely ignores the `bounds.y`
 * property for people who might have stacked their displays vertically rather than
 * horizontally. This is okay.
 */
var getAvailableDisplays = function () {
    var primaryDisplay = electron_1.screen.getPrimaryDisplay();
    var allDisplays = electron_1.screen.getAllDisplays();
    // Create an unsorted list of Display IDs to zero based monitor index
    // So we're can use that index later, after sorting the displays according
    // to their physical location.
    var displayIdToIndex = {};
    allDisplays.forEach(function (display, index) { return displayIdToIndex[display.id] = index; });
    // Iterate over all available displays and make our own list with the
    // relevant attributes and some extra stuff to make it easier for the
    // frontend.
    var ourDisplays = [];
    var numberOfMonitors = allDisplays.length;
    allDisplays
        .sort(function (A, B) { return A.bounds.x - B.bounds.x; })
        .forEach(function (display, index) {
        var isPrimary = display.id === primaryDisplay.id;
        var displayIndex = displayIdToIndex[display.id];
        var _a = display.size, width = _a.width, height = _a.height;
        ourDisplays.push({
            id: display.id,
            index: displayIndex,
            physicalPosition: getDisplayPhysicalPosition(numberOfMonitors, index),
            primary: isPrimary,
            displayFrequency: display.displayFrequency,
            depthPerComponent: display.depthPerComponent,
            size: display.size,
            scaleFactor: display.scaleFactor,
            aspectRatio: width / height,
            physicalSize: {
                width: Math.floor(width * display.scaleFactor),
                height: Math.floor(height * display.scaleFactor)
            }
        });
    });
    return ourDisplays;
};
exports.getAvailableDisplays = getAvailableDisplays;
