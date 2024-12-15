import Combatant from 'main/Combatant';
import { getLocalePhrase } from 'localisation/translations';
import { Language, Phrase } from 'localisation/types';
import ConfigService from 'main/ConfigService';
import { Flavour, Metadata } from '../main/types';
import { classicArenas, retailArenas } from '../main/constants';
import Activity from './Activity';
import { VideoCategory } from '../types/VideoCategory';

/**
 * Arena match class.
 */
export default class ArenaMatch extends Activity {
  constructor(
    startDate: Date,
    category: VideoCategory,
    zoneID: number,
    flavour: Flavour,
    cfg: ConfigService
  ) {
    super(startDate, category, flavour, cfg);
    this._zoneID = zoneID;
    this.overrun = 3;
  }

  get zoneID() {
    return this._zoneID;
  }

  get resultInfo() {
    if (this.result === undefined) {
      throw new Error('[ArenaMatch] Tried to get result info but no result');
    }

    const language = this.cfg.get<string>('language') as Language;

    if (this.result) {
      return getLocalePhrase(language, Phrase.Win);
    }

    return getLocalePhrase(language, Phrase.Loss);
  }

  get zoneName() {
    if (!this.zoneID) {
      throw new Error('[ArenaMatch] Tried to get zoneName but no zoneID');
    }

    if (this.flavour === Flavour.Retail) {
      return retailArenas[this._zoneID as number];
    }

    return classicArenas[this._zoneID as number];
  }

  endArena(endDate: Date, winningTeamID: number) {
    const result = this.determineArenaMatchResult(winningTeamID);
    super.end(endDate, result);
  }

  determineArenaMatchResult(winningTeamID: number): boolean {
    if (!this.playerGUID) {
      console.error(
        "[ArenaMatch] Haven't identified player so no results possible"
      );
      return false;
    }

    const player = this.getCombatant(this.playerGUID);

    if (!player) {
      console.error('[ArenaMatch] No player combatant so no results possible');
      return false;
    }

    return player.teamID === winningTeamID;
  }

  getMetadata(): Metadata {
    const rawCombatants = Array.from(this.combatantMap.values()).map(
      (combatant: Combatant) => combatant.getRaw()
    );

    return {
      category: this.category,
      zoneID: this.zoneID,
      zoneName: this.zoneName,
      flavour: this.flavour,
      duration: this.duration,
      result: this.result,
      deaths: this.deaths,
      player: this.player.getRaw(),
      combatants: rawCombatants,
      overrun: this.overrun,
      start: this.startDate.getTime(),
      uniqueHash: this.getUniqueHash(),
    };
  }

  getFileName() {
    const language = this.cfg.get<string>('language') as Language;

    let phrase;

    if (this.category === VideoCategory.TwoVTwo) {
      phrase = Phrase.VideoCategoryTwoVTwoLabel;
    } else if (this.category === VideoCategory.ThreeVThree) {
      phrase = Phrase.VideoCategoryThreeVThreeLabel;
    } else if (this.category === VideoCategory.FiveVFive) {
      phrase = Phrase.VideoCategoryFiveVFiveLabel;
    } else if (this.category === VideoCategory.Skirmish) {
      phrase = Phrase.VideoCategorySkirmishLabel;
    } else {
      console.error('Unrecognized arena category', this.category);
      throw new Error('Unrecongized arena category');
    }

    const categoryText = getLocalePhrase(language, phrase);
    let fileName = `${categoryText} ${this.zoneName} (${this.resultInfo})`;

    try {
      if (this.player.name !== undefined) {
        fileName = `${this.player.name} - ${fileName}`;
      }
    } catch {
      console.warn('[ArenaMatch] Failed to get player combatant');
    }

    return fileName;
  }
}
