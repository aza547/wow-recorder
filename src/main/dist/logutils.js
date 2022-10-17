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
exports.forceStopRecording = exports.runRecordingTest = exports.pollWowProcess = exports.watchLogs = void 0;
/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
var combatant_1 = require("./combatant");
var main_1 = require("./main");
var constants_1 = require("./constants");
var types_1 = require("./types");
var keystone_1 = require("./keystone");
var combatLogParser_1 = require("./combatLogParser");
var util_1 = require("./util");
var configService_1 = require("./configService");
var cfg = configService_1["default"].getInstance();
var tasklist = require('tasklist');
var videoStartDate;
var videoStopDate;
var metadata;
var combatantMap = new Map();
var playerCombatant;
var testRunning = false;
var activeChallengeMode;
var currentActivity;
/**
 * Parser and handler for WoW combat log files
 * If no data has been received for 'dataTimeout' milliseconds, an event
 * will be emitted ('DataTimeout') to be able to clean up whatever was going on.
 */
var combatLogParser = new combatLogParser_1.CombatLogParser({
    dataTimeout: 2 * 60 * 1000,
    fileFinderFn: util_1.getSortedFiles
});
/**
 * Log line handlers attached to their respective combat log event types.
 * Any combat log event is valid here.
 *
 * Callback signature is:
 *
 * (line: LogLine, flavour: string)
 *
 * 'flavour' is the WoW flavour like 'wow_classic', 'wow' (retail)
 */
combatLogParser
    .on('ARENA_MATCH_START', handleArenaStartLine)
    .on('ARENA_MATCH_END', handleArenaStopLine)
    .on('CHALLENGE_MODE_START', handleChallengeModeStartLine)
    .on('CHALLENGE_MODE_END', handleChallengeModeEndLine)
    .on('ENCOUNTER_START', handleEncounterStartLine)
    .on('ENCOUNTER_END', handleEncounterStopLine)
    .on('ZONE_CHANGE', handleZoneChange)
    .on('COMBATANT_INFO', handleCombatantInfoLine)
    .on('SPELL_AURA_APPLIED', handleSpellAuraAppliedLine)
    .on('UNIT_DIED', handleUnitDiedLine);
// If we haven't received data in a while, we're probably AFK and should stop recording.
combatLogParser.on('DataTimeout', function (timeoutMs) {
    console.log("[CombatLogParser] Haven't received data for combatlog in " + timeoutMs / 1000 + " seconds.");
    /**
     * End the current challenge mode dungeon and stop recording.
     * We'll keep the video.
     */
    if (activeChallengeMode || currentActivity === constants_1.VideoCategory.Battlegrounds) {
        forceStopRecording();
        return;
    }
});
/**
 * Is wow running? Starts null but we'll check immediately on start-up.
 */
var wowProcessRunning = null;
var resetProcessTracking = function () {
    wowProcessRunning = null;
};
/**
 * Timers for poll
 */
var pollWowProcessInterval;
/**
 * Handle WoW process starting.
 */
var wowProcessStarted = function (process) {
    wowProcessRunning = process;
    console.log("[Logutils] Detected " + process.exe + " (" + process.flavour + ") running");
    main_1.recorder.startBuffer();
};
/**
 * Handle WoW process stopping.
 */
var wowProcessStopped = function () {
    if (!wowProcessRunning) {
        return;
    }
    console.log("[Logutils] Detected " + wowProcessRunning.exe + " (" + wowProcessRunning.flavour + ") not running");
    wowProcessRunning = null;
    if (main_1.recorder.isRecording) {
        endRecording();
    }
    else if (main_1.recorder.isRecordingBuffer) {
        main_1.recorder.stopBuffer();
    }
};
/**
 * Check and return whether we're allowed to record a certain type of content
 */
var allowRecordCategory = function (category) {
    var categoryConfig = constants_1.categoryRecordingSettings[category];
    if (!cfg.get(categoryConfig.configKey)) {
        if (!testRunning) {
            console.log("[Logutils] Configured to not record", category);
            return false;
        }
        console.log("[Logutils] Configured to not record " + category + ", but test is running so recording anyway.");
    }
    ;
    return true;
};
/**
 * Initiate recording and mark as having something in-progress
 */
