import path from 'path';
import {
  getNoobsBinPath,
  getNoobsDistPath,
  prependPathEntry,
  setNoobsPathEnvironment,
} from '../../main/noobsRuntimePath';

test('resolves noobs dist path for development and production bundles', () => {
  const devBase = path.resolve('C:\\repo\\.erb\\dll');
  const prodBase = path.resolve('C:\\repo\\release\\app\\dist\\main');
  const expectedDistPath = path.resolve(
    'C:\\repo\\release\\app\\node_modules\\noobs\\dist',
  );

  expect(getNoobsDistPath(devBase, true)).toBe(expectedDistPath);
  expect(getNoobsDistPath(prodBase, false)).toBe(expectedDistPath);
});

test('resolves noobs dist path outside app.asar for packaged bundles', () => {
  const packagedBase = path.resolve(
    'C:\\Program Files\\WarcraftRecorder\\resources\\app.asar\\dist\\main',
  );

  expect(getNoobsDistPath(packagedBase, false)).toBe(
    path.resolve(
      'C:\\Program Files\\WarcraftRecorder\\resources\\app.asar.unpacked\\node_modules\\noobs\\dist',
    ),
  );
});

test('prepends noobs bin path without duplicating an existing entry', () => {
  const noobsBinPath = path.resolve(
    'C:\\repo\\release\\app\\node_modules\\noobs\\dist\\bin',
  );
  const systemPath = ['C:\\Windows\\System32', noobsBinPath].join(
    path.delimiter,
  );

  expect(prependPathEntry(systemPath, noobsBinPath)).toBe(
    [noobsBinPath, 'C:\\Windows\\System32'].join(path.delimiter),
  );
});

test('removes an existing noobs bin entry regardless of path casing', () => {
  const noobsBinPath = path.resolve(
    'C:\\repo\\release\\app\\node_modules\\noobs\\dist\\bin',
  );
  const systemPath = [noobsBinPath.toUpperCase(), 'C:\\Windows\\System32'].join(
    path.delimiter,
  );

  expect(prependPathEntry(systemPath, noobsBinPath)).toBe(
    [noobsBinPath, 'C:\\Windows\\System32'].join(path.delimiter),
  );
});

test('sets both PATH casings for native OBS dependency lookup', () => {
  const env: NodeJS.ProcessEnv = {
    PATH: 'C:\\Windows\\System32',
  };
  const distPath = path.resolve(
    'C:\\repo\\release\\app\\node_modules\\noobs\\dist',
  );

  setNoobsPathEnvironment(env, distPath);

  expect(env.PATH).toBe(
    [getNoobsBinPath(distPath), 'C:\\Windows\\System32'].join(path.delimiter),
  );
  expect(env.Path).toBe(env.PATH);
});

test('preserves existing Path value when PATH is absent', () => {
  const env: NodeJS.ProcessEnv = {
    Path: 'C:\\Windows\\System32',
  };
  const distPath = path.resolve(
    'C:\\repo\\release\\app\\node_modules\\noobs\\dist',
  );

  setNoobsPathEnvironment(env, distPath);

  expect(env.PATH).toBe(
    [getNoobsBinPath(distPath), 'C:\\Windows\\System32'].join(path.delimiter),
  );
  expect(env.Path).toBe(env.PATH);
});
