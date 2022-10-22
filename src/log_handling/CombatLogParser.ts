import path from "path";
import fs from "fs";
import { EventEmitter } from "stream";
import { setInterval, clearInterval } from 'timers';
import { CombatLogMonitorHandlerType, CombatLogParserOptionsType } from "../main/types";
import { LogLine } from "./LogLine";

const tail = require('tail').Tail;

/**
 * Combat log parser and monitoring class.
 *
 * Watches one or more directories for combat logs, read the new data from them
 * and emits events to act on the combat log events elsewhere.
 */
class CombatLogParser extends EventEmitter {
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
        flushAtEOF: true
    };

    constructor(options: CombatLogParserOptionsType) {
        super();

        this._options = options;
    };

    /**
     * Start watching a path, if it's a valid WoW logs directory.
     * This is checked via `getWowFlavour()` which looks for the file '../.flavour.info'
     * relative to the log directory, which all flavours of WoW have.
     *
     * This method can be called multiple times on different paths, and they will
     * all be watched, if they appear to be a valid WoW combat log directory.
     */
    watchPath(pathSpec: string): void {
        pathSpec = path.resolve(pathSpec);
        if (pathSpec in this._handlers) {
            return;
        }

        const wowFlavour = CombatLogParser.getWowFlavour(pathSpec);

        if (wowFlavour === 'unknown') {
            console.warn(`[CombatLogParser] Ignoring non-WoW combat log directory '${pathSpec}'`);
            return;
        }

        this._handlers[pathSpec] = {
            wowFlavour,
            path: pathSpec,
        };

        console.log(`[CombatLogParser] Start watching '${pathSpec}' for '${wowFlavour}'`);
        this.watchLogDirectory(pathSpec);
    }

    /**
     * Unwatch a previously watched path.
     */
    unwatchPath(pathSpec: string): void {
        pathSpec = path.resolve(pathSpec);
        if (!(pathSpec in this._handlers)) {
            return;
        }

        clearInterval(this._handlers[pathSpec].watchInterval);

        if (this._handlers[pathSpec].tail) {
            this._handlers[pathSpec].tail.unwatch();
        }

        delete this._handlers[pathSpec];

        console.log(`[CombatLogParser] Stop watching '${pathSpec}'`);
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
        const logLine = new LogLine(line)
        const logEventType = logLine.type();
        this.emit(flavour, logEventType, logLine);
    }

    /**
     * Validate a path as a combat log path
     */
    static validateLogPath(pathSpec: string): boolean {
        pathSpec = path.resolve(pathSpec);

        // Check if the leaf node of the path is actually 'logs',
        // which _all_ WoW flavours use for logs.
        const pathLeaf = path.basename(pathSpec).toLowerCase();
        if (pathLeaf !== 'logs') {
            return false;
        }

        // Check if the parent directory has a WoW flavour info file
        return CombatLogParser.getWowFlavour(pathSpec) !== 'unknown'
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

        const content = fs.readFileSync(flavourInfoFile)
            .toString()
            .split("\n");

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

        console.log(`[CombatLogParser] Locking path '${handler.path}' for exclusive event processing.`)

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
            console.log(`[CombatLogParser] Unlocking path '${this._handlerLock?.path}' for exclusive event processing since no data received in ${this._options.dataTimeout / 1000} seconds.`)
            this._handlerLock = undefined;
            this.emit('DataTimeout', this._options.dataTimeout);
        }, this._options.dataTimeout);
    }

    /**
     * Find and return the most recent file that matches the combat log filename
     * pattern.
     */
    private async getLatestLog (pathSpec: string): Promise<string | undefined> {
        const logs = await this._options.fileFinderFn(pathSpec, 'WoWCombatLog*.txt');
        if (logs.length === 0) return;
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

        const tailHandler = new tail(handler.currentLogFile, this._tailOptions);
        tailHandler
            .on('line', (line: string) => {
                if (!this.lockHandler(handler)) {
                    return;
                }

                this.handleLogLine(handler.wowFlavour, line);
            })
            .on('error', (error: unknown) => {
                console.error(`[CombatLogParser] Error while tailing log file ${handler.currentLogFile}`, error);
            });

        handler.tail = tailHandler;
    }

    /**
     * Watch a directory for combat logs and restart the monitoring
     * mechanism if there's a new one detected.
     */
    private watchLogDirectory(path: string): void {
        const handler = this._handlers[path];

        handler.watchInterval = setInterval(async () => {
            const latestLogFile = await this.getLatestLog(path);

            // Handle the case where there is no logs in the WoW log directory.
            if (!latestLogFile) {
                return;
            }

            const logFileChanged = (latestLogFile !== handler.currentLogFile);

            if (!logFileChanged) {
                return;
            }

            console.log(`[CombatLogParser] Detected latest/new log file '${latestLogFile}'`);
            handler.currentLogFile = latestLogFile;
            this.tailLogFile(handler);
        }, 1000);
    }
};

export {
    CombatLogParser,
}
