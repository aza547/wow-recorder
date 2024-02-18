import { BrowserWindow } from 'electron';
import { EventEmitter } from 'stream';
import VideoProcessQueue from '../main/VideoProcessQueue';
import Poller from '../utils/Poller';
import Combatant from '../main/Combatant';
import CombatLogWatcher from './CombatLogWatcher';
import ConfigService from '../main/ConfigService';
import { instanceDifficulty } from '../main/constants';
import Recorder from '../main/Recorder';
import { Flavour, PlayerDeathType, VideoQueueItem } from '../main/types';
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
import { allowRecordCategory, getFlavourConfig } from '../utils/configUtils';

/**
 * Generic LogHandler class. Everything in this class must be valid for both
 * classic and retail combat logs.
 *
 * If you need something flavour specific then put it in the appropriate
 * subclass; i.e. RetailLogHandler or ClassicLogHandler.
 */
export default abstract class LogHandler extends EventEmitter {
  public combatLogWatcher: CombatLogWatcher;

  public activity?: Activity;

  public overrunning = false;

  protected recorder: Recorder;

  protected player: Combatant | undefined;

  protected cfg: ConfigService = ConfigService.getInstance();

  protected poller: Poller = Poller.getInstance(getFlavourConfig(this.cfg));

  protected mainWindow: BrowserWindow;

  /**
   * Once we have completed a recording, we throw it onto the
   * VideoProcessQueue to handle cutting it to size, writing accompanying
   * metadata and saving it to the final location for display in the GUI.
   */
  protected videoProcessQueue: VideoProcessQueue;

  constructor(
    mainWindow: BrowserWindow,
    recorder: Recorder,
    videoProcessQueue: VideoProcessQueue,
    logPath: string,
    dataTimeout: number
  ) {
    super();

    this.mainWindow = mainWindow;
    this.recorder = recorder;

    this.combatLogWatcher = new CombatLogWatcher(logPath, dataTimeout);
    this.combatLogWatcher.watch();

    this.combatLogWatcher.on('timeout', (ms: number) => {
      this.dataTimeout(ms);
    });

    this.videoProcessQueue = videoProcessQueue;
  }

  destroy() {
    this.combatLogWatcher.unwatch();
    this.combatLogWatcher.removeAllListeners();
  }

  protected async handleEncounterStartLine(line: LogLine, flavour: Flavour) {
    console.debug('[LogHandler] Handling ENCOUNTER_START line:', line);

    const startDate = line.date();
    const encounterID = parseInt(line.arg(1), 10);
    const difficultyID = parseInt(line.arg(3), 10);
    const encounterName = line.arg(2);

    const isRecognisedDifficulty = Object.prototype.hasOwnProperty.call(
      instanceDifficulty,
      difficultyID
    );

    if (!isRecognisedDifficulty) {
      throw new Error(`[LogHandler] Unknown difficulty ID: ${difficultyID}`);
    }

    const isRaidEncounter =
      instanceDifficulty[difficultyID].partyType === 'raid';

    if (!isRaidEncounter) {
      console.debug('[LogHandler] Not a raid encounter, not recording');
      return;
    }

    const activity = new RaidEncounter(
      startDate,
      encounterID,
      encounterName,
      difficultyID,
      flavour
    );

    await this.startActivity(activity);
  }

  protected async handleEncounterEndLine(line: LogLine) {
    console.debug('[LogHandler] Handling ENCOUNTER_END line:', line);

    if (!this.activity) {
      console.info('[LogHandler] Encounter stop with no active encounter');
      return;
    }

    const result = Boolean(parseInt(line.arg(5), 10));

    if (result) {
      const overrun = this.cfg.get<number>('raidOverrun');
      this.activity.overrun = overrun;
    }

    this.activity.end(line.date(), result);
    await this.endActivity();
  }

  protected handleUnitDiedLine(line: LogLine): void {
    if (!this.activity) {
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

  protected async startActivity(activity: Activity) {
    const { category } = activity;
    const allowed = allowRecordCategory(this.cfg, category);

    if (!allowed) {
      console.info('[LogHandler] Not configured to record', category);
      return;
    }

    console.log(
      `[LogHandler] Start recording a video for category: ${category}`
    );

    try {
      this.activity = activity;
      await this.recorder.start();
      this.emit('state-change');
    } catch (error) {
      console.error('[LogHandler] Error starting activity', String(error));
      this.activity = undefined;
    }
  }

  /**
   * End the recording after the overrun has elasped. Every single activity
   * ending comes through this function.
   */
  protected async endActivity() {
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
    this.overrunning = true;
    this.activity = undefined;

    const { overrun } = lastActivity;

    if (overrun > 0) {
      this.emit('state-change');
      console.info('[LogHandler] Awaiting overrun:', overrun);
      await new Promise((resolve) => setTimeout(resolve, 1000 * overrun));
      console.info('[LogHandler] Done awaiting overrun');
    }

    this.overrunning = false;
    const { startDate } = this.recorder;
    let videoFile;

    try {
      await this.recorder.stop();
      videoFile = this.recorder.lastFile;
      this.poller.start();
    } catch (error) {
      console.error('[LogHandler] Failed to stop OBS, discarding video');
      return;
    }

    try {
      const activityStartTime = lastActivity.startDate.getTime();
      const bufferStartTime = startDate.getTime();
      const offset = (activityStartTime - bufferStartTime) / 1000;
      const metadata = lastActivity.getMetadata();
      const { duration } = metadata;
      const suffix = lastActivity.getFileName();

      if (lastActivity.category === VideoCategory.Raids) {
        const minDuration = this.cfg.get<number>('minEncounterDuration');
        const notLongEnough = duration < minDuration;

        if (notLongEnough) {
          console.info('[LogHandler] Discarding raid encounter, too short');
          return;
        }
      }

      const queueItem: VideoQueueItem = {
        source: videoFile,
        suffix,
        offset,
        duration,
        metadata,
        deleteSource: true,
      };

      this.videoProcessQueue.queueVideo(queueItem);
    } catch (error) {
      // We've failed to get the Metadata from the activity. Throw away the
      // video and log why. Example of when we hit this is on raid resets
      // where we don't have long enough to get a GUID for the player.
      console.warn(
        '[LogHandler] Discarding video as failed to get Metadata:',
        String(error)
      );
    }
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

  public async forceEndActivity(timedelta = 0) {
    if (!this.activity) {
      console.error('[LogHandler] forceEndActivity called but no activity');
      return;
    }

    console.info('[LogHandler] Force ending activity, timedelta:', timedelta);
    const endDate = new Date();
    endDate.setTime(endDate.getTime() + timedelta * 1000);
    this.activity.overrun = 0;

    this.activity.end(endDate, false);
    await this.endActivity();
    this.activity = undefined;
  }

  protected async zoneChangeStop(line: LogLine) {
    if (!this.activity) {
      console.error('[LogHandler] No active activity on zone change stop');

      return;
    }

    const endDate = line.date();
    this.activity.end(endDate, false);
    await this.endActivity();
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
