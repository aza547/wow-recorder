import {
  classicArenas,
  classicBattlegrounds,
  classicUniqueSpecAuras,
  classicUniqueSpecSpells,
  mopChallengeModes,
} from '../main/constants';

import LogHandler from './LogHandler';
import { Flavour } from '../main/types';
import ArenaMatch from '../activitys/ArenaMatch';
import { isUnitFriendly, isUnitPlayer, isUnitSelf } from './logutils';
import Battleground from '../activitys/Battleground';
import LogLine from './LogLine';
import { VideoCategory } from '../types/VideoCategory';
import Combatant from 'main/Combatant';
import ChallengeModeDungeon from 'activitys/ChallengeModeDungeon';
import ConfigService from 'config/ConfigService';

/**
 * Classic log handler class.
 */
export default class ClassicLogHandler extends LogHandler {
  constructor(logPath: string) {
    super(logPath, 2);

    /* eslint-disable prettier/prettier */
    this.combatLogWatcher
      .on('ENCOUNTER_START',      (line: LogLine) => { this.logProcessQueue.add(async () => this.handleEncounterStartLine(line)) })
      .on('ENCOUNTER_END',        (line: LogLine) => { this.logProcessQueue.add(async () => this.handleEncounterEndLine(line)) })
      .on('ZONE_CHANGE',          (line: LogLine) => { this.logProcessQueue.add(async () => this.handleZoneChange(line)) })
      .on('SPELL_AURA_APPLIED',   (line: LogLine) => { this.logProcessQueue.add(async () => this.handleSpellAuraAppliedLine(line)) })
      .on('UNIT_DIED',            (line: LogLine) => { this.logProcessQueue.add(async () => this.handleUnitDiedLine(line)) })
      .on('SPELL_CAST_SUCCESS',   (line: LogLine) => { this.logProcessQueue.add(async () => this.handleSpellCastSuccess(line)) })
      .on('COMBATANT_INFO',       (line: LogLine) => { this.logProcessQueue.add(async () => this.handleCombatantInfoLine(line)) })
      .on('CHALLENGE_MODE_START', (line: LogLine) => { this.logProcessQueue.add(async () => this.handleChallengeModeStartLine(line)) })
      .on('CHALLENGE_MODE_END',   (line: LogLine) => { this.logProcessQueue.add(async () => this.handleChallengeModeEndLine(line)) });
    /* eslint-enable prettier/prettier */
  }

  protected async handleEncounterStartLine(line: LogLine) {
    console.debug('[ClassicLogHandler] Handling ENCOUNTER_START line:', line);

    if (this.isManual()) {
      console.info('[ClassicLogHandler] Ignoring line as in manual recording');
      return;
    }

    await super.handleEncounterStartLine(line, Flavour.Classic);
  }

  private handleSpellAuraAppliedLine(line: LogLine) {
    if (!LogHandler.activity || this.isManual()) {
      // Deliberately don't log anything here as we can hit this a lot
      return;
    }

    const srcGUID = line.arg(1);
    const srcFlags = parseInt(line.arg(3), 16);
    const srcNameRealm = line.arg(2);
    const destGUID = line.arg(5);
    const destFlags = line.arg(7);
    const destNameRealm = line.arg(6);
    const spellName = line.arg(10);

    const alreadyKnowCombatant =
      LogHandler.activity.getCombatant(srcGUID) !== undefined;

    const combatant = this.processClassicCombatant(
      srcGUID,
      srcNameRealm,
      srcFlags,
      destGUID,
      destNameRealm,
      destFlags,
    );

    if (combatant === undefined) {
      // It's not an event we want to add a combatant for.
      return;
    }

    const isEnemyCombatant = combatant.teamID === 0;

    // If it's the first time we have spotted an enemy combatant in arena,
    // then the gates have just opened. Adjust the activity start time.
    if (this.isArena() && !alreadyKnowCombatant && isEnemyCombatant) {
      const combatants = LogHandler.activity.combatantMap.values();
      const enemyCombatants = [...combatants].filter((c) => c.teamID === 0);

      if (enemyCombatants.length === 1) {
        const newStartDate = line.date();
        console.info(
          '[ClassicLogHandler] Adjusting game start date:',
          newStartDate,
        );
        LogHandler.activity.startDate = newStartDate;
      }
    }

    if (combatant.specID === undefined) {
      const knownSpell = Object.prototype.hasOwnProperty.call(
        classicUniqueSpecAuras,
        spellName,
      );

      if (knownSpell) {
        combatant.specID = classicUniqueSpecAuras[spellName];
      }
    }
  }

