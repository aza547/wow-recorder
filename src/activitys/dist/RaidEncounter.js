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
var constants_1 = require("../main/constants");
var Activity_1 = require("./Activity");
/**
 * Class representing a raid encounter.
 */
var RaidEncounter = /** @class */ (function (_super) {
    __extends(RaidEncounter, _super);
    function RaidEncounter(startDate, encounterID, difficultyID, flavour) {
        var _this = _super.call(this, startDate, constants_1.VideoCategory.Raids, flavour) || this;
        _this._difficultyID = difficultyID;
        _this._encounterID = encounterID;
        _this.overrun = 15;
        return _this;
    }
    Object.defineProperty(RaidEncounter.prototype, "difficultyID", {
        get: function () { return this._difficultyID; },
        enumerable: false,
        configurable: true
    });
    ;
    Object.defineProperty(RaidEncounter.prototype, "encounterID", {
        get: function () { return this._encounterID; },
        enumerable: false,
        configurable: true
    });
    ;
    Object.defineProperty(RaidEncounter.prototype, "encounterName", {
        get: function () {
            if (!this.encounterID) {
                throw new Error("EncounterID not set, can't get name of encounter");
            }
            if (constants_1.raidEncountersById.hasOwnProperty(this.encounterID)) {
                return constants_1.raidEncountersById[this.encounterID];
            }
            return "Unknown Encounter";
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RaidEncounter.prototype, "zoneID", {
        get: function () {
            if (!this.encounterID) {
                throw new Error("EncounterID not set, can't get zone ID");
            }
            var zoneID = 0;
            for (var _i = 0, raidInstances_1 = constants_1.raidInstances; _i < raidInstances_1.length; _i++) {
                var raid = raidInstances_1[_i];
                if (raid.encounters[this.encounterID]) {
                    zoneID = raid.zoneId;
                    break;
                }
            }
            ;
            return zoneID;
        },
        enumerable: false,
        configurable: true
    });
    ;
    Object.defineProperty(RaidEncounter.prototype, "raid", {
        get: function () {
            var _this = this;
            if (!this.encounterID) {
                throw new Error("EncounterID not set, can't get raid name");
            }
            var raids = constants_1.raidInstances.filter(function (r) { return r.encounters.hasOwnProperty(_this.encounterID); });
            var raid = raids.pop();
            if (!raid) {
                throw new Error("[RaidEncounter] No raids matched this encounterID.");
            }
            return raid;
        },
        enumerable: false,
        configurable: true
    });
    ;
    Object.defineProperty(RaidEncounter.prototype, "resultInfo", {
        get: function () {
            if (this.result === undefined) {
                throw new Error("[RaidEncounter] Tried to get result info but no result");
            }
            if (this.result) {
                return "Kill";
            }
            return "Wipe";
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RaidEncounter.prototype, "difficulty", {
        get: function () {
            var recognisedID = constants_1.instanceDifficulty.hasOwnProperty(this.difficultyID);
            if (!recognisedID) {
                throw new Error("[RaidEncounters] Unknown difficulty ID: " + this.difficultyID);
            }
            return constants_1.instanceDifficulty[this.difficultyID];
        },
        enumerable: false,
        configurable: true
    });
    RaidEncounter.prototype.getMetadata = function () {
        return {
            category: constants_1.VideoCategory.Raids,
            zoneID: this.zoneID,
            zoneName: this.raid.shortName,
            flavour: this.flavour,
            encounterID: this.encounterID,
            encounterName: this.encounterName,
            difficultyID: this.difficultyID,
            difficulty: this.difficulty.difficulty,
            duration: this.duration,
            result: this.result,
            player: this.player,
            deaths: this.deaths
        };
    };
    RaidEncounter.prototype.getFileName = function () {
        return this.raid.name + ", " + this.encounterName + " (" + this.resultInfo + ")";
    };
    return RaidEncounter;
}(Activity_1["default"]));
exports["default"] = RaidEncounter;
