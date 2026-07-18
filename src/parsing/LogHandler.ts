import VideoProcessQueue from '../main/VideoProcessQueue';
import Combatant from '../main/Combatant';
import CombatLogWatcher from './CombatLogWatcher';
import ConfigService from '../config/ConfigService';
import { instanceDifficulty } from '../main/constants';
import Recorder from '../main/Recorder';
import {
  Flavour,
  PlayerDeathType,
  SoundAlerts,
  VideoQueueItem,
} from '../main/types';
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
import { assert } from 'console';
import Manual from 'activitys/Manual';
import { playSoundAlert } from 'main/main';
import Poller from 'utils/Poller';
import { emitErrorReport, refreshInstantReplayState } from 'main/util';
import AsyncQueue from 'utils/AsyncQueue';
import path from 'path';
import { ESupportedEncoders } from 'main/obsEnums';

/**
 * Generic LogHandler class. Everything in this class must be valid for both
 * classic and retail combat logs.
 *
 * If you need something flavour specific then put it in the appropriate
 * subclass; i.e. RetailLogHandler, ClassicLogHandler or EraLogHandler.
 *
 * Static fields in this class provide locking function. While we will
 * typically have up to 4 child classes, we don't want multiple concurrent
 * activities.
 */
export default abstract class LogHandler {
  public static activity: Activity | undefined;

  public static overrunning = false;

  public combatLogWatcher: CombatLogWatcher;

  protected player: Combatant | undefined;

  private static stateChangeCallback: () => void;

  /**
   * The timer is static and thus shared across all LogHandlers. We don't want
   * any weird behaviour when quickly switching between games. See Issue 855.
   */
  private static logDataTimeout: NodeJS.Timeout | null = null;

  /**
   * The lower this timer the better, but log flush behaviour varies between
   * games and we can't make it too low or we risk ending activities early. Let
   * the specific log handler instance decide what the timeout should be.
   */
  private logDataTimeoutMs: number;

  /**
   * Enforces ordered processing of log lines. Some log line processing
   * is asynchronous so we need to ensure later lines don't get processed
   * before earlier ones.
   */
  protected logProcessQueue = new AsyncQueue(Number.MAX_SAFE_INTEGER);

  constructor(logPath: string, dataTimeoutMins: number) {
    this.logDataTimeoutMs = dataTimeoutMins * 60 * 1000;
    this.combatLogWatcher = new CombatLogWatcher(logPath);
    this.combatLogWatcher.watch();
    const lpq = this.logProcessQueue;

    // For ease of testing force stop.
    this.combatLogWatcher.on('WARCRAFT_RECORDER_FORCE_STOP', () => {
      lpq.add(async () => LogHandler.forceEndActivity());
    });

    this.combatLogWatcher.on('WARCRAFT_RECORDER_LOG_ACTIVITY', () => {
      lpq.add(async () => this.resetTimeout());
    });
  }

  public static setStateChangeCallback = (
    cb: typeof LogHandler.stateChangeCallback,
  ) => {
    this.stateChangeCallback = cb;
  };

  public destroy() {
    this.combatLogWatcher.unwatch();
    this.combatLogWatcher.removeAllListeners();
  }

  protected async handleEncounterStartLine(line: LogLine, flavour: Flavour) {
    console.debug('[LogHandler] Handling ENCOUNTER_START line:', line);

    if (LogHandler.activity) {
      console.warn('[LogHandler] Activity already in progress');
      return;
    }

    const startDate = line.date();
    const encounterID = parseInt(line.arg(1), 10);
    const difficultyID = parseInt(line.arg(3), 10);
    const encounterName = line.arg(2);

    const isRecognisedDifficulty = Object.prototype.hasOwnProperty.call(
      instanceDifficulty,
      difficultyID,
    );

    if (!isRecognisedDifficulty) {
      throw new Error(`[LogHandler] Unknown difficulty ID: ${difficultyID}`);
    }

    const isRaidEncounter =
      instanceDifficulty[difficultyID].partyType === 'raid';

    if (!isRaidEncounter) {
      console.debug('[LogHandler] Not a raid encounter, do nothing');
      return;
    }

    const activity = new RaidEncounter(
      startDate,
      encounterID,
      encounterName,
      difficultyID,
      flavour,
    );

    await LogHandler.startActivity(activity);
  }

