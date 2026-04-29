/**
 * OSN feasibility spike for Phase 2 macOS port.
 * Run: node scripts/osn-spike.js
 * Expected: prints "spike: OK" and exits 0.
 *
 * Discovered API surface (OSN 0.26.17, obs_studio_client.0.3.21.0.node):
 *   - module.js auto-calls IPC.setServerPath at require-time (bin/obs64)
 *   - IPC.host(uri) spawns obs64 via posix_spawnp and returns IMMEDIATELY
 *     (no wait for readiness) — calling initAPI right after causes SIGABRT
 *     (IPC race condition: deserialize fails on empty/partial read).
 *   - Correct startup protocol on macOS:
 *       1. spawn obs64 manually: obs64 <pipeName> DEVMODE_VERSION <obs64Path>
 *       2. wait for obs64 to print "server - start watcher" on stdout
 *       3. IPC.connect(pipeName)  — NOT IPC.host()
 *       4. NodeObs.SetWorkingDirectory(obsRoot)  — MUST come before initAPI
 *       5. NodeObs.OBS_API_initAPI(locale, userDataPath, version) -> 0 = success
 *       6. shutdown: OBS_service_removeCallback → OBS_API_destroyOBS_API → IPC.disconnect
 *   - IPC.setServerPath(binaryPath, workingDirectoryPath?) — already called
 *     by module.js at import time; re-calling is idempotent.
 *   - NodeObs.SetWorkingDirectory(obsRoot) — MUST be called before OBS_API_initAPI
 *     so OBS can locate its data/ directory (shaders, effects, plugins).
 *   - NodeObs.OBS_API_initAPI(locale, userDataPath, version) -> number (0=success)
 *   - NodeObs.OBS_API_destroyOBS_API()
 *   - NodeObs.OBS_service_removeCallback()
 *   - IPC.disconnect()
 *
 * Binary patches applied (macOS arm64 only):
 *   libobs (Frameworks/libobs.framework/Versions/A/libobs):
 *     offset 0x2dff4: bl strlen → cbz x0, #76
 *     (null-guard in find_libobs_data_file when NSBundle returns nil)
 *   obs64 (bin/obs64):
 *     offset 0x1c014c: adrp x1, 191 → cbz x0, +20
 *     (null-guard in finalize_global_signals when obs_get_signal_handler() returns null)
 *
 * Note: module.js requires './obs_studio_client.node' but the actual file is
 * 'obs_studio_client.0.3.21.0.node'. We create a symlink if needed, or require
 * the versioned file directly and reconstruct the module shape manually.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');

const OSN_ROOT = path.resolve(
  __dirname,
  '../release/app/node_modules/obs-studio-node',
);

const NODE_FILE_VERSIONED = path.join(OSN_ROOT, 'obs_studio_client.0.3.21.0.node');
const NODE_FILE_UNVERSIONED = path.join(OSN_ROOT, 'obs_studio_client.node');

console.log('spike: OSN_ROOT =', OSN_ROOT);

// Ensure the unversioned symlink/copy exists so module.js can require it
if (!fs.existsSync(NODE_FILE_UNVERSIONED)) {
  if (fs.existsSync(NODE_FILE_VERSIONED)) {
    console.log('spike: creating symlink obs_studio_client.node ->',
      path.basename(NODE_FILE_VERSIONED));
    fs.symlinkSync(NODE_FILE_VERSIONED, NODE_FILE_UNVERSIONED);
  } else {
    console.error('spike: versioned .node file not found at', NODE_FILE_VERSIONED);
    process.exit(4);
  }
}

console.log('spike: loading osn from', OSN_ROOT);
let osn;
try {
  osn = require(OSN_ROOT);
} catch (e) {
  console.error('spike: require threw:', e && e.stack ? e.stack : e);
  process.exit(3);
}

console.log('spike: osn keys =', Object.keys(osn).slice(0, 40).join(', '));

if (!osn || !osn.NodeObs || !osn.IPC) {
  console.error('spike: expected keys NodeObs + IPC missing. Got:', Object.keys(osn || {}).join(', '));
  process.exit(2);
}

// module.js already called IPC.setServerPath at import time (bin/obs64 for macOS).
// Re-call explicitly to override any OSN.app path that module.js may have set.
const helperPath = path.join(OSN_ROOT, 'bin', 'obs64');
if (!fs.existsSync(helperPath)) {
  console.error('spike: helper binary not found at', helperPath);
  process.exit(4);
}
console.log('spike: helper binary =', helperPath);

console.log('spike: IPC.setServerPath (explicit override to ensure bin/obs64 is used)');
osn.IPC.setServerPath(helperPath, path.join(OSN_ROOT, 'bin'));

const userDataPath = path.join(os.tmpdir(), 'wcr-osn-spike');
fs.mkdirSync(userDataPath, { recursive: true });
console.log('spike: userDataPath =', userDataPath);

const pipeName = 'wcr-osn-spike-' + process.pid;
console.log('spike: pipe name =', pipeName);

/**
 * Spawn obs64 manually and wait for it to signal readiness via stdout.
 * obs64 argv: <pipeName> DEVMODE_VERSION <binaryPath>
 * Ready signal: stdout line containing "server - start watcher"
 */
