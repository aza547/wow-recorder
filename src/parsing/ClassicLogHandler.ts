import VideoProcessQueue from 'main/VideoProcessQueue';
import { BrowserWindow } from 'electron';
import {
  classicArenas,
  classicBattlegrounds,
  classicUniqueSpecSpells,
} from '../main/constants';

import Recorder from '../main/Recorder';
import LogHandler from './LogHandler';
import { Flavour } from '../main/types';
import ArenaMatch from '../activitys/ArenaMatch';
import { isUnitFriendly, isUnitPlayer, isUnitSelf } from './logutils';
import Battleground from '../activitys/Battleground';
import LogLine from './LogLine';
import { VideoCategory } from '../types/VideoCategory';

/**
 * Classic log handler class.
 */
export default class ClassicLogHandler extends LogHandler {
  // It's hard to end classic arenas on time due to log flushing and no
  // ARENA_MATCH_END events. We start a 20s timer on a player death that
  // will end the game unless another death is seen in that 20s, in which
  // case we start the timer again.
  private _playerDeathTimeout?: NodeJS.Timeout;

  constructor(
    mainWindow: BrowserWindow,
    recorder: Recorder,
    videoProcessQueue: VideoProcessQueue,
    logPath: string
  ) {
    super(mainWindow, recorder, videoProcessQueue, logPath, 2);

    this.combatLogWatcher
      .on('ENCOUNTER_START', async (line: LogLine) => {
        await this.handleEncounterStartLine(line);
      })
      .on('ENCOUNTER_END', async (line: LogLine) => {
        await this.handleEncounterEndLine(line);
      })
      .on('ZONE_CHANGE', async (line: LogLine) => {
        await this.handleZoneChange(line);
      })
      .on('SPELL_AURA_APPLIED', (line: LogLine) => {
        this.handleSpellAuraAppliedLine(line);
      })
      .on('UNIT_DIED', (line: LogLine) => {
        this.handleUnitDiedLine(line);
      })
      .on('SPELL_CAST_SUCCESS', (line: LogLine) => {
        this.handleSpellCastSuccess(line);
      });
  }

  protected async handleEncounterStartLine(line: LogLine) {
    console.debug('[ClassicLogHandler] Handling ENCOUNTER_START line:', line);
    await super.handleEncounterStartLine(line, Flavour.Classic);
  }

  private handleSpellAuraAppliedLine(line: LogLine) {
    if (!this.activity) {
      return;
    }

    const srcGUID = line.arg(1);
    const srcFlags = parseInt(line.arg(3), 16);
    const srcNameRealm = line.arg(2);
    const destGUID = line.arg(5);

    const alreadyKnowCombatant =
      this.activity.getCombatant(srcGUID) !== undefined;

    const combatant = this.processClassicCombatant(
      srcGUID,
      srcNameRealm,
      srcFlags,
      destGUID
    );

    if (combatant === undefined) {
      // It's not an event we want to add a combatant for.
      return;
    }

    const isEnemyCombatant = combatant.teamID === 0;

    // If it's the first time we have spotted an enemy combatant in arena,
    // then the gates have just opened. Adjust the activity start time.
    if (this.isArena() && !alreadyKnowCombatant && isEnemyCombatant) {
      const combatants = this.activity.combatantMap.values();
      const enemyCombatants = [...combatants].filter((c) => c.teamID === 0);

      if (enemyCombatants.length === 1) {
        const newStartDate = line.date();
        console.log(
          '[ClassicLogHandler] Adjusting game start date:',
          newStartDate
        );
        this.activity.startDate = newStartDate;
      }
    }
  }

