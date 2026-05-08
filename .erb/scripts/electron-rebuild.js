import { execSync } from 'child_process';
import fs from 'fs';
import { dependencies } from '../../release/app/package.json';
import webpackPaths from '../configs/webpack.paths';

if (
  Object.keys(dependencies || {}).length > 0 &&
  fs.existsSync(webpackPaths.appNodeModulesPath)
) {
  // --only whitelists modules whose native code we actually want rebuilt
  // for the Electron ABI. noobs ships a pre-built .node + dist tree from
  // its own CI (see noobs/.github/workflows/release-mac.yml) and would
  // otherwise need an obs-deps + libobs source tree on the consumer's
  // machine to rebuild from scratch — node-gyp doesn't read its no-op
  // install script.
  const electronRebuildCmd =
    '../../node_modules/.bin/electron-rebuild --force --types prod,dev,optional --module-dir . -v 38.1.2 --only=uiohook-napi,deasync';
  const cmd =
    process.platform === 'win32'
      ? electronRebuildCmd.replace(/\//g, '\\')
      : electronRebuildCmd;
  execSync(cmd, {
    cwd: webpackPaths.appPath,
    stdio: 'inherit',
  });
}
