import { Metadata } from "main/types";
import { dungeonTimersByMapId, VideoCategory } from "../main/constants";
import { ChallengeModeTimelineSegment, TimelineSegmentType } from "../main/keystone";
import Activity from "./Activity";

export default class ChallengeModeDungeon extends Activity {
    private mapID: number;
    private level: number;
    private affixes: number[];
    private timings: number[];
    private CMDuration: number = 0;
    private chests?: number;
    private timelineSegments: ChallengeModeTimelineSegment[] = []

    constructor(startDate: Date, 
                zoneID: number, 
                mapID: number, 
                level: number, 
                affixes: number[])
    {
        super(startDate, VideoCategory.MythicPlus);
        this.zoneID = zoneID;
        this.mapID = mapID;
        this.level = level;
        this.affixes = affixes; 
        this.timings = dungeonTimersByMapId[mapID];
    }

    endChallengeMode(endDate: Date, CMDuration: number) {
        this.endCurrentTimelineSegment(endDate);

        // If last timeline segment is less than 10 seconds long, discard it.
        // It's probably not useful
        const lastTimelineSegment = this.getCurrentTimelineSegment();

        if (lastTimelineSegment && lastTimelineSegment.length() < 10000) {
            console.debug("[ChallengeModeDungeon] Removing last timeline segment because it's too short.");
            this.removeLastTimelineSegment();
        }

        this.endDate = endDate;
        this.CMDuration = CMDuration;
        this.result = true; // @@@ is this OK or need to handle non completed better? 
        this.chests = this.calculateKeystoneUpgradeLevel();
    }

    /**
     * Calculate the completion result of a ChallngeModeDungeon based on the
     * duration of the dungeon tested against the dungeon timer values.
     *
     * Return value is a number between 0 and 3:
     * -  0   = depleted
     * -  1-3 = keystone upgrade levels
     */
    calculateKeystoneUpgradeLevel(): number {
        if (!this.CMDuration) {
            console.error("[ChallengeModeDungeon] Tried to get result of incomplete run.");
            return 0;
        }

        if (!this.timings) {
            console.error("[ChallengeModeDungeon] Don't have timings data for this dungeon.");
            return 0;
        }

        for (let i = (this.timings.length - 1); i >= 0; i--) {
            if (this.CMDuration <= this.timings[i]) {
                return (i + 1);
            }
        }

        return 0;
    }

    /**
     * Add a timeline segment, optionally ending the current one
     *
     * Given a date as endPrevious, that date is used as the logEnd for the
     * current segment.
     */
    addTimelineSegment(segment: ChallengeModeTimelineSegment, endPrevious?: Date) {
        if (endPrevious) {
            this.endCurrentTimelineSegment(endPrevious);
        }

        this.timelineSegments.push(segment);
    }

    getTimelineSegments(): ChallengeModeTimelineSegment[] {
        return this.timelineSegments;
    }

    getCurrentTimelineSegment(): ChallengeModeTimelineSegment | undefined {
        return this.timelineSegments.at(-1);
    }

    /**
     * Find and return the last timeline segment from a boss encounter
     */
    getLastBossEncounter(): ChallengeModeTimelineSegment | undefined {
        return this.timelineSegments.slice().reverse().find(v => {
            v.segmentType === TimelineSegmentType.BossEncounter;
        });
    }

    /**
     * End a timeline segment by setting its logEnd date.
     */
    endCurrentTimelineSegment(logDate: Date) {
        const currentSegment = this.getCurrentTimelineSegment()
        if (currentSegment) {
            currentSegment.logEnd = logDate;
        }
    }

    /**
     * Pop the last timeline segment and discard it
     */
    removeLastTimelineSegment() {
        this.timelineSegments.pop();
    }

    getChests() {
        return this.chests;
    }

    getLevel() {
        return this.level;
    }

    getMapID() {
        return this.mapID;
    }

    getAllTimelineSegment() {
        return this.timelineSegments;
    }

    getMetadata(): Metadata {
        const metadata: Metadata = {
            name: "a dungeon", // Instance name (e.g. "Operation: Mechagon")
            category: VideoCategory.MythicPlus,
            zoneID: this.getZoneID(),
            mapID: this.getMapID(),
            duration: this.getDuration(),
            result: this.getResult(),
            chests: this.getChests(),            
            playerName: this.getPlayerName(),
            playerRealm: this.getPlayerRealm(),
            playerSpecID: this.getPlayerSpecID(),
            timeline: this.getTimelineSegments(),
            level: this.getLevel(),
            challengeMode: this, // @@@ remove this
        }

        return metadata;
    }
};