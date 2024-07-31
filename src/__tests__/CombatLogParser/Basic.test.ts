import LogLine from '../../parsing/LogLine';
import CombatLogWatcher from '../../parsing/CombatLogWatcher';

test('Basic Retail', async () => {
  const combatLogParser = new CombatLogWatcher('', 2);
  let promiseResolve: (value: LogLine | PromiseLike<LogLine>) => void;

  const testLogLinePromise: Promise<LogLine> = new Promise((resolve) => {
    promiseResolve = resolve;
  });

  combatLogParser.on('ARENA_MATCH_START', (line: LogLine) => {
    promiseResolve(line);
  });

  const arenaMatchStartLine =
    '8/3 22:12:04.000  ARENA_MATCH_START,2547,33,5v5,1';

  combatLogParser.handleLogLine(arenaMatchStartLine);

  const testLogLine = await testLogLinePromise;
  const expectedDate = new Date('2024-08-03T22:12:04');

  expect(testLogLine.date()).toStrictEqual(expectedDate);
  expect(testLogLine.type()).toBe('ARENA_MATCH_START');
  expect(testLogLine.arg(1)).toBe('2547');
  expect(testLogLine.arg(2)).toBe('33');
  expect(testLogLine.arg(3)).toBe('5v5');
  expect(testLogLine.arg(4)).toBe('1');
  expect(testLogLine.toString()).toBe(arenaMatchStartLine);
});

test('Date Parsing', async () => {
  // Pre The War Within expansion there were note years or timezones.
  const preTWW = '8/3 22:12:04.000  ARENA_MATCH_START,2547,33,5v5,1';
  const parsedPreTWW = new LogLine(preTWW);
  const expectedPreTww = new Date('2024-08-03T22:12:04');
  expect(parsedPreTWW.date()).toStrictEqual(expectedPreTww);

  // Year but no TZ.
  const twwNoTZ = '7/28/2024 17:35:43.4931  ARENA_MATCH_START,2547,33,5v5,1';
  const parsedTwwNoTZ = new LogLine(twwNoTZ);
  const expectedTwwNoTZ = new Date('2024-07-28T17:35:43');
  expect(parsedTwwNoTZ.date()).toStrictEqual(expectedTwwNoTZ);

  // Year and TZ.
  const twwTz = '7/28/2024 14:37:54.790-4  ARENA_MATCH_START,2547,33,5v5,1';
  const parsedTwwTz = new LogLine(twwTz);
  const expectedTwwTz = new Date('2024-07-28T14:37:54');
  expect(parsedTwwTz.date()).toStrictEqual(expectedTwwTz);
});
