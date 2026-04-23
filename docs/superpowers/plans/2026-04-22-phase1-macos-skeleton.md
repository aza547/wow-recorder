# macOS Port — Phase 1: macOS Skeleton

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the Electron app to launch on macOS with platform adapters in place and a first-run permissions wizard, *without* real recording. Every adapter interface from Plan 1 gains a macOS implementation; the recorder backend is a stub that lets the app boot but does not attempt to initialise libobs. Plan 2b will add the real OsnBackend.

**Architecture:** Every adapter factory in `src/main/platform/index.ts` gains a `process.platform === 'darwin'` branch returning a `Mac*` implementation. A new `IPermissionsGate` interface surfaces TCC (Screen Recording, Microphone, Accessibility) state to the renderer so a first-run wizard can block the UI until Screen Recording is granted. `OsnBackend` is a safe-default stub — all methods no-op or throw a recognisable "not yet implemented" error, so the app boots but recording attempts fail loudly. Window chrome gains `titleBarStyle: 'hiddenInset'` on mac, the tray icon uses macOS `Template.png` conventions, and `menu.ts` gets a mac role-based template.

**Tech Stack:** Electron 38 (`systemPreferences` for TCC queries), `uiohook-napi` (cross-platform, needs Accessibility), React 18 (first-run wizard), existing React Query, TypeScript 5, Jest. No new runtime deps in this plan — `obs-studio-node` install is deferred to Plan 2b. `noobs` moves from `dependencies` → `optionalDependencies` in `release/app/package.json` so `npm install` tolerates mac.

**Scope boundary:** No real recording. No OSN install. No DMG/notarize. No ffmpeg static binary shipping (path provider returns a sensible placeholder that Plan 2b or Plan 3 replaces). Localisation adds English strings only (per spec, other languages get TODO comments).

**Spec reference:** `docs/superpowers/specs/2026-04-22-macos-port-design.md` §3 (architecture), §5 (capture modes + permissions), §6 (paths/poller/files/ffmpeg), §7 (renderer + window chrome), §11 Phase 1.

**Pre-existing context:** Plan 1 (`docs/superpowers/plans/2026-04-22-phase0-platform-interfaces.md`) landed all interface extractions. Branch state at start of this plan: ~29 commits on `feat/macos-port`, `NoobsBackend` + Windows adapters behind factory, `IRecorderBackend.init(options)` accepts a `BackendInitOptions` object, `RecorderCapabilities.captureModes` uses `CaptureModeCapability` enum (GAME/WINDOW/MONITOR).

---

## Pre-flight checklist

- [ ] **P1. Confirm branch**

Run: `git branch --show-current`
Expected: `feat/macos-port`.

- [ ] **P2. Confirm baselines from end of Plan 1**

```
./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -1
npx jest src/__tests__/platform 2>&1 | tail -1
```

Expected:
- tsc: 41
- lint: ≤40 errors
- platform tests: 16 passed (5–6 suites)

Snapshot these numbers. Every verification step in this plan compares against this baseline.

- [ ] **P3. Node version sanity**

```
node --version
```

Expected: ≥ 20. Some Electron 38 native modules need recent Node. If below, the agent should stop and flag to the user.

- [ ] **P4. Confirm working tree**

```
git status --short
```

Expected: only pre-existing modifications (`.gitignore`, `release/app/package-lock.json`) that carried through Plan 1. No other modifications.

- [ ] **P5. Platform detection sanity**

```
node -e "console.log(process.platform)"
```

