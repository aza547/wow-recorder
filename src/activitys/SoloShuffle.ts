import Combatant from 'main/Combatant';
import { Language, Phrase } from '../localisation/phrases';
import { getLocalePhrase } from '../localisation/translations';
import {
  Flavour,
  Metadata,
  PlayerDeathType,
  SoloShuffleTimelineSegment,
} from '../main/types';

import { classicArenas, retailArenas } from '../main/constants';
import Activity from './Activity';
import ArenaMatch from './ArenaMatch';
import { VideoCategory } from '../types/VideoCategory';

/**
 * Class representing a Solo Shuffle. This is essentially a wrapper around
 * a list of ArenaMatch objects, where the winner of the nested ArenaMatch
 * objects are determined by whoever gets the first kill.
 *
 * @@@ TODO handle leaver players (i.e. self), might just need a test?
 */
export default class SoloShuffle extends Activity {
  private rounds: ArenaMatch[] = [];

  constructor(startDate: Date, zoneID: number) {
    super(startDate, VideoCategory.SoloShuffle, Flavour.Retail);
    this._zoneID = zoneID;
    this.overrun = 3;
    this.startRound(startDate);
  }

  get zoneID() {
    return this._zoneID;
  }

  get currentRound() {
    return this.rounds[this.rounds.length - 1];
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

  get roundsWon() {
    let score = 0;

    this.rounds.forEach((arenaMatch) => {
      if (arenaMatch.result) score++;
    });

    return score;
  }

  get resultInfo() {
    const win = this.roundsWon;
    const loss = this.rounds.length - this.roundsWon;
    return `${win}-${loss}`;
  }

  get playerGUID() {
    return this.currentRound.playerGUID;
  }

  set playerGUID(GUID) {
    this.currentRound.playerGUID = GUID;
  }

  get player() {
    if (!this.playerGUID) {
      throw new Error('Failed to get player combatant, playerGUID not set');
    }

    const player = this.currentRound.getCombatant(this.playerGUID);

    if (!player) {
      throw new Error('Player not found in combatants');
    }

    return player;
  }

  getCombatant(GUID: string) {
    const currentRound = this.rounds[this.rounds.length - 1];
    return currentRound.getCombatant(GUID);
  }

  startRound(startDate: Date) {
    if (!this.zoneID) {
      throw new Error('[Solo Shuffle] No zoneID set');
    }

    const newRound = new ArenaMatch(
      startDate,
      VideoCategory.SoloShuffle,
      this.zoneID,
      Flavour.Retail,
      this.cfg,
    );

    this.rounds.push(newRound);
  }

  endRound(endDate: Date, winningTeamID: number) {
    this.currentRound.endArena(endDate, winningTeamID);
  }

  addDeath(death: PlayerDeathType) {
    console.info('[Solo Shuffle] Adding death to solo shuffle', death);

    if (this.currentRound.deaths.length > 0) {
      console.info(
        '[Solo Shuffle] Already have a death in this round',
        this.currentRound.deaths,
      );
      return;
    }

    if (!this.player || this.player.teamID === undefined) {
      console.error(
        "[Solo Shuffle] Tried to add a death but don't know the player",
      );
      return;
    }

    let winningTeamID;

    if (!death.friendly) {
      console.info('[Solo Shuffle] Adding enemy death');
      winningTeamID = this.player.teamID;
    } else {
      console.info('[Solo Shuffle] Adding friendly death');

      if (this.player.teamID === 0) {
        winningTeamID = 1;
      } else {
        winningTeamID = 0;
      }
    }

    this.currentRound.addDeath(death);
    this.endRound(death.date, winningTeamID);
    super.addDeath(death);
  }

  addCombatant(combatant: Combatant) {
    this.currentRound.addCombatant(combatant);
  }

  endGame(endDate: Date) {
    console.info('[Solo Shuffle] Ending game');

    for (let i = 0; i < this.rounds.length; i++) {
      console.info('[Solo Shuffle] Round', i, ':', this.rounds[i].resultInfo);
    }

    super.end(endDate, true);
  }

  getTimelineSegments(): SoloShuffleTimelineSegment[] {
    const segments = [];

    for (let i = 0; i < this.rounds.length; i++) {
      const gameStartTime = this.startDate.getTime();
      const roundStartTime = this.rounds[i].startDate.getTime();
      const roundEndTime = this.rounds[i].endDate?.getTime();

      if (roundEndTime === undefined) {
        segments.push({
          round: i + 1,
          timestamp: (roundStartTime - gameStartTime) / 1000,
          result: this.rounds[i].result,
        });
      } else {
        segments.push({
          round: i + 1,
          timestamp: (roundStartTime - gameStartTime) / 1000,
          result: this.rounds[i].result,
          duration: (roundEndTime - roundStartTime) / 1000,
        });
      }
    }

    return segments;
  }

  getMetadata(): Metadata {
    const rawCombatants = Array.from(
      // Just use the combatants from the final round.
      this.currentRound.combatantMap.values(),
    ).map((combatant: Combatant) => combatant.getRaw());

    return {
      category: this.category,
      zoneID: this.zoneID,
      zoneName: this.zoneName,
      flavour: this.flavour,
      duration: this.duration,
      result: this.result,
      deaths: this.deaths,
      player: this.player.getRaw(),
      soloShuffleRoundsWon: this.roundsWon,
      soloShuffleRoundsPlayed: this.rounds.length,
      soloShuffleTimeline: this.getTimelineSegments(),
      combatants: rawCombatants,
      overrun: this.overrun,
      start: this.startDate.getTime(),
      uniqueHash: this.getUniqueHash(),
    };
  }

  getFileName() {
    const language = this.cfg.get<string>('language') as Language;

    const category = getLocalePhrase(
      language,
      Phrase.VideoCategorySoloShuffleLabel,
    );

    let fileName = `${category} ${this.zoneName} (${this.resultInfo})`;

    try {
      if (this.player.name !== undefined) {
        fileName = `${this.player.name} - ${fileName}`;
      }
    } catch {
      console.warn('[SoloShuffle] Failed to get player combatant');
    }

    return fileName;
  }
}
