import { Recorder } from '../main/recorder';
import { getSortedFiles } from '../main/util';
import ClassicLogHandler from './ClassicLogHandler';
import CombatLogParser from './CombatLogParser';
import RetailLogHandler from './RetailLogHandler';

export const makeRetailHandler = (
  rec: Recorder,
  logPath: string
): RetailLogHandler => {
  console.info(
    '[HandlerFactory] Constructing RetailLogHandler for path',
    logPath
  );

  const parser = new CombatLogParser({
    dataTimeout: 2 * 60 * 1000,
    fileFinderFn: getSortedFiles,
  });

  parser.watchPath(logPath);
  return RetailLogHandler.getInstance(rec, parser);
};

export const makeClassicHandler = (
  rec: Recorder,
  logPath: string
): ClassicLogHandler => {
  console.info(
    '[HandlerFactory] Constructing ClassicLogHandler for path',
    logPath
  );

  const parser = new CombatLogParser({
    dataTimeout: 2 * 60 * 1000,
    fileFinderFn: getSortedFiles,
  });

  parser.watchPath(logPath);
  return ClassicLogHandler.getInstance(rec, parser);
};
