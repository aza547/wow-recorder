"use strict";
exports.__esModule = true;
var constants_1 = require("main/constants");
var LogHandler = /** @class */ (function () {
    function LogHandler(recorder, combatLogParser) {
        var _this = this;
        this.startRecording = function (category) {
            if (!allowRecordCategory(category)) {
                console.info("[LogUtils] Not configured to record", category);
                return;
            }
            else if (_this._recorder.isRecording || !_this._recorder.isRecordingBuffer) {
                console.error("[LogUtils] Avoiding error by not attempting to start recording", _this._recorder.isRecording, _this._recorder.isRecordingBuffer);
                return;
            }
            console.log("[Logutils] Start recording a video for category: " + category);
            // Ensure combatant map and player combatant is clean before
            // starting a new recording.
            clearCombatants();
            //@@@currentActivity = category;
            _this._recorder.start();
        };
        this._recorder = recorder;
        this._combatLogParser = combatLogParser;
        // If we haven't received data in a while, we're probably AFK and should stop recording.
        this._combatLogParser
            .on('DataTimeout', function (timeoutMs) {
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
    }
    return LogHandler;
}());
exports["default"] = LogHandler;
