# macOS Port — Phase 2c: Signed Dev Build (electron-builder + afterSign)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build + run a Developer-ID-signed `WarcraftRecorder.app` on macOS so OSN recording can be tested in a proper bundle context. The Phase 2b smoke kept hitting macOS-26 sandbox checks that ad-hoc binaries fail. Signing + running from a real `.app` bundle (not Terminal-spawned dev) bypasses those checks the same way Streamlabs Desktop does.

**Architecture:** electron-builder produces a `.app`/`.dmg` with `mac` target. An `afterSign` hook script (`scripts/sign-osn-binaries.js`) walks the OSN tree inside the bundled app and re-signs every native binary (`obs64`, `libobs.framework/Versions/A/libobs`, every `obs64 Helper*.app/Contents/MacOS/*`, `crashpad_handler`, `obs-ffmpeg-mux`, `Frameworks/ffmpeg`, every `.dylib` and `.plugin` content) with the user's Developer ID Application certificate.

**Tech Stack:** `electron-builder`, `@electron/notarize` (already in devDeps), Apple Developer ID Application certificate, hardened runtime entitlements, codesign CLI.

**Scope boundary:** Local-dev signed `.app` only. Notarization for distribution is a Plan 3 concern (involves Apple's `xcrun notarytool` + waiting). This plan stops at "double-click the .app, it launches, OSN init works without binary patches."

**Pre-existing context:** Branch `feat/macos-osn-backend` at HEAD `dbaa72c` (12 Phase 2b commits + binary patches to OSN). Plan 2b smoke showed: monitor enum works; recording start fails with IPC error in ad-hoc context. Plan 2a Task 12 already includes `assets/entitlements.mac.plist` with `cs.allow-jit` + `cs.allow-unsigned-executable-memory`.

---

## Pre-flight

- [ ] **P1. Confirm branch + clean tree**

```bash
git branch --show-current  # → feat/macos-osn-backend
git status --short         # → clean except known pre-existing modifications
```

- [ ] **P2. Capture signing identity**

```bash
security find-identity -v -p codesigning | grep "Developer ID Application"
```

Expected: `1) <40-char-hash> "Developer ID Application: <Your Name> (<TEAM_ID>)"`. Record:
- The full identity string (between quotes).
- The 10-character `TEAM_ID` in parentheses.

If empty: install the Developer ID Application cert from Apple Developer portal first (download `.cer`, double-click to add to Keychain).

- [ ] **P3. Confirm entitlements file**

```bash
cat /Users/yuripiratello/projects/personal/wow-recorder/assets/entitlements.mac.plist
```

Should contain at minimum `com.apple.security.cs.allow-jit` + `com.apple.security.cs.allow-unsigned-executable-memory`. We'll extend it in Task 1.

---

## Task 1: Update entitlements for OSN's needs

**Files:** Modify `assets/entitlements.mac.plist`.

OSN spawns `obs64` helper which Crashpad subprocess-execs. macOS hardened runtime blocks unsigned-library loading and Mach lookup unless explicitly entitled. Add the entitlements Streamlabs Desktop uses (their `entitlements.plist` in their repo is public).

Replace the file with:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
  <key>com.apple.security.cs.allow-jit</key><true/>
  <key>com.apple.security.cs.allow-dyld-environment-variables</key><true/>
  <key>com.apple.security.cs.disable-library-validation</key><true/>
  <key>com.apple.security.device.audio-input</key><true/>
  <key>com.apple.security.device.camera</key><true/>
  <key>com.apple.security.cs.disable-executable-page-protection</key><true/>
  <key>com.apple.security.cs.allow-relative-library-loads</key><true/>
  <key>com.apple.security.automation.apple-events</key><true/>
  <key>com.apple.security.cs.allow-arbitrary-loads</key><true/>
</dict>
</plist>
```

Commit:
```bash
git add assets/entitlements.mac.plist
git commit -m "build(mac): expand entitlements for OSN hardened runtime"
```

---

## Task 2: Configure electron-builder mac block

**Files:** Modify `package.json` `build` block.

Read `/Users/yuripiratello/projects/personal/wow-recorder/package.json`. The existing `build` block has `nsis`, `win`, `directories`, `extraResources`, `publish`, `appId`. Add a `mac` block + `afterSign` hook reference.

Inside the `build` object, add (preserving everything else):

```json
"mac": {
  "category": "public.app-category.utilities",
  "target": [
    { "target": "dir", "arch": ["arm64"] }
  ],
  "artifactName": "WarcraftRecorder-${version}-${arch}.${ext}",
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "assets/entitlements.mac.plist",
  "entitlementsInherit": "assets/entitlements.mac.plist",
  "identity": "<full Developer ID identity string from P2>",
  "type": "development",
  "extendInfo": {
    "NSScreenCaptureUsageDescription": "Warcraft Recorder needs Screen Recording to capture your gameplay.",
    "NSMicrophoneUsageDescription": "Warcraft Recorder needs microphone access to record your voice.",
    "NSCameraUsageDescription": "Warcraft Recorder does not use the camera; this entitlement is reserved for future webcam-overlay support.",
    "LSUIElement": false
  },
  "asar": false,
  "extraResources": [
    "./assets/**"
  ]
},
"afterSign": "scripts/sign-osn-binaries.js"
```

Notes:
- `target: dir` produces `.app/` only (no DMG). Faster iteration. Plan 3 adds DMG.
- `asar: false` so OSN's native data files (plugins, dylibs) stay browseable on disk; OSN doesn't work with asar packaging.
- `identity`: paste full string captured in P2, e.g. `"Developer ID Application: Yuri Piratello (XXXXXXXXXX)"`.

Verify the JSON parses:
```bash
./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS"   # baseline check still passes
node -e "console.log(JSON.stringify(require('./package.json').build.mac.identity))"
```

Commit:
```bash
git add package.json
git commit -m "build(mac): add mac target + Developer ID signing config"
```

---

## Task 3: Write afterSign hook to re-sign OSN binaries

**Files:** Create `scripts/sign-osn-binaries.js`.

electron-builder signs the main `WarcraftRecorder.app` plus its top-level Frameworks + Helpers. It does NOT recursively sign third-party dylibs/binaries deep inside `node_modules/obs-studio-node/`. Without re-signing, hardened runtime refuses to load them and OSN init fails.

Write to `/Users/yuripiratello/projects/personal/wow-recorder/scripts/sign-osn-binaries.js`:

```js
/**
 * electron-builder afterSign hook.
 *
 * Walks the OSN tree inside the bundled .app and re-signs every native
 * binary, dylib, framework, helper, and plugin with our Developer ID.
 *
 * Why: the default electron-builder pass only signs first-party stuff.
 * OSN ships a deep tree of third-party binaries (obs64 helper apps,
 * crashpad_handler, Chromium Embedded Framework, ffmpeg, plus dozens
 * of OBS .plugin bundles). All of them must be signed with our team
 * cert for hardened-runtime + macOS 26 sandbox checks to permit
 * loading them.
 *
 * Run-once verification: `codesign --verify --deep --strict <appPath>`
 * after the hook runs.
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const IDENTITY = process.env.WCR_SIGN_IDENTITY;
const ENTITLEMENTS = path.resolve(
  __dirname,
  '..',
  'assets',
  'entitlements.mac.plist',
);

if (!IDENTITY) {
  console.warn(
    '[sign-osn-binaries] WCR_SIGN_IDENTITY env not set; falling back to identity from package.json build.mac.identity',
  );
}

function sign(target) {
  const identity =
    IDENTITY ||
    require('../package.json').build.mac.identity ||
    '-'; // ad-hoc as last resort
  console.log('[sign-osn-binaries]', target);
  try {
    execFileSync(
      'codesign',
      [
        '--force',
        '--sign',
        identity,
        '--options',
        'runtime',
        '--entitlements',
        ENTITLEMENTS,
        '--timestamp=none', // notarization happens later in Plan 3
        target,
      ],
      { stdio: ['ignore', 'inherit', 'inherit'] },
    );
  } catch (err) {
    console.error('[sign-osn-binaries] FAILED to sign', target, err.message);
    throw err;
  }
}

/**
 * Find all signable items inside a directory: dylibs, .node modules,
 * Mach-O executables, .framework bundles, .app bundles, .plugin bundles.
 * Returns DEEPEST-first so nested bundles are signed before their parents.
 */
function findSignables(root) {
  const out = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (
          entry.name.endsWith('.app') ||
          entry.name.endsWith('.framework') ||
          entry.name.endsWith('.plugin')
        ) {
          // Recurse first, then add the bundle itself.
          walk(full);
          out.push(full);
        } else {
          walk(full);
        }
        continue;
      }
      if (
        entry.name.endsWith('.dylib') ||
        entry.name.endsWith('.node') ||
        entry.name === 'obs64' ||
        entry.name === 'crashpad_handler' ||
        entry.name === 'crashpad_database_util' ||
        entry.name === 'crashpad_http_upload' ||
        entry.name === 'obs-ffmpeg-mux' ||
        entry.name === 'ffmpeg'
      ) {
        // Verify it's actually Mach-O before signing.
        try {
          const head = fs.readFileSync(full, { encoding: null }).slice(0, 4);
          const magic = head.readUInt32BE(0);
          // Mach-O magic numbers (be/le, 32/64, fat).
          if (
            magic === 0xfeedface ||
            magic === 0xfeedfacf ||
            magic === 0xcefaedfe ||
            magic === 0xcffaedfe ||
            magic === 0xcafebabe ||
            magic === 0xbebafeca
          ) {
            out.push(full);
          }
        } catch {
          // Not a regular file — skip.
        }
      }
    }
  }
  walk(root);
  return out;
}