var startRecording = function (category) {
    if (!allowRecordCategory(category)) {
        console.info("[LogUtils] Not configured to record", category);
        return;
    }
    else if (main_1.recorder.isRecording || !main_1.recorder.isRecordingBuffer) {
        console.error("[LogUtils] Avoiding error by not attempting to start recording", main_1.recorder.isRecording, main_1.recorder.isRecordingBuffer);
        return;
    }
    console.log("[Logutils] Start recording a video for category: " + category);
    // Ensure combatant map and player combatant is clean before
    // starting a new recording.
    clearCombatants();
    currentActivity = category;
    main_1.recorder.start();
};
/**
 * Stop recording and mark as not doing anything.
 */
var endRecording = function (options) {
    var _a;
    if (!main_1.recorder.isRecording || !currentActivity) {
        console.error("[LogUtils] Avoiding error by not attempting to stop recording");
        return;
    }
    if (!videoStopDate) {
        videoStopDate = new Date();
    }
    var overrun = constants_1.categoryRecordingSettings[currentActivity].videoOverrun;
    var videoDuration = (videoStopDate.getTime() - videoStartDate.getTime());
    metadata.duration = Math.round(videoDuration / 1000) + overrun;
    metadata.result = (_a = options === null || options === void 0 ? void 0 : options.result) !== null && _a !== void 0 ? _a : false;
    console.log("[Logutils] Stop recording video for category: " + currentActivity);
    main_1.recorder.stop(metadata, overrun);
    currentActivity = undefined;
};
/**
 * Handle a line from the WoW log.
 */
function handleArenaStartLine(line) {
    if (main_1.recorder.isRecording)
        return;
    var category = line.arg(3);
    var zoneID = parseInt(line.arg(1), 10);
    // If all goes to plan we don't need this but we do it incase the game
    // crashes etc. so we can still get a reasonable duration.
    videoStartDate = line.date();
    metadata = {
        name: "name",
        category: category,
        zoneID: zoneID,
        duration: 0,
        result: false,
        playerDeaths: []
    };
    startRecording(category);
}
/**
 * Handle a line from the WoW log.
 */
function handleArenaStopLine(line) {
    if (!main_1.recorder.isRecording)
        return;
    videoStopDate = line.date();
    var _a = determineArenaMatchResult(line), result = _a[0], MMR = _a[1];
    metadata.teamMMR = MMR;
    endRecording({ result: result });
}
/**
 * Determines the arena match result.
 * @param line the line from the WoW log.
 * @returns [win: boolean, newRating: number]
 */
var determineArenaMatchResult = function (line) {
    if (playerCombatant === undefined)
        return [undefined, undefined];
    var teamID = playerCombatant.teamID;
    var indexForMMR = (teamID == 0) ? 3 : 4;
    var MMR = parseInt(line.arg(indexForMMR), 10);
    var winningTeamID = parseInt(line.arg(1), 10);
    var win = (teamID === winningTeamID);
    return [win, MMR];
};
/**
 * Handle a log line for CHALLENGE_MODE_START
 */
