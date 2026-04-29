/**
 * OSN feasibility re-spike — clean path via OSN.app bundle.
 *
 * The first spike loaded the flat `obs_studio_client.node` directly,
 * bypassing the OSN.app bundle. That caused libobs's
 * `find_libobs_data_file` to crash on `[NSBundle bundleWithIdentifier]`
 * returning nil (no proper .app bundle for the framework to register).
 *
 * Per OSN's `module.js`, `require('obs-studio-node')` auto-detects
 * OSN.app on darwin and loads the .node binding from inside the
 * bundle. This re-spike uses that path + the standard `IPC.host`
 * flow Streamlabs Desktop uses, with no binary patches.
 *
 * Goal: confirm OSN works without our patches when loaded correctly.
 *
 * Run: node scripts/osn-spike-clean.js
 * Pass: prints "clean-spike: OK" and exits 0.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

const OSN_ROOT = path.resolve(
  __dirname,
  '../release/app/node_modules/obs-studio-node',
);

console.log('clean-spike: requiring obs-studio-node from', OSN_ROOT);
console.log('clean-spike: process.platform =', process.platform);
console.log('clean-spike: process.arch =', process.arch);

let osn;
try {
  osn = require(OSN_ROOT);
} catch (err) {
  console.error('clean-spike: require failed', err && err.stack ? err.stack : err);
  process.exit(1);
}

console.log(
  'clean-spike: top-level keys =',
  Object.keys(osn).slice(0, 30).join(', '),
);

if (!osn.NodeObs || !osn.IPC) {
  console.error('clean-spike: NodeObs or IPC missing');
  process.exit(2);
}

const userDataPath = path.join(os.tmpdir(), 'wcr-osn-clean-spike');
fs.mkdirSync(userDataPath, { recursive: true });
console.log('clean-spike: userDataPath =', userDataPath);

const pipeName = 'wcr-clean-' + process.pid;

try {
  // Standard OSN init flow (per Streamlabs Desktop pattern + Envek example).
  // module.js already called setServerPath at require time, so we skip it.
  console.log('clean-spike: IPC.host(' + pipeName + ')');
  osn.IPC.host(pipeName);

  console.log('clean-spike: SetWorkingDirectory');
  osn.NodeObs.SetWorkingDirectory(OSN_ROOT);

  console.log('clean-spike: OBS_API_initAPI');
  const initRes = osn.NodeObs.OBS_API_initAPI(
    'en-US',
    userDataPath,
    '0.0.0-spike',
  );
  console.log('clean-spike: init result =', initRes);

  if (initRes !== 0) {
    console.error('clean-spike: init returned non-zero', initRes);
    try { osn.NodeObs.OBS_API_destroyOBS_API(); } catch (e) {}
    try { osn.IPC.disconnect(); } catch (e) {}
    process.exit(5);
  }

  console.log('clean-spike: shutdown — removeCallback');
  try { osn.NodeObs.OBS_service_removeCallback(); } catch (e) {
    console.warn('clean-spike: removeCallback threw', e && e.message);
  }

  console.log('clean-spike: shutdown — destroyOBS_API');
  // Apply a soft timeout: if destroy hangs (the original spike's
  // observation), kill the process after 5s so we know.
  const destroyTimer = setTimeout(() => {
    console.error('clean-spike: destroyOBS_API hung > 5s, exiting');
    process.exit(7);
  }, 5000);

  try {
    osn.NodeObs.OBS_API_destroyOBS_API();
    clearTimeout(destroyTimer);
    console.log('clean-spike: destroyOBS_API returned cleanly');
  } catch (e) {
    clearTimeout(destroyTimer);
    console.warn('clean-spike: destroyOBS_API threw', e && e.message);
  }

  console.log('clean-spike: IPC.disconnect');
  try { osn.IPC.disconnect(); } catch (e) {
    console.warn('clean-spike: disconnect threw', e && e.message);
  }

  console.log('clean-spike: OK');
  process.exit(0);
} catch (err) {
  console.error('clean-spike: threw', err && err.stack ? err.stack : err);
  try { osn.NodeObs.OBS_API_destroyOBS_API(); } catch (e) {}
  try { osn.IPC.disconnect(); } catch (e) {}
  process.exit(3);
}