  protected async handleEncounterEndLine(line: LogLine) {
    console.debug('[LogHandler] Handling ENCOUNTER_END line:', line);

    if (this.isManual()) {
      console.info('[ClassicLogHandler] Ignoring line as in manual recording');
      return;
    }

    if (!LogHandler.activity) {
      console.info('[LogHandler] Encounter stop with no active encounter');
      return;
    }

    const difficultyID = parseInt(line.arg(3), 10);

    const isRaidEncounter =
      instanceDifficulty[difficultyID].partyType === 'raid';

    if (!isRaidEncounter) {
      console.debug('[LogHandler] Not a raid encounter, do nothing');
      return;
    }

    const result = Boolean(parseInt(line.arg(5), 10));

    if (result) {
      const overrun = ConfigService.getInstance().get<number>('raidOverrun');
      LogHandler.activity.overrun = overrun;
    }

    LogHandler.activity.end(line.date(), result);
    await LogHandler.endActivity();
  }

  protected handleUnitDiedLine(line: LogLine): void {
    if (!LogHandler.activity) {
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
    const playerSpecId =
      LogHandler.activity.getCombatant(playerGUID)?.specID ?? 0;

    // Add player death and subtract 2 seconds from the time of death to allow the
    // user to view a bit of the video before the death and not at the actual millisecond
    // it happens.
    const deathDate = (line.date().getTime() - 2) / 1000;
    const activityStartDate = LogHandler.activity.startDate.getTime() / 1000;
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

    LogHandler.activity.addDeath(playerDeath);
    refreshInstantReplayState(LogHandler.activity);
  }

  protected static async startActivity(activity: Activity) {
    const { category } = activity;
    const allowed = allowRecordCategory(ConfigService.getInstance(), category);

    if (!allowed) {
      console.info('[LogHandler] Not configured to record', category);
      return;
    }

    console.info(
      `[LogHandler] Start recording a video for category: ${category}`,
    );

    // Offset is the number of seconds to cut back into the buffer. That way
    // the buffer length is irrelevant. It is physically impossible to have
    // a negative offset. That would mean an activity started in the future.
    const offset = (Date.now() - activity.startDate.getTime()) / 1000;
    console.info(`[LogHandler] Calculated offset seconds`, offset);
    assert(offset >= 0);

    try {
      LogHandler.activity = activity;
      await Recorder.getInstance().startRecording(offset);
      LogHandler.stateChangeCallback();
    } catch (error) {
      console.error('[LogHandler] Error starting activity', String(error));
      LogHandler.activity = undefined;
    }
  }

  /**
   * End the recording after the overrun has elasped. Every single activity
   * ending comes through this function.
   */
  protected static async endActivity() {
    if (!LogHandler.activity) {
      console.error("[LogHandler] No active activity so can't stop");
      return;
    }

    console.info(
      `[LogHandler] Ending recording video for category: ${LogHandler.activity.category}`,
    );

    // It's important we clear the activity before we call stop as stop will
    // await for the overrun, and we might do weird things if the player
    // immediately starts a new activity while we're awaiting. See issue 291.
    const lastActivity = LogHandler.activity;
    LogHandler.overrunning = true;
    LogHandler.activity = undefined;

    const { overrun } = lastActivity;

    if (overrun > 0) {
      console.info('[LogHandler] Awaiting overrun:', overrun);
      LogHandler.stateChangeCallback();
      await new Promise((resolve) => setTimeout(resolve, 1000 * overrun));
      console.info('[LogHandler] Done awaiting overrun');
    }

    LogHandler.overrunning = false;
    const recorder = Recorder.getInstance();
    const poller = Poller.getInstance();
    const cfg = ConfigService.getInstance();

    let videoFile;

    const stopPromise = recorder.stop(); // Queue the stop.
    const wowRunning = poller.isWowRunning();

    if (wowRunning) {
      // Immediately queue the buffer start so it's ready if we go instantly into another activity.
      console.info('[LogHandler] Queue buffer start as WoW still running');
      recorder.startBuffer(); // No assignment, we don't care about when it's done.
    }

    try {
      // Now await the stop so we get the file from the recorder. Clear it
      // when we do to prevent it being reused.
      await stopPromise;
      videoFile = recorder.getAndClearLastFile();
    } catch (error) {
      console.error(
        '[LogHandler] Failed to stop recording, discarding video',
        error,
      );

      const report =
        'Failed to stop recording, discarding: ' + lastActivity.getFileName();
      emitErrorReport(report);

      return;
    }

    if (!videoFile) {
      console.error('[LogHandler] No video file available');

      const report =
        'No video file produced, discarding: ' + lastActivity.getFileName();
      emitErrorReport(report);

      return;
    }

    try {
      const metadata = lastActivity.getMetadata();
      const { duration } = metadata;
      const suffix = lastActivity.getFileName();

      if (lastActivity.category === VideoCategory.Raids) {
        const minDuration = cfg.get<number>('minEncounterDuration');
        const notLongEnough = duration < minDuration;

        if (notLongEnough) {
          console.info('[LogHandler] Discarding raid encounter, too short');
          return;
        }
      }

      // Add the encoder field. Just do this directly from the config, as the
      // encoder can't be changed mid recording.`
      metadata.encoder = cfg.get<string>('obsRecEncoder') as ESupportedEncoders;

      // This looks redundant as we also pass videoFile but this allows us to
      // share logic with clipping of remote videos where there is no file path.
      const videoName = path.basename(videoFile, path.extname(videoFile));

      const queueItem: VideoQueueItem = {
        name: videoName,
        source: videoFile,
        suffix,
        offset: 0, // We don't need to offset here, we've already cut the buffer back.
        duration,
        metadata,
        clip: false,
      };

      VideoProcessQueue.getInstance().queueVideo(queueItem);
    } catch (error) {
      // We've failed to get the Metadata from the activity. Throw away the
      // video and log why. Example of when we hit this is on raid resets
      // where we don't have long enough to get a GUID for the player.
      console.warn(
        '[LogHandler] Discarding video as failed to get Metadata:',
        String(error),
      );
    }
  }

  protected async dataTimeout(ms: number) {
    console.info(
      `[LogHandler] Haven't received data from any combat logs in ${
        ms / 1000
      } seconds.`,
    );

    if (!LogHandler.activity) {
      console.info('[LogHandler] No activity, no action');
      return;
    }

    if (LogHandler.overrunning) {
      console.info('[LogHandler] Activity in overrun, no action');
      return;
    }

    if (this.isManual()) {
      console.info('[LogHandler] Manual recording, no action');
      return;
    }

    console.info('[LogHandler] Force ending activity due to data timeout');
    await LogHandler.forceEndActivity(-ms / 1000);
  }

  public static async forceEndActivity(timedelta = 0) {
    if (!LogHandler.activity) {
      console.error('[LogHandler] forceEndActivity called but no activity');
      return;
    }

    console.info('[LogHandler] Force ending activity, timedelta:', timedelta);
    const endDate = new Date();
    endDate.setTime(endDate.getTime() + timedelta * 1000);
    LogHandler.activity.overrun = 0;

    LogHandler.activity.end(endDate, false);
    await LogHandler.endActivity();
    LogHandler.activity = undefined;
  }

  public static dropActivity() {
    LogHandler.overrunning = false;
    LogHandler.activity = undefined;
  }

  protected async zoneChangeStop(line: LogLine) {
    if (!LogHandler.activity) {
      console.error('[LogHandler] No active activity on zone change stop');

      return;
    }

    const endDate = line.date();
    LogHandler.activity.end(endDate, false);
    await LogHandler.endActivity();
  }

  protected isArena() {
    if (!LogHandler.activity) {
      return false;
    }

    const { category } = LogHandler.activity;

    return (
      category === VideoCategory.TwoVTwo ||
      category === VideoCategory.ThreeVThree ||
      category === VideoCategory.FiveVFive ||
      category === VideoCategory.Skirmish ||
      category === VideoCategory.SoloShuffle
    );
  }

  protected isBattleground() {
    if (!LogHandler.activity) {
      return false;
    }

    const { category } = LogHandler.activity;
    return category === VideoCategory.Battlegrounds;
  }

  protected isMythicPlus() {
    if (!LogHandler.activity) {
      return false;
    }

    const { category } = LogHandler.activity;
    return category === VideoCategory.MythicPlus;
  }

  protected isManual() {
    if (!LogHandler.activity) return false;
    return LogHandler.activity.category === VideoCategory.Manual;
  }

  protected isRaid() {
    if (!LogHandler.activity) return false;
    return LogHandler.activity.category === VideoCategory.Raids;
  }

  protected processCombatant(
    srcGUID: string,
    srcNameRealm: string,
    srcFlags: number,
    allowNew: boolean,
  ) {
    let combatant: Combatant | undefined;

    if (!LogHandler.activity) {
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
    if (!LogHandler.activity.playerGUID && isUnitSelf(srcFlags)) {
      LogHandler.activity.playerGUID = srcGUID;
    }

    // Even if the combatant exists already we still update it with the info it
    // may not have yet. We can't tell the name, realm or if it's the player
    // from COMBATANT_INFO events.
    combatant = LogHandler.activity.getCombatant(srcGUID);

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

    [combatant.name, combatant.realm, combatant.region] =
      ambiguate(srcNameRealm);
    LogHandler.activity.addCombatant(combatant);
    return combatant;
  }

  protected handleSpellDamage(line: LogLine) {
    if (!this.isRaid()) {
      return;
    }

    const raid = LogHandler.activity as RaidEncounter;
    raid.updateBossHp(line);
  }

  /**
   * Handle the pressing of the manual recording hotkey.
   */
  public static async handleManualRecordingHotKey() {
    const sounds = ConfigService.getInstance().get('manualRecordSoundAlert');

    if (!LogHandler.activity) {
      console.info('[LogHandler] Starting manual recording');
      const startDate = new Date();
      const activity = new Manual(startDate, Flavour.Retail);
      await LogHandler.startActivity(activity);
      if (sounds) playSoundAlert(SoundAlerts.MANUAL_RECORDING_START);
      return;
    }

    if (LogHandler.activity.category === VideoCategory.Manual) {
      console.info('[LogHandler] Stopping manual recording');
      const endDate = new Date();
      LogHandler.activity.end(endDate, true); // Result is meaningless but required.
      await LogHandler.endActivity();
      if (sounds) playSoundAlert(SoundAlerts.MANUAL_RECORDING_STOP);
      return;
    }

    console.warn('[LogHandler] Unable to start manual recording');
    if (sounds) playSoundAlert(SoundAlerts.MANUAL_RECORDING_ERROR);
  }

  /**
   * Reset the log data timeout. This should be called whenever we receive
   * data from the combat log.
   */
  protected resetTimeout() {
    if (LogHandler.logDataTimeout) {
      clearTimeout(LogHandler.logDataTimeout);
    }

    LogHandler.logDataTimeout = setTimeout(() => {
      this.logProcessQueue.add(async () =>
        this.dataTimeout(this.logDataTimeoutMs),
      );
    }, this.logDataTimeoutMs);
  }
}
