import { EventEmitter } from 'stream';
import fs, { watch, FSWatcher } from 'fs';
import util from 'util';
import { FileInfo } from 'main/types';
import path from 'path';
import { getFileInfo, getSortedFiles } from '../main/util';
import LogLine from './LogLine';
import AsyncQueue from 'utils/AsyncQueue';

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
  private watcher?: FSWatcher;

  /**
   * We need to keep track of some info about each log file to know how much we
   * should read.
   */
  private state: Record<string, FileInfo> = {};

  /**
   * A promise queue we use to ensure that we only have one active attempt to
   * parse the file at a time.
   */
  private queue = new AsyncQueue(Number.MAX_SAFE_INTEGER);

  /**
   * The most recently updated log file, we remember this purely so we can
   * log when it changes.
   */
  private current = '';

  /**
   * Constructor, unit of timeout is minutes. No events will be emitted until
   * watch() is called.
   */
  constructor(logDir: string) {
    super();
    this.logDir = logDir;
  }

  /**
   * Start watching the directory.
   */
  public async watch() {
    await this.getLogDirectoryState();
    this.watcher = watch(this.logDir);

    this.watcher.on('change', (type, file) => {
      if (typeof file !== 'string') {
        return;
      }

      if (!file.startsWith('WoWCombatLog')) {
        return;
      }

      if (type === 'rename') {
        // Despite this being a 'change' listener, we can still get
        // rename events here, see the Node watch API. The rename event
        // misleadingly fires for both file creation and deletion.
        //
        // We reset the position in a file on either, such that a file
        // recreated with the same name will be read from the start. See
        // Issue 624.
        console.info('[CombatLogWatcher] Create or delete event', file);
        const fullPath = path.join(this.logDir, file);
        delete this.state[fullPath];
        return;
      }

      if (file !== this.current) {
        console.info('[CombatLogWatcher] New active log file', file);
        this.current = file;
      }

      this.queue.add(() => this.process(file));
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
   * We need this in-case WCR is launched mid activity where a partial log file
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
  }

  /**
   * Process a change event receieved from the directory watcher.
   */
  private async process(file: string) {
    const fullPath = path.join(this.logDir, file);
    const currentInfo = await getFileInfo(fullPath);
    const lastInfo = this.state[fullPath];

    let bytesToRead;
    let startPosition;

    if (lastInfo) {
      // Existing file, read from the last known length.
      bytesToRead = currentInfo.size - lastInfo.size;
      startPosition = lastInfo.size;
    } else {
      // New file, we want to read from the start.
      bytesToRead = currentInfo.size;
      startPosition = 0;
    }

    if (bytesToRead < 1) {
      // The node fs watcher is known to sometimes emit multiple events for
      // the same write. This lets us drop out early if there is nothing to read.
      return;
    }

    await this.parseFileChunk(fullPath, bytesToRead, startPosition);
    this.state[fullPath] = currentInfo;
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
        bytesRead,
      );
    }

    this.emit('WARCRAFT_RECORDER_LOG_ACTIVITY');

    const lines = buffer
      .toString('utf-8')
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s);

    lines.forEach((line) => {
      this.handleLogLine(line);
    });
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
}
