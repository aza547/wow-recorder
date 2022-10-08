enum TimelineSegmentType {
    BossEncounter = 'Boss',
    Trash = 'Trash'
};

class ChallengeModeTimelineSegment {
    logEnd: Date
    result?: Boolean

    constructor(
        public segmentType: TimelineSegmentType,
        public logStart: Date,
        public timestamp: number,
        public encounterId?: number
    ) {
        // Initially, let's set this to log start date to avoid logEnd
        // potentially being undefined.
        this.logEnd = logStart
    }

    length (): number {
        return (this.logEnd.getTime() - this.logStart.getTime())
    }
};

class ChallengeModeDungeon {
    timed: boolean = false;
    duration: number = 0;
    timelineSegments: ChallengeModeTimelineSegment[] = []

    constructor(
        public allottedTime: number[],
        public zoneId: number,
        public mapId: number, // Some dungeons like Karazhan and such have have the
                              // same zoneId for both Upper/Lower, but have distinct
                              // mapVersion numbers.
        public level: number,
        public affixes: number[],
    ) {}

    /**
     * Calculate the completion result of a Mythic Keystone
     * based on the duration of the dungeon (from the logs) tested against
     * the dungeon timer values from `dungeonTimersByMapId`.
     *
     * Return value is a number between 0 and 3:
     *
     * 0   = depleted,
     * 1-3 = keystone upgrade levels
     */
    static calculateKeystoneUpgradeLevel(allottedTime: number[] | undefined, duration: number): number {
        // If we've been passed an undefined value, assume not timed.
        // This can happen if the dungeon that was recorded doesn't have completion timers in
        // dungeonTimersByMapId in constants.ts
        if (!allottedTime) {
            return 0;
        }

        for (let i = allottedTime.length - 1; i >= 0; i--) {
            if (duration <= allottedTime[i]) {
                return i + 1;
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

    getCurrentTimelineSegment(): ChallengeModeTimelineSegment | undefined {
        return this.timelineSegments.at(-1)
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
            currentSegment.logEnd = logDate
        }
    }

    /**
     * Pop the last timeline segment and discard it
     */
    removeLastTimelineSegment() {
        this.timelineSegments.pop();
    }
};

export {
    TimelineSegmentType,
    ChallengeModeTimelineSegment,
    ChallengeModeDungeon,
}
