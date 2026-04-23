# macOS Port — Phase 2: Real OsnBackend (obs-studio-node)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Phase 1 `OsnBackend` stub with real `obs-studio-node` calls so macOS can capture, encode, and record gameplay end-to-end. By the end of this plan, a manual smoke test on macOS produces a playable MKV of the desktop via VideoToolbox-accelerated H.264, through the same `IRecorderBackend` interface Windows already uses.

**Architecture:** `OsnBackend` wraps the Streamlabs `obs-studio-node` (OSN) native module behind the existing `IRecorderBackend` interface. OSN's API shape (factories for inputs / scenes / scene items; `osn.NodeObs` for process control; signal callbacks for recording lifecycle) is encapsulated inside the backend so `Recorder.ts` keeps using the same platform-neutral method names as on Windows. Capture uses ScreenCaptureKit via OSN's `screen_capture` or `display_capture` source on macOS 14+; encoding uses Apple VideoToolbox (`com.apple.videotoolbox.videoencoder.ave.avc` for H.264, `.hevc` for HEVC).

**Tech Stack:** `obs-studio-node` (Streamlabs, installed from a prebuilt Streamlabs S3 tarball — the npm release is stale), Electron 38, TypeScript 5, existing platform-factory + IRecorderBackend plumbing from Plans 1 and 2a. No API changes to `IRecorderBackend` itself — the interface was designed in Plan 1 to be shape-compatible with OSN.

**Scope boundary:** This plan only replaces the stub body. No new interfaces, no renderer work except the minimum needed to run the capability-driven Settings UI (hides Game Capture on mac, shows VideoToolbox encoders). Test infrastructure (Python log-replay, Playwright, Layer 2.5 integration) stays in Plan 4. Distribution (DMG/notarize) stays in Plan 3.

**High risk — feasibility gate at Task 3.** `obs-studio-node` is effectively unmaintained on npm (last public release 5 years ago). Tasks 1–3 are a feasibility spike: install, init, shutdown. If the spike fails, the plan stops before wasting effort on later tasks. Three fallback paths documented at the end of this plan.

**Spec reference:** `docs/superpowers/specs/2026-04-22-macos-port-design.md` §4 (recorder backend), §5 (capture + encoders), §11 Phase 2.

**Pre-existing context:** Plan 2a (`docs/superpowers/plans/2026-04-22-phase1-macos-skeleton.md`) shipped a stub `OsnBackend` that satisfies the interface but throws on real calls. Branch at start of this plan: `feat/macos-osn-backend` (split off from `feat/macos-port` at commit `b258697`). Platform tests green (40 passing). App launches on mac with permissions wizard.

---

## Pre-flight checklist

- [ ] **P1. Confirm branch**

```
git branch --show-current
```
Expected: `feat/macos-osn-backend`. If not, `git checkout feat/macos-osn-backend` — do NOT work on `feat/macos-port` (Windows verification branch).

- [ ] **P2. Confirm baselines from end of Plan 2a**

```
./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | grep -E "^✖" | tail -1
npx jest src/__tests__/platform 2>&1 | grep -E "Tests:"
```

Expected:
- tsc: 38
- lint: 40 problems (39 errors, 1 warning)
- platform tests: 40 passed

Snapshot the numbers. All later steps compare against this baseline.

- [ ] **P3. Confirm macOS version + arch**

```
sw_vers
uname -m
```

Expected: macOS 13.0+ (for ScreenCaptureKit) and `arm64` or `x86_64`. Apple Silicon is the common case. Log the output — OSN compatibility depends on both.

- [ ] **P4. Confirm Xcode command line tools present**

```
xcode-select -p
```

Expected: a path like `/Library/Developer/CommandLineTools` or an Xcode.app path. If the command errors, install via `xcode-select --install` before proceeding — OSN's native module needs the toolchain.

- [ ] **P5. Worktree clean**

```
git status --short
```

Expected: empty. If not, stash or commit pre-existing changes before proceeding.

---

## File structure

New files:

```
src/main/platform/recorder/
  OsnBackendInternals.ts              # osn wiring helpers (source factory, scene, signals) — keeps OsnBackend.ts readable

src/main/platform/recorder/osn/
  signalWiring.ts                     # translates OSN signals → IRecorderBackend Signal type
  sourceFactory.ts                    # maps CaptureModeCapability → OSN source id + settings

assets/
  (no new files — Info.plist edits go through electron-builder's extendInfo)
```

Modified files:

```
src/main/platform/recorder/OsnBackend.ts          # stub → real impl
src/main/platform/recorder/IRecorderBackend.ts    # no change unless spike reveals an API gap
src/main/obsEnums.ts                              # add VT_H264, VT_HEVC
release/app/package.json                          # add obs-studio-node to optionalDependencies
.erb/configs/webpack.config.base.ts               # extend NormalModuleReplacementPlugin to stub obs-studio-node on win32
.erb/stubs/osn-stub.js                            # runtime stub for non-mac builds (symmetric to noobs-stub.js)
src/renderer/VideoBaseControls.tsx                # read capabilities.encoders for encoder dropdown
src/renderer/VideoSourceControls.tsx              # read capabilities.captureModes for capture-mode dropdown
assets/binaries/ffmpeg                            # macOS universal ffmpeg static binary (added in Task 11; licensed LGPL, user action)
package.json (top level)                          # extraResources → include binaries/ffmpeg on mac
```

No file deletions. If the feasibility spike fails at Task 3, the plan pauses and later task files are not created.

---

## Task 1: Research + install obs-studio-node

**Files:**
- Modify: `release/app/package.json` — add `obs-studio-node` as an optional dependency.

OSN's npm releases lag upstream by years. The Streamlabs S3 bucket publishes prebuilt tarballs per OS; we install the macOS tarball directly.

- [ ] **Step 1: Discover the current Streamlabs OSN macOS tarball URL**

The Streamlabs S3 bucket is at `https://s3-us-west-2.amazonaws.com/obsstudionodes3.streamlabs.com/`. Historically, release artefacts follow `osn-<version>-release-osx.tar.gz`. Find the current version:

```bash
curl -s 'https://s3-us-west-2.amazonaws.com/obsstudionodes3.streamlabs.com/?list-type=2&prefix=osn-' | grep -oE 'osn-[0-9.]+-release-osx(-arm64)?\.tar\.gz' | sort -u | tail -20
```

Pick the highest version number that ends in `-release-osx.tar.gz` or `-release-osx-arm64.tar.gz`. On Apple Silicon prefer arm64; on Intel use the plain osx build. Record the exact URL in the commit message.

If the S3 listing is unavailable or the Streamlabs bucket has changed, search `streamlabs/obs-studio-node` GitHub Releases page as a fallback, or check recent Streamlabs Desktop releases for the bundled OSN build reference.

**If no mac arm64 tarball exists**: stop. Report BLOCKED and escalate — see fallback paths at the end of this plan.

- [ ] **Step 2: Add to `release/app/package.json` as optionalDependencies**

Read `/Users/yuripiratello/projects/personal/wow-recorder/release/app/package.json` (current state has `optionalDependencies.noobs`). Extend the optionalDependencies block to add `obs-studio-node` pointing at the S3 tarball URL discovered in Step 1. Example (replace `<VERSION>` and arch suffix with actual values):

```json
  "optionalDependencies": {
    "noobs": "^0.0.184",
    "obs-studio-node": "https://s3-us-west-2.amazonaws.com/obsstudionodes3.streamlabs.com/osn-<VERSION>-release-osx-arm64.tar.gz"
  },
```

- [ ] **Step 3: Install + verify**

```bash
cd release/app && npm install 2>&1 | tail -20 && cd -
ls release/app/node_modules/obs-studio-node 2>&1 | head -10
```

Expected: directory exists with `package.json`, `index.js` or similar, a `obs64` binary or `.node` file, and a `data/libobs-plugins` directory. If the directory is missing after install, npm failed silently because it's an optional dep — rerun without `--no-optional` and capture stderr.