Expected: `darwin` (this plan's tasks target mac dev). If not darwin, the agent must stop — this plan is meant to be implemented on a mac.

---

## File structure

New files:

```
src/main/platform/
  poller/MacPgrepPoller.ts
  paths/MacWowPathResolver.ts
  files/MacFileReveal.ts
  ffmpeg/MacFfmpegPathProvider.ts
  recorder/OsnBackend.ts                       # stub — all methods no-op or throw
  permissions/IPermissionsGate.ts              # Screen Recording / Mic / Accessibility
  permissions/WinPermissionsGate.ts            # no-op impl (Windows never blocks)
  permissions/MacTccGate.ts                    # real TCC queries via systemPreferences

src/__tests__/platform/
  MacPgrepPoller.test.ts
  MacWowPathResolver.test.ts
  MacFileReveal.test.ts
  MacFfmpegPathProvider.test.ts
  MacTccGate.test.ts

src/renderer/permissions/
  PermissionsWizard.tsx                        # first-run mac-only blocking modal
  usePermissionsStatus.ts                      # React Query hook
  openPermissionsSettings.ts                   # IPC wrapper

assets/icon/tray/
  Template.png                                 # 22×22 template mask (macOS menu bar)
  Template@2x.png                              # 44×44 template mask
```

Modified files:

```
src/main/platform/index.ts                     # darwin branch in every factory + getPermissionsGate
src/main/main.ts                               # titleBarStyle on mac, tray asset on mac, permissions gate wiring
src/main/menu.ts                               # mac role-based template
src/main/Manager.ts                            # startup integrates permissions gate
src/main/preload.ts                            # expose platform + permissions IPC
src/renderer/preload.d.ts                      # typed bridge for platform + permissions
src/renderer/App.tsx                           # mount PermissionsWizard on darwin when needed
src/renderer/Layout.tsx                        # reserve traffic-light padding on mac
src/config/ConfigService.ts                    # or new utility — mac config-migration helper
release/app/package.json                       # noobs → optionalDependencies
.erb/scripts/check-native-dep.js               # skip noobs gate on darwin
package.json                                   # (maybe) adjust postinstall guard
src/localisation/english.ts                    # new phrase keys for wizard + mac examples
src/localisation/{german,korean,chineseSimplified}.ts  # English placeholder + TODO comments
src/localisation/phrases.ts                    # new Phrase enum members
```

No deletions in this plan. Plan 2b removes the OsnBackend stub body once real impl lands.

---

## Task 1: Make `noobs` optional on macOS

**Files:**
- Modify: `release/app/package.json`
- Modify: `.erb/scripts/check-native-dep.js`

On macOS, `npm install` currently skips or silently fails noobs because the package is Windows-only. Moving noobs to `optionalDependencies` makes this formal: `npm install` on mac keeps succeeding, `npm install` on Windows still installs noobs because optional deps are installed unless they fail. The `check-native-dep.js` preflight must stop false-alarming on darwin.

- [ ] **Step 1: Move noobs in `release/app/package.json`**

Current:
```json
{
  ...
  "dependencies": {
    "atomic-queue": "^5.0.4",
    "noobs": "^0.0.184",
    "uiohook-napi": "^1.5.2"
  },
  "license": "MIT"
}
```

Replace with:
```json
{
  ...
  "dependencies": {
    "atomic-queue": "^5.0.4",
    "uiohook-napi": "^1.5.2"
  },
  "optionalDependencies": {
    "noobs": "^0.0.184"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Guard `check-native-dep.js` on darwin**

Edit `.erb/scripts/check-native-dep.js`. Find the top-of-file section (after the imports):

```js
import fs from 'fs';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { dependencies } from '../../package.json';

if (dependencies) {
```

Replace with:

```js
import fs from 'fs';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { dependencies } from '../../package.json';

// macOS builds skip noobs (Windows-only native binding). The platform
// factory selects OsnBackend there; the check below would false-alarm
// because the fs.existsSync check can't see the missing module.
if (process.platform === 'darwin') {
  process.exit(0);
}

if (dependencies) {
```

- [ ] **Step 3: Verify `npm install` in `release/app/` succeeds on mac**

```
cd release/app && npm install 2>&1 | tail -10 && cd -
```

Expected: no fatal errors. `noobs` may log a warning like `npm WARN optional SKIPPING OPTIONAL DEPENDENCY` — that's the desired outcome. Any exit status non-zero means something else broke.

- [ ] **Step 4: Verify platform tests still pass**

```
npx jest src/__tests__/platform 2>&1 | tail -5
```

Expected: 16 passed.

- [ ] **Step 5: Verify baselines unchanged**

```
./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -1
```

Expected: 41 and ≤40 respectively.

- [ ] **Step 6: Commit**

```bash
git add release/app/package.json .erb/scripts/check-native-dep.js release/app/package-lock.json
git commit -m "build(mac): make noobs optional dep + skip preflight gate on darwin"
```

Include `release/app/package-lock.json` in the stage — `npm install` regenerated it.

---

## Task 2: OsnBackend stub

**Files:**
- Create: `src/main/platform/recorder/OsnBackend.ts`

The stub must satisfy the `IRecorderBackend` interface. Goal: app can boot, factory returns `OsnBackend` on darwin, but any real recording attempt fails with a clear error. Safe defaults (empty arrays, zero dimensions) where the caller inspects return values.

- [ ] **Step 1: Create the file**

Write to `src/main/platform/recorder/OsnBackend.ts`:

```ts
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

const NOT_IMPL = 'OsnBackend not yet implemented (Phase 2 — Plan 2b)';

/**
 * macOS recorder backend STUB. Phase 1 only — every method either no-ops
 * or throws so the app boots cleanly but recording fails loudly.
 * Plan 2b will replace the bodies with real obs-studio-node calls.
 */
export default class OsnBackend implements IRecorderBackend {
  public readonly capabilities: RecorderCapabilities = {
    captureModes: [CaptureModeCapability.WINDOW, CaptureModeCapability.MONITOR],
    encoders: [ESupportedEncoders.OBS_X264], // VT_H264/VT_HEVC added in Plan 2b
    supportsReplayBuffer: false, // flipped true in Plan 2b
  };

  // Lifecycle — throw so callers see a clear error
  init(_options: BackendInitOptions): void {
    throw new Error(NOT_IMPL);
  }
  initPreview(_hwnd: Buffer): void {
    throw new Error(NOT_IMPL);
  }
  shutdown(): void {
    // no-op: safe to call on app quit even if init never happened
  }
  setBuffering(_enabled: boolean): void {}
  setDrawSourceOutline(_enabled: boolean): void {}

  // Video context
  resetVideoContext(_fps: number, _width: number, _height: number): void {}
  getPreviewInfo(): {
    canvasWidth: number;
    canvasHeight: number;
    previewWidth: number;
    previewHeight: number;
  } {
    return { canvasWidth: 0, canvasHeight: 0, previewWidth: 0, previewHeight: 0 };
  }

  // Preview window
  configurePreview(_x: number, _y: number, _w: number, _h: number): void {}
  showPreview(): void {}
  hidePreview(): void {}
  disablePreview(): void {}

  // Recording output
  setRecordingCfg(_outputPath: string, _container: string): void {}
  setVideoEncoder(_encoder: string, _settings: ObsData): void {}
  listVideoEncoders(): string[] {
    return [ESupportedEncoders.OBS_X264];
  }

  // Sources
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
      x: 0, y: 0,
      scaleX: 1, scaleY: 1,
      cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0,
      width: 0, height: 0,
    } as SceneItemPosition & SourceDimensions;
  }
  setSourcePos(_id: string, _pos: SceneItemPosition): void {}
  setSourceVolume(_id: string, _volume: number): void {}

  // Audio
  setVolmeterEnabled(_enabled: boolean): void {}
  setForceMono(_enabled: boolean): void {}
  setAudioSuppression(_enabled: boolean): void {}
  setMuteAudioInputs(_muted: boolean): void {}

  // Recording lifecycle — throw (no no-op equivalent that makes sense)
  startBuffer(): void {
    throw new Error(NOT_IMPL);
  }
  startRecording(_offsetSeconds: number): void {
    throw new Error(NOT_IMPL);
  }
  stopRecording(): void {
    throw new Error(NOT_IMPL);
  }
  forceStopRecording(): void {
    // no-op: safe on shutdown
  }
  getLastRecording(): string {
    return '';
  }
}
```

- [ ] **Step 2: Verify tsc**

```
./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: 41 or slightly lower. If higher, the interface shape may have drifted — check `IRecorderBackend.ts` for unmatched methods.

- [ ] **Step 3: Commit**

```bash
git add src/main/platform/recorder/OsnBackend.ts
git commit -m "feat(platform): add OsnBackend stub for macOS (Phase 1)"
```

---

## Task 3: MacPgrepPoller

**Files:**
- Create: `src/main/platform/poller/MacPgrepPoller.ts`
- Create: `src/__tests__/platform/MacPgrepPoller.test.ts`

Parallel to `WinRustPsPoller`. Instead of spawning `rust-ps.exe` once and streaming stdout, macOS polls `pgrep` every 2 s. Process names: `World of Warcraft` (retail) and `World of Warcraft Classic` (classic + era share the binary, matching the Windows pattern).

- [ ] **Step 1: Write failing test**

Write to `src/__tests__/platform/MacPgrepPoller.test.ts`:

```ts
jest.useFakeTimers();

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

const cfgFlags: { [k: string]: boolean } = {
  recordRetail: true,
  recordClassic: false,
  recordEra: false,
};

jest.mock('config/ConfigService', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({
      get: jest.fn((key: string) => cfgFlags[key]),
    }),
  },
}));

import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import MacPgrepPoller from 'main/platform/poller/MacPgrepPoller';
import { WowProcessEvent } from 'main/types';

class FakeProc extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = jest.fn();
}

/** Drive one poll tick and let spawn resolve with the given exit codes. */
function runTick(retailFound: boolean, classicFound: boolean) {
  const procs: FakeProc[] = [];
  (spawn as jest.Mock).mockImplementation(() => {
    const p = new FakeProc();
    procs.push(p);
    return p;
  });

  jest.advanceTimersByTime(2100); // > 2s interval

  // pgrep emits the exit event with code 0 if found, 1 if not.
  const [retailProc, classicProc] = procs;
  retailProc?.emit('exit', retailFound ? 0 : 1);
  classicProc?.emit('exit', classicFound ? 0 : 1);
}

describe('MacPgrepPoller', () => {
  beforeEach(() => {
    (spawn as jest.Mock).mockReset();
    cfgFlags.recordRetail = true;
    cfgFlags.recordClassic = false;
    cfgFlags.recordEra = false;
  });

  it('emits STARTED when pgrep finds "World of Warcraft" and recordRetail is true', (done) => {
    const poller = new MacPgrepPoller();
    poller.on(WowProcessEvent.STARTED, () => {
      expect(poller.isWowRunning()).toBe(true);
      done();
    });
    poller.start();
    runTick(true, false);
  });

  it('emits STOPPED after STARTED when retail disappears', (done) => {
    const poller = new MacPgrepPoller();
    const events: string[] = [];
    poller.on(WowProcessEvent.STARTED, () => events.push('started'));
    poller.on(WowProcessEvent.STOPPED, () => {
      events.push('stopped');
      expect(events).toEqual(['started', 'stopped']);
      done();
    });
    poller.start();
    runTick(true, false);
    runTick(false, false);
  });

  it('emits STARTED for era when recordEra is true and Classic binary is running', (done) => {
    cfgFlags.recordRetail = false;
    cfgFlags.recordEra = true;
    const poller = new MacPgrepPoller();
    poller.on(WowProcessEvent.STARTED, () => done());
    poller.start();
    runTick(false, true);
  });

  it('does not emit if recordRetail is false even when retail binary runs', () => {
    cfgFlags.recordRetail = false;
    const poller = new MacPgrepPoller();
    const events: string[] = [];
    poller.on(WowProcessEvent.STARTED, () => events.push('started'));
    poller.on(WowProcessEvent.STOPPED, () => events.push('stopped'));
    poller.start();
    runTick(true, false);
    expect(events).toEqual([]);
    expect(poller.isWowRunning()).toBe(false);
  });
});
```

Run: `npx jest src/__tests__/platform/MacPgrepPoller.test.ts 2>&1 | tail -10` → expect FAIL "Cannot find module".

- [ ] **Step 2: Implement the poller**

Write to `src/main/platform/poller/MacPgrepPoller.ts`:

```ts
import EventEmitter from 'events';
import { spawn } from 'child_process';
import ConfigService from 'config/ConfigService';
import { WowProcessEvent } from 'main/types';
import type { IProcessPoller } from './IProcessPoller';

const POLL_INTERVAL_MS = 2000;
const RETAIL_PROCESS = 'World of Warcraft';
const CLASSIC_PROCESS = 'World of Warcraft Classic';

/**
 * macOS process poller. Spawns `pgrep -x <name>` for retail and
 * classic process names every 2 seconds; exit code 0 = running,
 * 1 = not running. Config gates (recordRetail/Classic/Era) are
 * applied before emitting. Era shares the Classic binary on mac,
 * mirroring the Windows behaviour.
 */
export default class MacPgrepPoller extends EventEmitter implements IProcessPoller {
  private cfg = ConfigService.getInstance();
  private wowRunning = false;
  private timer: NodeJS.Timeout | undefined;

  isWowRunning(): boolean {
    return this.wowRunning;
  }

  start(): void {
    this.stop();
    console.info('[MacPgrepPoller] Start');
    this.timer = setInterval(this.poll, POLL_INTERVAL_MS);
  }

  stop(): void {
    console.info('[MacPgrepPoller] Stop');
    this.wowRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private poll = () => {
    Promise.all([
      this.pgrep(RETAIL_PROCESS),
      this.pgrep(CLASSIC_PROCESS),
    ]).then(([retail, classic]) => this.apply(retail, classic));
  };

  private pgrep(name: string): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn('pgrep', ['-x', name]);
      child.on('exit', (code) => resolve(code === 0));
      child.on('error', () => resolve(false));
    });
  }

  private apply(retail: boolean, classic: boolean): void {
    const recordRetail = this.cfg.get<boolean>('recordRetail');
    const recordClassic = this.cfg.get<boolean>('recordClassic');
    const recordEra = this.cfg.get<boolean>('recordEra');

    const running =
      (recordRetail && retail) ||
      (recordClassic && classic) ||
      (recordEra && classic);

    if (this.wowRunning === running) return;
    this.wowRunning = running;
    if (running) this.emit(WowProcessEvent.STARTED);
    else this.emit(WowProcessEvent.STOPPED);
  }
}
```

- [ ] **Step 3: Run tests**

```
npx jest src/__tests__/platform/MacPgrepPoller.test.ts 2>&1 | tail -10
```

Expected: 4 passed. If timing-dependent tests flake, investigate — do NOT reduce assertion strength.

- [ ] **Step 4: Verify baselines**

```
./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: 41 or lower.

- [ ] **Step 5: Commit**

```bash
git add src/main/platform/poller/MacPgrepPoller.ts src/__tests__/platform/MacPgrepPoller.test.ts
git commit -m "feat(platform): add MacPgrepPoller impl + unit tests"
```

---

## Task 4: MacWowPathResolver

**Files:**
- Create: `src/main/platform/paths/MacWowPathResolver.ts`
- Create: `src/__tests__/platform/MacWowPathResolver.test.ts`

Battle.net installs WoW at `/Applications/World of Warcraft/` on macOS. A home-dir fallback covers unusual setups. Forward slashes throughout.

- [ ] **Step 1: Write failing test**

Write to `src/__tests__/platform/MacWowPathResolver.test.ts`:

```ts
jest.mock('os', () => ({
  ...jest.requireActual('os'),
  homedir: () => '/Users/testuser',
}));

import MacWowPathResolver from 'main/platform/paths/MacWowPathResolver';

describe('MacWowPathResolver', () => {
  const r = new MacWowPathResolver();

  it('includes the standard /Applications root', () => {
    expect(r.searchRoots()).toContain('/Applications/World of Warcraft');
  });

  it('includes the home-dir Applications fallback', () => {
    expect(r.searchRoots()).toContain('/Users/testuser/Applications/World of Warcraft');
  });

  it('joins a retail log path with forward slashes', () => {
    expect(r.joinLogPath('/Applications/World of Warcraft', 'retail'))
      .toBe('/Applications/World of Warcraft/_retail_/Logs');
  });

  it('joins a classic_era log path', () => {
    expect(r.joinLogPath('/Applications/World of Warcraft', 'classic_era'))
      .toBe('/Applications/World of Warcraft/_classic_era_/Logs');
  });
});
```

Run: `npx jest src/__tests__/platform/MacWowPathResolver.test.ts 2>&1 | tail -10` → expect FAIL.

- [ ] **Step 2: Implement**

Write to `src/main/platform/paths/MacWowPathResolver.ts`:

```ts
import os from 'os';
import path from 'path';
import type { IWowPathResolver, WowFlavour } from './IWowPathResolver';

const FLAVOUR_DIR: Record<WowFlavour, string> = {
  retail: '_retail_',
  classic: '_classic_',
  classic_era: '_classic_era_',
  classic_ptr: '_classic_ptr_',
};

/**
 * macOS WoW path resolver. Battle.net defaults to /Applications;
 * user-Applications is a common fallback for sandbox-sensitive setups.
 */
export default class MacWowPathResolver implements IWowPathResolver {
  searchRoots(): string[] {
    return [
      '/Applications/World of Warcraft',
      path.join(os.homedir(), 'Applications', 'World of Warcraft'),
    ];
  }

  joinLogPath(root: string, flavour: WowFlavour): string {
    return `${root}/${FLAVOUR_DIR[flavour]}/Logs`;
  }
}
```

- [ ] **Step 3: Run tests**

```
npx jest src/__tests__/platform/MacWowPathResolver.test.ts 2>&1 | tail -10
```

Expected: 4 passed.

- [ ] **Step 4: Commit**

```bash
git add src/main/platform/paths/MacWowPathResolver.ts src/__tests__/platform/MacWowPathResolver.test.ts
git commit -m "feat(platform): add MacWowPathResolver impl + unit tests"
```

---

## Task 5: MacFileReveal

**Files:**
- Create: `src/main/platform/files/MacFileReveal.ts`
- Create: `src/__tests__/platform/MacFileReveal.test.ts`

- [ ] **Step 1: Write failing test**

Write to `src/__tests__/platform/MacFileReveal.test.ts`:

```ts
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

import { spawn } from 'child_process';
import MacFileReveal from 'main/platform/files/MacFileReveal';

describe('MacFileReveal', () => {
  beforeEach(() => {
    (spawn as jest.Mock).mockReset();
  });

  it('invokes `open -R <path>` with the file path unchanged', () => {
    new MacFileReveal().reveal('/Users/me/Movies/clip.mkv');
    expect(spawn).toHaveBeenCalledWith('open', ['-R', '/Users/me/Movies/clip.mkv']);
  });

  it('does not rewrite forward slashes on mac paths', () => {
    new MacFileReveal().reveal('/tmp/foo bar/baz.mp4');
    expect(spawn).toHaveBeenCalledWith('open', ['-R', '/tmp/foo bar/baz.mp4']);
  });
});
```

Run: `npx jest src/__tests__/platform/MacFileReveal.test.ts 2>&1 | tail -10` → expect FAIL.

- [ ] **Step 2: Implement**

Write to `src/main/platform/files/MacFileReveal.ts`:

```ts
import { spawn } from 'child_process';
import type { IFileReveal } from './IFileReveal';

/**
 * macOS file reveal — opens Finder with the file selected via `open -R`.
 * `spawn` (not `exec`) avoids shell quoting concerns with paths that
 * contain spaces or special characters.
 */
export default class MacFileReveal implements IFileReveal {
  reveal(filePath: string): void {
    spawn('open', ['-R', filePath]);
  }
}
```

- [ ] **Step 3: Run tests**

```
npx jest src/__tests__/platform/MacFileReveal.test.ts 2>&1 | tail -10
```

Expected: 2 passed.

- [ ] **Step 4: Commit**

```bash
git add src/main/platform/files/MacFileReveal.ts src/__tests__/platform/MacFileReveal.test.ts
git commit -m "feat(platform): add MacFileReveal impl + unit tests"
```

---

## Task 6: MacFfmpegPathProvider

**Files:**
- Create: `src/main/platform/ffmpeg/MacFfmpegPathProvider.ts`
- Create: `src/__tests__/platform/MacFfmpegPathProvider.test.ts`

ffmpeg shipping on macOS is deferred to Plan 2b/3 (a universal static binary under `extraResources`). For Phase 1 the provider returns the expected final path; if `ffmpeg` isn't actually at that path, post-processing will fail — but Phase 1 doesn't record anything so post-processing never runs.

- [ ] **Step 1: Write failing test**

Write to `src/__tests__/platform/MacFfmpegPathProvider.test.ts`:

```ts
jest.mock('electron', () => ({
  app: { isPackaged: false },
}));

jest.mock('main/util', () => ({
  fixPathWhenPackaged: (p: string) => p,
}));

import path from 'path';
import MacFfmpegPathProvider from 'main/platform/ffmpeg/MacFfmpegPathProvider';

describe('MacFfmpegPathProvider', () => {
  it('returns an absolute path ending in binaries/ffmpeg', () => {
    const p = new MacFfmpegPathProvider().getPath();
    expect(path.isAbsolute(p)).toBe(true);
    expect(p.endsWith('binaries/ffmpeg')).toBe(true);
  });
});
```

Run: `npx jest src/__tests__/platform/MacFfmpegPathProvider.test.ts 2>&1 | tail -10` → expect FAIL.

- [ ] **Step 2: Implement**

Write to `src/main/platform/ffmpeg/MacFfmpegPathProvider.ts`:

```ts
import path from 'path';
import { app } from 'electron';
import { fixPathWhenPackaged } from 'main/util';
import type { IFfmpegPathProvider } from './IFfmpegPathProvider';

/**
 * macOS ffmpeg path. Points at the universal static binary shipped
 * under `extraResources/binaries/ffmpeg` (added in Plan 2b/3).
 * Packaged builds resolve via `process.resourcesPath`; dev builds
 * resolve relative to the repo-root `binaries/` (same convention as
 * the Windows rust-ps path).
 */
export default class MacFfmpegPathProvider implements IFfmpegPathProvider {
  getPath(): string {
    const abs = app.isPackaged
      ? path.join(process.resourcesPath, 'binaries', 'ffmpeg')
      : path.join(__dirname, '../../binaries', 'ffmpeg');
    return fixPathWhenPackaged(abs);
  }
}
```

- [ ] **Step 3: Run tests**

```
npx jest src/__tests__/platform/MacFfmpegPathProvider.test.ts 2>&1 | tail -10
```

Expected: 1 passed.

- [ ] **Step 4: Commit**

```bash
git add src/main/platform/ffmpeg/MacFfmpegPathProvider.ts src/__tests__/platform/MacFfmpegPathProvider.test.ts
git commit -m "feat(platform): add MacFfmpegPathProvider (binary shipping deferred)"
```

---

## Task 7: IPermissionsGate interface + Windows no-op impl

**Files:**
- Create: `src/main/platform/permissions/IPermissionsGate.ts`
- Create: `src/main/platform/permissions/WinPermissionsGate.ts`

The interface exposes each TCC category the renderer cares about. Windows has no TCC-equivalent for our usage — `WinPermissionsGate` returns `'granted'` for everything.

- [ ] **Step 1: Create the interface**

Write to `src/main/platform/permissions/IPermissionsGate.ts`:

```ts
export type PermissionStatus = 'granted' | 'denied' | 'unknown' | 'not-determined';

export type PermissionKey = 'screen' | 'microphone' | 'accessibility';

export interface PermissionsSnapshot {
  screen: PermissionStatus;
  microphone: PermissionStatus;
  accessibility: PermissionStatus;
}

/**
 * Platform permission gate. macOS reports real TCC state via
 * `systemPreferences`; Windows treats every permission as granted
 * because the relevant APIs (DirectX capture, uiohook) work without
 * explicit grants.
 */
export interface IPermissionsGate {
  /** Current status for all three permission categories. */
  snapshot(): PermissionsSnapshot;
  /** True iff screen recording is granted (the minimum required to record). */
  canRecord(): boolean;
  /** True iff all listeners can attach (uiohook hotkeys). */
  canUseGlobalHotkeys(): boolean;
  /** Open the OS Settings pane for the given category (no-op on platforms without one). */
  openSettingsFor(key: PermissionKey): void;
}
```

- [ ] **Step 2: Write Windows no-op impl**

Write to `src/main/platform/permissions/WinPermissionsGate.ts`:

```ts
import type {
  IPermissionsGate,
  PermissionKey,
  PermissionsSnapshot,
} from './IPermissionsGate';

/**
 * Windows no-op permissions gate. DirectX hook (game capture), window
 * enumeration, and uiohook work on Windows without user-facing TCC
 * consent, so every category reports 'granted'.
 */
export default class WinPermissionsGate implements IPermissionsGate {
  snapshot(): PermissionsSnapshot {
    return {
      screen: 'granted',
      microphone: 'granted',
      accessibility: 'granted',
    };
  }
  canRecord(): boolean {
    return true;
  }
  canUseGlobalHotkeys(): boolean {
    return true;
  }
  openSettingsFor(_key: PermissionKey): void {
    // no-op
  }
}
```

- [ ] **Step 3: Verify tsc**

```
./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: 41 or lower.

- [ ] **Step 4: Commit**

```bash
git add src/main/platform/permissions/IPermissionsGate.ts src/main/platform/permissions/WinPermissionsGate.ts
git commit -m "feat(platform): add IPermissionsGate + WinPermissionsGate no-op"
```

---

## Task 8: MacTccGate

**Files:**
- Create: `src/main/platform/permissions/MacTccGate.ts`
- Create: `src/__tests__/platform/MacTccGate.test.ts`

Electron's `systemPreferences` APIs:
- `getMediaAccessStatus('screen' | 'microphone' | 'camera')` — returns `'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown'`.
- `isTrustedAccessibilityClient(prompt: boolean)` — boolean.
- `askForMediaAccess('microphone' | 'camera')` — returns Promise<boolean>. No screen equivalent (TCC prompts on first use).
- Settings deep links: `x-apple.systempreferences:com.apple.preference.security?Privacy_<Category>`.

- [ ] **Step 1: Write failing test**

Write to `src/__tests__/platform/MacTccGate.test.ts`:

```ts
const mockSystemPreferences = {
  getMediaAccessStatus: jest.fn(),
  isTrustedAccessibilityClient: jest.fn(),
};
const mockShell = {
  openExternal: jest.fn().mockResolvedValue(undefined),
};

jest.mock('electron', () => ({
  systemPreferences: mockSystemPreferences,
  shell: mockShell,
}));

import MacTccGate from 'main/platform/permissions/MacTccGate';

describe('MacTccGate', () => {
  beforeEach(() => {
    mockSystemPreferences.getMediaAccessStatus.mockReset();
    mockSystemPreferences.isTrustedAccessibilityClient.mockReset();
    mockShell.openExternal.mockReset();
  });

  it('reads screen + microphone status via systemPreferences and accessibility via trust', () => {
    mockSystemPreferences.getMediaAccessStatus.mockImplementation((k) =>
      k === 'screen' ? 'granted' : 'denied',
    );
    mockSystemPreferences.isTrustedAccessibilityClient.mockReturnValue(true);

    const snap = new MacTccGate().snapshot();
    expect(snap).toEqual({
      screen: 'granted',
      microphone: 'denied',
      accessibility: 'granted',
    });
  });

  it('canRecord reflects screen status', () => {
    mockSystemPreferences.getMediaAccessStatus.mockReturnValue('granted');
    mockSystemPreferences.isTrustedAccessibilityClient.mockReturnValue(false);
    expect(new MacTccGate().canRecord()).toBe(true);

    mockSystemPreferences.getMediaAccessStatus.mockImplementation((k) =>
      k === 'screen' ? 'denied' : 'granted',
    );
    expect(new MacTccGate().canRecord()).toBe(false);
  });

  it('canUseGlobalHotkeys reflects accessibility trust', () => {
    mockSystemPreferences.getMediaAccessStatus.mockReturnValue('granted');
    mockSystemPreferences.isTrustedAccessibilityClient.mockReturnValue(false);
    expect(new MacTccGate().canUseGlobalHotkeys()).toBe(false);

    mockSystemPreferences.isTrustedAccessibilityClient.mockReturnValue(true);
    expect(new MacTccGate().canUseGlobalHotkeys()).toBe(true);
  });

  it('opens the correct deep link for screen', () => {
    new MacTccGate().openSettingsFor('screen');
    expect(mockShell.openExternal).toHaveBeenCalledWith(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
    );
  });

  it('opens the correct deep link for microphone', () => {
    new MacTccGate().openSettingsFor('microphone');
    expect(mockShell.openExternal).toHaveBeenCalledWith(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
    );
  });

  it('opens the correct deep link for accessibility', () => {
    new MacTccGate().openSettingsFor('accessibility');
    expect(mockShell.openExternal).toHaveBeenCalledWith(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
    );
  });
});
```

Run: `npx jest src/__tests__/platform/MacTccGate.test.ts 2>&1 | tail -10` → expect FAIL.

- [ ] **Step 2: Implement**

Write to `src/main/platform/permissions/MacTccGate.ts`:

```ts
import { shell, systemPreferences } from 'electron';
import type {
  IPermissionsGate,
  PermissionKey,
  PermissionStatus,
  PermissionsSnapshot,
} from './IPermissionsGate';

const SETTINGS_URL: Record<PermissionKey, string> = {
  screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
};

function normaliseMediaStatus(s: string): PermissionStatus {
  // Electron returns 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown'.
  // We collapse 'restricted' (institutional MDM block) into 'denied' since the
  // user cannot grant it from our settings flow anyway.
  if (s === 'granted' || s === 'denied' || s === 'not-determined' || s === 'unknown') {
    return s as PermissionStatus;
  }
  if (s === 'restricted') return 'denied';
  return 'unknown';
}

/**
 * macOS TCC gate. Reads Screen Recording + Microphone status via the
 * Electron `systemPreferences` API and Accessibility status via
 * `isTrustedAccessibilityClient`. Deep-links open the correct Privacy
 * pane so the user can toggle the grant without hunting through menus.
 */
export default class MacTccGate implements IPermissionsGate {
  snapshot(): PermissionsSnapshot {
    return {
      screen: normaliseMediaStatus(systemPreferences.getMediaAccessStatus('screen')),
      microphone: normaliseMediaStatus(systemPreferences.getMediaAccessStatus('microphone')),
      accessibility: systemPreferences.isTrustedAccessibilityClient(false)
        ? 'granted'
        : 'denied',
    };
  }

  canRecord(): boolean {
    return this.snapshot().screen === 'granted';
  }

  canUseGlobalHotkeys(): boolean {
    return this.snapshot().accessibility === 'granted';
  }

  openSettingsFor(key: PermissionKey): void {
    shell.openExternal(SETTINGS_URL[key]);
  }
}
```

- [ ] **Step 3: Run tests**

```
npx jest src/__tests__/platform/MacTccGate.test.ts 2>&1 | tail -10
```

Expected: 6 passed.

- [ ] **Step 4: Commit**

```bash
git add src/main/platform/permissions/MacTccGate.ts src/__tests__/platform/MacTccGate.test.ts
git commit -m "feat(platform): add MacTccGate with TCC queries + Settings deep-links"
```

---

## Task 9: Wire platform factory for darwin + permissions gate

**Files:**
- Modify: `src/main/platform/index.ts`

Add `process.platform === 'darwin'` branches to every factory. Add a new `getPermissionsGate()` factory.

- [ ] **Step 1: Rewrite `src/main/platform/index.ts`**

Replace entire file content with:

```ts
import NoobsBackend from './recorder/NoobsBackend';
import OsnBackend from './recorder/OsnBackend';

import WinRustPsPoller from './poller/WinRustPsPoller';
import MacPgrepPoller from './poller/MacPgrepPoller';

import WinWowPathResolver from './paths/WinWowPathResolver';
import MacWowPathResolver from './paths/MacWowPathResolver';

import WinFileReveal from './files/WinFileReveal';
import MacFileReveal from './files/MacFileReveal';

import WinFfmpegPathProvider from './ffmpeg/WinFfmpegPathProvider';
import MacFfmpegPathProvider from './ffmpeg/MacFfmpegPathProvider';

import WinPermissionsGate from './permissions/WinPermissionsGate';
import MacTccGate from './permissions/MacTccGate';

import type { IRecorderBackend } from './recorder/IRecorderBackend';
import type { IProcessPoller } from './poller/IProcessPoller';
import type { IWowPathResolver } from './paths/IWowPathResolver';
import type { IFileReveal } from './files/IFileReveal';
import type { IFfmpegPathProvider } from './ffmpeg/IFfmpegPathProvider';
import type { IPermissionsGate } from './permissions/IPermissionsGate';

export type {
  IRecorderBackend,
  IProcessPoller,
  IWowPathResolver,
  IFileReveal,
  IFfmpegPathProvider,
  IPermissionsGate,
};
export type {
  BackendInitOptions,
  RecorderCapabilities,
  SignalCallback,
} from './recorder/IRecorderBackend';
export { CaptureModeCapability } from './recorder/IRecorderBackend';
export type { WowFlavour } from './paths/IWowPathResolver';
export type {
  PermissionStatus,
  PermissionKey,
  PermissionsSnapshot,
} from './permissions/IPermissionsGate';
export type {
  ObsData,
  ObsListItem,
  ObsProperty,
  SceneItemPosition,
  Signal,
  SourceDimensions,
} from './recorder/types';

const isMac = process.platform === 'darwin';

let recorderBackend: IRecorderBackend | undefined;
let processPoller: IProcessPoller | undefined;
let wowPathResolver: IWowPathResolver | undefined;
let fileReveal: IFileReveal | undefined;
let ffmpegPathProvider: IFfmpegPathProvider | undefined;
let permissionsGate: IPermissionsGate | undefined;

export function getRecorderBackend(): IRecorderBackend {
  if (!recorderBackend) {
    recorderBackend = isMac ? new OsnBackend() : new NoobsBackend();
  }
  return recorderBackend;
}

export function getProcessPoller(): IProcessPoller {
  if (!processPoller) {
    processPoller = isMac ? new MacPgrepPoller() : new WinRustPsPoller();
  }
  return processPoller;
}

export function getWowPathResolver(): IWowPathResolver {
  if (!wowPathResolver) {
    wowPathResolver = isMac ? new MacWowPathResolver() : new WinWowPathResolver();
  }
  return wowPathResolver;
}

export function getFileReveal(): IFileReveal {
  if (!fileReveal) {
    fileReveal = isMac ? new MacFileReveal() : new WinFileReveal();
  }
  return fileReveal;
}

export function getFfmpegPathProvider(): IFfmpegPathProvider {
  if (!ffmpegPathProvider) {
    ffmpegPathProvider = isMac ? new MacFfmpegPathProvider() : new WinFfmpegPathProvider();
  }
  return ffmpegPathProvider;
}

export function getPermissionsGate(): IPermissionsGate {
  if (!permissionsGate) {
    permissionsGate = isMac ? new MacTccGate() : new WinPermissionsGate();
  }
  return permissionsGate;
}
```

- [ ] **Step 2: Extend the factory test**

Edit `src/__tests__/platform/PlatformFactory.test.ts`. Add these mocks to the existing mock block at the top:

```ts
jest.mock('obs-studio-node', () => ({}), { virtual: true });
```

Add these imports next to the existing backend imports:

```ts
import OsnBackend from 'main/platform/recorder/OsnBackend';
import MacPgrepPoller from 'main/platform/poller/MacPgrepPoller';
import MacWowPathResolver from 'main/platform/paths/MacWowPathResolver';
import MacFileReveal from 'main/platform/files/MacFileReveal';
import MacFfmpegPathProvider from 'main/platform/ffmpeg/MacFfmpegPathProvider';
import WinPermissionsGate from 'main/platform/permissions/WinPermissionsGate';
import MacTccGate from 'main/platform/permissions/MacTccGate';
import { getPermissionsGate } from 'main/platform';
```

Add this block AFTER the existing `describe` block (so existing tests keep running with `process.platform` as the mac actual):

```ts
describe('platform factory — darwin dispatch', () => {
  beforeAll(() => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
  });

  afterAll(() => {
    // Reset isn't strictly necessary — this file is the only factory test.
  });

  it('returns OsnBackend on darwin', () => {
    jest.resetModules();
    const { getRecorderBackend: getDarwinBackend } = require('main/platform');
    expect(getDarwinBackend()).toBeInstanceOf(OsnBackend);
  });

  it('returns MacPgrepPoller on darwin', () => {
    jest.resetModules();
    const { getProcessPoller: getDarwinPoller } = require('main/platform');
    expect(getDarwinPoller()).toBeInstanceOf(MacPgrepPoller);
  });

  it('returns MacWowPathResolver on darwin', () => {
    jest.resetModules();
    const { getWowPathResolver: get } = require('main/platform');
    expect(get()).toBeInstanceOf(MacWowPathResolver);
  });

  it('returns MacFileReveal on darwin', () => {
    jest.resetModules();
    const { getFileReveal: get } = require('main/platform');
    expect(get()).toBeInstanceOf(MacFileReveal);
  });

  it('returns MacFfmpegPathProvider on darwin', () => {
    jest.resetModules();
    const { getFfmpegPathProvider: get } = require('main/platform');
    expect(get()).toBeInstanceOf(MacFfmpegPathProvider);
  });

  it('returns MacTccGate on darwin', () => {
    jest.resetModules();
    const { getPermissionsGate: get } = require('main/platform');
    expect(get()).toBeInstanceOf(MacTccGate);
  });
});

describe('platform factory — permissions (win32 baseline)', () => {
  beforeAll(() => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
  });

  it('returns WinPermissionsGate on win32', () => {
    jest.resetModules();
    const { getPermissionsGate: get } = require('main/platform');
    expect(get()).toBeInstanceOf(WinPermissionsGate);
  });
});
```

Note: existing tests in this file assert the `win32` behaviour. Because Plan 2a runs on darwin, they need a `beforeAll` that pins `process.platform` to `win32`. Update the existing top-level `describe('platform factory', ...)` to add:

```ts
  beforeAll(() => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
  });
```

…right after the `describe('platform factory', () => {` opening line.

- [ ] **Step 3: Run tests**

```
npx jest src/__tests__/platform 2>&1 | tail -10
```

Expected: all platform tests pass. Total count increases from 16 → 23+ (existing 16 + 7 new darwin/permissions tests).

If tests fail due to singleton caching (the factory memoises across `require` calls), the `jest.resetModules()` inside each `it` should isolate them. If it still fails, investigate — do not weaken assertions.

- [ ] **Step 4: tsc + lint**

```
./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -1
```

Both should be near baseline (41 / ≤40).

- [ ] **Step 5: Commit**

```bash
git add src/main/platform/index.ts src/__tests__/platform/PlatformFactory.test.ts
git commit -m "feat(platform): dispatch Mac* impls on darwin + add getPermissionsGate"
```

---

## Task 10: Window chrome platform branch

**Files:**
- Modify: `src/main/main.ts` (around line 178 — `createWindow`)

- [ ] **Step 1: Update BrowserWindow options**

Find in `src/main/main.ts` (`createWindow`, around line 178):

```ts
  window = new BrowserWindow({
    show: false,
    height: 1020 * 0.9,
    width: 1980 * 0.8,
    icon: getAssetPath('./icon/small-icon.png'),
    frame: false,
    title: `Warcraft Recorder v${appVersion}`,
    webPreferences: {
      sandbox: true, // Good security practice.
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });
```

Replace with:

```ts
  const isMac = process.platform === 'darwin';

  window = new BrowserWindow({
    show: false,
    height: 1020 * 0.9,
    width: 1980 * 0.8,
    icon: getAssetPath('./icon/small-icon.png'),
    frame: isMac, // native traffic-light chrome on macOS, borderless on Windows
    titleBarStyle: isMac ? 'hiddenInset' : undefined,
    trafficLightPosition: isMac ? { x: 12, y: 14 } : undefined,
    title: `Warcraft Recorder v${appVersion}`,
    webPreferences: {
      sandbox: true,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });
```

- [ ] **Step 2: Verify tsc**

```
./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: 41 or lower.

- [ ] **Step 3: Commit**

```bash
git add src/main/main.ts
git commit -m "feat(mac): use hiddenInset titlebar + native frame on darwin"
```

---

## Task 11: Menu template mac variant

**Files:**
- Modify: `src/main/menu.ts`

The existing `buildDefaultTemplate` lacks mac-standard items (App menu, Edit menu). Electron's role-based `MenuItemConstructorOptions` makes adding them trivial.

- [ ] **Step 1: Replace `src/main/menu.ts` content**

```ts
import { app, Menu, MenuItemConstructorOptions } from 'electron';

export default class MenuBuilder {
  buildMenu(): Menu {
    const template =
      process.platform === 'darwin'
        ? this.buildMacTemplate()
        : this.buildDefaultTemplate();
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    return menu;
  }

  private buildDefaultTemplate(): MenuItemConstructorOptions[] {
    const developSubmenu: MenuItemConstructorOptions[] = [
      {
        label: 'Reload',
        accelerator: 'CommandOrControl+R',
        role: 'reload',
      },
      {
        label: 'Toggle Developer Tools',
        role: 'toggleDevTools',
        accelerator: 'CommandOrControl+Shift+I',
      },
      {
        label: 'Zoom In',
        accelerator: 'CommandOrControl+Plus',
        role: 'zoomIn',
        visible: false,
        enabled: true,
      },
      {
        label: 'Zoom Out',
        accelerator: 'CommandOrControl+-',
        role: 'zoomOut',
        visible: false,
        enabled: true,
      },
      {
        label: 'Reset Zoom',
        accelerator: 'CommandOrControl+0',
        role: 'resetZoom',
        visible: false,
        enabled: true,
      },
    ];

    return [
      { label: 'View', submenu: developSubmenu, visible: false, enabled: true },
    ];
  }

  private buildMacTemplate(): MenuItemConstructorOptions[] {
    return [
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload', accelerator: 'Cmd+R' },
          { role: 'toggleDevTools', accelerator: 'Alt+Cmd+I' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' },
          { type: 'separator' },
          { role: 'front' },
        ],
      },
    ];
  }
}
```

- [ ] **Step 2: Verify tsc**

```
./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: 41 or lower.