function spawnObs64AndWaitReady(binaryPath, pipe, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    console.log('spike: spawning obs64 manually:', binaryPath, [pipe, 'DEVMODE_VERSION', binaryPath].join(' '));
    const child = spawn(binaryPath, [pipe, 'DEVMODE_VERSION', binaryPath], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let ready = false;
    let stdoutBuf = '';
    let stderrBuf = '';

    const timer = setTimeout(() => {
      if (!ready) {
        console.error('spike: obs64 readiness timeout after', timeoutMs, 'ms');
        console.error('spike: obs64 stdout so far:\n' + stdoutBuf);
        console.error('spike: obs64 stderr so far:\n' + stderrBuf);
        child.kill();
        reject(new Error('obs64 readiness timeout'));
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString();
      process.stdout.write('[obs64] ' + chunk.toString());
      if (!ready && stdoutBuf.includes('server - start watcher')) {
        ready = true;
        clearTimeout(timer);
        resolve(child);
      }
    });

    child.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString();
      process.stderr.write('[obs64 err] ' + chunk.toString());
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('exit', (code, signal) => {
      if (!ready) {
        clearTimeout(timer);
        reject(new Error('obs64 exited before ready: code=' + code + ' signal=' + signal));
      }
    });
  });
}

async function run() {
  let obs64proc = null;
  let initRes = -1;

  try {
    // Step 1: spawn obs64 manually and wait for IPC server readiness
    obs64proc = await spawnObs64AndWaitReady(helperPath, pipeName);
    console.log('spike: obs64 ready (pid=' + obs64proc.pid + ')');

    // Step 2: connect (NOT host — host would spawn a second obs64 and race)
    console.log('spike: IPC.connect(' + pipeName + ')');
    const connectResult = osn.IPC.connect(pipeName);
    console.log('spike: IPC.connect result =', connectResult);

    // Step 3: SetWorkingDirectory before initAPI
    console.log('spike: SetWorkingDirectory');
    osn.NodeObs.SetWorkingDirectory(OSN_ROOT);

    // Step 4: initialize OBS
    console.log('spike: OBS_API_initAPI');
    try {
      if (typeof osn.NodeObs.OBS_API_initAPI === 'function') {
        initRes = osn.NodeObs.OBS_API_initAPI('en-US', userDataPath, '0.0.0-spike');
      } else {
        console.log('spike: OBS_API_initAPI not found on NodeObs, trying Global.startup');
        osn.Global.startup('en-US', userDataPath);
        initRes = 0;
      }
    } catch (e) {
      console.error('spike: init threw', e && e.stack ? e.stack : e);
      initRes = -1;
    }
    console.log('spike: init result =', initRes);

    if (initRes !== 0) {
      console.warn('spike: init returned non-zero code', initRes,
        '— checking logs at', path.join(userDataPath, 'logs'));
      const logsDir = path.join(userDataPath, 'logs');
      if (fs.existsSync(logsDir)) {
        const logs = fs.readdirSync(logsDir);
        if (logs.length > 0) {
          const lastLog = path.join(logsDir, logs.sort().pop());
          console.log('spike: last log file:', lastLog);
          try {
            const logContent = fs.readFileSync(lastLog, 'utf8').slice(-2000);
            console.log('spike: log tail:\n' + logContent);
          } catch {}
        }
      }
    }

    // Step 5: shutdown sequence
    // Note: OBS_API_destroyOBS_API sends an IPC message to obs64 and blocks
    // synchronously (sem_wait) for the response. On macOS, obs64 exits before
    // sending the IPC reply — so the sem_wait never fires and Node hangs.
    // Workaround: kill obs64 first, then IPC.disconnect to clean up the socket.
    // The production OsnBackend will need the same workaround until OSN is fixed.
    console.log('spike: shutting down');
    console.log('spike: calling OBS_service_removeCallback');
    try { osn.NodeObs.OBS_service_removeCallback(); } catch (e) { console.warn('removeCallback threw', e && e.message); }
    console.log('spike: killing obs64 process before destroyOBS_API (avoids IPC hang)');
    if (obs64proc) {
      try { obs64proc.kill('SIGTERM'); } catch (e) { console.warn('obs64 kill threw', e && e.message); }
      // Give obs64 a moment to exit before we disconnect
      await new Promise((r) => setTimeout(r, 500));
    }
    console.log('spike: calling IPC.disconnect');
    try { osn.IPC.disconnect(); } catch (e) { console.warn('IPC.disconnect threw', e && e.message); }
    console.log('spike: shutdown sequence complete');
    obs64proc = null; // already killed

  } catch (err) {
    console.error('spike: threw', err && err.stack ? err.stack : err);
    try { osn.NodeObs.OBS_API_destroyOBS_API(); } catch {}
    try { osn.IPC.disconnect(); } catch {}
    if (obs64proc) { try { obs64proc.kill(); } catch {} }
    process.exit(3);
  }

  // Kill obs64 after IPC disconnect
  if (obs64proc) {
    try {
      obs64proc.kill();
      console.log('spike: obs64 process killed');
    } catch (e) {
      console.warn('spike: obs64 kill failed:', e && e.message);
    }
  }

  if (initRes === 0) {
    console.log('spike: OK');
    process.exit(0);
  } else {
    console.error('spike: FAILED — init code', initRes);
    process.exit(5);
  }
}

run();