- [ ] **Step 4: Examine the module's API surface**

```bash
find release/app/node_modules/obs-studio-node -name "*.d.ts" | head -5
head -80 release/app/node_modules/obs-studio-node/index.d.ts 2>&1
head -80 release/app/node_modules/obs-studio-node/index.js 2>&1
```

Expected: find TypeScript declarations or at minimum a top-level `module.exports` listing. Record the exported surface — you'll need names like `NodeObs`, `InputFactory`, `SceneFactory`, `SceneItem`, `SourceFactory`, `IInput`, `IScene`, `ISceneItem`, plus enums like `EOBSOutputSignal`, `ESourceOutputFlags`, etc. Summarise in a plain text note for the next task.

- [ ] **Step 5: Rebuild native for Electron ABI**

```bash
npm run rebuild 2>&1 | tail -15
```

Expected: rebuild succeeds for all three (uiohook-napi, obs-studio-node, and stale noobs if still on disk). If obs-studio-node fails to rebuild — it's a prebuilt tarball, so it shouldn't need rebuilding unless ABI mismatch occurs. If it does fail, note the specific ABI error (e.g. `Node module version mismatch`) and report.

- [ ] **Step 6: Extend webpack stub for non-mac builds (symmetric to noobs)**

Webpack externals include `obs-studio-node` now it's in optionalDependencies, but on Windows builds OSN will be missing, so add a stub symmetric to the noobs one.

Create `/Users/yuripiratello/projects/personal/wow-recorder/.erb/stubs/osn-stub.js`:

```js
// Runtime stub for `obs-studio-node` on non-macOS builds.
// The platform factory lazy-requires the real OSN only on darwin,
// but webpack + Electron UMD wrapper resolves externals at bundle
// load time regardless of whether code paths use them. This stub
// satisfies require('obs-studio-node') without shipping the real
// macOS-only build on Windows.
module.exports = {};
module.exports.default = module.exports;
```

Edit `/Users/yuripiratello/projects/personal/wow-recorder/.erb/configs/webpack.config.base.ts`. Find the existing noobs conditional plugin block:

```ts
    ...(isMac
      ? [
          new webpack.NormalModuleReplacementPlugin(
            /^noobs$/,
            path.resolve(__dirname, '../stubs/noobs-stub.js'),
          ),
        ]
      : []),
```

Replace with:

```ts
    ...(isMac
      ? [
          new webpack.NormalModuleReplacementPlugin(
            /^noobs$/,
            path.resolve(__dirname, '../stubs/noobs-stub.js'),
          ),
        ]
      : [
          new webpack.NormalModuleReplacementPlugin(
            /^obs-studio-node$/,
            path.resolve(__dirname, '../stubs/osn-stub.js'),
          ),
        ]),
```

Also update the externals filter in the same file. Find:

```ts
const baseExternals = [
  ...Object.keys(externals || {}),
  ...Object.keys(optionalExternals || {}).filter(
    (dep) => !(isMac && dep === 'noobs'),
  ),
];
```

Replace with:

```ts
const baseExternals = [
  ...Object.keys(externals || {}),
  ...Object.keys(optionalExternals || {}).filter((dep) => {
    // Stub instead of externalising so NormalModuleReplacementPlugin can
    // redirect the require() to an empty stub on the wrong platform.
    if (isMac && dep === 'noobs') return false;
    if (!isMac && dep === 'obs-studio-node') return false;
    return true;
  }),
];
```

- [ ] **Step 7: Verify baselines**

```
./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | grep -E "^✖" | tail -1
```

Expected: tsc ≤ 38; lint ≤ 40. No new errors from the webpack config.

- [ ] **Step 8: Commit**

```bash
git add release/app/package.json release/app/package-lock.json .erb/configs/webpack.config.base.ts .erb/stubs/osn-stub.js
git commit -m "build(mac): install obs-studio-node + webpack stub for non-mac builds"
```

Include the `release/app/package-lock.json` changes from the install. Commit message body should mention the exact Streamlabs tarball URL and version installed.

---

## Task 2: OSN feasibility spike — init + shutdown

**Files:**
- Create: `scripts/osn-spike.js` — standalone Node script that exercises the bare-minimum OSN init/shutdown flow.

Before touching the `IRecorderBackend` stub, verify OSN actually loads + initialises on this mac. If it segfaults, crashes, or hangs, the plan stops.

- [ ] **Step 1: Write the spike script**

Create `/Users/yuripiratello/projects/personal/wow-recorder/scripts/osn-spike.js`:

```js
// OSN feasibility spike — verify obs-studio-node loads, initialises,
// and shuts down cleanly on this machine. Run via:
//   node scripts/osn-spike.js
// Expected: prints "spike: OK" and exits 0.

const path = require('path');

const osn = require(path.resolve(
  __dirname,
  '../release/app/node_modules/obs-studio-node',
));

console.log('spike: osn keys =', Object.keys(osn).slice(0, 30));

if (!osn || !osn.NodeObs) {
  console.error('spike: osn.NodeObs missing — module shape unexpected');
  process.exit(2);
}

const appdata = require('os').tmpdir();
const obsDataPath = path.resolve(
  __dirname,
  '../release/app/node_modules/obs-studio-node/data',
);

try {
  console.log('spike: initializing OBS context');
  const initRes = osn.NodeObs.OBS_API_initAPI(
    'en-US',
    appdata,
    '0.0.0-spike',
  );
  console.log('spike: init result =', initRes);

  console.log('spike: shutting down OBS context');
  osn.NodeObs.OBS_service_removeCallback?.();
  osn.NodeObs.OBS_API_destroyOBS_API();
  console.log('spike: OK');
  process.exit(0);
} catch (err) {
  console.error('spike: threw', err && err.stack ? err.stack : err);
  process.exit(3);
}
```

Note: exact OSN init API signature varies slightly between versions. `OBS_API_initAPI(locale: string, userData: string, versionString: string)` is the pattern used in Streamlabs Desktop. If Step 2 reports a different signature, adjust the args to match what Task 1 Step 4 discovered.

- [ ] **Step 2: Run the spike**

```bash
node scripts/osn-spike.js 2>&1 | head -40
```

**Expected outcomes**:

1. **Exit 0 with `spike: OK`** — OSN works. Proceed.
2. **Exit 2, "osn.NodeObs missing"** — module shape differs from assumption. Re-read `release/app/node_modules/obs-studio-node/index.d.ts` (or `.js` if no types), adjust imports, retry.
3. **Exit 3 with a thrown error** — init failed. Capture the full error and triage. Common causes:
   - `Dynamic linker error` / `dlopen failed` → native deps missing. Run `otool -L release/app/node_modules/obs-studio-node/libobs.dylib` and check for missing links.
   - `cannot find plugin` → OSN didn't ship `data/libobs-plugins` for this arch.
   - Code signing issue → Apple Silicon may block unsigned dylibs. Run `codesign -dv --verbose=4 release/app/node_modules/obs-studio-node/libobs.dylib` and try `sudo xattr -rd com.apple.quarantine release/app/node_modules/obs-studio-node`.
4. **Process hangs or crashes with SIGSEGV** — OSN incompatible with this Electron/Node ABI or arch. Likely fatal for Plan 2b. Report BLOCKED.

- [ ] **Step 3: Document the outcome**

Create `/Users/yuripiratello/projects/personal/wow-recorder/docs/superpowers/notes/osn-spike-result.md` (you may need `mkdir -p docs/superpowers/notes`):

```markdown
# OSN Feasibility Spike Result

Date: <today's date>
Machine: macOS <version>, <arch>
OSN version: <version from Task 1 Step 1>

## Outcome

<OK / BLOCKED / PARTIAL>

## Log output

```
<paste the full spike output here>
```

## Next steps

<EITHER "Proceed to Task 3" OR specific remediation OR escalate>
```

