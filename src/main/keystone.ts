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



export {
    TimelineSegmentType,
    ChallengeModeTimelineSegment,
}
