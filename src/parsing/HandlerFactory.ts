import Recorder from '../main/Recorder';
import { getSortedFiles } from '../main/util';
import ClassicLogHandler from './ClassicLogHandler';
import CombatLogParser from './CombatLogParser';
import RetailLogHandler from './RetailLogHandler';

const createRetailHandler = (
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
  return new RetailLogHandler(rec, parser);
};

const createClassicHandler = (
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
  return new ClassicLogHandler(rec, parser);
};

export { createRetailHandler, createClassicHandler };