Fill in each field. Commit this note regardless of outcome — future plan runs need the history.

- [ ] **Step 4: Commit**

```bash
git add scripts/osn-spike.js docs/superpowers/notes/osn-spike-result.md
git commit -m "build(mac): add OSN feasibility spike + record result"
```

- [ ] **Step 5: Feasibility gate**

If the spike result is OK, proceed to Task 3. If BLOCKED, **stop here**. Escalate to the user with the spike log and the fallback options listed at the end of this plan.

---

## Task 3: OsnBackend lifecycle (init + shutdown)

**Files:**
- Modify: `src/main/platform/recorder/OsnBackend.ts` — replace the stub `init` and `shutdown` bodies.

First real impl. Methods go from `throw` / `no-op` to calling real OSN entry points.

- [ ] **Step 1: Read current OsnBackend.ts**

```
cat src/main/platform/recorder/OsnBackend.ts
```

Remember the stub structure — it has `const NOT_IMPL = '...';` at the top and every method either throws `NOT_IMPL` or no-ops.

- [ ] **Step 2: Replace the file with real lifecycle impl**

Write to `/Users/yuripiratello/projects/personal/wow-recorder/src/main/platform/recorder/OsnBackend.ts`:

```ts
/* eslint-disable @typescript-eslint/no-require-imports, global-require */

import path from 'path';
import { app } from 'electron';
import type {
  BackendInitOptions,
  IRecorderBackend,
  RecorderCapabilities,
} from './IRecorderBackend';
import { CaptureModeCapability } from './IRecorderBackend';
import { ESupportedEncoders } from 'main/obsEnums';
import type {
  ObsData,
  ObsProperty,
  SceneItemPosition,
  SourceDimensions,
} from './types';

const NOT_IMPL = 'OsnBackend: feature not yet wired (later Phase 2 task)';

/**
 * macOS recorder backend — wraps obs-studio-node.
 * OSN's flat API (osn.NodeObs.*) handles process lifecycle + recording;
 * factory classes (InputFactory, SceneFactory, SceneItem) handle the
 * scene graph. This class adapts both surfaces to IRecorderBackend.
 */
export default class OsnBackend implements IRecorderBackend {
  private osn: typeof import('obs-studio-node') | undefined;
  private initialized = false;

  public readonly capabilities: RecorderCapabilities = {
    captureModes: [CaptureModeCapability.WINDOW, CaptureModeCapability.MONITOR],
    // Expanded in Task 10 once VT_H264 / VT_HEVC enum values exist.
    encoders: [ESupportedEncoders.OBS_X264],
    supportsReplayBuffer: false, // flipped in Task 6
  };

  private getOsn(): typeof import('obs-studio-node') {
    if (!this.osn) {
      // Lazy require so the module only loads on darwin (webpack stubs
      // obs-studio-node on non-mac builds via NormalModuleReplacementPlugin).
      this.osn = require('obs-studio-node');
    }
    return this.osn!;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  init(options: BackendInitOptions): void {
    if (this.initialized) {
      console.warn('[OsnBackend] init called twice — ignoring');
      return;
    }

    const osn = this.getOsn();
    const userDataPath = app.getPath('userData');
    const osnUserDataPath = path.join(userDataPath, 'osn-data');

    console.info('[OsnBackend] init', {
      userData: osnUserDataPath,
      logPath: options.logPath,
    });

    // OBS_API_initAPI(locale, userDataPath, versionString) → 0 on success.
    const result = osn.NodeObs.OBS_API_initAPI(
      'en-US',
      osnUserDataPath,
      app.getVersion(),
    );

    if (result !== 0) {
      throw new Error(
        `[OsnBackend] OBS_API_initAPI failed with code ${result}`,
      );
    }

    this.initialized = true;
    // Signal callback wiring lands in Task 7.
    void options.signalCallback;
  }

  initPreview(_hwnd: Buffer): void {
    // Preview rendering into a host-window handle is non-trivial on mac
    // (CALayer-based). Deferred — renderer uses a placeholder until a
    // dedicated preview task lands (not in this plan).
  }

  shutdown(): void {
    if (!this.initialized || !this.osn) return;
    try {
      this.osn.NodeObs.OBS_service_removeCallback?.();
      this.osn.NodeObs.OBS_API_destroyOBS_API();
    } catch (err) {
      console.error('[OsnBackend] shutdown error', err);
    }
    this.initialized = false;
  }

  setBuffering(_enabled: boolean): void {
    // No direct equivalent in OSN lifecycle; replay buffer manages itself.
  }

  setDrawSourceOutline(_enabled: boolean): void {
    // Preview-only feature; deferred alongside initPreview.
  }

  // ─── Everything else still stubbed until later tasks ───────────────────

  resetVideoContext(_fps: number, _width: number, _height: number): void {
    throw new Error(NOT_IMPL);
  }
  getPreviewInfo() {
    return { canvasWidth: 0, canvasHeight: 0, previewWidth: 0, previewHeight: 0 };
  }
  configurePreview(_x: number, _y: number, _w: number, _h: number): void {}
  showPreview(): void {}
  hidePreview(): void {}
  disablePreview(): void {}
  setRecordingCfg(_outputPath: string, _container: string): void {
    throw new Error(NOT_IMPL);
  }
  setVideoEncoder(_encoder: string, _settings: ObsData): void {
    throw new Error(NOT_IMPL);
  }
  listVideoEncoders(): string[] {
    return [ESupportedEncoders.OBS_X264];
  }
  createSource(id: string, _type: string): string {
    return id;
  }
  deleteSource(_id: string): void {}
  addSourceToScene(_name: string): void {}
  removeSourceFromScene(_name: string): void {}
  getSourceSettings(_id: string): ObsData {
    return {};
  }
  setSourceSettings(_id: string, _settings: ObsData): void {}
  getSourceProperties(_id: string): ObsProperty[] {
    return [];
  }
  getSourcePos(_id: string): SceneItemPosition & SourceDimensions {
    return {
      x: 0, y: 0, scaleX: 1, scaleY: 1,
      cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0,
      width: 0, height: 0,
    } as SceneItemPosition & SourceDimensions;
  }
  setSourcePos(_id: string, _pos: SceneItemPosition): void {}
  setSourceVolume(_id: string, _volume: number): void {}
  setVolmeterEnabled(_enabled: boolean): void {}
  setForceMono(_enabled: boolean): void {}
  setAudioSuppression(_enabled: boolean): void {}
  setMuteAudioInputs(_muted: boolean): void {}
  startBuffer(): void {
    throw new Error(NOT_IMPL);
  }
  startRecording(_offsetSeconds: number): void {
    throw new Error(NOT_IMPL);
  }
  stopRecording(): void {
    throw new Error(NOT_IMPL);
  }
  forceStopRecording(): void {}
  getLastRecording(): string {
    return '';
  }
}
```

- [ ] **Step 3: Verify tsc + tests**

```
./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS"
npx jest src/__tests__/platform 2>&1 | grep -E "Tests:"
```

Expected: tsc ≤ 38; 40 platform tests passing. The PlatformFactory darwin test instantiates `OsnBackend` but doesn't call `init()` on it — `require('obs-studio-node')` shouldn't fire in test because `getOsn()` is lazy. If tests fail with a native-module error, add the virtual jest.mock for `obs-studio-node` in `PlatformFactory.test.ts` (the one for noobs is already there).

- [ ] **Step 4: Launch smoke (init only)**

Remove the "recorder disabled until granted" branch temporarily to force init, OR flip the gate by granting Screen Recording permission in System Settings first. Then:

```bash
npm start > /tmp/wcr-launch.log 2>&1 &
LAUNCH_PID=$!
sleep 25
grep -iE "OsnBackend|error|uncaught|segv" /tmp/wcr-launch.log | head -20
pkill -9 -f WarcraftRecorder 2>/dev/null
pkill -9 -f electronmon 2>/dev/null
kill -9 $LAUNCH_PID 2>/dev/null
```

