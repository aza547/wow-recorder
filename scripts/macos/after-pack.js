/* eslint-env node */
/* global require, __dirname, process, module */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const copyRebuiltNoobsAddon = require('../noobs/copy-rebuilt-addon');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OBS_VERSION =
  process.env.WCR_MACOS_OBS_VERSION || process.env.OBS_VERSION || '30.2.3';

const macArtifactArch = process.arch === 'x64' ? 'x86_64' : process.arch;
const DEFAULT_ARTIFACT_DIR = path.join(
  REPO_ROOT,
  'native',
  'macos',
  'artifacts',
  `obs-${OBS_VERSION}-${macArtifactArch}`,
);

const ARTIFACT_DIR =
  process.env.WCR_MACOS_OBS_ARTIFACT_DIR || DEFAULT_ARTIFACT_DIR;

const OBS_APP_SOURCE =
  process.env.WCR_MACOS_OBS_APP_PATH || '/Applications/OBS.app';

const PLUGIN_SOURCE = path.join(
  ARTIFACT_DIR,
  'obs',
  'OBS.app',
  'Contents',
  'WCRPlugIns',
  'obs-ffmpeg.plugin',
);

const MUX_SOURCE = path.join(
  ARTIFACT_DIR,
  'app',
  'Contents',
  'MacOS',
  'obs-ffmpeg-mux',
);

const assertExists = async (sourcePath, description) => {
  try {
    await fsp.access(sourcePath);
  } catch {
    throw new Error(
      `${description} not found at ${sourcePath}. ` +
        'Run scripts/macos/build-obs-ffmpeg.sh or set the WCR_MACOS_* override paths.',
    );
  }
};

const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });

const ditto = async (sourcePath, destinationPath) => {
  await fsp.rm(destinationPath, { force: true, recursive: true });
  await fsp.mkdir(path.dirname(destinationPath), { recursive: true });
  await run('ditto', [sourcePath, destinationPath]);
};

const findAppBundle = async (appOutDir) => {
  const entries = await fsp.readdir(appOutDir, { withFileTypes: true });
  const appEntry = entries.find(
    (entry) => entry.isDirectory() && entry.name.endsWith('.app'),
  );

  if (!appEntry) {
    throw new Error(`No .app bundle found in ${appOutDir}`);
  }

  return path.join(appOutDir, appEntry.name);
};

const getAppBundlePath = async (context) => {
  if (typeof context === 'string') {
    return context;
  }

  const appInfo = context.packager && context.packager.appInfo;
  const productFilename =
    appInfo && (appInfo.productFilename || appInfo.productName);

  if (productFilename) {
    const appBundlePath = path.join(
      context.appOutDir,
      `${productFilename}.app`,
    );

    if (fs.existsSync(appBundlePath)) {
      return appBundlePath;
    }
  }

  return findAppBundle(context.appOutDir);
};

const installMacObsRuntime = async (appBundlePath) => {
  await assertExists(
    path.join(OBS_APP_SOURCE, 'Contents', 'Info.plist'),
    'OBS.app source',
  );
  await assertExists(PLUGIN_SOURCE, 'patched obs-ffmpeg.plugin');
  await assertExists(MUX_SOURCE, 'obs-ffmpeg-mux helper');

  const contentsPath = path.join(appBundlePath, 'Contents');
  const resourcesPath = path.join(contentsPath, 'Resources');
  const macosPath = path.join(contentsPath, 'MacOS');
  const packagedNoobsPath = path.join(
    resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    'noobs',
  );

  const obsDestination = path.join(resourcesPath, 'obs', 'OBS.app');
  const pluginDestination = path.join(
    obsDestination,
    'Contents',
    'WCRPlugIns',
    'obs-ffmpeg.plugin',
  );
  const muxDestination = path.join(macosPath, 'obs-ffmpeg-mux');

  await ditto(OBS_APP_SOURCE, obsDestination);
  await ditto(PLUGIN_SOURCE, pluginDestination);

  await fsp.mkdir(macosPath, { recursive: true });
  await fsp.copyFile(MUX_SOURCE, muxDestination);
  await fsp.chmod(muxDestination, 0o755);
  copyRebuiltNoobsAddon(packagedNoobsPath);

  console.log('[macos-obs-runtime] Installed OBS runtime assets');
  console.log(`[macos-obs-runtime] OBS.app: ${obsDestination}`);
  console.log(`[macos-obs-runtime] WCR plugin: ${pluginDestination}`);
  console.log(`[macos-obs-runtime] mux helper: ${muxDestination}`);
};

const afterPack = async (context) => {
  if (process.env.WCR_MACOS_SKIP_OBS_RUNTIME === '1') {
    console.log('[macos-obs-runtime] Skipping OBS runtime bundle');
    return;
  }

  if (
    typeof context !== 'string' &&
    context &&
    context.electronPlatformName !== 'darwin'
  ) {
    return;
  }

  const appBundlePath = await getAppBundlePath(context);
  await installMacObsRuntime(appBundlePath);
};

module.exports = afterPack;
module.exports.installMacObsRuntime = installMacObsRuntime;

if (require.main === module) {
  const appBundlePath = process.argv[2];

  if (!appBundlePath) {
    console.error('usage: node scripts/macos/after-pack.js /path/to/App.app');
    process.exit(1);
  }

  afterPack(appBundlePath).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