- [ ] **Step 3: Commit**

```bash
git add src/main/menu.ts
git commit -m "feat(mac): add macOS role-based application menu template"
```

---

## Task 12: Tray template icons (manual asset provisioning)

**Files:**
- Create: `assets/icon/tray/Template.png`
- Create: `assets/icon/tray/Template@2x.png`
- Modify: `src/main/main.ts` (tray setup, around line 132-158)

Mac menu-bar icons use a monochrome "template" convention where black pixels render correctly under light and dark menu bar backgrounds. Filename suffix `Template` triggers Electron's auto-inversion.

- [ ] **Step 1: Provision the icon files**

The tray template icons must be provided as black-on-transparent PNGs. Required dimensions:
- `assets/icon/tray/Template.png` — 22×22 pixels.
- `assets/icon/tray/Template@2x.png` — 44×44 pixels.

**User action required.** The agent cannot generate binary PNG assets. Options:
1. Export from the existing `assets/icon/small-icon.png` (256×256), converted to monochrome template form, downsampled to 22/44 px. Use any macOS image tool (Preview, ImageMagick, Sketch).
2. Commission or hand-draw.

Until the real assets land, ship a placeholder: copy `assets/icon/small-icon.png` to both paths so the app can boot. The tray icon will render in colour (wrong) but the app works.

