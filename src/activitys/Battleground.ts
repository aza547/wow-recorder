import { Flavour, Metadata } from 'main/types';
import { Language, Phrase } from '../localisation/phrases';
import { getLocalePhrase } from '../localisation/translations';
import { classicBattlegrounds, retailBattlegrounds } from '../main/constants';
import { VideoCategory } from '../types/VideoCategory';
import Activity from './Activity';

/**
 * Arena match class.
 */
export default class Battleground extends Activity {
  constructor(
    startDate: Date,
    category: VideoCategory,
    zoneID: number,
    flavour: Flavour,
  ) {
    super(startDate, category, flavour);
    this.zoneID = zoneID;
    this.overrun = 3;
  }

  get battlegroundName(): string {
    if (!this.zoneID) {
      throw new Error("zoneID not set, can't get battleground name");
    }

    const isRetailBattleground = Object.prototype.hasOwnProperty.call(
      retailBattlegrounds,
      this.zoneID,
    );

    if (isRetailBattleground) {
      return retailBattlegrounds[this.zoneID];
    }

    const isClassicBattleground = Object.prototype.hasOwnProperty.call(
      classicBattlegrounds,
      this.zoneID,
    );

    if (isClassicBattleground) {
      return classicBattlegrounds[this.zoneID];
    }

    return 'Unknown Battleground';
  }

  estimateResult() {
    // We decide who won by counting the deaths. The winner is the
    // team with the least deaths. Obviously this is a best effort
    // thing and might be wrong.
    const friendsDead = this.deaths.filter((d) => d.friendly).length;
    const enemiesDead = this.deaths.filter((d) => !d.friendly).length;
    console.info('[Battleground] Friendly deaths: ', friendsDead);
    console.info('[Battleground] Enemy deaths: ', enemiesDead);
    const result = friendsDead < enemiesDead;
    this.result = result;
    return result;
  }

  getMetadata(): Metadata {
    return {
      category: this.category,
      zoneID: this.zoneID,
      zoneName: this.battlegroundName,
      duration: this.duration,
      result: this.estimateResult(),
      flavour: this.flavour,
      player: this.player.getRaw(),
      overrun: this.overrun,
      combatants: [],
      start: this.startDate.getTime(),
      uniqueHash: this.getUniqueHash(),
    };
  }

  getFileName(): string {
    const language = this.cfg.get<string>('language') as Language;

    const resultText = this.estimateResult()
      ? getLocalePhrase(language, Phrase.Win)
      : getLocalePhrase(language, Phrase.Loss);

    let fileName = `${this.battlegroundName} (${resultText})`;

    try {
      if (this.player.name !== undefined) {
        fileName = `${this.player.name} - ${fileName}`;
      }
    } catch {
      console.warn('[Battleground] Failed to get player combatant');
    }

    return fileName;
  }
}
