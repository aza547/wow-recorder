import path from 'path';
import { fixPathWhenPackaged } from './util';
import log from 'electron-log/main';
import fs from 'fs';

/**
 * Returns a local date string in the format YYYY-MM-DD.
 */
const getLocalDate = () => {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

const logPrefix = 'WarcraftRecorder';
let logIndex = 0;
let logDate = getLocalDate();

/**
 * Get the next log index on startup of the application as logIndex in memory
 * does not persist across restarts. Always selects one more than the max
 * existing index, even if there are gaps.
 *
 * This also means that we will rotate to a new log on each startup of the app,
 * meaning we can rotate the log before it reaches the maximum size, but that's
 * actually a nice feature.
 */
const getNextLogIndex = () => {
  const dir = getApplicationLogDir();
  logDate = getLocalDate();

  try {
    // We only ever run this on startup so it's OK this is not async.
    const files = fs.readdirSync(dir);
    const prefix = `${logPrefix}-${logDate}.`;

    const indices = files
      .filter((file) => file.startsWith(prefix) && file.endsWith('.log'))
      .map((file) => Number(file.slice(prefix.length, -'.log'.length)))
      .filter(Number.isInteger);

    logIndex = indices.length > 0 ? Math.max(...indices) + 1 : 0;
    console.info('[Logging] Application log index is', logIndex);
  } catch {
    // This log is early such that won't actually appear in the log files, but
    // will appear in a terminal if attached. It's unlikely to go wrong (unless
    // the filesystem is broken).
    console.error('[Logging] Failed to read application log directory', dir);
  }
};

const getApplicationLogPath = () => {
  const dir = getApplicationLogDir();
  const date = getLocalDate();

  if (date !== logDate) {
    // Reset the rotation index if the date changed.
    console.info('[Logging] Date changed, resetting log index.');
    logIndex = 0;
    logDate = date;
  }

  const fileName = `${logPrefix}-${date}.${logIndex}.log`;
  return path.join(dir, fileName);
};

export const setupApplicationLogging = () => {
  getNextLogIndex();
  log.transports.file.resolvePathFn = getApplicationLogPath;

  // This isn't really proper log rotation, it's just incremented the index
  // each time we exceed the default max size (1MB). We never delete logs.
  log.transports.file.archiveLogFn = () => {
    logIndex++;
  };

  Object.assign(console, log.functions);
};

export const getApplicationLogDir = () => {
  const parent = fixPathWhenPackaged(__dirname);
  const dir = 'logs';
  return path.join(parent, dir);
};