Placeholder creation (shell):

```bash
mkdir -p assets/icon/tray
cp assets/icon/small-icon.png assets/icon/tray/Template.png
cp assets/icon/small-icon.png assets/icon/tray/Template@2x.png
```

- [ ] **Step 2: Update tray setup in `src/main/main.ts`**

Find the existing tray initialisation (around line 132):

```ts
const setupTray = () => {
  tray = new Tray(getAssetPath('./icon/small-icon.png'));
```

Replace with:

```ts
const setupTray = () => {
  const isMac = process.platform === 'darwin';
  const trayIconPath = isMac
    ? getAssetPath('./icon/tray/Template.png')
    : getAssetPath('./icon/small-icon.png');
  tray = new Tray(trayIconPath);
```

The rest of the function (`setToolTip`, `setContextMenu`, etc.) stays unchanged.

- [ ] **Step 3: Verify tsc**

```
./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: 41 or lower.

- [ ] **Step 4: Commit**

```bash
git add assets/icon/tray/Template.png assets/icon/tray/Template@2x.png src/main/main.ts
git commit -m "feat(mac): use Template tray icon convention for menu bar"
```

Note in the commit or in a follow-up: the PNG assets are placeholders (copied from `small-icon.png`) until proper monochrome templates are provided.

---

## Task 13: Permissions wizard renderer UI

**Files:**
- Create: `src/renderer/permissions/PermissionsWizard.tsx`
- Create: `src/renderer/permissions/usePermissionsStatus.ts`
- Modify: `src/main/preload.ts` — expose IPC channels
- Modify: `src/renderer/preload.d.ts` — typed bridge
- Modify: `src/renderer/App.tsx` — mount wizard when blocking

The wizard is a full-screen modal that blocks the rest of the UI on macOS until Screen Recording is granted. Accessibility is shown as a non-blocking banner (hotkeys are optional). Microphone prompts are deferred to when the user configures an audio source.

- [ ] **Step 1: Expose IPC in preload**

Edit `src/main/preload.ts`. Near the existing `contextBridge.exposeInMainWorld` call, add a new channel pair:

```ts
import { contextBridge, ipcRenderer } from 'electron';
import type { ObsProperty, SceneItemPosition, SourceDimensions } from './platform/recorder/types';
import type { PermissionsSnapshot, PermissionKey } from './platform/permissions/IPermissionsGate';

