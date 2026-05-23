import path from 'path';
import { getNoobsBinPath, getNoobsDistPath } from '../../main/noobsRuntimePath';

const originalNodeEnv = process.env.NODE_ENV;
const originalPath = process.env.PATH;
const originalPathTitle = process.env.Path;

const restoreEnvValue = (key: 'NODE_ENV' | 'PATH' | 'Path', value?: string) => {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
};

afterEach(() => {
  jest.resetModules();
  jest.dontMock('noobs');
  restoreEnvValue('NODE_ENV', originalNodeEnv);
  restoreEnvValue('PATH', originalPath);
  restoreEnvValue('Path', originalPathTitle);
});

test('prepends noobs bin path before loading the native noobs module', () => {
  const mockNoobs = { Init: jest.fn() };
  let mockPathWhenNoobsLoaded: string | undefined;
  let mockPathTitleWhenNoobsLoaded: string | undefined;

  process.env.NODE_ENV = 'test';
  process.env.PATH = 'C:\\Windows\\System32';
  process.env.Path = 'C:\\Windows\\System32';

  jest.resetModules();
  jest.doMock(
    'noobs',
    () => {
      mockPathWhenNoobsLoaded = process.env.PATH;
      mockPathTitleWhenNoobsLoaded = process.env.Path;
      return mockNoobs;
    },
    { virtual: true },
  );

  const noobsRuntime = require('../../main/noobsRuntime')
    .default as typeof mockNoobs;
  const expectedBinPath = getNoobsBinPath(
    getNoobsDistPath(path.resolve(__dirname, '../../main'), false),
  );

  expect(noobsRuntime).toBe(mockNoobs);
  expect(mockPathWhenNoobsLoaded?.split(path.delimiter)[0]).toBe(
    expectedBinPath,
  );
  expect(mockPathTitleWhenNoobsLoaded).toBe(mockPathWhenNoobsLoaded);
  expect(mockPathWhenNoobsLoaded?.split(path.delimiter)).toContain(
    'C:\\Windows\\System32',
  );
});
