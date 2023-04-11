import { getSortedFiles } from '../main/util';
import Combatant from '../main/Combatant';
import CombatLogParser from './CombatLogParser';
import ConfigService from '../main/ConfigService';
import { raidInstances } from '../main/constants';
import Recorder from '../main/Recorder';
import { Flavour, PlayerDeathType } from '../main/types';
import Activity from '../activitys/Activity';
import RaidEncounter from '../activitys/RaidEncounter';

import {
  ambiguate,
  isUnitFriendly,
  isUnitPlayer,
  isUnitSelf,
} from './logutils';

import LogLine from './LogLine';
import { VideoCategory } from '../types/VideoCategory';
import { allowRecordCategory } from '../utils/configUtils';

/**
 * Generic LogHandler class. Everything in this class must be valid for both
 * classic and retail combat logs.
 *
 * If you need something flavour specific then put it in the appropriate
 * subclass; i.e. RetailLogHandler or ClassicLogHandler.
 */
export default abstract class LogHandler {
  protected recorder: Recorder;

  protected _combatLogParser: CombatLogParser;

  protected _player: Combatant | undefined;

  protected _cfg: ConfigService;

  protected _activity?: Activity;

  constructor(recorder: Recorder, logPath: string, dataTimeout: number) {
    this.recorder = recorder;

    this._combatLogParser = new CombatLogParser({
      dataTimeout: dataTimeout * 60 * 1000,
      fileFinderFn: getSortedFiles,
    });

    this._combatLogParser.watchPath(logPath);

    this._combatLogParser.on('DataTimeout', async (ms: number) => {
      await this.dataTimeout(ms);
    });

    this._cfg = ConfigService.getInstance();
  }

  reconfigure(logPath: string) {
    this._combatLogParser.unwatch();
    this._combatLogParser.watchPath(logPath);
  }

  get activity() {
    return this._activity;
  }

  set activity(activity) {
    this._activity = activity;
  }

  get combatLogParser() {
    return this._combatLogParser;
  }

  get cfg() {
    return this._cfg;
  }

  get player() {
    return this._player;
  }

  protected async handleEncounterStartLine(line: LogLine, flavour: Flavour) {
    console.debug('[LogHandler] Handling ENCOUNTER_START line:', line);

    const startDate = line.date();
    const encounterID = parseInt(line.arg(1), 10);
    const difficultyID = parseInt(line.arg(3), 10);

    const raids = raidInstances.filter((r) =>
      Object.prototype.hasOwnProperty.call(r.encounters, encounterID)
    );

    if (!raids.pop()) {
      console.debug('[LogHandler] Encounter ID not recognised, not recording');
      return;
    }

    this.activity = new RaidEncounter(
      startDate,
      encounterID,
      difficultyID,
      flavour
    );

    await this.startRecording(this.activity);
  }

  protected async handleEncounterEndLine(line: LogLine) {
    console.debug('[LogHandler] Handling ENCOUNTER_END line:', line);

    if (!this.activity) {
      console.error('[LogHandler] Encounter stop with no active encounter');
      return;
    }

    const result = Boolean(parseInt(line.arg(5), 10));
    this.activity.end(line.date(), result);
    await this.endRecording();
  }

  protected handleUnitDiedLine(line: LogLine): void {
    if (!this.activity) {
      console.info(
        '[LogHandler] Ignoring UNIT_DIED line as no active activity'
      );
      return;
    }

    const unitFlags = parseInt(line.arg(7), 16);

    if (!isUnitPlayer(unitFlags)) {
      // Deliberatly not logging here as not interesting and frequent.
      return;
    }

    const isUnitUnconsciousAtDeath = Boolean(parseInt(line.arg(9), 10));

    if (isUnitUnconsciousAtDeath) {
      // Deliberatly not logging here as not interesting and frequent.
      return;
    }

    const playerName = line.arg(6);
    const playerGUID = line.arg(5);
    const playerSpecId = this.activity.getCombatant(playerGUID)?.specID ?? 0;

    // Add player death and subtract 2 seconds from the time of death to allow the
    // user to view a bit of the video before the death and not at the actual millisecond
    // it happens.
    const deathDate = (line.date().getTime() - 2) / 1000;
    const activityStartDate = this.activity.startDate.getTime() / 1000;
    let relativeTime = deathDate - activityStartDate;

    if (relativeTime < 0) {
      console.error('[LogHandler] Tried to set timestamp to', relativeTime);
      relativeTime = 0;
    }

    const playerDeath: PlayerDeathType = {
      name: playerName,
      specId: playerSpecId,
      date: line.date(),
      timestamp: relativeTime,
      friendly: isUnitFriendly(unitFlags),
    };

    this.activity.addDeath(playerDeath);
  }