// Existing exposures stay.

contextBridge.exposeInMainWorld('permissions', {
  /** Read current TCC state. Called on window focus + at startup. */
  snapshot: (): Promise<PermissionsSnapshot> => ipcRenderer.invoke('permissions:snapshot'),
  /** Open the Settings deep link for the given category. */
  openSettingsFor: (key: PermissionKey): void => ipcRenderer.send('permissions:open-settings', key),
  /** Tell main that the user clicked "Refresh" (main re-polls and broadcasts). */
  refresh: (): Promise<PermissionsSnapshot> => ipcRenderer.invoke('permissions:snapshot'),
});

contextBridge.exposeInMainWorld('platformInfo', {
  platform: process.platform,
});
```

- [ ] **Step 2: Wire IPC handlers in main**

Edit `src/main/main.ts`. Near the other `ipcMain.handle` calls (find `ipcMain.handle` with a grep — should appear near `Manager`/`Recorder` setup), add:

```ts
import { ipcMain } from 'electron';
import { getPermissionsGate } from './platform';

// Register after app is ready, alongside existing IPC handlers.
ipcMain.handle('permissions:snapshot', () => getPermissionsGate().snapshot());
ipcMain.on('permissions:open-settings', (_evt, key) => {
  getPermissionsGate().openSettingsFor(key);
});
```

Placement: these must register BEFORE the renderer loads. The existing `createWindow` registers other handlers; put these immediately after the `Recorder.getInstance().initializeObs()` call in `createWindow`, or alongside any existing `ipcMain.handle(...)` calls in `main.ts`. (Run `grep -n "ipcMain" src/main/main.ts` to find the right place.)

- [ ] **Step 3: Extend preload type declarations**

Edit `src/renderer/preload.d.ts`. Add near the other declarations:

```ts
import type { PermissionsSnapshot, PermissionKey } from 'main/platform/permissions/IPermissionsGate';