  private async handleZoneChange(line: LogLine) {
    console.info('[ClassicLogHandler] Handling ZONE_CHANGE line:', line);

    const zoneID = parseInt(line.arg(1), 10);

    const isZoneArena = Object.prototype.hasOwnProperty.call(
      classicArenas,
      zoneID
    );

    const isZoneBG = Object.prototype.hasOwnProperty.call(
      classicBattlegrounds,
      zoneID
    );

    if (this.activity) {
      const isActivityBG = this.isBattleground();
      const isActivityArena = this.isArena();

      // Sometimes (maybe always) see a double ZONE_CHANGE fired on the way into arena.
      // Explicitly check here that the zoneID we're going to is different than that
      // of the activity we are in to avoid ending the arena on the duplicate event.
      if (isActivityArena && zoneID !== this.activity.zoneID) {
        console.info('[ClassicLogHandler] Zone change out of Arena');
        await this.endArena(line.date());
      }

      if (isActivityBG && zoneID !== this.activity.zoneID) {
        console.info('[ClassicLogHandler] Zone change out of battleground');
        await this.battlegroundEnd(line);
      }
    } else if (isZoneBG) {
      console.info('[ClassicLogHandler] Zone change into BG');
      await this.battlegroundStart(line);
    } else if (isZoneArena) {
      console.info('[ClassicLogHandler] Zone change into Arena');
      const startDate = line.date();
      await this.startArena(startDate, zoneID);
    } else {
      console.info('[ClassicLogHandler] Uninteresting zone change');
    }
  }

  protected handleUnitDiedLine(line: LogLine) {
    if (!this.activity) {
      return;
    }

    const unitFlags = parseInt(line.arg(7), 16);

    if (!isUnitPlayer(unitFlags)) {
      // Deliberatly not logging here as not interesting and frequent.
      return;
    }

    super.handleUnitDiedLine(line);

    if (this.isArena()) {
      this.processArenaDeath(line.date());
    }
  }

  private handleSpellCastSuccess(line: LogLine) {
    if (!this.activity) {
      return;
    }

    const srcGUID = line.arg(1);
    const srcNameRealm = line.arg(2);
    const srcFlags = parseInt(line.arg(3), 16);
    const destGUID = line.arg(5);
    const spellName = line.arg(10);

    const combatant = this.processClassicCombatant(
      srcGUID,
      srcNameRealm,
      srcFlags,
      destGUID
    );

    if (combatant === undefined) {
      // Not an event we can add a combatant for.
      return;
    }

    if (combatant.specID !== undefined) {
      // If we already have a specID for this combatant, no point continuing.
      return;
    }

    const knownSpell = Object.prototype.hasOwnProperty.call(
      classicUniqueSpecSpells,
      spellName
    );

    if (knownSpell) {
      combatant.specID = classicUniqueSpecSpells[spellName];
    }
  }

  private async startArena(startDate: Date, zoneID: number) {
    if (this.activity) {
      console.error(
        "[ClassicLogHandler] Another activity in progress, can't start arena"
      );
      return;
    }

    console.debug('[ClassicLogHandler] Starting arena at date:', startDate);
    const category = VideoCategory.TwoVTwo;

    const activity = new ArenaMatch(
      startDate,
      category,
      zoneID,
      Flavour.Classic
    );

    await this.startActivity(activity);
  }

  private async endArena(endDate: Date) {
    if (!this.activity) {
      console.error(
        '[ClassicLogHandler] Arena stop with no active arena match'
      );
      return;
    }

    console.debug('[ClassicLogHandler] Stopping arena at date:', endDate);
    const arenaMatch = this.activity as ArenaMatch;

    // We decide at the end of the game what bracket it was by counting
    // the players as classic logs don't tell us upfront.
    const combatantMapSize = arenaMatch.combatantMap.size;
    console.info(
      '[ClassicLogHandler] Number of combatants found: ',
      combatantMapSize
    );

    if (combatantMapSize < 5) {
      arenaMatch.category = VideoCategory.TwoVTwo;
    } else if (combatantMapSize < 7) {
      arenaMatch.category = VideoCategory.ThreeVThree;
    } else {
      arenaMatch.category = VideoCategory.FiveVFive;
    }

    // Verbose logging to make it super obvious what's happened.
    console.info('[ClassicLogHandler] Logging combatants');
    arenaMatch.combatantMap.forEach((k, v) => {
      console.log(k, v);
    });

    // We decide who won by counting the deaths. The winner is the
    // team with the least deaths. Classic doesn't have team IDs
    // but we cheated a bit earlier always assigning the player as
    // team 1. So effectively 0 is a loss and 1 is a win here.
    const friendsDead = arenaMatch.deaths.filter((d) => d.friendly).length;
    const enemiesDead = arenaMatch.deaths.filter((d) => !d.friendly).length;
    console.info('[ClassicLogHandler] Friendly deaths: ', friendsDead);
    console.info('[ClassicLogHandler] Enemy deaths: ', enemiesDead);
    const result = friendsDead < enemiesDead ? 1 : 0;

    // TODO:
    // AV win/loss if we see enemy boss die, i.e.:
    // 11/12 13:36:53.746  UNIT_DIED,0000000000000000,nil,0x80000000,0x80000000,Creature-0-4468-30-7750-11946-00006F9FFC,"Drek'Thar",0xa48,0x0,0

    arenaMatch.endArena(endDate, result);
    this.clearDeathTimeout();
    await this.endActivity();
  }

