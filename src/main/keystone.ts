import { dungeonTimersByMapId } from "./constants";

enum VideoSegmentType {
    BossEncounter = 'Boss',
    Trash = 'Trash'
};

class ChallengeModeVideoSegment {
    logEnd: Date
    result?: Boolean

    constructor(
        public segmentType: VideoSegmentType,
        public logStart: Date,
        public ts: number,
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

    constructor(
        public zoneId: number,
        public mapId: number, // Some dungeons like Karazhan and such have have the
                              // same zoneId for both Upper/Lower, but have distinct
                              // mapVersion numbers.
        public level: number,
        public affixes: number[]
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
const calculateCompletionResult = (mapId: number, duration: number): number => {
    const timerValues = dungeonTimersByMapId[mapId]

    for (let i = timerValues.length - 1; i >= 0; i--) {
        if (duration <= timerValues[i]) {
            return i + 1;
        }
    }

    return 0;
}

export {
    VideoSegmentType,
    ChallengeModeVideoSegment,
    ChallengeModeDungeon,
    calculateCompletionResult,
}