declare global {
  interface Window {
    permissions: {
      snapshot: () => Promise<PermissionsSnapshot>;
      openSettingsFor: (key: PermissionKey) => void;
      refresh: () => Promise<PermissionsSnapshot>;
    };
    platformInfo: {
      platform: NodeJS.Platform;
    };
  }
}

export {};
```

- [ ] **Step 4: React Query hook for status**

Write `src/renderer/permissions/usePermissionsStatus.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import type {
  PermissionsSnapshot,
} from 'main/platform/permissions/IPermissionsGate';

const EMPTY: PermissionsSnapshot = {
  screen: 'unknown',
  microphone: 'unknown',
  accessibility: 'unknown',
};

/**
 * Polls permission status every 2 seconds while the window is focused.
 * The user typically grants permission in System Settings then returns
 * to the app — short polling catches the transition without requiring
 * an explicit IPC event from the OS (none is available).
 */
export function usePermissionsStatus() {
  return useQuery<PermissionsSnapshot>({
    queryKey: ['permissions'],
    queryFn: () => window.permissions.snapshot(),
    refetchInterval: 2000,
    refetchIntervalInBackground: false,
    initialData: EMPTY,
  });
}
```

- [ ] **Step 5: Wizard component**

Write `src/renderer/permissions/PermissionsWizard.tsx`:

```tsx
import React from 'react';
import { usePermissionsStatus } from './usePermissionsStatus';