Expected log lines:
- `[OsnBackend] init { userData: ..., logPath: ... }`
- No `OBS_API_initAPI failed with code ...`
- No segfaults, no "uncaught exception".

If the app crashes, inspect the launch log and remediate. Do NOT mark the task complete until a clean launch.

- [ ] **Step 5: Commit**

```bash
git add src/main/platform/recorder/OsnBackend.ts
git commit -m "feat(osn): real OSN init + shutdown lifecycle"
```

---

## Task 4: Video context + recording output config

**Files:**
- Modify: `src/main/platform/recorder/OsnBackend.ts` — implement `resetVideoContext` and `setRecordingCfg`.

OSN configures video via `NodeObs.OBS_settings_saveSettings('Video', …)`. Recording output via `NodeObs.OBS_settings_saveSettings('Output', …)`. Both take arrays of `{ parameters: [{ name, currentValue }] }` objects — shape is ugly but documented in Streamlabs Desktop's `setting-manager.ts`.

- [ ] **Step 1: Implement `resetVideoContext`**

Replace the existing stub in `OsnBackend.ts`:

```ts
  resetVideoContext(fps: number, width: number, height: number): void {
    const osn = this.getOsn();

    // OSN 'Video' settings category uses categorical strings for base/output
    // resolution (e.g. "1920x1080") and integer FPS. We match the category
    // name exactly — OSN's settings-manager pattern from Streamlabs Desktop.
    const baseRes = `${width}x${height}`;
    const video = [
      {
        nameSubCategory: 'Untitled',
        parameters: [
          { name: 'Base', currentValue: baseRes, type: 'OBS_PROPERTY_LIST' },
          { name: 'Output', currentValue: baseRes, type: 'OBS_PROPERTY_LIST' },
          { name: 'FPSCommon', currentValue: String(fps), type: 'OBS_PROPERTY_LIST' },
          { name: 'FPSType', currentValue: 'Common FPS Values', type: 'OBS_PROPERTY_LIST' },
        ],
      },
    ];

    osn.NodeObs.OBS_settings_saveSettings('Video', video);
  }
```

- [ ] **Step 2: Implement `setRecordingCfg`**

Replace the stub:

```ts
  setRecordingCfg(outputPath: string, container: string): void {
    const osn = this.getOsn();

    // Output 'Untitled' sub-category holds recording path + format.
    const output = [
      {
        nameSubCategory: 'Recording',
        parameters: [
          { name: 'RecFilePath', currentValue: outputPath, type: 'OBS_PROPERTY_PATH' },
          { name: 'RecFormat', currentValue: container, type: 'OBS_PROPERTY_LIST' },
          // Simple (not Advanced) output mode keeps encoder logic straightforward.
          { name: 'Mode', currentValue: 'Simple', type: 'OBS_PROPERTY_LIST' },
        ],
      },
    ];

    osn.NodeObs.OBS_settings_saveSettings('Output', output);
  }
```

- [ ] **Step 3: Implement `getPreviewInfo`**

Replace the stub with a real query. OSN exposes video canvas dimensions via `NodeObs.OBS_content_getSourceSize` for individual sources, and canvas totals via the video context. For Phase 2, return the resolution we just set — it matches what the video context produces.

```ts
  private cachedPreviewDimensions = {
    canvasWidth: 0,
    canvasHeight: 0,
    previewWidth: 0,
    previewHeight: 0,
  };

  getPreviewInfo() {
    return this.cachedPreviewDimensions;
  }
```

And in `resetVideoContext`, update the cache at the end of the method:

```ts
    // ... existing saveSettings call above ...
    this.cachedPreviewDimensions = {
      canvasWidth: width,
      canvasHeight: height,
      previewWidth: width,  // preview area TBD in a preview-specific task
      previewHeight: height,
    };
  }
```

The `previewWidth/Height` = canvas dims is a placeholder. The real renderer preview rectangle is a separate concern (Task deferred — not in this plan). Callers who care about the preview rectangle (see `Recorder.setSourcePosition` in `Recorder.ts` ~line 1622) will work correctly at 1:1 ratio until preview rendering lands.

- [ ] **Step 4: Verify tsc + tests**

```
./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS"
npx jest src/__tests__/platform 2>&1 | grep -E "Tests:"
```

Expected: tsc ≤ 38, 40 platform tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/main/platform/recorder/OsnBackend.ts
git commit -m "feat(osn): wire video context + recording output config"
```

---

## Task 5: Sources — create, delete, add to scene

**Files:**
- Create: `src/main/platform/recorder/osn/sourceFactory.ts` — maps `CaptureModeCapability` + type strings to OSN source IDs + default settings.
- Modify: `src/main/platform/recorder/OsnBackend.ts` — implement `createSource`, `deleteSource`, `addSourceToScene`, `removeSourceFromScene`, `getSourceSettings`, `setSourceSettings`, `getSourceProperties`.

OSN scene graph: `SceneFactory.create(name)` → `IScene` → `scene.add(input)` → `ISceneItem`. Inputs come from `InputFactory.create(sourceId, name, settings)`.

- [ ] **Step 1: Create the source factory helper**

Write `/Users/yuripiratello/projects/personal/wow-recorder/src/main/platform/recorder/osn/sourceFactory.ts`:

```ts
/* eslint-disable @typescript-eslint/no-require-imports, global-require */

import type { ObsData } from '../types';

/**
 * Map a caller-supplied source type string (coming from Recorder.ts or
 * neutral capture-mode enum) to an OSN input source ID + sensible
 * default settings. Keeps the OsnBackend class readable and gives a
 * single place to tune mac source IDs as ScreenCaptureKit evolves.
 */
export interface ResolvedSource {
  sourceId: string;
  defaults: ObsData;
}

const MAP: Record<string, ResolvedSource> = {
  // Legacy Windows IDs — caller passes these today. OsnBackend remaps on mac.
  window_capture: {
    sourceId: 'screen_capture', // macOS 14+ uses ScreenCaptureKit-based 'screen_capture' with type window
    defaults: { type: 1 /* window */ },
  },
  monitor_capture: {
    sourceId: 'screen_capture',
    defaults: { type: 0 /* display */ },
  },
  display_capture: {
    sourceId: 'screen_capture',
    defaults: { type: 0 },
  },
  image_source: {
    sourceId: 'image_source',
    defaults: {},
  },
  browser_source: {
    sourceId: 'browser_source',
    defaults: {},
  },
  coreaudio_input_capture: {
    sourceId: 'coreaudio_input_capture',
    defaults: {},
  },
  coreaudio_output_capture: {
    sourceId: 'coreaudio_output_capture',
    defaults: {},
  },
  // Fallback: pass through unchanged.
};

export function resolveMacSource(callerType: string): ResolvedSource {
  return (
    MAP[callerType] ?? {
      sourceId: callerType,
      defaults: {},
    }
  );
}
```

- [ ] **Step 2: Implement source methods in OsnBackend.ts**

Add a private scene + source-tracking state alongside existing fields:

```ts
  private scene: import('obs-studio-node').IScene | undefined;
  private sceneItems = new Map<string, import('obs-studio-node').ISceneItem>();
  private inputs = new Map<string, import('obs-studio-node').IInput>();
```

Add a private helper to ensure the main scene exists:

```ts
  private ensureScene() {
    if (this.scene) return this.scene;
    const osn = this.getOsn();
    this.scene = osn.SceneFactory.create('wcr-scene');
    osn.Global.setOutputSource(0, this.scene); // main channel
    return this.scene;
  }
