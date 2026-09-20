import fs from 'fs';
import os from 'os';
import path from 'path';
import CombatLogWatcher from '../../parsing/CombatLogWatcher';

jest.setTimeout(30_000);

jest.mock('../../main/util', () => {
  const nodeFs = jest.requireActual<typeof import('fs')>('fs');
  const nodePath = jest.requireActual<typeof import('path')>('path');

  return {
    getFileInfo: async (pathSpec: string) => {
      const filePath = nodePath.resolve(pathSpec);
      const stats = await nodeFs.promises.stat(filePath);

      return {
        name: filePath,
        size: stats.size,
        mtime: stats.mtime.getTime(),
        birthTime: stats.birthtime.getTime(),
      };
    },
    getSortedFiles: async () => [],
  };
});

const LOG_DIR = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'tests',
  'logs',
  'retail',
);
// common VFS chunk sizes depending on the driver
const CHUNK_SIZES = [4096, 65536, 131072, 1048576];

const loadFixture = (fixture: string): Buffer => {
  const raw = fs.readFileSync(path.join(LOG_DIR, fixture));
  return Buffer.from(raw.subarray(0, raw.lastIndexOf(0x0a) + 1));
};

const toLines = (payload: Buffer): string[] =>
  payload
    .toString('utf-8')
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s);

const toCrlf = (payload: Buffer): Buffer =>
  Buffer.from(payload.toString('utf-8').replace(/\n/g, '\r\n'), 'utf-8');

const makeHarness = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wcr-chunking-'));
  const file = 'WoWCombatLog.txt';
  const target = path.join(dir, file);
  const watcher = new CombatLogWatcher(dir);
  const seen: string[] = [];
  const original = watcher.handleLogLine.bind(watcher);

  watcher.handleLogLine = (line: string) => {
    seen.push(line);
    original(line);
  };

  fs.writeFileSync(target, '');

  const append = async (data: Buffer) => {
    fs.appendFileSync(target, data);
    await (
      watcher as unknown as { process: (f: string) => Promise<void> }
    ).process(file);
  };

  const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
  return { seen, append, cleanup };
};

const deliver = async (
  payload: Buffer,
  chunkSize: number,
): Promise<string[]> => {
  const { seen, append, cleanup } = makeHarness();

  try {
    for (let at = 0; at < payload.length; at += chunkSize) {
      await append(payload.subarray(at, at + chunkSize));
    }
  } finally {
    cleanup();
  }

  return seen;
};

describe.each(['raid_wipe.txt', 'mythic_plus.txt'])('%s', (fixture) => {
  const payload = loadFixture(fixture);
  const expected = toLines(payload);

  test.each(CHUNK_SIZES)('LF delivered in %i byte chunks', async (size) => {
    expect(await deliver(payload, size)).toStrictEqual(expected);
  });

  test.each(CHUNK_SIZES)('CRLF delivered in %i byte chunks', async (size) => {
    expect(await deliver(toCrlf(payload), size)).toStrictEqual(expected);
  });
});

test('holds back a partial trailing line until its newline arrives', async () => {
  const payload = loadFixture('raid_wipe.txt');
  const expected = toLines(payload);
  const cut = payload.lastIndexOf(0x0a, payload.length - 2) + 11;
  const { seen, append, cleanup } = makeHarness();

  try {
    await append(payload.subarray(0, cut));
    expect(seen).toStrictEqual(expected.slice(0, -1));

    await append(payload.subarray(cut));
    expect(seen).toStrictEqual(expected);
  } finally {
    cleanup();
  }
});

test('a malformed line is logged and does not stop later lines', async () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  try {
    const payload = loadFixture('raid_wipe.txt');
    let offset = 0;

    for (let i = 0; i < 100; i++) {
      offset = payload.indexOf(0x0a, offset) + 1;
    }

    const bad = Buffer.from('8/3 22:12:05.000  )0000000141,junk\n', 'utf-8');

    const spliced = Buffer.concat([
      payload.subarray(0, offset),
      bad,
      payload.subarray(offset),
    ]);

    const seen = await deliver(spliced, 65536);

    expect(seen).toStrictEqual(toLines(spliced));
    expect(errorSpy).toHaveBeenCalled();
  } finally {
    errorSpy.mockRestore();
  }
});