/**
 * First-run mac permissions wizard. Blocks the app UI until Screen
 * Recording is granted. Microphone and Accessibility are surfaced as
 * non-blocking warnings — the user can proceed without them.
 */
export default function PermissionsWizard() {
  const { data: status } = usePermissionsStatus();
  const screenGranted = status.screen === 'granted';
  const accessibilityGranted = status.accessibility === 'granted';

  if (screenGranted) return null; // wizard dismissed once screen is granted

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(17, 24, 39, 0.95)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 540,
          padding: 32,
          background: 'rgba(31, 41, 55, 1)',
          borderRadius: 8,
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>
          Permissions required
        </h1>
        <p style={{ marginBottom: 24, lineHeight: 1.5 }}>
          Warcraft Recorder needs <strong>Screen Recording</strong>{' '}
          permission to capture your gameplay. macOS gates this behind a
          system setting you must enable manually.
        </p>

        <PermissionRow
          label="Screen Recording (required)"
          status={status.screen}
          onOpen={() => window.permissions.openSettingsFor('screen')}
        />
        <PermissionRow
          label="Accessibility (for global hotkeys)"
          status={status.accessibility}
          optional
          onOpen={() => window.permissions.openSettingsFor('accessibility')}
        />

        <p style={{ marginTop: 24, fontSize: 13, opacity: 0.8 }}>
          After toggling a permission in System Settings, return to this
          window — the status will refresh automatically.
        </p>

        {!accessibilityGranted && (
          <p style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
            Without Accessibility, push-to-talk and other global hotkeys
            are disabled. You can grant it later.
          </p>
        )}
      </div>
    </div>
  );
}

function PermissionRow({
  label,
  status,
  optional,
  onOpen,
}: {
  label: string;
  status: string;
  optional?: boolean;
  onOpen: () => void;
}) {
  const granted = status === 'granted';
  const bg = granted ? '#065f46' : optional ? '#78350f' : '#991b1b';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: bg,
        padding: '12px 16px',
        borderRadius: 4,
        marginBottom: 8,
      }}
    >
      <span>{label}</span>
      <button
        type="button"
        onClick={onOpen}
        style={{
          background: 'white',
          color: 'black',
          padding: '6px 12px',
          borderRadius: 4,
          border: 'none',
          cursor: 'pointer',
          fontSize: 13,
        }}
      >
        {granted ? 'Granted ✓' : 'Open Settings'}
      </button>
    </div>
  );
}
```

Note: this component deliberately uses inline styles to keep it self-contained. Matching the rest of the app's styling (Tailwind/shadcn) is a Plan 2b polish task. Functional-first for Phase 1.

- [ ] **Step 6: Mount wizard in `App.tsx`**

Edit `src/renderer/App.tsx`. Near the top of the `App` component's return statement (wrap the existing JSX), add the wizard conditionally:

```tsx
import PermissionsWizard from './permissions/PermissionsWizard';

// Inside the App component body, before the existing return:
const isMac = window.platformInfo?.platform === 'darwin';

// Inside the return's root JSX fragment (before the existing <Layout /> or router):
{isMac && <PermissionsWizard />}
// ... existing content ...
```

(The exact wrapping depends on current `App.tsx` structure. Read the file first; insert the wizard as a sibling of the existing top-level layout. The wizard self-hides when Screen Recording is granted, so it's safe to always render it on darwin.)

- [ ] **Step 7: Verify tsc + tests**

```
./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS"
npx jest src/__tests__/platform 2>&1 | tail -5
```

Expected: tsc ≤42 (may bump slightly due to new `@tanstack/react-query` import; if the project doesn't already have it installed, check `grep @tanstack/react-query package.json`). Tests unchanged.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/permissions/ src/main/preload.ts src/main/main.ts src/renderer/preload.d.ts src/renderer/App.tsx
git commit -m "feat(mac): first-run permissions wizard + IPC plumbing"
```

---

## Task 14: Manager startup integrates permissions gate

**Files:**
- Modify: `src/main/Manager.ts`

Manager currently starts the poller + recorder unconditionally. On mac we must:
1. Check `canRecord()` before initialising the recorder — if false, skip init (wizard will prompt user, app stays idle).
2. Check `canUseGlobalHotkeys()` before starting `uIOhook` — if false, skip starting (still functional without hotkeys).

- [ ] **Step 1: Find the Manager startup entry**

Run `grep -n "startup\|uIOhook.start\|poller.start" src/main/Manager.ts` to locate the relevant functions. There's likely a single `startup()` method that kicks everything off; we extend it with permission gates.

Read the first ~50 lines of that method. Identify:
- The line that initializes or starts the `Recorder`.
- The line that starts `uIOhook` (if present in Manager; might be in `main.ts`).

- [ ] **Step 2: Add the gate import and checks**

At the top of `Manager.ts`, alongside other `main/platform` imports, add:

```ts
import { getPermissionsGate } from './platform';
```

(If Manager already imports from `./platform`, extend the existing import list.)

In the startup method, before the recorder initialization call, insert:

```ts
    const perms = getPermissionsGate();
    if (!perms.canRecord()) {
      console.warn(
        '[Manager] Screen Recording permission missing — recorder disabled until granted',
      );
      // Poller still starts (harmless on mac without TCC).
      // Recorder.getInstance().initializeObs() is skipped.
    } else {
      Recorder.getInstance().initializeObs();
    }
```

(Replace the existing unconditional `Recorder.getInstance().initializeObs()` call with this branch. If `initializeObs` is called from `main.ts` instead, apply the guard there.)

For hotkeys (uIOhook), find where `uIOhook.start()` is called (likely in `main.ts` or `Manager.ts`). Wrap:

```ts
    if (getPermissionsGate().canUseGlobalHotkeys()) {
      uIOhook.start();
    } else {
      console.warn('[Manager] Accessibility permission missing — global hotkeys disabled');
    }
```

- [ ] **Step 3: Verify tsc + tests**

```
./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS"
npx jest src/__tests__/platform 2>&1 | tail -5
```

Baseline preserved.

- [ ] **Step 4: Commit**

```bash
git add src/main/Manager.ts src/main/main.ts
git commit -m "feat(mac): gate recorder + hotkey init on TCC permission state"
```

