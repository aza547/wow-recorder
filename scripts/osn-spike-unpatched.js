/**
 * OSN feasibility spike — manual-spawn pattern + UNPATCHED OSN.app binaries.
 *
 * Hypothesis from re-investigation: the original spike's two binary patches
 * (libobs find_libobs_data_file, obs64 finalize_global_signals) were
 * masking a different root cause. The real issue: loading libobs as a
 * flat dylib outside its proper .app bundle means
 * `[NSBundle bundleWithIdentifier:@"com.obsproject.libobs"]` returns nil.
 *
 * `OSN.app/distribute/obs-studio-node/Frameworks/libobs.framework/...`
 * IS a proper bundle. If we load OSN through the OSN.app path
 * (require('obs-studio-node') auto-detects this), the bundle lookup
 * should succeed and the strlen-on-NULL crash shouldn't happen.
 *
 * This spike combines:
 *   1. Manual obs64 spawn + readiness wait (proven workaround for IPC.host race).
 *   2. Pointing IPC at the UNPATCHED OSN.app's bin/obs64.
 *   3. require('obs-studio-node') so module.js loads the .node from OSN.app.
 *
 * Pass criteria: no SIGSEGV from the patched-out null guards. Same
 * "spike: OK" exit. If it crashes in find_libobs_data_file or
 * finalize_global_signals, the patches really are needed.
 *
 * Run: node scripts/osn-spike-unpatched.js
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');

const OSN_ROOT = path.resolve(
  __dirname,
  '../release/app/node_modules/obs-studio-node',
);

// The UNPATCHED bundle — preserves macOS bundle identifier semantics.
const OSN_APP_BIN = path.join(
  OSN_ROOT,
  'OSN.app',
  'distribute',
  'obs-studio-node',
  'bin',
);
const HELPER = path.join(OSN_APP_BIN, 'obs64');

if (!fs.existsSync(HELPER)) {
  console.error('unpatched-spike: missing helper at', HELPER);
  process.exit(4);
}

console.log('unpatched-spike: helper =', HELPER);

const osn = require(OSN_ROOT);
console.log('unpatched-spike: osn keys =', Object.keys(osn).slice(0, 25).join(', '));

if (!osn.NodeObs || !osn.IPC) {
  console.error('unpatched-spike: NodeObs/IPC missing');
  process.exit(2);
}

// module.js auto-set IPC.setServerPath at require time. Override explicitly to
// the OSN.app path to make sure we use the unpatched binary.
console.log('unpatched-spike: IPC.setServerPath -> OSN.app/.../bin/obs64');
osn.IPC.setServerPath(HELPER, OSN_APP_BIN);

const userDataPath = path.join(os.tmpdir(), 'wcr-osn-unpatched-spike');
fs.mkdirSync(userDataPath, { recursive: true });

const pipeName = 'wcr-unpatched-' + process.pid;

function spawnObs64AndWait(binaryPath, pipe, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, [pipe, 'DEVMODE_VERSION', binaryPath], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let ready = false;
    let stdoutBuf = '';
    const timer = setTimeout(() => {
      if (!ready) {
        console.error('unpatched-spike: readiness timeout. stdout so far:\n' + stdoutBuf);
        child.kill();
        reject(new Error('readiness timeout'));
      }
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      const s = chunk.toString();
      stdoutBuf += s;
      process.stdout.write('[obs64] ' + s);
      if (!ready && stdoutBuf.includes('server - start watcher')) {
        ready = true;
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.stderr.on('data', (chunk) => process.stderr.write('[obs64 err] ' + chunk));
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('exit', (code, signal) => {
      if (!ready) {
        clearTimeout(timer);
        reject(new Error('obs64 exited early: code=' + code + ' signal=' + signal));
      }
    });
  });
}

async function run() {
  let obs64proc = null;
  let initRes = -1;
  try {
    obs64proc = await spawnObs64AndWait(HELPER, pipeName);
    console.log('unpatched-spike: obs64 ready, pid=' + obs64proc.pid);

    console.log('unpatched-spike: IPC.connect(' + pipeName + ')');
    const connectResult = osn.IPC.connect(pipeName);
    console.log('unpatched-spike: IPC.connect =', connectResult);

    // Use OSN.app path as working dir so libobs's bundle lookup finds itself.
    const workingDir = path.join(OSN_ROOT, 'OSN.app', 'distribute', 'obs-studio-node');
    console.log('unpatched-spike: SetWorkingDirectory ->', workingDir);
    osn.NodeObs.SetWorkingDirectory(workingDir);

    console.log('unpatched-spike: OBS_API_initAPI');
    initRes = osn.NodeObs.OBS_API_initAPI(
      'en-US',
      userDataPath,
      '0.0.0-unpatched-spike',
    );
    console.log('unpatched-spike: init result =', initRes);

    // Shutdown
    console.log('unpatched-spike: removeCallback');
    try { osn.NodeObs.OBS_service_removeCallback(); } catch (e) {
      console.warn('  threw:', e && e.message);
    }

    console.log('unpatched-spike: SIGTERM obs64');
    obs64proc.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));

    console.log('unpatched-spike: IPC.disconnect');
    try { osn.IPC.disconnect(); } catch (e) {
      console.warn('  threw:', e && e.message);
    }

    if (initRes === 0) {
      console.log('unpatched-spike: OK');
      process.exit(0);
    } else {
      console.error('unpatched-spike: init non-zero', initRes);
      process.exit(5);
    }
  } catch (err) {
    console.error('unpatched-spike: caught', err && err.stack ? err.stack : err);
    if (obs64proc) {
      try { obs64proc.kill('SIGKILL'); } catch {}
    }
    try { osn.IPC.disconnect(); } catch {}
    process.exit(3);
  }
}

run();