```

Replace the existing stub `createSource` / `deleteSource` / `addSourceToScene` / `removeSourceFromScene` / `getSourceSettings` / `setSourceSettings` / `getSourceProperties`:

```ts
  createSource(id: string, type: string): string {
    const osn = this.getOsn();
    const { resolveMacSource } = require('./osn/sourceFactory');
    const { sourceId, defaults } = resolveMacSource(type);
    const input = osn.InputFactory.create(sourceId, id, defaults);
    this.inputs.set(id, input);
    return id;
  }

  deleteSource(id: string): void {
    const input = this.inputs.get(id);
    if (!input) return;
    const item = this.sceneItems.get(id);
    if (item) {
      item.remove();
      this.sceneItems.delete(id);
    }
    input.release();
    input.remove();
    this.inputs.delete(id);
  }

  addSourceToScene(name: string): void {
    const input = this.inputs.get(name);
    if (!input) throw new Error(`[OsnBackend] addSourceToScene: no input '${name}'`);
    const scene = this.ensureScene();
    const item = scene.add(input);
    this.sceneItems.set(name, item);
  }

  removeSourceFromScene(name: string): void {
    const item = this.sceneItems.get(name);
    if (!item) return;
    item.remove();
    this.sceneItems.delete(name);
  }

  getSourceSettings(id: string): ObsData {
    const input = this.inputs.get(id);
    if (!input) return {};
    return input.settings as ObsData;
  }

  setSourceSettings(id: string, settings: ObsData): void {
    const input = this.inputs.get(id);
    if (!input) return;
    input.update(settings);
  }

  getSourceProperties(id: string): ObsProperty[] {
    const input = this.inputs.get(id);
    if (!input) return [];
    const props = input.properties;
    // OSN's IProperty shape differs from ours; adapt minimally.
    // Expand in a follow-up if renderer needs richer introspection.
    const out: ObsProperty[] = [];
    for (let p = props.first(); p !== null && p !== undefined; p = p.next()) {
      out.push({
        name: p.name,
        description: p.description,
        type: (p.type as unknown) as string,
      } as ObsProperty);
    }
    return out;
  }
```

Update the `shutdown()` method to drop cached state:

```ts
  shutdown(): void {
    if (!this.initialized || !this.osn) return;
    for (const [id, item] of this.sceneItems) {
      try { item.remove(); } catch {}
    }
    this.sceneItems.clear();
    for (const [id, input] of this.inputs) {
      try { input.release(); input.remove(); } catch {}
    }
    this.inputs.clear();
    this.scene = undefined;
    try {
      this.osn.NodeObs.OBS_service_removeCallback?.();
      this.osn.NodeObs.OBS_API_destroyOBS_API();
    } catch (err) {
      console.error('[OsnBackend] shutdown error', err);
    }
    this.initialized = false;
  }
```

- [ ] **Step 3: Verify tsc + tests**

```
./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS"
npx jest src/__tests__/platform 2>&1 | grep -E "Tests:"
```

Expected: tsc ≤ 38; 40 platform tests.

- [ ] **Step 4: Commit**

```bash
git add src/main/platform/recorder/osn/ src/main/platform/recorder/OsnBackend.ts
git commit -m "feat(osn): implement source + scene graph management"
```

---

## Task 6: Recording lifecycle — startRecording, stopRecording, replay buffer

**Files:**
- Modify: `src/main/platform/recorder/OsnBackend.ts` — implement `startBuffer`, `startRecording`, `stopRecording`, `forceStopRecording`, `getLastRecording`.

OSN recording API: `NodeObs.OBS_service_startRecording()` / `stopRecording()`. Replay buffer: `OBS_service_startReplayBuffer()` / `processReplayBufferHotkey()`. Last recording path: event fired via signal — we'll stash the latest file path in a field.

- [ ] **Step 1: Add recording state fields + implement methods**

In `OsnBackend.ts`, add fields alongside existing ones:

```ts
  private recording = false;
  private replayBuffering = false;
  private lastRecordingPath = '';
```

Flip capability flag for replay buffer:

```ts
  public readonly capabilities: RecorderCapabilities = {
    captureModes: [CaptureModeCapability.WINDOW, CaptureModeCapability.MONITOR],
    encoders: [ESupportedEncoders.OBS_X264], // updated in Task 10
    supportsReplayBuffer: true, // flipped from false
  };
```

Replace the stubs:

```ts
  startBuffer(): void {
    if (this.replayBuffering) return;
    const osn = this.getOsn();
    osn.NodeObs.OBS_service_startReplayBuffer();
    this.replayBuffering = true;
  }

  startRecording(_offsetSeconds: number): void {
    if (this.recording) return;
    const osn = this.getOsn();
    // offsetSeconds is used by noobs's replay-buffer conversion —
    // OSN manages this internally via OBS_service_processReplayBufferHotkey
    // when saving the buffer. Phase 2 uses plain record-start; true replay-
    // buffer-to-file conversion is a follow-up refinement.
    osn.NodeObs.OBS_service_startRecording();
    this.recording = true;
  }

  stopRecording(): void {
    if (!this.recording) return;
    const osn = this.getOsn();
    osn.NodeObs.OBS_service_stopRecording();
    this.recording = false;
  }

  forceStopRecording(): void {
    if (this.recording) {
      try {
        this.getOsn().NodeObs.OBS_service_stopRecording();
      } catch (err) {
        console.error('[OsnBackend] forceStopRecording failed', err);
      }
      this.recording = false;
    }
    if (this.replayBuffering) {
      try {
        this.getOsn().NodeObs.OBS_service_stopReplayBuffer(true);
      } catch (err) {
        console.error('[OsnBackend] force-stop replay buffer failed', err);
      }
      this.replayBuffering = false;
    }
  }

  getLastRecording(): string {
    return this.lastRecordingPath;
  }
```

- [ ] **Step 2: Verify tsc + tests**

```
./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS"
npx jest src/__tests__/platform 2>&1 | grep -E "Tests:"
```

Expected: tsc ≤ 38; 40 platform tests.

- [ ] **Step 3: Commit**

```bash
git add src/main/platform/recorder/OsnBackend.ts
git commit -m "feat(osn): recording + replay buffer lifecycle"
```

---

## Task 7: Signal wiring

**Files:**
- Create: `src/main/platform/recorder/osn/signalWiring.ts`
- Modify: `src/main/platform/recorder/OsnBackend.ts`

OSN emits lifecycle signals via `OBS_service_connectOutputSignals` callbacks: `start`, `stop`, `stopping`, `recording`, `wrote` (last file path), `writing_error`. Map to the existing `Signal` type + translate into the `SignalCallback` passed at `init()`.

The existing `Signal` type in `src/main/platform/recorder/types.ts` re-exports from `noobs` on Windows; on mac we need a matching shape. Check the `noobs` `Signal` definition during Task 1 Step 4 and produce a matching object shape here.

- [ ] **Step 1: Create the signal wiring module**

Write `/Users/yuripiratello/projects/personal/wow-recorder/src/main/platform/recorder/osn/signalWiring.ts`:

```ts
/* eslint-disable @typescript-eslint/no-require-imports, global-require */

import type { Signal } from '../types';
import type { SignalCallback } from '../IRecorderBackend';

/**
 * Subscribe to OSN recording signals and adapt them into the flat
 * `Signal` shape Recorder.ts expects. The noobs-native signal shape
 * is `{ type: 'recording'|'replay-buffer', signal: 'start'|'stop'|..., code: number }`.
 * OSN emits `{ type, signal, code }` natively via NodeObs callbacks.
 */
