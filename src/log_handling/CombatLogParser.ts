import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'stream';
import { setInterval, clearInterval } from 'timers';
import { FileFinderCallbackType } from '../main/types';
import LogLine from './LogLine';

const { Tail } = require('tail');

/**
 * Type that defines the structure of a combat log file handler,
 * which is used to monitor a specific log directory.
 */
type CombatLogMonitorHandlerType = {
  path: string;
  wowFlavour: string; // Read from the '.flavor.info' file from WoW
  currentLogFile?: string;
  watchInterval?: any;
  tail?: any;
};

/**
 * Options for CombatLogParser
 *
 * 'dataTimeout'  = data timeout in milliseconds
 * 'fileFinderFn' = Function for finding files according to a glob pattern
 */
type CombatLogParserOptionsType = {
  dataTimeout: number;
  fileFinderFn: FileFinderCallbackType;
};

/**
 * Combat log parser and monitoring class.
 *
 * Watches one or more directories for combat logs, read the new data from them
 * and emits events to act on the combat log events elsewhere.
 */
export default class CombatLogParser extends EventEmitter {
  private _options: CombatLogParserOptionsType;

  private _handlers: { [key: string]: CombatLogMonitorHandlerType } = {};

  /**
   * If set, any handler receiving data which _ISN'T_ the one
   * given here will be ignored. This is to avoid multiple log files receiving
   * data at the same time which shouldn't happen, but can.
   */
  private _handlerLock?: CombatLogMonitorHandlerType;

  private _handlerLockTimeout: any;

  private readonly _tailOptions = {
    flushAtEOF: true,
  };

  constructor(options: CombatLogParserOptionsType) {
    super();

    this._options = options;
  }

  /**
   * Start watching a path, if it's a valid WoW logs directory.
   * This is checked via `getWowFlavour()` which looks for the file '../.flavour.info'
   * relative to the log directory, which all flavours of WoW have.
   *
   * This method can be called multiple times on different paths, and they will
   * all be watched, if they appear to be a valid WoW combat log directory.
   */
  watchPath(pathSpec: string): void {
    const resolvedPath = path.resolve(pathSpec);

    if (resolvedPath in this._handlers) {
      return;
    }

    const wowFlavour = CombatLogParser.getWowFlavour(resolvedPath);

    if (wowFlavour === 'unknown') {
      console.warn(
        `[CombatLogParser] Ignoring non-WoW combat log directory '${resolvedPath}'`
      );
      return;
    }

    this._handlers[resolvedPath] = {
      wowFlavour,
      path: resolvedPath,
    };

    console.log(
      `[CombatLogParser] Start watching '${resolvedPath}' for '${wowFlavour}'`
    );
    this.watchLogDirectory(resolvedPath);
  }

  /**
   * Unwatch a previously watched path.
   */
  unwatchPath(pathSpec: string): void {
    const resolvedPath = path.resolve(pathSpec);

    if (!(resolvedPath in this._handlers)) {
      return;
    }

    clearInterval(this._handlers[resolvedPath].watchInterval);

    if (this._handlers[resolvedPath].tail) {
      this._handlers[resolvedPath].tail.unwatch();
    }

    delete this._handlers[resolvedPath];

    console.log(`[CombatLogParser] Stop watching '${resolvedPath}'`);
  }

  /**
   * Unwatch all paths.
   */
  unwatch(): void {
    Object.keys(this._handlers).forEach(this.unwatchPath.bind(this));
  }

  /**
   * Handle a line from the WoW log.
   */
  handleLogLine(flavour: string, line: string) {
    const logLine = new LogLine(line);
    const logEventType = logLine.type();

    this.emit(logEventType, logLine, flavour);
  }

  /**
   * Validate a path as a combat log path
   */
  static validateLogPath(pathSpec: string): boolean {
    const resolvePath = path.resolve(pathSpec);

    // Check if the leaf node of the path is actually 'logs',
    // which _all_ WoW flavours use for logs.
    const pathLeaf = path.basename(resolvePath).toLowerCase();
    if (pathLeaf !== 'logs') {
      return false;
    }

    // Check if the parent directory has a WoW flavour info file
    return CombatLogParser.getWowFlavour(resolvePath) !== 'unknown';
  }