function handleChallengeModeStartLine(line) {
    // It's impossible to start a keystone dungeon while another one is in progress
    // so we'll just remove the existing one and make a new one when `CHALLENGE_MODE_START`
    // is encountered.
    if (activeChallengeMode) {
        console.warn("[ChallengeMode] A Challenge Mode instance is already in progress; abandoning it.");
    }
    videoStartDate = line.date();
    var zoneName = line.arg(2);
    var mapId = parseInt(line.arg(3), 10);
    var hasDungeonMap = (mapId in constants_1.dungeonsByMapId);
    var hasTimersForDungeon = (mapId in constants_1.dungeonTimersByMapId);
    if (!hasDungeonMap || !hasTimersForDungeon) {
        console.error("[ChallengeMode] Invalid/unsupported mapId for Challenge Mode dungeon: " + mapId + " ('" + zoneName + "')");
    }
    var dungeonAffixes = line.arg(5).map(function (v) { return parseInt(v, 10); });
    activeChallengeMode = new keystone_1.ChallengeModeDungeon(constants_1.dungeonTimersByMapId[mapId], // Dungeon timers
    parseInt(line.arg(2), 10), // zoneId
    mapId, // mapId
    parseInt(line.arg(4), 10), // Keystone Level
    dungeonAffixes);
    activeChallengeMode.addTimelineSegment(new keystone_1.ChallengeModeTimelineSegment(keystone_1.TimelineSegmentType.Trash, videoStartDate, 0));
    console.debug("[ChallengeMode] Starting Challenge Mode instance");
    metadata = {
        name: line.arg(1),
        encounterID: parseInt(line.arg(1), 10),
        category: constants_1.VideoCategory.MythicPlus,
        zoneID: parseInt(line.arg(5)),
        duration: 0,
        result: false,
        challengeMode: activeChallengeMode,
        playerDeaths: []
    };
    startRecording(constants_1.VideoCategory.MythicPlus);
}
;
var endChallengeModeDungeon = function () {
    if (!activeChallengeMode) {
        return;
    }
    console.debug("[ChallengeMode] Ending current timeline segment");
    activeChallengeMode.endCurrentTimelineSegment(videoStopDate);
    // If last timeline segment is less than 10 seconds long, discard it.
    // It's probably not useful
    var lastTimelineSegment = activeChallengeMode.getCurrentTimelineSegment();
    if (lastTimelineSegment && lastTimelineSegment.length() < 10000) {
        console.debug("[ChallengeMode] Removing last timeline segment because it's too short.");
        activeChallengeMode.removeLastTimelineSegment();
    }
    console.debug("[ChallengeMode] Ending Challenge Mode instance");
    activeChallengeMode = undefined;
};
/**
 * Handle a log line for CHALLENGE_MODE_END
 */
function handleChallengeModeEndLine(line) {
    if (!main_1.recorder.isRecording || !activeChallengeMode) {
        return;
    }
    videoStopDate = line.date();
    // The actual log duration of the dungeon, from which keystone upgrade
    // levels can be calculated.
    //
    // It's included separate from `metadata.duration` because the duration of the
    // dungeon, as the game sees it, is what is important for this value to make sense.
    activeChallengeMode.duration = Math.round(parseInt(line.arg(4), 10) / 1000);
    // Calculate whether the key was timed or not
    activeChallengeMode.timed = keystone_1.ChallengeModeDungeon.calculateKeystoneUpgradeLevel(activeChallengeMode.allottedTime, activeChallengeMode.duration) > 0;
    endChallengeModeDungeon();
    var result = Boolean(parseInt(line.arg(1)));
    endRecording({ result: result });
}
;
var getRelativeTimestampForTimelineSegment = function (currentDate) {
    if (!videoStartDate) {
        return 0;
    }
    return (currentDate.getTime() - videoStartDate.getTime()) / 1000;
};
/**
 * Handle a line from the WoW log.
 */
function handleEncounterStartLine(line) {
    var encounterID = parseInt(line.arg(1), 10);
    var difficultyID = parseInt(line.arg(3), 10);
    var eventDate = line.date();
    // If we're recording _and_ has an active challenge mode dungeon,
    // add a new boss encounter timeline segment.
    if (main_1.recorder.isRecording && activeChallengeMode) {
        var vSegment = new keystone_1.ChallengeModeTimelineSegment(keystone_1.TimelineSegmentType.BossEncounter, eventDate, getRelativeTimestampForTimelineSegment(eventDate), encounterID);
        activeChallengeMode.addTimelineSegment(vSegment, eventDate);
        console.debug("[ChallengeMode] Starting new boss encounter: " + constants_1.dungeonEncounters[encounterID]);
        return;
    }
    videoStartDate = eventDate;
    metadata = {
        name: "name",
        category: constants_1.VideoCategory.Raids,
        encounterID: encounterID,
        difficultyID: difficultyID,
        duration: 0,
        result: false,
        playerDeaths: []
    };
    startRecording(constants_1.VideoCategory.Raids);
}
/**
 * Handle a line from the WoW log.
 */