module.exports = async function (context) {
  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );
  const osnRoot = path.join(
    appPath,
    'Contents',
    'Resources',
    'app',
    'node_modules',
    'obs-studio-node',
  );

  if (!fs.existsSync(osnRoot)) {
    console.warn(
      '[sign-osn-binaries] OSN root not found at',
      osnRoot,
      '— skipping (signing only the main app).',
    );
    return;
  }

  console.log('[sign-osn-binaries] OSN root:', osnRoot);
  const targets = findSignables(osnRoot);
  console.log(
    `[sign-osn-binaries] Will sign ${targets.length} items (deepest-first).`,
  );

  for (const target of targets) sign(target);

  // Final pass: re-sign the top-level app to seal everything.
  console.log('[sign-osn-binaries] Re-sealing app bundle');
  sign(appPath);

  // Verify
  console.log('[sign-osn-binaries] Verifying full bundle');
  try {
    execFileSync(
      'codesign',
      ['--verify', '--deep', '--strict', '--verbose=2', appPath],
      { stdio: ['ignore', 'inherit', 'inherit'] },
    );
    console.log('[sign-osn-binaries] OK');
  } catch (err) {
    console.error('[sign-osn-binaries] verify failed', err.message);
    throw err;
  }
};
```

Commit:
```bash
git add scripts/sign-osn-binaries.js
git commit -m "build(mac): afterSign hook re-signs OSN bundled binaries"
```

---

## Task 4: First package attempt + iterate

**Files:** none — running build, debugging fallout.

```bash
WCR_SIGN_IDENTITY="<full identity string>" npm run package
```

Expected outcomes (in order of likelihood):

**A. Build succeeds, `codesign --verify --deep --strict` reports OK.** Proceed to Task 5.

**B. `codesign` failures on specific binaries.** Common causes:
- Symlinks inside frameworks confusing the walker — already filtered, but verify with `find ... -type l`.
- Binary lacks proper Mach-O magic (some `.dylib`s on disk are scripts) — extend the magic check or skip.
- `--entitlements` rejected for non-main binaries — try removing the `--entitlements` flag from `sign()` for non-main targets (entitlements only apply to the top-level executable).

**C. electron-builder fails to package because `release/app/` lacks `node_modules/obs-studio-node`.** electron-builder copies `release/app/node_modules` into the bundle. If the OSN tarball got blown away, reinstall: `cd release/app && npm install && cd -`.

**D. Build succeeds but signed app fails Gatekeeper on first launch.** Right-click the app → Open the first time to bypass.

Iterate until clean signed `.app` produced under `release/build/mac-arm64/WarcraftRecorder.app` (or similar path; electron-builder logs the exact path).

Commit any sign-script tweaks:
```bash
git add scripts/sign-osn-binaries.js
git commit -m "fix(build/mac): <specific tweak>"
```

---

## Task 5: Launch the signed app + grant TCC

**Files:** none — manual smoke.

```bash
open release/build/mac-arm64/WarcraftRecorder.app
```

(Or wherever electron-builder put it — check stdout from Task 4.)

Expected:
1. App launches (may take 5-10s on first run while macOS verifies the signature).
2. macOS prompts to grant Screen Recording on the first capture attempt — grant it. The app appears in Privacy & Security settings as **WarcraftRecorder** (not Electron).
3. Permissions wizard auto-dismisses once Screen Recording is granted.
4. Status flips from "waiting for WoW" to "WoW running" if WoW process detected.

Trigger a manual recording. Monitor:
```bash
tail -f ~/Library/Application\ Support/WarcraftRecorder/logs/WarcraftRecorder-$(date -u +%Y-%m-%d).log
```

Look for:
- `[OsnBackend] init` (no errors).
- `[OsnBackend] startBuffer (SimpleReplayBuffer)`.
- `replay-buffer signal { signal: 'start', ... }` (NOT `code: -4`).
- `[OsnBackend] startRecording`.
- An MKV appearing in `~/Documents/Wow Recorder Rec/`.

If init still fails: read OBS log at `~/Library/Application Support/WarcraftRecorder/osn-data/node-obs/logs/<latest>.txt`. The errors should be different now — specific OSN bugs rather than sandbox-permission denials.

---

## Task 6: Document outcome

**Files:** Update `docs/superpowers/notes/osn-macos-context.md`.

Append a "Phase 2c — signed dev build" section describing:
- Whether the original binary patches are still required (try removing them by `cp bin/obs64.orig2 bin/obs64` etc.).
- Whether each Phase 2b issue resolved or persisted in signed context:
  - Crashpad fork-pre-exec: pass/fail
  - Replay buffer IPC error: pass/fail
  - Audio device list empty: pass/fail
  - Window list empty: pass/fail
  - Black preview: pass/fail
- For each that still fails: capture exact OBS log lines + crash report path.

Commit:
```bash
git add docs/superpowers/notes/osn-macos-context.md
git commit -m "docs(mac): record Phase 2c signed-build smoke result"
```

---

## What's NOT in this plan

- **DMG distribution** — Plan 3.
- **Notarization** (`xcrun notarytool submit`) — Plan 3.
- **Post-fix iteration on remaining OSN bugs** if signing doesn't resolve them — separate follow-up task per bug.
- **Auto-updater wiring** — Plan 3.
- **CI signing workflow** (GitHub Actions secrets) — Plan 3.

---

## Recovery / rollback

If the signed build is broken and dev-via-`npm start` is needed again, just run `npm start` as before — it doesn't depend on the packaged build. The `release/build/` artifacts are throwaway.

If the OSN binary patches must come back for the unsigned dev path, re-apply them by hand or restore from `bin/obs64.orig2`/`libobs.orig` backups already present.