  protected processClassicCombatant(
    srcGUID: string,
    srcNameRealm: string,
    srcFlags: number,
    destGUID: string
  ) {
    if (!this.activity) {
      return undefined;
    }

    const srcCombatant = this.activity.getCombatant(srcGUID);
    const destCombatant = this.activity.getCombatant(destGUID);
    const srcIdentified = srcCombatant !== undefined;
    const destIdentified = destCombatant !== undefined;

    if (
      this.isArena() &&
      !isUnitSelf(srcFlags) &&
      !srcIdentified &&
      !destIdentified
    ) {
      // Drop out of this function if certain conditions are met, long
      // description below. We only ever get here if we're in arena and the event
      // isn't from the player themself.
      //
      // In classic arena we mandate that combatants are only identified by
      // interaction with the player, or a unit that the player has interacted
      // with. This is to avoid counting outsiders.
      //
      // We also avoid this branch if we have registered either the source or
      // destination as a combatant as:
      //   1. It's fine to include a source combatant we have'nt registered so
      //      long as they are interacting with a destination combatant we have
      //      registered.
      //   2. We may rely on spells that do not have a destination for spec
      //      detection, e.g. Bladestorm.
      //
      // This approach can be thought of a bit like a web crawler, where we
      // start from the player and crawl for the other combatants.
      return undefined;
    }

    const combatant = super.processCombatant(
      srcGUID,
      srcNameRealm,
      srcFlags,
      true
    );

    if (combatant === undefined) {
      return combatant;
    }

    // Classic doesn't have team IDs, we cheat a bit here and always assign
    // the player team 1 to share logic with retail.
    if (isUnitFriendly(srcFlags)) {
      combatant.teamID = 1;
    } else {
      combatant.teamID = 0;
    }

    return combatant;
  }

  private setDeathTimeout(ms: number) {
    this.clearDeathTimeout();

    this._playerDeathTimeout = setTimeout(async () => {
      await this.endArena(new Date());
    }, ms);
  }

  private clearDeathTimeout() {
    if (this._playerDeathTimeout) {
      clearTimeout(this._playerDeathTimeout);
    }
  }

  private processArenaDeath(deathDate: Date) {
    if (!this.activity) {
      return;
    }

    this.setDeathTimeout(20000);

    let totalFriends = 0;
    let totalEnemies = 0;

    this.activity.combatantMap.forEach((combatant) => {
      if (combatant.teamID === 1) {
        totalFriends++;
      } else {
        totalEnemies++;
      }
    });

    const deadFriends = this.activity.deaths.filter((d) => d.friendly).length;
    const aliveFriends = totalFriends - deadFriends;

    if (aliveFriends < 1) {
      console.info(
        '[ClassicLogHandler] No friendly players left so ending game.'
      );
      this.endArena(deathDate);
      return;
    }

    const deadEnemies = this.activity.deaths.filter((d) => !d.friendly).length;
    const aliveEnemies = totalEnemies - deadEnemies;

    if (aliveEnemies < 1) {
      console.info('[ClassicLogHandler] No enemy players left so ending game.');
      this.endArena(deathDate);
    }
  }

  private async battlegroundStart(line: LogLine) {
    if (this.activity) {
      console.error(
        "[ClassicLogHandler] Another activity in progress, can't start battleground"
      );
      return;
    }

    const startTime = line.date();
    const category = VideoCategory.Battlegrounds;
    const zoneID = parseInt(line.arg(1), 10);

    const activity = new Battleground(
      startTime,
      category,
      zoneID,
      Flavour.Classic
    );

    await this.startActivity(activity);
  }

  private async battlegroundEnd(line: LogLine) {
    if (!this.activity) {
      console.error(
        "[ClassicLogHandler] Can't stop battleground as no active activity"
      );
      return;
    }

    const endTime = line.date();
    this.activity.end(endTime, false);
    await this.endActivity();
  }
}