function handleEncounterStopLine(line) {
    var eventDate = line.date();
    var result = Boolean(parseInt(line.arg(5), 10));
    var encounterID = parseInt(line.arg(1), 10);
    if (main_1.recorder.isRecording && activeChallengeMode) {
        var currentSegment = activeChallengeMode.getCurrentTimelineSegment();
        if (currentSegment) {
            currentSegment.result = result;
        }
        var vSegment = new keystone_1.ChallengeModeTimelineSegment(keystone_1.TimelineSegmentType.Trash, eventDate, getRelativeTimestampForTimelineSegment(eventDate));
        // Add a trash segment as the boss encounter ended
        activeChallengeMode.addTimelineSegment(vSegment, eventDate);
        console.debug("[ChallengeMode] Ending boss encounter: " + constants_1.dungeonEncounters[encounterID]);
        return;
    }
    videoStopDate = eventDate;
    endRecording({ result: result });
}
/**
 * Handle a line from the WoW log.
 */
function handleZoneChange(line, flavour) {
    console.log("[Logutils] Handling zone change", line);
    var zoneID = parseInt(line.arg(1), 10);
    var isNewZoneBG = constants_1.battlegrounds.hasOwnProperty(zoneID);
    var isRecording = main_1.recorder.isRecording;
    // const classicArenas = [
    //     617, // Dalaran
    //     572, // Ruins
    //     559, // Nagrand 
    // ];
    var isRecordingBG = false;
    var isRecordingArena = false;
    if (metadata !== undefined) {
        isRecordingBG = (metadata.category === constants_1.VideoCategory.Battlegrounds);
        isRecordingArena = (metadata.category === constants_1.VideoCategory.TwoVTwo) ||
            (metadata.category === constants_1.VideoCategory.ThreeVThree) ||
            (metadata.category === constants_1.VideoCategory.SoloShuffle) ||
            (metadata.category === constants_1.VideoCategory.Skirmish);
    }
    if (!isRecording && isNewZoneBG) {
        console.log("[Logutils] ZONE_CHANGE into BG");
        battlegroundStart(line);
        return;
    }
    if (isRecording && isRecordingBG && !isNewZoneBG) {
        console.log("[Logutils] ZONE_CHANGE out of BG, stop recording");
        battlegroundStop(line);
        return;
    }
    if (isRecording && isRecordingArena) {
        console.log("[Logutils] ZONE_CHANGE out of arena, stop recording");
        zoneChangeStop(line);
        return;
    }
}
/**
 * Handles the SPELL_AURA_APPLIED line from WoW log.
 * @param line the SPELL_AURA_APPLIED line
 */
function handleSpellAuraAppliedLine(line) {
    if (playerCombatant)
        return;
    if (combatantMap.size === 0)
        return;
    var srcGUID = line.arg(1);
    var srcNameRealm = line.arg(2);
    var srcFlags = parseInt(line.arg(3), 16);
    var srcCombatant = combatantMap.get(srcGUID);
    if (srcCombatant === undefined)
        return;
    if (isUnitSelf(srcFlags)) {
        var _a = ambiguate(srcNameRealm), srcName = _a[0], srcRealm = _a[1];
        srcCombatant.name = srcName;
        srcCombatant.realm = srcRealm;
        playerCombatant = srcCombatant;
        metadata.playerName = playerCombatant.name;
        metadata.playerRealm = playerCombatant.realm;
        metadata.playerSpecID = playerCombatant.specID;
    }
}
/**
 * Handles the COMBATANT_INFO line from WoW log by creating a Combatant and
 * adding it to combatantMap.
 * @param line the COMBATANT_INFO line
 */
function handleCombatantInfoLine(line) {
    var GUID = line.arg(1);
    var teamID = parseInt(line.arg(2), 10);
    var specID = parseInt(line.arg(24), 10);
    var combatantInfo = new combatant_1.Combatant(GUID, teamID, specID);
    combatantMap.set(GUID, combatantInfo);
}
/**
 * Return a combatant by guid, if it exists.
 */
function getCombatantByGuid(guid) {
    return combatantMap.get(guid);
}
/**
 * Clear combatants map and the current player combatant, if any.
 */