  /**
   * Find and return the flavour of WoW that the log directory
   * belongs to by means of the '.flavor.info' file.
   */
  static getWowFlavour(pathSpec: string): string {
    const flavourInfoFile = path.normalize(
      path.join(pathSpec, '../.flavor.info')
    );

    // If this file doesn't exist, it's not a subdirectory of a WoW flavour.
    if (!fs.existsSync(flavourInfoFile)) {
      return 'unknown';
    }

    const content = fs.readFileSync(flavourInfoFile).toString().split('\n');

    return content.length > 1 ? content[1] : 'unknown';
  }

  /**
   * Ensure only a single logfile is being watched once one of them starts
   * receiving data.
   *
   * The lock will timeout after a given number of seconds has passed with no
   * data being received.
   *
   * This is set the constructor options property `dataTimeout`.
   */
  private lockHandler(handler: CombatLogMonitorHandlerType): boolean {
    // If it's locked, and not by 'handler', get out.
    if (this._handlerLock && this._handlerLock !== handler) {
      return false;
    }

    // Reset timeout and return
    if (this._handlerLock === handler) {
      this.resetLockTimeout();
      return true;
    }

    console.log(
      `[CombatLogParser] Locking path '${handler.path}' for exclusive event processing.`
    );

    this.emit('DataFirstEvent', handler.wowFlavour);

    this.resetLockTimeout();

    this._handlerLock = handler;
    return true;
  }

  /**
   * Reset the lock/data timeout timer such that it doesn't fire when it
   * isn't supposed to.
   */
  private resetLockTimeout(): void {
    if (this._handlerLockTimeout) {
      clearTimeout(this._handlerLockTimeout);
    }

    this._handlerLockTimeout = setTimeout(() => {
      console.log(
        `[CombatLogParser] Unlocking path '${
          this._handlerLock?.path
        }' for exclusive event processing since no data received in ${
          this._options.dataTimeout / 1000
        } seconds.`
      );
      this._handlerLock = undefined;
      this.emit('DataTimeout', this._options.dataTimeout);
    }, this._options.dataTimeout);
  }

  /**
   * Find and return the most recent file that matches the combat log filename
   * pattern.
   */
  private async getLatestLog(pathSpec: string): Promise<string | undefined> {
    const logs = await this._options.fileFinderFn(
      pathSpec,
      'WoWCombatLog.*\\.txt'
    );

    if (logs.length === 0) {
      console.error(`[CombatLogParser] No combat logs found in ${pathSpec}`);
      throw new Error(`[CombatLogParser] No combat logs found in ${pathSpec}`);
    }

    return logs[0].name;
  }

  /**
   * Monitor a file for new content and process combat log lines accordingly
   * when they arrive.
   */
  private tailLogFile(handler: CombatLogMonitorHandlerType): void {
    // Clear any old tail handler before creating the new instance
    if (handler.tail) {
      handler.tail.unwatch();
    }

    const tailHandler = new Tail(handler.currentLogFile, this._tailOptions);

    tailHandler
      .on('line', (line: string) => {
        if (!this.lockHandler(handler)) {
          return;
        }

        this.handleLogLine(handler.wowFlavour, line);
      })
      .on('error', (error: unknown) => {
        console.error(
          `[CombatLogParser] Error while tailing log file ${handler.currentLogFile}`,
          error
        );
      });

    handler.tail = tailHandler;
  }

  /**
   * Watch a directory for combat logs and restart the monitoring
   * mechanism if there's a new one detected.
   */
  private watchLogDirectory(pathSpec: string): void {
    const handler = this._handlers[pathSpec];

    handler.watchInterval = setInterval(async () => {
      let latestLogFile;

      try {
        latestLogFile = await this.getLatestLog(pathSpec);
      } catch {
        console.error('[CombatLogParser] Did not find any logs to watch');
        return;
      }

      if (latestLogFile !== handler.currentLogFile) {
        // Log file didn't change so no-op.
        return;
      }

      console.log(
        `[CombatLogParser] Detected latest/new log file '${latestLogFile}'`
      );

      handler.currentLogFile = latestLogFile;
      this.tailLogFile(handler);
    }, 1000);
  }
}
