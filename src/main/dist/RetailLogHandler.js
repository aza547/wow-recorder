"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
var combatant_1 = require("./combatant");
var main_1 = require("./main");
var constants_1 = require("./constants");
var types_1 = require("./types");
var keystone_1 = require("./keystone");
var LogHandler_1 = require("./LogHandler");
var RetailLogHandler = /** @class */ (function (_super) {
    __extends(RetailLogHandler, _super);
    /**
     * Constructor
     */
    function RetailLogHandler(recorder) {
        return _super.call(this, recorder) || this;
    }
    ;
    /**
     * Handle a line from the WoW log.
     */
    RetailLogHandler.prototype.handleArenaStartLine = function (line) {
        if (this._recorder.isRecording)
            return;
        var category = line.arg(3);
        var zoneID = parseInt(line.arg(1), 10);
        // If all goes to plan we don't need this but we do it incase the game
        // crashes etc. so we can still get a reasonable duration.
        this._recordingStartDate = line.date();
        this._metadata = {
            name: "name",
            category: category,
            zoneID: zoneID,
            duration: 0,
            result: false,
            playerDeaths: []
        };
        startRecording(category);
    };
    return RetailLogHandler;
}(LogHandler_1.LogHandler));
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
function handleZoneChange(line) {
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