var clearCombatants = function () {
    combatantMap.clear();
    playerCombatant = undefined;
};
/**
 * ZONE_CHANGE event into a BG.
 */
function battlegroundStart(line) {
    var zoneID = parseInt(line.arg(1), 10);
    var battlegroundName = constants_1.battlegrounds[zoneID];
    videoStartDate = line.date();
    metadata = {
        name: battlegroundName,
        category: constants_1.VideoCategory.Battlegrounds,
        zoneID: zoneID,
        duration: 0,
        result: false,
        playerDeaths: []
    };
    startRecording(constants_1.VideoCategory.Battlegrounds);
}
/**
 * battlegroundStop
 */
function battlegroundStop(line) {
    videoStopDate = line.date();
    endRecording();
}
/**
 * zoneChangeStop
 */
function zoneChangeStop(line) {
    videoStopDate = line.date();
    endRecording();
}
/**
 * Register a player death in the video metadata
 */
var registerPlayerDeath = function (timestamp, name, specId) {
    // Ensure a timestamp cannot be negative
    timestamp = timestamp >= 0 ? timestamp : 0;
    metadata.playerDeaths.push({ name: name, specId: specId, timestamp: timestamp });
};
/**
 * Handle a unit dying, but only if it's a player.
 */
function handleUnitDiedLine(line) {
    var _a, _b;
    // Only handle UNIT_DIED if we have a videoStartDate AND we're recording
    // We're not interested in player deaths outside of an active activity/recording.
    if (!videoStartDate || !main_1.recorder.isRecording) {
        return;
    }
    var unitFlags = parseInt(line.arg(7), 16);
    var isUnitUnconsciousAtDeath = Boolean(parseInt(line.arg(9), 10));
    // We only want player deaths and we don't want fake deaths,
    // i.e. a hunter that feigned death
    if (!isUnitPlayer(unitFlags) || isUnitUnconsciousAtDeath) {
        return;
    }
    var playerName = line.arg(6);
    var playerGuid = line.arg(5);
    var playerSpecId = (_b = (_a = getCombatantByGuid(playerGuid)) === null || _a === void 0 ? void 0 : _a.specID) !== null && _b !== void 0 ? _b : 0;
    // Add player death and subtract 2 seconds from the time of death to allow the
    // user to view a bit of the video before the death and not at the actual millisecond
    // it happens.
    var relativeTimeStamp = ((line.date().getTime() - 2) - videoStartDate.getTime()) / 1000;
    registerPlayerDeath(relativeTimeStamp, playerName, playerSpecId);
}
/**
 * Return whether the bitmask `flags` contain the bitmask `flag`
 */
var hasFlag = function (flags, flag) {
    return (flags & flag) !== 0;
};
/**
 * Determine if the `flags` value indicate our own unit.
 * This is determined by the unit being a player and having the
 * flags `AFFILIATION_MINE` and `REACTION_FRIENDLY`.
 */
var isUnitSelf = function (flags) {
    return isUnitPlayer(flags) && (hasFlag(flags, types_1.UnitFlags.REACTION_FRIENDLY) &&
        hasFlag(flags, types_1.UnitFlags.AFFILIATION_MINE));
};
/**
* Determine if the unit is a player.
*
* See more here: https://wowpedia.fandom.com/wiki/UnitFlag
*/
var isUnitPlayer = function (flags) {
    return (hasFlag(flags, types_1.UnitFlags.CONTROL_PLAYER) &&
        hasFlag(flags, types_1.UnitFlags.TYPE_PLAYER));
};
/**
 * Split name and realm. Name stolen from:
 * https://wowpedia.fandom.com/wiki/API_Ambiguate
 * @param nameRealm string containing name and realm
 * @returns array containing name and realm
 */
var ambiguate = function (nameRealm) {
    var split = nameRealm.split("-");
    var name = split[0];
    var realm = split[1];
    return [name, realm];
};
/**
 * Forcibly stop recording and clean up whatever was going on
 */
