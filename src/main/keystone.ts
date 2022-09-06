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
};

class ChallengeModeDungeon {
    completed: boolean = false;
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

    getLastBossEncounter(): ChallengeModeVideoSegment | undefined {
        return this.videoSegments.reverse().find(v => v.segmentType === VideoSegmentType.BossEncounter);
    }

    endVideoSegment(logDate: Date) {
        const currentSegment = this.getCurrentVideoSegment()
        if (currentSegment) {
            currentSegment.logEnd = logDate
        }
    }

    // Remove the last video segment
    removeLastSegment() {
        this.videoSegments.pop();
    }
};

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