  private async handleZoneChange(line: LogLine) {
    console.info('[ClassicLogHandler] Handling ZONE_CHANGE line:', line);

    if (this.isManual()) {
      console.info('[ClassicLogHandler] Ignoring line as in manual recording');
      return;
    }

    const zoneID = parseInt(line.arg(1), 10);

    const isZoneArena = Object.prototype.hasOwnProperty.call(
      classicArenas,
      zoneID,
    );

    const isZoneBG = Object.prototype.hasOwnProperty.call(
      classicBattlegrounds,
      zoneID,
    );

    if (LogHandler.activity) {
      const isActivityBG = this.isBattleground();
      const isActivityArena = this.isArena();

      // Sometimes (maybe always) see a double ZONE_CHANGE fired on the way into arena.
      // Explicitly check here that the zoneID we're going to is different than that
      // of the activity we are in to avoid ending the arena on the duplicate event.
      if (isActivityArena && zoneID !== LogHandler.activity.zoneID) {
        console.info('[ClassicLogHandler] Zone change out of Arena');
        await this.endArena(line.date());
      }

      if (isActivityBG && zoneID !== LogHandler.activity.zoneID) {
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
    if (!LogHandler.activity || this.isManual()) {
      // Deliberately don't log anything here as we can hit this a lot
      return;
    }

    const unitFlags = parseInt(line.arg(7), 16);
    const isPlayer = isUnitPlayer(unitFlags);
    const isFeignDeath = Boolean(parseInt(line.arg(9), 10));

    if (!isPlayer || isFeignDeath) {
      // Deliberatly not logging here as not interesting and frequent.
      return;
    }

    super.handleUnitDiedLine(line);

    if (this.isArena()) {
      this.processArenaDeath(line.date());
    }
  }

  private handleSpellCastSuccess(line: LogLine) {
    if (!LogHandler.activity || this.isManual()) {
      // Deliberately don't log anything here as we can hit this a lot
      return;
    }

    const srcGUID = line.arg(1);
    const srcNameRealm = line.arg(2);
    const srcFlags = parseInt(line.arg(3), 16);
    const destGUID = line.arg(5);
    const destFlags = line.arg(7);
    const destNameRealm = line.arg(6);
    const spellName = line.arg(10);

    const combatant = this.processClassicCombatant(
      srcGUID,
      srcNameRealm,
      srcFlags,
      destGUID,
      destNameRealm,
      destFlags,
    );

    if (combatant === undefined) {
      // Not an event we can add a combatant for.
      return;
    }

    if (combatant.specID === undefined) {
      const knownSpell = Object.prototype.hasOwnProperty.call(
        classicUniqueSpecSpells,
        spellName,
      );

      if (knownSpell) {
        combatant.specID = classicUniqueSpecSpells[spellName];
      }
    }
  }

  private async startArena(startDate: Date, zoneID: number) {
    if (LogHandler.activity) {
      console.error(
        "[ClassicLogHandler] Another activity in progress, can't start arena",
      );
      return;
    }

    console.debug('[ClassicLogHandler] Starting arena at date:', startDate);
    const category = VideoCategory.TwoVTwo;

    const activity = new ArenaMatch(
      startDate,
      category,
      zoneID,
      Flavour.Classic,
    );

    await LogHandler.startActivity(activity);
  }

  private static calculateArenaResult(arenaMatch: ArenaMatch) {
    // We decide who won by counting the deaths. The winner is the
    // team with the least deaths. Classic doesn't have team IDs
    // but we cheated a bit earlier always assigning the player as
    // team 1. So effectively 0 is a loss and 1 is a win here.
    const friendsDead = arenaMatch.deaths.filter((d) => d.friendly).length;
    const enemiesDead = arenaMatch.deaths.filter((d) => !d.friendly).length;
    console.info('[ClassicLogHandler] Friendly deaths: ', friendsDead);
    console.info('[ClassicLogHandler] Enemy deaths: ', enemiesDead);
    const result = friendsDead < enemiesDead ? 1 : 0;

    return result;
  }

  private async endArena(endDate: Date) {
    if (!LogHandler.activity) {
      console.error(
        '[ClassicLogHandler] Arena stop with no active arena match',
      );
      return;
    }

    console.debug('[ClassicLogHandler] Stopping arena at date:', endDate);
    const arenaMatch = LogHandler.activity as ArenaMatch;
    const result = await ClassicLogHandler.calculateArenaResult(arenaMatch);
    arenaMatch.endArena(endDate, result);
    await LogHandler.endActivity();
  }

  protected processClassicCombatant(
    srcGUID: string,
    srcNameRealm: string,
    srcFlags: number,
    destGUID: string,
    destNameRealm: string,
    destFlags: number,
  ) {
    if (!LogHandler.activity) {
      return undefined;
    }

    const srcCombatant = LogHandler.activity.getCombatant(srcGUID);
    const destCombatant = LogHandler.activity.getCombatant(destGUID);
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

    if (srcIdentified && !destIdentified) {
      // If we know the source but not the dest, we want to add the dest so
      // we can fill in the combatant details later. That allows the crawling
      // to go both directions.
      super.processCombatant(destGUID, destNameRealm, destFlags, true);
    }

    const combatant = super.processCombatant(
      srcGUID,
      srcNameRealm,
      srcFlags,
      true,
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

  private processArenaDeath(deathDate: Date) {
    if (!LogHandler.activity) {
      return;
    }

    let totalFriends = 0;
    let totalEnemies = 0;

    LogHandler.activity.combatantMap.forEach((combatant) => {
      if (combatant.teamID === 1) {
        totalFriends++;
      } else {
        totalEnemies++;
      }
    });

    const deadFriends = LogHandler.activity.deaths.filter(
      (d) => d.friendly,
    ).length;
    const aliveFriends = totalFriends - deadFriends;

    if (aliveFriends < 1) {
      console.info(
        '[ClassicLogHandler] No friendly players left so ending game.',
      );
      this.endArena(deathDate);
      return;
    }

    const deadEnemies = LogHandler.activity.deaths.filter(
      (d) => !d.friendly,
    ).length;
    const aliveEnemies = totalEnemies - deadEnemies;

    if (aliveEnemies < 1) {
      console.info('[ClassicLogHandler] No enemy players left so ending game.');
      this.endArena(deathDate);
    }
  }

  private async battlegroundStart(line: LogLine) {
    if (LogHandler.activity) {
      console.error(
        "[ClassicLogHandler] Another activity in progress, can't start battleground",
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
      Flavour.Classic,
    );

    await LogHandler.startActivity(activity);
  }

  private async battlegroundEnd(line: LogLine) {
    if (!LogHandler.activity) {
      console.error(
        "[ClassicLogHandler] Can't stop battleground as no active activity",
      );
      return;
    }

    const endTime = line.date();
    LogHandler.activity.end(endTime, false);
    await LogHandler.endActivity();
  }

  private handleCombatantInfoLine(line: LogLine) {
    console.debug('[ClassicLogHandler] Handling COMBATANT_INFO line:', line);

    if (this.isManual()) {
      console.info('[ClassicLogHandler] Ignoring line as in manual recording');
      return;
    }

    if (!LogHandler.activity) {
      console.warn(
        '[ClassicLogHandler] No activity in progress, ignoring COMBATANT_INFO',
      );
      return;
    }

    const GUID = line.arg(1);

    // In CMs we see COMBANTANT_INFO events for each encounter.
    // Don't bother overwriting them if we have them already.
    const combatant = LogHandler.activity.getCombatant(GUID);

    if (combatant) {
      return;
    }

    console.info(
      '[RetailLogHandler] Adding combatant from COMBATANT_INFO',
      GUID,
    );

    // We weirdly MOP classic doesn't include class or spec in
    // the COMBATANT_INFO.
    const newCombatant = new Combatant(GUID);
    LogHandler.activity.addCombatant(newCombatant);
  }

  private async handleChallengeModeStartLine(line: LogLine) {
    console.debug(
      '[ClassicLogHandler] Handling CHALLENGE_MODE_START line:',
      line,
    );

    if (this.isManual()) {
      console.info('[ClassicLogHandler] Ignoring line as in manual recording');
      return;
    }

    if (
      LogHandler.activity &&
      LogHandler.activity.category === VideoCategory.MythicPlus
    ) {
      // This can happen if you zone in and out of a key mid pull.
      // If it's a new key, we see a CHALLENGE_MODE_END event first.
      console.info('[ClassicLogHandler] Subsequent start event for dungeon');
      return;
    }

    const zoneID = parseInt(line.arg(2), 10);
    const mapID = parseInt(line.arg(3), 10);

    const unknownMap = !Object.prototype.hasOwnProperty.call(
      mopChallengeModes,
      mapID,
    );

    if (unknownMap) {
      console.error('[ClassicLogHandler] Unknown map', mapID);
      return;
    }

    const recordChallengeModes = ConfigService.getInstance().get<boolean>(
      'recordChallengeModes',
    );

    if (!recordChallengeModes) {
      console.info(
        '[ClassicLogHandler] Ignoring MoP Challenge Mode (disabled in settings)',
      );
      return;
    }

    const startTime = line.date();

    const activity = new ChallengeModeDungeon(
      startTime,
      zoneID,
      mapID,
      0,
      [],
      Flavour.Classic,
    );

    await LogHandler.startActivity(activity);
  }

  private async handleChallengeModeEndLine(line: LogLine) {
    console.debug(
      '[ClassicLogHandler] Handling CHALLENGE_MODE_END line:',
      line,
    );

    if (this.isManual()) {
      console.info('[ClassicLogHandler] Ignoring line as in manual recording');
      return;
    }

    if (!LogHandler.activity) {
      console.error(
        '[ClassicLogHandler] Challenge mode stop with no active ChallengeModeDungeon',
      );
      return;
    }

    const challengeModeActivity = LogHandler.activity as ChallengeModeDungeon;
    const endDate = line.date();

    challengeModeActivity.endChallengeMode(endDate, 0, true);
    await LogHandler.endActivity();
  }
}
