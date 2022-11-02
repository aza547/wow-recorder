import { Metadata } from "main/types";
import { dungeonTimersByMapId, VideoCategory } from "../main/constants";
import { ChallengeModeTimelineSegment, TimelineSegmentType } from "../main/keystone";
import Activity from "./Activity";

export default class ChallengeModeDungeon extends Activity {
    private _mapID: number;
    private _level: number;
    private _timings: number[];
    private _CMDuration: number = 0;
    private _timeline: ChallengeModeTimelineSegment[] = []

    constructor(startDate: Date, 
                zoneID: number, 
                mapID: number, 
                level: number)
    {
        super(startDate, VideoCategory.MythicPlus);
        this._zoneID = zoneID;
        this._mapID = mapID;
        this._level = level;
        this._timings = dungeonTimersByMapId[mapID];
    }

    get endDate() { return this._endDate };
    get CMDuration() { return this._CMDuration };
    get timings() { return this._timings };
    get timeline() { return this._timeline };
    get level() { return this._level };
    get mapID() { return this._mapID };
    set endDate(date) { this._endDate = date };
    set CMDuration(duration) { this._CMDuration = duration };

    get upgradeLevel(): number {
        if (!this.CMDuration) {
            throw new Error("Tried to get result of incomplete run.");
        }

        if (!this.timings) {
            throw new Error("Don't have timings data for this dungeon.");
        }

        for (let i = (this.timings.length - 1); i >= 0; i--) {
            if (this.CMDuration <= this.timings[i]) {
                return (i + 1);
            }
        }

        return 0;
    }

    get currentSegment() {
        return this.timeline.at(-1);
    }

    endChallengeMode(endDate: Date, CMDuration: number) {
        this.endCurrentTimelineSegment(endDate);
        const lastSegment = this.currentSegment;

        if (lastSegment && lastSegment.length() < 10000) {
            console.debug("[ChallengeModeDungeon] Removing last timeline segment because it's too short.");
            this.removeLastTimelineSegment();
        }

        this.CMDuration = CMDuration;
        super.end(endDate, true); // @@@ is this OK or need to handle non completed better? 
    }

    addTimelineSegment(segment: ChallengeModeTimelineSegment, endPrevious?: Date) {
        if (endPrevious) {
            this.endCurrentTimelineSegment(endPrevious);
        }

        this.timeline.push(segment);
    }

    getLastBossEncounter(): ChallengeModeTimelineSegment | undefined {
        return this.timeline.slice().reverse().find(v => {
            v.segmentType === TimelineSegmentType.BossEncounter;
        });
    }

    endCurrentTimelineSegment(date: Date) {
        if (this.currentSegment) {
            this.currentSegment.logEnd = date;
        }
    }

    removeLastTimelineSegment() {
        this.timeline.pop();
    }

    getMetadata(): Metadata {
        return {
            category: VideoCategory.MythicPlus,
            zoneID: this.zoneID,
            mapID: this.mapID,
            duration: this.duration,
            result: this.result,
            upgradeLevel: this.upgradeLevel,            
            player: this.player,
            timeline: this.timeline,
            level: this.level,
            challengeMode: this, // @@@ remove this
        }
    }
};