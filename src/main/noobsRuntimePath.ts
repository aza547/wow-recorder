import path from 'path';

const fixPathWhenPackaged = (p: string) =>
  p.replace('app.asar', 'app.asar.unpacked');

export const getNoobsDistPath = (
  baseDir = __dirname,
  devMode = process.env.NODE_ENV === 'development',
): string => {
  const distPath = devMode
    ? path.resolve(baseDir, '../../release/app/node_modules/noobs/dist')
    : path.resolve(baseDir, '../../node_modules/noobs/dist');

  return fixPathWhenPackaged(distPath);
};

export const getNoobsBinPath = (distPath: string): string =>
  path.join(distPath, 'bin');

export const prependPathEntry = (
  currentPath: string | undefined,
  entry: string,
): string => {
  const normalizedEntry = path.normalize(entry);
  const entries = (currentPath || '')
    .split(path.delimiter)
    .filter(Boolean)
    .filter(
      (item) =>
        path.normalize(item).toLowerCase() !== normalizedEntry.toLowerCase(),
    );

  return [normalizedEntry, ...entries].join(path.delimiter);
};

export const setNoobsPathEnvironment = (
  env: NodeJS.ProcessEnv,
  distPath = getNoobsDistPath(),
) => {
  const currentPath = env.PATH || env.Path;
  const pathWithNoobsBin = prependPathEntry(
    currentPath,
    getNoobsBinPath(distPath),
  );

  env.PATH = pathWithNoobsBin;
  env.Path = pathWithNoobsBin;
};
