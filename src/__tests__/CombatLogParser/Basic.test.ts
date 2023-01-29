import { Flavour } from '../../main/types';
import LogLine from '../../parsing/LogLine';
import { getSortedFiles } from '../../main/util';
import CombatLogParser from '../../parsing/CombatLogParser';

test('Basic Retail', async () => {
  const combatLogParser = new CombatLogParser({
    dataTimeout: 2 * 60 * 1000,
    fileFinderFn: getSortedFiles,
  });

  let promiseResolve: (value: LogLine | PromiseLike<LogLine>) => void;

  const testLogLinePromise: Promise<LogLine> = new Promise((resolve) => {
    promiseResolve = resolve;
  });

  combatLogParser.on('ARENA_MATCH_START', (line: LogLine) => {
    promiseResolve(line);
  });

  const arenaMatchStartLine =
    '8/3 22:12:04.000  ARENA_MATCH_START,2547,33,5v5,1';

  combatLogParser.handleLogLine(Flavour.Retail, arenaMatchStartLine);

  const testLogLine = await testLogLinePromise;
  const expectedDate = new Date('2023-08-03T22:12:04');

  expect(testLogLine.date()).toStrictEqual(expectedDate);
  expect(testLogLine.type()).toBe('ARENA_MATCH_START');
  expect(testLogLine.arg(1)).toBe('2547');
  expect(testLogLine.arg(2)).toBe('33');
  expect(testLogLine.arg(3)).toBe('5v5');
  expect(testLogLine.arg(4)).toBe('1');
  expect(testLogLine.toString()).toBe(arenaMatchStartLine);
});
