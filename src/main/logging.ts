import path from 'path';
import { fixPathWhenPackaged } from './util';
import log from 'electron-log/main';
import fs from 'fs';

const getLocalDate = () => {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

const logPrefix = 'WarcraftRecorder-';
let logIndex = 0;
let logDate = getLocalDate();

const getNextLogIndex = () => {
  const dir = getApplicationLogDir();
  logDate = getLocalDate();

  try {
    // We only ever run this on startup so it's OK this is not async.
    const files = fs.readdirSync(dir);
    const prefix = `${logPrefix}${logDate}.`;

    const indices = files
      .filter((file) => file.startsWith(prefix) && file.endsWith('.log'))
      .map((file) => Number(file.slice(prefix.length, -'.log'.length)))
      .filter(Number.isInteger);

    logIndex = indices.length > 0 ? Math.max(...indices) + 1 : 0;
    console.info('[Logging] Application log index is', logIndex);
  } catch {
    console.error('[Logging] Failed to read application log directory', dir);
  }
};

const getApplicationLogPath = () => {
  const dir = getApplicationLogDir();
  const date = getLocalDate();

  if (date !== logDate) {
    // Reset the rotation index if the date changed.
    logIndex = 0;
    logDate = date;
  }

  const fileName = `${logPrefix}${date}.${logIndex}.log`;
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