export function subscribeOsnSignals(
  osn: typeof import('obs-studio-node'),
  callback: SignalCallback,
  onLastRecordingPath: (filePath: string) => void,
): void {
  osn.NodeObs.OBS_service_connectOutputSignals(
    (signal: { type: string; signal: string; code: number }) => {
      // Emit a signal matching the Windows noobs shape.
      callback(signal as unknown as Signal);

      // Side-channel: capture the last-written file path when the
      // 'wrote' signal fires (OSN-only; noobs has its own channel).
      if (signal.signal === 'wrote' || signal.signal === 'stop') {
        // The actual path is on `signal.info` in some OSN builds,
        // or retrievable via NodeObs.OBS_service_getLastRecording().
        try {
          const p =
            (osn.NodeObs as any).OBS_service_getLastRecording?.() as
              | string
              | undefined;
          if (p) onLastRecordingPath(p);
        } catch {
          // ignore — older OSN builds may lack the helper
        }
      }
    },
  );
}
```

- [ ] **Step 2: Wire the subscription in `OsnBackend.init`**

Extend the `init` method in `OsnBackend.ts`. After the `OBS_API_initAPI` call, before setting `this.initialized = true`:

```ts
    // Signal callback wiring — adapts OSN events to the noobs-shaped
    // Signal callback Recorder.ts already consumes.
    const { subscribeOsnSignals } = require('./osn/signalWiring');
    subscribeOsnSignals(osn, options.signalCallback, (path: string) => {
      this.lastRecordingPath = path;
    });
```

Remove the prior `void options.signalCallback;` line (no longer a no-op).

- [ ] **Step 3: Verify tsc + tests**

```
./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS"
npx jest src/__tests__/platform 2>&1 | grep -E "Tests:"
```

Expected: tsc ≤ 38; 40 platform tests.

- [ ] **Step 4: Commit**

```bash
git add src/main/platform/recorder/osn/signalWiring.ts src/main/platform/recorder/OsnBackend.ts
git commit -m "feat(osn): wire recording signals to IRecorderBackend callback"
```

---

## Task 8: Audio methods + source volume + source position

**Files:**
- Modify: `src/main/platform/recorder/OsnBackend.ts` — implement `setSourceVolume`, `setSourcePos`, `getSourcePos`, `setVolmeterEnabled`, `setForceMono`, `setAudioSuppression`, `setMuteAudioInputs`.

Most of these map directly to OSN `IInput` properties / scene-item transforms.

- [ ] **Step 1: Implement**

Replace the existing stubs in `OsnBackend.ts`:

```ts
  setSourceVolume(id: string, volume: number): void {
    const input = this.inputs.get(id);
    if (!input) return;
    input.volume = volume;
  }

  getSourcePos(id: string): SceneItemPosition & SourceDimensions {
    const item = this.sceneItems.get(id);
    const input = this.inputs.get(id);
    if (!item || !input) {
      return {
        x: 0, y: 0, scaleX: 1, scaleY: 1,
        cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0,
        width: 0, height: 0,
      } as SceneItemPosition & SourceDimensions;
    }
    return {
      x: item.position.x,
      y: item.position.y,
      scaleX: item.scale.x,
      scaleY: item.scale.y,
      cropLeft: item.crop.left,
      cropRight: item.crop.right,
      cropTop: item.crop.top,
      cropBottom: item.crop.bottom,
      width: input.width,
      height: input.height,
    } as SceneItemPosition & SourceDimensions;
  }

  setSourcePos(id: string, pos: SceneItemPosition): void {
    const item = this.sceneItems.get(id);
    if (!item) return;
    item.position = { x: pos.x, y: pos.y };
    item.scale = { x: pos.scaleX, y: pos.scaleY };
    item.crop = {
      left: pos.cropLeft,
      right: pos.cropRight,
      top: pos.cropTop,
      bottom: pos.cropBottom,
    };
  }

  setVolmeterEnabled(enabled: boolean): void {
    // Volume meter attaches via osn.VolmeterFactory; deferred — UI-only
    // feature that renderer doesn't need for record-only flows.
    void enabled;
  }

  setForceMono(enabled: boolean): void {
    // Global audio flag. OSN exposes via OBS_settings_saveSettings('Audio',…).
    // Deferred — has no effect on passive capture; needed for live mic only.
    void enabled;
  }

  setAudioSuppression(enabled: boolean): void {
    // Same deferral rationale as setForceMono — mic-processing only.
    void enabled;
  }

  setMuteAudioInputs(muted: boolean): void {
    // Mute all audio inputs currently attached to the scene.
    for (const input of this.inputs.values()) {
      if (input.audioMixers !== undefined) {
        input.muted = muted;
      }
    }
  }
```

- [ ] **Step 2: Verify tsc + tests**

Baselines.

- [ ] **Step 3: Commit**

```bash
git add src/main/platform/recorder/OsnBackend.ts
git commit -m "feat(osn): audio + scene-item transform wiring"
```

---

## Task 9: Video encoder selection + settings

**Files:**
- Modify: `src/main/platform/recorder/OsnBackend.ts` — implement `setVideoEncoder`, `listVideoEncoders`.

OSN encoder selection flows through `OBS_settings_saveSettings('Output', …)` when in Simple mode. Simple mode recording supports `x264`, `videotoolbox_hevc`, `videotoolbox_h264` (values as strings).

- [ ] **Step 1: Implement**

Replace the stubs:

```ts
  listVideoEncoders(): string[] {
    // Phase 2 exposes software (x264) + VideoToolbox H.264/HEVC.
    // The enum values land in Task 10; for now we hand back the OSN
    // encoder IDs directly.
    return [
      'obs_x264',
      'com.apple.videotoolbox.videoencoder.ave.avc',
      'com.apple.videotoolbox.videoencoder.ave.hevc',
    ];
  }

  setVideoEncoder(encoder: string, settings: ObsData): void {
    const osn = this.getOsn();

    // Simple-mode recording encoder lives under Output / Recording.
    const recEncoder = encoderToSimpleName(encoder);

    const params = [
      {
        nameSubCategory: 'Recording',
        parameters: [
          { name: 'RecEncoder', currentValue: recEncoder, type: 'OBS_PROPERTY_LIST' },
          // Quality defaults — map settings.rate_control + settings.crf/cqp to
          // the relevant OSN knobs.
          ...mapEncoderSettings(settings),
        ],
      },
    ];

    osn.NodeObs.OBS_settings_saveSettings('Output', params);
  }
```

Add the two helper functions at the bottom of the file (before the closing `}` of the class, as top-level functions):

```ts
function encoderToSimpleName(encoder: string): string {
  // Map Windows-style enum values + raw OSN IDs to OSN Simple-mode RecEncoder
  // values.
  switch (encoder) {
    case 'OBS_X264':
    case 'obs_x264':
      return 'x264';
    case 'com.apple.videotoolbox.videoencoder.ave.avc':
    case 'VT_H264':
      return 'apple_h264';
    case 'com.apple.videotoolbox.videoencoder.ave.hevc':
    case 'VT_HEVC':
      return 'apple_hevc';
    default:
      console.warn('[OsnBackend] unrecognised encoder id, falling back to x264', encoder);
      return 'x264';
  }
}

function mapEncoderSettings(settings: ObsData): Array<{
  name: string;
  currentValue: string | number;
  type: string;
}> {
  const out: Array<{ name: string; currentValue: string | number; type: string }> = [];
  if (settings.rate_control) {
    out.push({
      name: 'RecRB',
      currentValue: String(settings.rate_control),
      type: 'OBS_PROPERTY_LIST',
    });
  }
  if (settings.crf !== undefined) {
    out.push({ name: 'RecCRF', currentValue: Number(settings.crf), type: 'OBS_PROPERTY_INT' });
  }
  if (settings.cqp !== undefined) {
    out.push({ name: 'RecCQP', currentValue: Number(settings.cqp), type: 'OBS_PROPERTY_INT' });
  }
  return out;
}
```

Note: the OSN Simple-mode recording parameter names listed here (`RecEncoder`, `RecRB`, `RecCRF`, `RecCQP`) are illustrative — the actual names in Streamlabs Desktop's source are subject to OSN version. Task 1 Step 4 should have dumped the Output category parameter names; cross-reference and adjust the names before declaring this task done.

- [ ] **Step 2: Verify tsc + tests**

Baselines.

- [ ] **Step 3: Commit**

```bash
git add src/main/platform/recorder/OsnBackend.ts
git commit -m "feat(osn): wire video encoder selection (x264 + VT H.264/HEVC)"
```

---

## Task 10: Add VT encoder enum values + expand capabilities

**Files:**
- Modify: `src/main/obsEnums.ts` — add `VT_H264` and `VT_HEVC` to `ESupportedEncoders`.
- Modify: `src/main/platform/recorder/OsnBackend.ts` — expand `capabilities.encoders`.

- [ ] **Step 1: Extend the enum**

Read `src/main/obsEnums.ts`. Find the `ESupportedEncoders` enum (exact location via `grep -n "ESupportedEncoders" src/main/obsEnums.ts`). Add two new entries:

```ts
  VT_H264 = 'VT_H264',
  VT_HEVC = 'VT_HEVC',
