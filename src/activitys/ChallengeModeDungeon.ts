import { IConfigService } from 'config/ConfigService';
import Combatant from '../main/Combatant';
import { Language, Phrase } from '../localisation/phrases';
import { getLocalePhrase } from '../localisation/translations';
import { Flavour, Metadata } from '../main/types';
import {
  dungeonTimersByMapId,
  instanceNamesByZoneId,
  mopChallengeModes,
  mopChallengeModesTimers,
} from '../main/constants';
import { VideoCategory } from '../types/VideoCategory';
import {
  ChallengeModeTimelineSegment,
  TimelineSegmentType,
} from '../main/keystone';
import Activity from './Activity';

export default class ChallengeModeDungeon extends Activity {
  private _mapID: number;

  private _level: number;

  private _timings: number[];

  private _CMDuration: number = 0;

  private _timeline: ChallengeModeTimelineSegment[] = [];

  private affixes: number[] = [];

  constructor(
    startDate: Date,
    zoneID: number,
    mapID: number,
    level: number,
    affixes: number[],
    cfg: IConfigService,
    flavor: Flavour,
  ) {
    super(startDate, VideoCategory.MythicPlus, flavor, cfg);
    this._zoneID = zoneID;
    this._mapID = mapID;
    this._level = level;
    this.affixes = affixes;

    this._timings = dungeonTimersByMapId[mapID];

    if (flavor === Flavour.Classic) {
      console.info('[ChallengeModeDungeon] Using Classic timers for', mapID);
      this._timings = mopChallengeModesTimers[mapID];
    }

    this.overrun = 0;
  }

  get endDate() {
    return this._endDate;
  }

  set endDate(date) {
    this._endDate = date;
  }

  get CMDuration() {
    return this._CMDuration;
  }

  set CMDuration(duration) {
    this._CMDuration = duration;
  }

  get timings() {
    return this._timings;
  }

  get timeline() {
    return this._timeline;
  }

  get level() {
    return this._level;
  }

  get mapID() {
    return this._mapID;
  }

  get upgradeLevel(): number {
    if (!this.timings) {
      throw new Error("Don't have timings data for this dungeon.");
    }

    if (!this.CMDuration && this.flavour === Flavour.Retail) {
      console.info(
        "[ChallengeModeDungeon] Run didn't complete (abandoned, not a deplete)",
      );
      return 0;
    }

    if (this.affixes.includes(152)) {
      // Challenger's Peril
      this.CMDuration -= 90;
    }

    const durationForResult = Flavour.Classic ? this.CMDuration : this.duration;

    for (let i = this.timings.length - 1; i >= 0; i--) {
      if (durationForResult <= this.timings[i]) {
        return i + 1;
      }
    }

    return 0;
  }

  get currentSegment() {
    return this.timeline.at(-1);
  }

  get dungeonName(): string {
    if (!this.zoneID) {
      throw new Error("zoneID not set, can't get dungeon name");
    }

    const isRecognisedMythicPlus = Object.prototype.hasOwnProperty.call(
      instanceNamesByZoneId,
      this.zoneID,
    );

    if (isRecognisedMythicPlus) {
      return instanceNamesByZoneId[this.zoneID];
    }

    if (this.flavour === Flavour.Classic && mopChallengeModes[this.mapID]) {
      return mopChallengeModes[this.mapID];
    }

    return 'Unknown Dungeon';
  }

  get resultInfo() {
    if (this.result === undefined) {
      throw new Error('[RaidEncounter] Tried to get result info but no result');
    }

    if (this.result) {
      return `+${this.upgradeLevel}`;
    }

    const language = this.cfg.get<string>('language') as Language;
    return getLocalePhrase(language, Phrase.Abandoned);
  }

  endChallengeMode(endDate: Date, CMDuration: number, result: boolean) {
    this.endCurrentTimelineSegment(endDate);
    const lastSegment = this.currentSegment;

    if (lastSegment && lastSegment.length() < 10000) {
      console.debug(
        "[ChallengeModeDungeon] Removing last timeline segment because it's too short.",
      );
      this.removeLastTimelineSegment();
    }

    this.CMDuration = CMDuration;
    super.end(endDate, result);
  }

  addTimelineSegment(
    segment: ChallengeModeTimelineSegment,
    endPrevious?: Date,
  ) {
    if (endPrevious) {
      this.endCurrentTimelineSegment(endPrevious);
    }

    this.timeline.push(segment);
  }

  endCurrentTimelineSegment(date: Date) {
    if (this.currentSegment) {
      this.currentSegment.logEnd = date;
    }
  }

  removeLastTimelineSegment() {
    this.timeline.pop();
  }

  getLastBossEncounter(): ChallengeModeTimelineSegment | undefined {
    if (this.flavour !== Flavour.Retail) {
      return undefined;
    }

    return this.timeline
      .slice()
      .reverse()
      .find((v) => v.segmentType === TimelineSegmentType.BossEncounter);
  }

  getMetadata(): Metadata {
    const rawCombatants = Array.from(this.combatantMap.values()).map(
      (combatant: Combatant) => combatant.getRaw(),
    );

    const rawSegments = this.timeline.map(
      (segment: ChallengeModeTimelineSegment) => segment.getRaw(),
    );

    return {
      category: VideoCategory.MythicPlus,
      zoneID: this.zoneID,
      mapID: this.mapID,
      duration: this.duration,
      result: this.result,
      upgradeLevel: this.upgradeLevel,
      player: this.player.getRaw(),
      challengeModeTimeline: rawSegments,
      keystoneLevel: this.level,
      flavour: this.flavour,
      overrun: this.overrun,
      combatants: rawCombatants,
      affixes: this.affixes,
      deaths: this.deaths,
      start: this.startDate.getTime(),
      uniqueHash: this.getUniqueHash(),
    };
  }

  getFileName(): string {
    let fileName = `${this.dungeonName} +${this.level} (${this.resultInfo})`;

    try {
      if (this.player.name !== undefined) {
        fileName = `${this.player.name} - ${fileName}`;
      }
    } catch {
      console.warn('[ChallengeModeDungeon] Failed to get player combatant');
    }

    return fileName;
  }
}
