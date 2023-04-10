enum TimelineSegmentType {
  BossEncounter = 'Boss',
  Trash = 'Trash',
}

type RawChallengeModeTimelineSegment = {
  segmentType?: TimelineSegmentType;
  logStart?: string;
  timestamp?: number;
  encounterId?: number;
  logEnd?: string;
  result?: string;
};

class ChallengeModeTimelineSegment {
  logEnd: Date;

  result?: boolean;

  constructor(
    public segmentType: TimelineSegmentType,
    public logStart: Date,
    public timestamp: number,
    public encounterId?: number
  ) {
    // Initially, let's set this to log start date to avoid logEnd
    // potentially being undefined.
    this.logEnd = logStart;
  }

  length(): number {
    return this.logEnd.getTime() - this.logStart.getTime();
  }

  getRaw(): RawChallengeModeTimelineSegment {
    const rawSegment: RawChallengeModeTimelineSegment = {
      segmentType: this.segmentType,
      logStart: this.logStart.toISOString(),
      logEnd: this.logEnd.toISOString(),
      timestamp: this.timestamp,
    };

    if (this.encounterId !== undefined) {
      rawSegment.encounterId = this.encounterId;
    }

    return rawSegment;
  }
}

export {
  TimelineSegmentType,
  ChallengeModeTimelineSegment,
  RawChallengeModeTimelineSegment,
};