```

Alongside the existing Windows entries (`OBS_X264`, `AMD_H264`, etc.). Do not remove any.

- [ ] **Step 2: Expand OsnBackend capabilities**

In `OsnBackend.ts`:

```ts
  public readonly capabilities: RecorderCapabilities = {
    captureModes: [CaptureModeCapability.WINDOW, CaptureModeCapability.MONITOR],
    encoders: [
      ESupportedEncoders.OBS_X264,
      ESupportedEncoders.VT_H264,
      ESupportedEncoders.VT_HEVC,
    ],
    supportsReplayBuffer: true,
  };
```

- [ ] **Step 3: Add encoder labels to the renderer**

`src/renderer/rendererutils.ts` has an encoder-label switch (`grep -n "ESupportedEncoders" src/renderer/rendererutils.ts`). Add cases for the two new values:

```ts
    case ESupportedEncoders.VT_H264:
      return 'Apple VideoToolbox H.264';
    case ESupportedEncoders.VT_HEVC:
      return 'Apple VideoToolbox HEVC';
```

- [ ] **Step 4: Verify tsc + tests + lint**

Baselines.

- [ ] **Step 5: Commit**

```bash
git add src/main/obsEnums.ts src/main/platform/recorder/OsnBackend.ts src/renderer/rendererutils.ts
git commit -m "feat(mac): expose VT_H264 + VT_HEVC encoder capabilities"
```

---

## Task 11: Ship macOS ffmpeg static binary

**Files:**
- Create: `assets/binaries/ffmpeg` — universal static binary (Intel + Apple Silicon).
- Modify: `package.json` top-level — extend `build.extraResources` to include the binary on mac.

macOS doesn't ship a system-wide ffmpeg. `VideoProcessQueue` relies on `fluent-ffmpeg` to cut/remux recorded files; on Windows we reuse the one bundled in noobs, on mac we ship our own.

- [ ] **Step 1: Obtain a universal ffmpeg binary**

Download a universal2 static build from a reputable source. The evermeet build is LGPL-licensed + widely used:

```bash
mkdir -p assets/binaries
curl -L -o /tmp/ffmpeg.zip 'https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip'
unzip -o /tmp/ffmpeg.zip -d /tmp/ffmpeg-extract
cp /tmp/ffmpeg-extract/ffmpeg assets/binaries/ffmpeg
chmod +x assets/binaries/ffmpeg
```

Verify arch support:

```bash
file assets/binaries/ffmpeg
./assets/binaries/ffmpeg -version | head -1
```

Expected: `file` reports a Mach-O universal binary (arm64 + x86_64) OR you accept a single-arch build that matches the current host. `-version` reports the ffmpeg version.

If evermeet is unavailable, any LGPL static build with H.264/H.265 + libx264 works. Document the source in the commit message for license compliance.

- [ ] **Step 2: Update `package.json` extraResources**

Read `/Users/yuripiratello/projects/personal/wow-recorder/package.json`. Find the `build.extraResources` block:

```json
    "extraResources": [
      "./assets/**",
      "./binaries/*"
    ],
```

Change to include the new `assets/binaries/ffmpeg` path (already covered by `./assets/**`). Confirm by running `ls assets/binaries/`.

If the `assets/**` glob already matches, no package.json change is needed. Note that in Task 6 of Plan 2a we had `MacFfmpegPathProvider` look at `path.join(__dirname, '../../binaries', 'ffmpeg')` for dev mode — but the real location is `assets/binaries/ffmpeg`. Fix the provider:

Edit `src/main/platform/ffmpeg/MacFfmpegPathProvider.ts`. Find:

```ts
      : path.join(__dirname, '../../binaries', 'ffmpeg');
```

Replace with:

```ts
      : path.join(__dirname, '../../../../assets/binaries', 'ffmpeg');
```

Note: in dev, webpack main-bundle output sits at `.erb/dll/main.bundle.dev.js`, so `__dirname` = `<repo>/.erb/dll/`. Four levels up is `<repo>/`, then `assets/binaries/ffmpeg`. Update the sibling test `src/__tests__/platform/MacFfmpegPathProvider.test.ts` to expect the new suffix:

Find `expect(p.endsWith('binaries/ffmpeg')).toBe(true);` — still passes because the literal `binaries/ffmpeg` suffix is unchanged. No test edit needed.

- [ ] **Step 3: Verify tsc + tests**

```
./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS"
npx jest src/__tests__/platform 2>&1 | grep -E "Tests:"
```

Baselines.

- [ ] **Step 4: Verify the binary runs**

```bash
./assets/binaries/ffmpeg -i /dev/null 2>&1 | head -5
```

Expected: ffmpeg banner + error about the input source (that's fine — the binary ran). If macOS Gatekeeper blocks execution with `killed: 9`, run `xattr -d com.apple.quarantine assets/binaries/ffmpeg` and retry.

- [ ] **Step 5: Commit**

Include the binary (it's small enough ~20-40MB):

```bash
git add assets/binaries/ffmpeg src/main/platform/ffmpeg/MacFfmpegPathProvider.ts
git commit -m "build(mac): ship universal ffmpeg static binary for post-processing"
```

Commit message body should cite the source URL and license (`LGPL 2.1`).

---

## Task 12: Capability-driven Settings UI

**Files:**
- Modify: `src/renderer/VideoSourceControls.tsx` — filter capture mode dropdown by `capabilities.captureModes`.
- Modify: `src/renderer/VideoBaseControls.tsx` — filter encoder dropdown by `capabilities.encoders`.

Until this task, the dropdowns on mac still show every Windows option (Game Capture, NVENC, AMD, QSV) — all of which would fail if the user picked them. Read capabilities from the backend via a new IPC channel.

- [ ] **Step 1: Expose capabilities over IPC**

Edit `src/main/preload.ts`. Near the existing `contextBridge.exposeInMainWorld('platformInfo', …)` call, add:

```ts
contextBridge.exposeInMainWorld('recorderCapabilities', {
  get: () => ipcRenderer.invoke('recorder:capabilities'),
});
```

Edit `src/main/main.ts`. Alongside the other `ipcMain.handle` calls registered in Plan 2a (for permissions), add:

```ts
ipcMain.handle('recorder:capabilities', () => getRecorderBackend().capabilities);
```

Edit `src/renderer/preload.d.ts`. Inside `declare global { interface Window { … } }`, add:

```ts
    recorderCapabilities: {
      get: () => Promise<import('main/platform/recorder/IRecorderBackend').RecorderCapabilities>;
    };
```

- [ ] **Step 2: Create a React Query hook**

Write `/Users/yuripiratello/projects/personal/wow-recorder/src/renderer/useRecorderCapabilities.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import type { RecorderCapabilities } from 'main/platform/recorder/IRecorderBackend';

const FALLBACK: RecorderCapabilities = {
  captureModes: ['GAME', 'WINDOW', 'MONITOR'] as unknown as RecorderCapabilities['captureModes'],
  encoders: [],
  supportsReplayBuffer: true,
};

/**
 * Read recorder-backend capabilities once — they are constant for a given
 * platform + app version, so staleTime is effectively infinite.
 */
