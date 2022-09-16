enum VideoSegmentType {
    BossEncounter = 'Boss',
    Trash = 'Trash'
};

type ChallengeModePlayerDeathType = {
    name: string,
    specId: number,
    timestamp: number,
};

class ChallengeModeVideoSegment {
    logEnd: Date
    result?: Boolean

    constructor(
        public segmentType: VideoSegmentType,
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
    videoSegments: ChallengeModeVideoSegment[] = []
    playerDeaths: ChallengeModePlayerDeathType[] = []

    constructor(
        public startTime: number,
        public allottedTime: number[],
        public zoneId: number,
        public mapId: number, // Some dungeons like Karazhan and such have have the
                              // same zoneId for both Upper/Lower, but have distinct
                              // mapVersion numbers.
        public level: number,
        public affixes: number[],
    ) {}

    /**
     * Add a video segment, optionally ending a current one
     *
     * Given a date as endPrevious, that date is used as the logEnd for the
     * current segment.
     */
    addVideoSegment(segment: ChallengeModeVideoSegment, endPrevious?: Date) {
        if (endPrevious) {
            this.endVideoSegment(endPrevious);
        }

        this.videoSegments.push(segment);
    }

    getCurrentVideoSegment(): ChallengeModeVideoSegment | undefined {
        return this.videoSegments.at(-1)
    }

    /**
     * Find and return the last video segment from a boss encounter
     */
    getLastBossEncounter(): ChallengeModeVideoSegment | undefined {
        return this.videoSegments.slice().reverse().find(v => v.segmentType === VideoSegmentType.BossEncounter);
    }

    /**
     * End a video segment by setting its logEnd date.
     */
    endVideoSegment(logDate: Date) {
        const currentSegment = this.getCurrentVideoSegment()
        if (currentSegment) {
            currentSegment.logEnd = logDate
        }
    }

    /**
     * Pop the last video segment and discard it
     */
    removeLastSegment() {
        this.videoSegments.pop();
    }

    /**
     * Add a player death to the log
     */
    addPlayerDeath(timestamp: number, name: string, specId: number) {
        // Ensure a timestamp cannot be negative
        timestamp = timestamp >= 0 ? timestamp : 0;

        this.playerDeaths.push({ name, specId, timestamp });
    }
};

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
const calculateKeystoneCompletionResult = (allottedTime: number[], duration: number): number => {
    for (let i = allottedTime.length - 1; i >= 0; i--) {
        if (duration <= allottedTime[i]) {
            return i + 1;
        }
    }

    return 0;
}

export {
    VideoSegmentType,
    ChallengeModeVideoSegment,
    ChallengeModeDungeon,
    calculateKeystoneCompletionResult,
}
