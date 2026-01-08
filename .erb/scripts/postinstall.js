/* eslint-disable no-console */
const { spawnSync } = require('child_process');

const run = (cmd, args) => {
  const res = spawnSync(cmd, args, { stdio: 'inherit' });
  if (res.error) throw res.error;
  if (res.status !== 0) process.exit(res.status ?? 1);
};

// Windows builds rely on native deps living in `release/app`.
if (process.platform === 'win32') {
  console.info('[postinstall] Installing production deps for release/app');
  run('electron-builder', ['install-app-deps']);
} else {
  console.info(
    `[postinstall] Skipping electron-builder install-app-deps on ${process.platform}`,
  );
}

// Always build the renderer DLL (used by dev mode).
console.info('[postinstall] Building renderer DLL');
run('npm', ['run', 'build:dll']);