export function useRecorderCapabilities(): RecorderCapabilities {
  const { data } = useQuery<RecorderCapabilities>({
    queryKey: ['recorder-capabilities'],
    queryFn: () => window.recorderCapabilities.get(),
    staleTime: Infinity,
    initialData: FALLBACK,
  });
  return data;
}
```

- [ ] **Step 3: Filter VideoSourceControls capture-mode dropdown**

Read `src/renderer/VideoSourceControls.tsx`. The `<Select>` for `obsCaptureMode` (grep for `obsCaptureMode` in the file) currently has three static options (`game_capture`, `window_capture`, `monitor_capture`).

Near the top of the component, add:

```ts
import { useRecorderCapabilities } from './useRecorderCapabilities';
```

Inside the component body, before the return:

```ts
  const caps = useRecorderCapabilities();
  const modeEnabled = {
    game_capture: caps.captureModes.includes('GAME' as never),
    window_capture: caps.captureModes.includes('WINDOW' as never),
    monitor_capture: caps.captureModes.includes('MONITOR' as never),
  };
```

Wrap each dropdown `<SelectItem value="game_capture" …>` (or similar) in a conditional:

```tsx
  {modeEnabled.game_capture && <SelectItem value="game_capture">…</SelectItem>}
  {modeEnabled.window_capture && <SelectItem value="window_capture">…</SelectItem>}
  {modeEnabled.monitor_capture && <SelectItem value="monitor_capture">…</SelectItem>}
```

The exact JSX depends on the current component structure — read the file first and splice the conditionals into the existing option list rather than rewriting the component.

- [ ] **Step 4: Filter VideoBaseControls encoder dropdown**

Read `src/renderer/VideoBaseControls.tsx`. The encoder dropdown iterates a list — likely derived from `ESupportedEncoders`. Replace with:

```ts
  const caps = useRecorderCapabilities();
  const availableEncoders = caps.encoders; // already filtered by backend
```

…and render only those. Keep the existing `getEncoderLabel` (in `rendererutils.ts`) — it already handles both Windows + mac VT values after Task 10 Step 3.

- [ ] **Step 5: Verify tsc + tests + lint**

Baselines.

- [ ] **Step 6: Commit**

```bash
git add src/main/preload.ts src/main/main.ts src/renderer/preload.d.ts src/renderer/useRecorderCapabilities.ts src/renderer/VideoSourceControls.tsx src/renderer/VideoBaseControls.tsx
git commit -m "feat(renderer): capability-driven capture-mode + encoder dropdowns"
```

---

## Task 13: Manual smoke — record 5 s of desktop to MKV

**Files:** (verification only — no code changes unless bugs surface)

This is the payoff. Record the desktop for 5 seconds via the UI and verify an MKV lands in the storage path.

- [ ] **Step 1: Grant Screen Recording permission**

Open System Settings → Privacy & Security → Screen Recording → toggle Warcraft Recorder (Electron dev build) ON. The OS may prompt once; after toggling, the app needs a relaunch before the grant is picked up by `systemPreferences.getMediaAccessStatus('screen')`.

- [ ] **Step 2: Launch the app**

```bash
npm start
```

The permissions wizard should NOT appear (Screen Recording now granted). The app main window opens with the normal UI.

- [ ] **Step 3: Configure a minimum-viable recording**

In the Settings panel:
- Capture mode: `Monitor Capture`.
- Encoder: `Apple VideoToolbox H.264`.
- Output resolution: `1920x1080` (default is fine).
- FPS: `30`.
- Recording path: pick any writable folder (default should work).

Save.

- [ ] **Step 4: Trigger a manual recording**

From whatever manual-record affordance the app exposes (Manual activity / Record button), start a recording. Wait 5 seconds. Stop.

- [ ] **Step 5: Verify the MKV**

```bash
ls -la "<storage-path>/*.mkv" | tail -5
./assets/binaries/ffmpeg -i "<latest-file>.mkv" -hide_banner 2>&1 | head -15
```

Pass criteria:
- MKV file exists, is > 0 bytes.
- ffmpeg probe reports a video stream encoded with `h264` (or `hevc`) via `VideoToolbox`.
- Audio stream present (or absent, depending on whether mic was configured).
- Duration ~5 s.

- [ ] **Step 6: Verify in a media player**

Open the MKV in QuickTime or VLC. Play it. It should show 5 s of your desktop.

- [ ] **Step 7: Document the result**

Append to `docs/superpowers/notes/osn-spike-result.md`:

```markdown

## Phase 2 smoke — <date>

Capture mode: monitor_capture
Encoder: VT_H264
Duration: 5.0s recorded
File size: <bytes>
Output path: <path to MKV>

Result: PASS / FAIL

<any notes>
```

- [ ] **Step 8: Commit the note**

```bash
git add docs/superpowers/notes/osn-spike-result.md
git commit -m "docs(mac): record Phase 2 smoke-test result"
```

If the smoke test FAILS, triage the failure and re-dispatch the relevant earlier task. Common issues:
- No MKV produced → `setRecordingCfg` wrote to wrong path, check OSN log at `~/Library/Application Support/WarcraftRecorder/osn-data/logs/`.
- MKV is 0 bytes or unreadable → encoder config wrong; swap VT_H264 for OBS_X264 and re-test.
- App crashes on stop → signal wiring races; inspect the log for unhandled callbacks.

---

## Rollback

Per-task commits make rollback cheap. If any Task 3–12 introduces a regression:

```bash
git log --oneline feat/macos-osn-backend | head -20
git reset --hard <sha-before-bad-commit>
```

The branch isn't pushed so rollback has no blast radius beyond the local machine.

If Task 2 (feasibility spike) FAILS, stop. Do NOT proceed to Task 3 — the spike is the gate.

---

## Fallback paths (if OSN spike fails)

Documented upfront so the user can pick without re-brainstorming:

1. **Fork OSN + fix** — clone `streamlabs/obs-studio-node`, build against current Electron/Node ABI for darwin-arm64. Effort: 1–2 weeks of C++/CMake work. Yields our own mac build of OSN.

2. **Port noobs to macOS** — the original plan's road-not-taken. Fork `aza547/noobs`, add macOS build (libobs + ScreenCaptureKit source). Effort: 2–4 weeks C++/Objective-C. Yields a unified backend API.

3. **Headless OBS Studio shell** — spawn a headless `obs` process with a scene file; communicate via obs-websocket. Effort: 1–2 weeks — mostly protocol work, no native code. Yields a more fragile integration (cross-process, extra binary shipping, different signal surface).

4. **Pause the mac port** — merge the refactor + skeleton (Plans 1, 2a) to main, ship as a "Windows unchanged + mac scaffolding" release. Resume mac work when OSN stabilises or a maintained alternative emerges.

---

## What's NOT in this plan

- **Preview rendering** — OSN preview-into-BrowserWindow on mac requires CALayer bridging. Deferred; `initPreview` is a no-op and the Settings scene-preview shows a placeholder.
- **Volume meter** — Plan 2b does not wire `VolmeterFactory`. `setVolmeterEnabled` is a no-op. Follow-up task.
- **Audio suppression + mono** — Global audio settings; needed for live mic only. Follow-up.
- **Packaging / DMG / notarize** — Plan 3.
- **Playwright / Python E2E on mac** — Plan 4.
- **Localisation for VT encoder labels** — uses English only; follow-up i18n pass.

---

## Notes for Plan 3 (Distribution)

After this plan completes:

- `release/app/node_modules/obs-studio-node/data/` contains ~200 MB of libobs plugins + modules. These must ship unpacked (asar:false path pattern) so OSN can dlopen them. Plan 3 configures electron-builder `asarUnpack` accordingly.
- `assets/binaries/ffmpeg` must be signed + executable in the bundled app. Plan 3's `afterSign` step handles signing; entitlements already allow unsigned dylib loading (set in Plan 2a's `assets/entitlements.mac.plist`).
- Info.plist needs `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSScreenCaptureDescription` (added via `build.mac.extendInfo` in Plan 3).