var forceStopRecording = function () {
    videoStopDate = new Date();
    var milliSeconds = (videoStopDate.getTime() - videoStartDate.getTime());
    metadata.duration = Math.round(milliSeconds / 1000);
    // If a Keystone Dungeon is in progress, end it properly before we stop recording
    if (activeChallengeMode) {
        endChallengeModeDungeon();
    }
    // Clear all kinds of stuff that would prevent the app from starting another
    // recording
    clearCombatants();
    // Regardless of what happens above these lines, _ensure_ that these variables
    // are cleared.
    activeChallengeMode = undefined;
    testRunning = false;
    main_1.recorder.stop(metadata, 0);
};
exports.forceStopRecording = forceStopRecording;
/**
 * Watch the given directories for combat log changes.
 */
var watchLogs = function (logDirectories) {
    logDirectories.forEach(function (logdir) {
        combatLogParser.watchPath(logdir);
    });
};
exports.watchLogs = watchLogs;
/**
 * Check Windows task list and find any WoW process.
 */
var checkWoWProcess = function () { return __awaiter(void 0, void 0, Promise, function () {
    var wowProcessRx, taskList;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                wowProcessRx = new RegExp(/(wow(T|B|classic)?)\.exe/, 'i');
                return [4 /*yield*/, tasklist()];
            case 1:
                taskList = _a.sent();
                return [2 /*return*/, taskList
                        // Map all processes found to check if they match `wowProcessRx`
                        .map(function (p) { return p.imageName.match(wowProcessRx); })
                        // Remove those that result in `null` (didn't match)
                        .filter(function (p) { return p; })
                        // Return an object suitable for `IWoWProcessResult`
                        .map(function (match) { return ({
                        exe: match[0],
                        flavour: constants_1.wowExecutableFlavours[match[1].toLowerCase()]
                    }); })];
        }
    });
}); };
/**
 * pollWoWProcessLogic
 */
var pollWoWProcessLogic = function () { return __awaiter(void 0, void 0, void 0, function () {
    var wowProcesses, processesToRecord, firstProcessToRecord;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, checkWoWProcess()];
            case 1:
                wowProcesses = _a.sent();
                processesToRecord = wowProcesses.filter(filterFlavoursByConfig);
                firstProcessToRecord = processesToRecord.pop();
                if ((wowProcessRunning === null) && firstProcessToRecord) {
                    wowProcessStarted(firstProcessToRecord);
                }
                else if (wowProcessRunning !== null && !firstProcessToRecord) {
                    wowProcessStopped();
                }
                return [2 /*return*/];
        }
    });
}); };
/**
 * pollWoWProcess
 */
var pollWowProcess = function () {
    // If we've re-called this we need to reset the current state of process 
    // tracking. This is important for settings updates. 
    resetProcessTracking();
    // Run a check without waiting for the timeout. 
    pollWoWProcessLogic();
    if (pollWowProcessInterval) {
        clearInterval(pollWowProcessInterval);
    }
    pollWowProcessInterval = setInterval(pollWoWProcessLogic, 5000);
};
exports.pollWowProcess = pollWowProcess;
/**
 * Filter out flavours that we are not configured to record.
 */
var filterFlavoursByConfig = function (wowProcess) {
    var wowFlavour = wowProcess.flavour;
    var recordClassic = cfg.get("recordClassic");
    var recordRetail = cfg.get("recordRetail");
    // Any non classic flavour is considered a retail flavour (i.e. retail, beta, ptr)
    var validRetailProcess = (wowFlavour !== "Classic" && recordRetail);
    var validClassicProcess = (wowFlavour === "Classic" && recordClassic);
    if (validRetailProcess || validClassicProcess) {
        return true;
    }
    return false;
};
var sendTestCombatLogLine = function (line) {
    console.debug('[Logutils] Sending test combat log line to the Combat Log Parser', line);
    combatLogParser.handleLogLine('retail', line);
};
/**
 * Function to invoke if the user clicks the "run a test" button
 * in the GUI. Uses some sample log lines from 2v2.txt.
 */
