import { EventEmitter } from 'stream';
import fs from 'fs';
import util from 'util';
import { FileInfo } from 'main/types';
import path from 'path';
import chokidar from 'chokidar';
import { getFileInfo, getSortedFiles } from '../main/util';
import LogLine from './LogLine';

/**
 * Setup a bunch of promisified fs calls for convienence.
 */
const open = util.promisify(fs.open);
const read = util.promisify(fs.read);
const close = util.promisify(fs.close);

/**
 * Watches a directory for combat logs, read the new data from them
 * and emits events containing a LogLine object for processing elsewhere.
 *
 * I'm a bit nervous about race conditions here in multiple read calls. I
 * considered using p-queue, but I think it's probably fine as almost
 * certainly we won't have combat log writes close enough together to hit it.
 */
export default class CombatLogWatcher extends EventEmitter {
  /**
   * The directory to watch for logs.
   */
  private logDir: string;

  /**
   * The watcher object itself.
   */
  private watcher?: chokidar.FSWatcher;

  /**
   * A duration after seeing a log write to send a timeout event in if no
   * other subsequent log writes seen. In seconds.
   */
  private timeout: number;

  /**
   * A handle to the timeout timer so we can easily reset it when we see
   * additional logs.
   */
  private timer?: NodeJS.Timeout;

  /**
   * We need to keep track of some info about the file to know how much we
   * should read. Initialize this to some dull values so we don't have to
   * check for undefined.
   */
  private state: Record<string, FileInfo> = {};

  /**
   * Constructor, unit of timeout is minutes. No events will be emitted until
   * watch() is called.
   */
  constructor(logDir: string, timeout: number) {
    super();
    this.timeout = timeout * 1000 * 60;
    this.logDir = logDir;
  }

  /**
   * Start watching the directory.
   */
  public async watch() {
    await this.getLogDirectoryState();

    this.watcher = chokidar.watch('WoWCombatLog*.txt', {
      cwd: this.logDir,
      useFsEvents: false,
    });

    this.watcher.on('change', (file) => {
      console.log('changed', file);
      this.process(file);
    });
  }

  /**
   * Stop watching the directory.
   */
  public async unwatch() {
    if (this.watcher) {
      await this.watcher.close();
    }
  }

  /**
   * We need this in-case WR is launched mid activity where a partial log file
   * already exists.
   */
  private async getLogDirectoryState() {
    const logs = await getSortedFiles(this.logDir, 'WoWCombatLog.*.txt');

    if (logs.length < 1) {
      return;
    }

    const fileInfoPromises = logs.map((f) => f.name).map(getFileInfo);
    const fileInfo = await Promise.all(fileInfoPromises);

    fileInfo.forEach((info) => {
      this.state[info.name] = info;
    });

    console.log("STATE LEN: " ,   Object.keys(this.state).length);
  }

  /**
   * Process a change event receieved from the directory watcher.
   */
  private async process(file: string) {
    const fullPath = path.join(this.logDir, file);
    const currentInfo = await getFileInfo(fullPath);
    const lastInfo = this.state[file];

    let bytesToRead;
    let startPosition;

    if (!lastInfo || lastInfo.birthTime !== currentInfo.birthTime) {
      // If it's a new file, we want to read from the start.
      bytesToRead = currentInfo.size;
      startPosition = 0;
    } else {
      bytesToRead = currentInfo.size - lastInfo.size;
      startPosition = lastInfo.size;
    }

    await this.parseFileChunk(fullPath, bytesToRead, startPosition);
    this.state[file] = currentInfo;
  }

  /**
   * Parse a chunk of the file of length bytes from a specified position.
   */
  private async parseFileChunk(file: string, bytes: number, position: number) {
    const buffer = Buffer.alloc(bytes);
    const handle = await open(file, 'r');
    const { bytesRead } = await read(handle, buffer, 0, bytes, position);
    close(handle);

    if (bytesRead !== bytes) {
      console.error(
        '[CombatLogParser] Read attempted for',
        bytes,
        'bytes, but read',
        bytesRead
      );
    }

    const lines = buffer
      .toString('utf-8')
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s);

    lines.forEach((line) => {
      this.handleLogLine(line);
    });

    this.resetTimeout();
  }

  /**
   * Handle a line from the WoW log. Public as this is called by the test
   * button.
   */
  public handleLogLine(line: string) {
    const logLine = new LogLine(line);
    const logEventType = logLine.type();
    this.emit(logEventType, logLine);
  }

  /**
   * Sends a timeout event signalling no activity in the combat log directory
   * for the timeout period. That's handy as a catch-all for ending any active
   * events. Typically a Mythic+ that's been abandoned.
   */
  private resetTimeout() {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      this.emit('timeout', this.timeout);
    }, this.timeout);
  }
}