(Include `main.ts` in the add if you modified the uIOhook call there.)

---

## Task 15: Config migration on darwin

**Files:**
- Modify: `src/config/ConfigService.ts` (or wherever first-time setup currently lives)
- Modify: `src/main/util.ts` — extend `runFirstTimeSetupActionsNoObs`

On first launch on macOS (or on a config synced from a Windows machine), the following fields need mac-appropriate defaults / migrations:
- `obsCaptureMode`: if `'game_capture'`, migrate to `'window_capture'` (Game Capture doesn't exist on mac).
- `obsRecEncoder`: if set to a Windows-only encoder (`AMD_H264`, `NVENC_H264`, etc.), migrate to `'OBS_X264'` (until VT encoders land in Plan 2b).
- `storagePath`: default to `~/Library/Application Support/WarcraftRecorder/Warcraft Recorder Videos` if empty (existing `runFirstTimeSetupActionsNoObs` in `util.ts` already defaults to `app.getPath('userData')` which IS `Library/Application Support/...` on mac — no change needed, verify).
- Log paths — Plan 1 task 14 already routed through `WowPathResolver`, which returns `/Applications/...` on mac. Verified working.

- [ ] **Step 1: Add platform check at top of first-time setup**

Edit `src/main/util.ts`. Find `runFirstTimeSetupActionsNoObs`. At the top of the function, add a pre-check that migrates stale Windows-only values:

```ts
const runFirstTimeSetupActionsNoObs = () => {
  const cfg = ConfigService.getInstance();

  // Phase 1 mac migration: kick stale Windows-only capture modes and encoders
  // off cloud-synced configs or old local configs so the app can boot cleanly.
  if (process.platform === 'darwin') {
    if (cfg.get<string>('obsCaptureMode') === 'game_capture') {
      console.info('[Util] Migrating obsCaptureMode game_capture → window_capture on macOS');
      cfg.set('obsCaptureMode', 'window_capture');
    }

    const currentEncoder = cfg.get<string>('obsRecEncoder');
    const macCompatibleEncoders = new Set([
      'OBS_X264', // only OBS_X264 in Phase 1; VT_H264/VT_HEVC added in Plan 2b
    ]);
    if (currentEncoder && !macCompatibleEncoders.has(currentEncoder)) {
      console.info('[Util] Migrating obsRecEncoder', currentEncoder, '→ OBS_X264 on macOS');
      cfg.set('obsRecEncoder', 'OBS_X264');
    }
  }

  // ... existing body of runFirstTimeSetupActionsNoObs follows unchanged ...
};
```

- [ ] **Step 2: Verify tsc + tests**

```
./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS"
npx jest 2>&1 | tail -5
```

tsc unchanged; full-suite tests may have pre-existing failures — compare count to Plan 1 baseline.

- [ ] **Step 3: Commit**

```bash
git add src/main/util.ts
git commit -m "feat(mac): migrate stale capture mode + encoder on darwin first-time setup"
```

---

## Task 16: Final verification + launch smoke

**Files:** (verification only)

The whole point of Phase 1 is "app launches on mac, permissions prompt fires, no recording." This task runs it.

- [ ] **Step 1: Dep install check**

```
npm install 2>&1 | tail -10
cd release/app && npm install 2>&1 | tail -10 && cd -
```

Expected: exits cleanly. `noobs` may log `SKIPPING OPTIONAL DEPENDENCY` — that's the desired behaviour.

- [ ] **Step 2: Electron-rebuild for native deps**

```
npm run rebuild 2>&1 | tail -20
```

Expected: `uiohook-napi` rebuilds for the current Electron ABI on darwin. If rebuild fails for a specific module, capture the error and report.

- [ ] **Step 3: Full tsc + lint + test pass**

```
./node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -c "error TS"
npm run lint 2>&1 | tail -1
npx jest src/__tests__/platform 2>&1 | tail -5
```

Targets:
- tsc: ≤42 (close to baseline of 41).
- lint: ≤40.
- platform tests: ≥23 passed.

- [ ] **Step 4: Dev build launches**

```
npm start 2>&1 | tee /tmp/wcr-launch.log &
APP_PID=$!
sleep 15
# Check the log for obvious errors.
grep -iE "error|fatal|uncaught" /tmp/wcr-launch.log | head -20
# Verify the Electron renderer process exists.
ps -p $APP_PID && echo "App running OK"
kill $APP_PID 2>/dev/null || true
```

Pass criteria:
- App process is alive after 15 s.
- No `Uncaught` exceptions in the log.
- Log contains a message like `[Manager] Screen Recording permission missing` (first launch, before user grants) OR the app launches silently with recorder idle.

If the app crashes at startup, triage:
- `Error: OsnBackend not yet implemented` — something in Manager/Recorder started the recorder despite `canRecord()` returning false. Fix the guard in Task 14.
- `Cannot find module 'noobs'` at runtime — NoobsBackend is being instantiated on darwin. Check `src/main/platform/index.ts` — the `isMac` branch should pick `OsnBackend`.
- `Cannot find module '@tanstack/react-query'` — the renderer uses it in `usePermissionsStatus`; verify it's listed in the top-level `package.json`. If missing, add via `npm install @tanstack/react-query` and commit the lockfile change.

- [ ] **Step 5: Manual verification checklist**

The agent cannot tick these — report them to the user for confirmation:

- [ ] App window opens with native mac traffic-light controls (top-left).
- [ ] App menu bar shows `WarcraftRecorder` / `Edit` / `View` / `Window` menus.
- [ ] Tray icon appears in the menu bar (colour — Template asset is a placeholder).
- [ ] PermissionsWizard overlay is visible (before Screen Recording is granted).
- [ ] Clicking "Open Settings" opens System Settings → Privacy → Screen Recording.
- [ ] After granting, clicking back to the app → wizard auto-dismisses within 2s.
- [ ] After dismissing, the app shows its normal UI (recording is disabled but nothing crashes).

- [ ] **Step 6: Summary commit (if any strays)**

```
git status --short
```

If anything unstaged is the result of a prior task's slip (lockfile regen, prettier auto-fix, etc), commit it with a tidy message:

```bash
git add -A
git commit -m "chore(phase1): housekeeping (lockfile / formatting)"
```

If clean, skip this step.

---

## Rollback

If any Task 1–15 test fails and is not recoverable with a bugfix in-task:

1. `git log --oneline -20` to find the last good commit.
2. `git reset --hard <sha>` — branch isn't pushed with anything others rely on.
3. Triage in isolation before retry.

If Task 16 launch smoke fails, it is usually the integration of multiple smaller pieces. Before rolling back, read the Electron log carefully — the failure is almost always one misnamed IPC channel, a missing gate, or a wrong import path. Root-cause fix, don't revert.

---

## What's NOT in this plan (explicit scope boundaries)

- **Real OSN recording** — `OsnBackend` stub body replaced in Plan 2b.
- **obs-studio-node install** — deferred to Plan 2b. The factory references `OsnBackend` (a pure TS class with no native deps) but the class never touches `obs-studio-node`.
- **macOS ffmpeg static binary shipping** — deferred to Plan 2b or Plan 3. Phase 1 recording is disabled; ffmpeg is only used by `VideoProcessQueue`, which runs after recordings — none happen.
- **DMG / notarization / entitlements beyond existing** — Plan 3.
- **Tray `Template.png` final artwork** — placeholder only; user provides real art.
- **Localisation for wizard strings** — English only. Plan 2b (or a dedicated L10N pass) adds other languages.
- **Python E2E + Playwright harness cross-platform** — Plan 4.
- **Styling the wizard with Tailwind/shadcn** — Plan 2b. Phase 1 uses inline styles for speed.

---

## Notes for Plan 2b

After this plan completes:

- `src/main/platform/recorder/OsnBackend.ts` exists as a stub. Plan 2b replaces the body with real `obs-studio-node` calls while keeping the interface identical.
- `release/app/package.json` gets `obs-studio-node` added as a mac-only dep (ideally behind `optionalDependencies` + platform guard).
- `src/main/platform/ffmpeg/MacFfmpegPathProvider.ts` expects `<resourcesPath>/binaries/ffmpeg` — Plan 2b adds that universal static binary under `extraResources`.
- `CaptureModeCapability.GAME` is declared but omitted from `OsnBackend.capabilities.captureModes` — renderer UI hides it on darwin automatically.
- Capability-driven rendering in `VideoSourceControls.tsx` / `VideoBaseControls.tsx` — Plan 2b work, when real encoders are available.