var runRecordingTest = function (endTest) {
    if (endTest === void 0) { endTest = true; }
    console.log("[Logutils] User pressed the test button!");
    if (!endTest) {
        console.log("[Logutils] The test will NOT end on its own and needs to be stopped manually.");
    }
    if (testRunning) {
        console.info("[Logutils] Test already running, not starting test.");
        return;
    }
    if (wowProcessRunning === null) {
        console.info("[Logutils] WoW isn't running, not starting test.");
        return;
    }
    console.info("[Logutils] WoW is running, starting test.");
    testRunning = true;
    /**
     * Return a combatlog formatted timestamp representing the current date/time
     * adjusted acording to `seconds` (which can be negative).
     */
    var getAdjustedDate = function (seconds) {
        if (seconds === void 0) { seconds = 0; }
        var now = new Date(new Date().getTime() + (seconds * 1000));
        return now.getMonth() + 1 + "/" + now.getDate() + " " + now.toLocaleTimeString('en-GB') + ".000";
    };
    // This inserts a test date so that the recorder doesn't confuse itself with
    // dates too far in the past. This happens when a recording doesn't end on its own
    // and we forcibly stop it using `new Date()` instead of the date from a log line
    // that ends an activity.
    var startDate = getAdjustedDate();
    var endDate = getAdjustedDate(10);
    [
        startDate + "  ARENA_MATCH_START,2547,33,2v2,1",
        startDate + "  COMBATANT_INFO,Player-1084-08A89569,0,194,452,3670,2353,0,0,0,111,111,111,0,0,632,632,632,0,345,1193,1193,1193,779,256,(102351,102401,197491,5211,158478,203651,155675),(0,203553,203399,353114),[4,4,[],[(1123),(1124),(1129),(1135),(1136),(1819),(1122),(1126),(1128),(1820)],[(256,200),(278,200),(276,200),(275,200),(271,200)]],[(188847,265,(),(7578,8151,7899,1472,6646),()),(186787,265,(),(7578,7893,1524,6646),()),(172319,291,(),(7098,7882,8156,6649,6650,1588),()),(44693,1,(),(),()),(188849,265,(),(8153,7899,1472,6646),()),(186819,265,(),(8136,8137,7578,7896,1524,6646),()),(188848,265,(),(8155,7899,1472,6646),()),(186809,265,(),(8136,8137,7896,1524,6646),()),(186820,265,(),(8136,8138,7578,7893,1524,6646),()),(188853,265,(),(8154,7896,1472,6646),()),(178926,291,(),(8121,7882,8156,6649,6650,1588,6935),()),(186786,265,(),(7579,7893,1524,6646),()),(185304,233,(),(7305,1492,6646),()),(186868,262,(),(7534,1521,6646),()),(186782,265,(),(8136,8138,7893,1524,6646),()),(186865,275,(),(7548,6652,1534,6646),()),(0,0,(),(),()),(147336,37,(),(),())],[Player-1084-08A89569,768,Player-1084-08A89569,5225],327,33,767,1",
        startDate + "  SPELL_AURA_APPLIED,Player-1084-08A89569,\"Alexsmite-TarrenMill\",0x511,0x0,Player-1084-08A89569,\"Alexsmite-TarrenMill\",0x511,0x0,110310,\"Dampening\",0x1,DEBUFF",
        // 'SPELL_PERIODIC_HEAL' isn't currently an event of interest so we want to test that too
        startDate + '  SPELL_PERIODIC_HEAL,Player-1084-08A89569,"Alexsmite-TarrenMill",0x10512,0x0,Player-1084-08A89569,"Alexsmite-TarrenMill",0x10512,0x0,199483,"Camouflage",0x1,Player-1084-08A89569,0000000000000000,86420,86420,2823,369,1254,0,2,100,100,0,284.69,287.62,0,2.9138,285,2291,2291,2291,0,nil',
    ].forEach(sendTestCombatLogLine);
    var testArenaStopLine = endDate + "  ARENA_MATCH_END,0,8,1673,1668";
    if (!endTest) {
        return;
    }
    setTimeout(function () {
        sendTestCombatLogLine(testArenaStopLine);
        testRunning = false;
    }, 10 * 1000);
};
exports.runRecordingTest = runRecordingTest;