  protected async startRecording(activity: Activity) {
    const { category } = activity;
    const allowed = allowRecordCategory(this.cfg, category);

    if (!allowed) {
      console.info('[LogHandler] Not configured to record', category);
      return;
    }

    console.log(
      `[LogHandler] Start recording a video for category: ${category}`
    );

    await this.recorder.start();
  }

  /**
   * End the recording after the overrun has elasped. Every single activity
   * ending comes through this function.
   */
  protected async endRecording(closedWow = false) {
    if (!this.activity) {
      console.error("[LogHandler] No active activity so can't stop");
      return;
    }

    console.info(
      `[LogHandler] Ending recording video for category: ${this.activity.category}`
    );

    // It's important we clear the activity before we call stop as stop will
    // await for the overrun, and we might do weird things if the player
    // immediately starts a new activity while we're awaiting. See issue 291.
    const lastActivity = this.activity;
    this.activity = undefined;
    await this.recorder.stop(lastActivity, closedWow);
  }

  protected async dataTimeout(ms: number) {
    console.log(
      `[LogHandler] Haven't received data for combatlog in ${
        ms / 1000
      } seconds.`
    );

    if (this.activity) {
      await this.forceEndActivity(-ms / 1000);
    }
  }

  public async forceEndActivity(timedelta = 0, closedWow = false) {
    console.log(
      '[LogHandler] Force ending activity',
      'timedelta:',
      timedelta,
      'closedWow:',
      closedWow
    );

    if (!this.activity) {
      await this.recorder.forceStop();
      return;
    }

    const endDate = new Date();
    endDate.setTime(endDate.getTime() + timedelta * 1000);
    this.activity.overrun = 0;

    this.activity.end(endDate, false);
    await this.endRecording(closedWow);
    this.activity = undefined;
  }

  protected async zoneChangeStop(line: LogLine) {
    if (!this.activity) {
      console.error(
        '[RetailLogHandler] No active activity on force zone change stop'
      );

      return;
    }

    const endDate = line.date();
    this.activity.end(endDate, false);
    await this.endRecording();
  }

  protected isArena() {
    if (!this.activity) {
      return false;
    }

    const { category } = this.activity;

    return (
      category === VideoCategory.TwoVTwo ||
      category === VideoCategory.ThreeVThree ||
      category === VideoCategory.FiveVFive ||
      category === VideoCategory.Skirmish ||
      category === VideoCategory.SoloShuffle
    );
  }

  protected isBattleground() {
    if (!this.activity) {
      return false;
    }

    const { category } = this.activity;
    return category === VideoCategory.Battlegrounds;
  }

  protected processCombatant(
    srcGUID: string,
    srcNameRealm: string,
    srcFlags: number,
    allowNew: boolean
  ) {
    let combatant: Combatant | undefined;

    if (!this.activity) {
      return combatant;
    }

    // Logs sometimes emit this GUID and we don't want to include it.
    // No idea what causes it. Seems really common but not exlusive on
    // "Shadow Word: Death" casts.
    if (srcGUID === '0000000000000000') {
      return combatant;
    }

    if (!isUnitPlayer(srcFlags)) {
      return combatant;
    }

    // We check if we already know the playerGUID here, no point updating it
    // because it can't change, unless the user changes characters mid
    // recording like in issue 355, in which case better to retain the initial
    // character details.
    if (!this.activity.playerGUID && isUnitSelf(srcFlags)) {
      this.activity.playerGUID = srcGUID;
    }

    // Even if the combatant exists already we still update it with the info it
    // may not have yet. We can't tell the name, realm or if it's the player
    // from COMBATANT_INFO events.
    combatant = this.activity.getCombatant(srcGUID);

    if (allowNew && combatant === undefined) {
      // We've failed to get a pre-existing combatant, but we are allowed to add it.
      combatant = new Combatant(srcGUID);
    } else if (combatant === undefined) {
      // We've failed to get a pre-existing combatant, and we're not allowed to add it.
      return combatant;
    }

    if (combatant.isFullyDefined()) {
      // No point doing anything more here, we already know all the details.
      return combatant;
    }

    [combatant.name, combatant.realm] = ambiguate(srcNameRealm);
    this.activity.addCombatant(combatant);
    return combatant;
  }
}
