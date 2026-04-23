# macOS Port — Phase 0: Platform Interface Extraction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract every platform-coupled call in the main process (OBS via `noobs`, process poller, WoW install paths, file reveal, ffmpeg path) behind small adapter interfaces, with a Windows implementation for each. Zero behavior change — ships to Windows users as a pure refactor that unblocks later macOS adapters.

**Architecture:** Introduce `src/main/platform/` containing one folder per adapter: `recorder/`, `poller/`, `paths/`, `files/`, `ffmpeg/`. Each folder holds an `I<Name>.ts` interface plus a `Win<Name>.ts` implementation. A thin `src/main/platform/index.ts` module exposes `getRecorderBackend()`, `getProcessPoller()`, `getWowPathResolver()`, `getFileReveal()`, `getFfmpegPathProvider()` factory functions that pick the right implementation by `process.platform`. Existing call sites (`Recorder.ts`, `Poller.ts`, `util.ts`, `VideoProcessQueue.ts`) stop importing `noobs` / hardcoded paths / shelling out directly and go through the factory.

**Tech Stack:** TypeScript 5, Electron 38, Node 20, Jest + ts-jest, ESLint flat config, webpack via electron-react-boilerplate. Pre-existing deps only — no new runtime dependencies.

**Scope boundary:** This plan is Windows-only. No macOS code, no `process.platform === 'darwin'` branches. The factory in `index.ts` returns the Windows implementation unconditionally for now; Plan 2 will add mac implementations and platform dispatch logic.

**Spec reference:** `docs/superpowers/specs/2026-04-22-macos-port-design.md` §3 (architecture), §4 (recorder backend), §6 (paths / poller / files / ffmpeg), §11 Phase 0.

---

## Pre-flight checklist

- [ ] **P1. Confirm branch**

Run: `git branch --show-current`
Expected: `feat/macos-port`

If the output is anything else, stop and switch: `git checkout feat/macos-port`.

- [ ] **P2. Confirm working tree clean**

Run: `git status --short`
Expected: empty output, or only the `.gitignore` / `skills-lock.json` modifications that existed before this plan started. No other modified files.

- [ ] **P3. Confirm dependencies installed**

Run: `npm ls noobs uiohook-napi --depth=0 2>&1 | head -20`
Expected: both packages resolved (e.g. `noobs@0.0.184`, `uiohook-napi@1.5.2`). If either is missing, run `npm install` before continuing.

- [ ] **P4. Baseline lint + type-check**

Run: `npm run lint 2>&1 | tail -5`
Expected: exits clean (non-zero exit = pre-existing failure; snapshot the output and note it — we'll compare against it at the end of the plan to prove we didn't regress).

Run: `npx tsc --noEmit 2>&1 | tail -20`
Expected: clean or only pre-existing errors. Snapshot the count: `npx tsc --noEmit 2>&1 | grep -c "error TS"` — we'll re-run at the end and expect the same number.

---

## File structure

New files (all paths absolute to repo root):

```
src/main/platform/
  index.ts                                  # factory + platform detector
  recorder/
    types.ts                                # re-export noobs types for platform-neutral imports
    IRecorderBackend.ts                     # interface + RecorderCapabilities
    NoobsBackend.ts                         # Windows impl wrapping `noobs`
  poller/
    IProcessPoller.ts                       # interface
    WinRustPsPoller.ts                      # Windows impl wrapping rust-ps.exe
  paths/
    IWowPathResolver.ts                     # interface
    WinWowPathResolver.ts                   # Windows impl (drive letter scan)
  files/
    IFileReveal.ts                          # interface
    WinFileReveal.ts                        # Windows impl (explorer.exe /select)
  ffmpeg/
    IFfmpegPathProvider.ts                  # interface
    WinFfmpegPathProvider.ts                # Windows impl (noobs/dist/bin/ffmpeg.exe)

src/__tests__/platform/
  WinRustPsPoller.test.ts
  WinWowPathResolver.test.ts
  WinFileReveal.test.ts
  WinFfmpegPathProvider.test.ts
  PlatformFactory.test.ts                   # factory returns Win* impls on win32
```

Modified files:

```
src/main/Recorder.ts                        # replace direct `noobs.*` with `this.backend.*`
src/utils/Poller.ts                         # delegate to IProcessPoller
src/main/util.ts                            # line 313 (file reveal) + line 1103-1140 (first-time setup paths)
src/main/VideoProcessQueue.ts               # line 37-45 (ffmpeg path)
src/main/preload.ts                         # swap `from 'noobs'` to platform types
src/renderer/preload.d.ts                   # swap `from 'noobs'` to platform types
src/renderer/AudioSourceControls.tsx        # swap `from 'noobs'` to platform types
```

No deletions in this plan. `import noobs from 'noobs'` remains in `NoobsBackend.ts` only — every other file loses direct noobs coupling.

---

## Task 1: Create platform-neutral type re-exports

**Files:**
- Create: `src/main/platform/recorder/types.ts`

Downstream renderer files (`preload.d.ts`, `AudioSourceControls.tsx`) currently `import { ObsProperty, SceneItemPosition, SourceDimensions, ObsListItem } from 'noobs'`. On macOS those types will come from `obs-studio-node`. Re-exporting them through a platform module lets renderer imports stay stable across platforms.

- [ ] **Step 1: Create the types module**

Write to `src/main/platform/recorder/types.ts`:

```ts
/**
 * Platform-neutral re-exports of recorder backend types.
 * Renderer and main-process callers import from here instead of a
 * specific native binding, so the active backend can be swapped by
 * platform without changes to consumers.
 */
export type {
  ObsData,
  ObsListItem,
  ObsProperty,
  SceneItemPosition,
  Signal,
  SourceDimensions,
} from 'noobs';
```

- [ ] **Step 2: Verify type-check passes**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: same count as the P4 baseline (no new errors).

- [ ] **Step 3: Commit**

```bash
git add src/main/platform/recorder/types.ts
git commit -m "refactor(platform): add type re-exports for recorder backend"
```

---

## Task 2: Define the recorder backend interface

**Files:**
- Create: `src/main/platform/recorder/IRecorderBackend.ts`

This interface must cover **every** `noobs.*` call site in `src/main/Recorder.ts` (86 call sites across 21 distinct methods). Method names match noobs names exactly so the later `NoobsBackend` is a thin pass-through. Captures are modeled as capabilities so renderer code can drive UI without platform branching.

- [ ] **Step 1: Create the interface file**

Write to `src/main/platform/recorder/IRecorderBackend.ts`:

```ts
import type {
  ObsData,
  ObsProperty,
  SceneItemPosition,
  Signal,
  SourceDimensions,
} from './types';

/**
 * Recording-backend feature flags. Renderer reads these via IPC so the
 * Settings UI can show only options supported on the current platform.
 */
export interface RecorderCapabilities {
  /** Capture source types this backend can create. */
  captureModes: Array<'game_capture' | 'window_capture' | 'monitor_capture'>;
  /** Encoder ids (ESupportedEncoders values) this backend exposes. */
  encoders: string[];
  /** Whether libobs replay buffer is supported. */
  supportsReplayBuffer: boolean;
}

export type SignalCallback = (signal: Signal) => void;

/**
 * Abstract recorder backend. Windows implementation wraps `noobs`;
 * macOS implementation wraps `obs-studio-node` (added in a later plan).
 * Method shapes mirror the underlying `noobs` surface to keep the
 * Windows pass-through trivial.
 */
export interface IRecorderBackend {
  capabilities: RecorderCapabilities;

  // Lifecycle
  init(noobsPath: string, logPath: string, signalCallback: SignalCallback): void;
  initPreview(windowHandle: Buffer): void;
  shutdown(): void;
  setBuffering(enabled: boolean): void;
  setDrawSourceOutline(enabled: boolean): void;

  // Video context
  resetVideoContext(fps: number, width: number, height: number): void;
  getPreviewInfo(): { canvasWidth: number; canvasHeight: number };

  // Preview window
  configurePreview(x: number, y: number, width: number, height: number): void;
  showPreview(): void;
  hidePreview(): void;
  disablePreview(): void;

  // Recording output
  setRecordingCfg(outputPath: string, container: string): void;
  setVideoEncoder(encoder: string, settings: ObsData): void;
  listVideoEncoders(): string[];

  // Sources
  createSource(id: string, type: string): string;
  deleteSource(id: string): void;
  addSourceToScene(name: string): void;
  removeSourceFromScene(name: string): void;
  getSourceSettings(id: string): ObsData;
  setSourceSettings(id: string, settings: ObsData): void;
  getSourceProperties(id: string): ObsProperty[];
  getSourcePos(id: string): SceneItemPosition & SourceDimensions;
  setSourcePos(id: string, pos: SceneItemPosition): void;
  setSourceVolume(id: string, volume: number): void;

  // Audio
  setVolmeterEnabled(enabled: boolean): void;
  setForceMono(enabled: boolean): void;
  setAudioSuppression(enabled: boolean): void;
  setMuteAudioInputs(muted: boolean): void;

  // Recording lifecycle
  startBuffer(): void;
  startRecording(offsetSeconds: number): void;
  stopRecording(): void;
  forceStopRecording(): void;
  getLastRecording(): string;
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: same count as the P4 baseline.

- [ ] **Step 3: Commit**

```bash
git add src/main/platform/recorder/IRecorderBackend.ts
git commit -m "refactor(platform): define IRecorderBackend interface"
```

---

## Task 3: Implement NoobsBackend (Windows recorder backend)

**Files:**
- Create: `src/main/platform/recorder/NoobsBackend.ts`

Pass-through wrapper around `noobs`. Exactly one file in the repo still imports `noobs` directly after this plan is complete: this one. `ESupportedEncoders` values come from the existing `src/main/obsEnums.ts` — keep the list in sync with the enum.

- [ ] **Step 1: Create the backend file**

Write to `src/main/platform/recorder/NoobsBackend.ts`:

```ts
import noobs from 'noobs';
import { ESupportedEncoders } from 'main/obsEnums';
import type {
  ObsData,
  ObsProperty,
  SceneItemPosition,
  Signal,
  SourceDimensions,
} from './types';
import type {
  IRecorderBackend,
  RecorderCapabilities,
  SignalCallback,
} from './IRecorderBackend';

/**
 * Windows recorder backend. Thin pass-through to the `noobs` native module.
 * Any noobs-specific quirk (signal wiring, path fixing, process-name filters)
 * stays in Recorder.ts — this class is deliberately mechanical.
 */
export default class NoobsBackend implements IRecorderBackend {
  public readonly capabilities: RecorderCapabilities = {
    captureModes: ['game_capture', 'window_capture', 'monitor_capture'],
    encoders: [
      ESupportedEncoders.OBS_X264,
      ESupportedEncoders.AMD_H264,
      ESupportedEncoders.AMD_AV1,
      ESupportedEncoders.NVENC_H264,
      ESupportedEncoders.NVENC_AV1,
      ESupportedEncoders.QSV_H264,
      ESupportedEncoders.QSV_AV1,
    ],
    supportsReplayBuffer: true,
  };

  // Lifecycle
  init(noobsPath: string, logPath: string, cb: SignalCallback): void {
    noobs.Init(noobsPath, logPath, cb as (s: Signal) => void);
  }
  initPreview(hwnd: Buffer): void { noobs.InitPreview(hwnd); }
  shutdown(): void { noobs.Shutdown(); }
  setBuffering(enabled: boolean): void { noobs.SetBuffering(enabled); }
  setDrawSourceOutline(enabled: boolean): void { noobs.SetDrawSourceOutline(enabled); }

  // Video context
  resetVideoContext(fps: number, width: number, height: number): void {
    noobs.ResetVideoContext(fps, width, height);
  }
  getPreviewInfo(): { canvasWidth: number; canvasHeight: number } {
    return noobs.GetPreviewInfo();
  }

  // Preview window
  configurePreview(x: number, y: number, width: number, height: number): void {
    noobs.ConfigurePreview(x, y, width, height);
  }
  showPreview(): void { noobs.ShowPreview(); }
  hidePreview(): void { noobs.HidePreview(); }
  disablePreview(): void { noobs.DisablePreview(); }

  // Recording output
  setRecordingCfg(outputPath: string, container: string): void {
    noobs.SetRecordingCfg(outputPath, container);
  }
  setVideoEncoder(encoder: string, settings: ObsData): void {
    noobs.SetVideoEncoder(encoder, settings);
  }
  listVideoEncoders(): string[] {
    return noobs.ListVideoEncoders();
  }

  // Sources
  createSource(id: string, type: string): string {
    return noobs.CreateSource(id, type);
  }
  deleteSource(id: string): void { noobs.DeleteSource(id); }
  addSourceToScene(name: string): void { noobs.AddSourceToScene(name); }
  removeSourceFromScene(name: string): void { noobs.RemoveSourceFromScene(name); }
  getSourceSettings(id: string): ObsData {
    return noobs.GetSourceSettings(id);
  }
  setSourceSettings(id: string, settings: ObsData): void {
    noobs.SetSourceSettings(id, settings);
  }
  getSourceProperties(id: string): ObsProperty[] {
    return noobs.GetSourceProperties(id);
  }
  getSourcePos(id: string): SceneItemPosition & SourceDimensions {
    return noobs.GetSourcePos(id);
  }
  setSourcePos(id: string, pos: SceneItemPosition): void {
    noobs.SetSourcePos(id, pos);
  }
  setSourceVolume(id: string, volume: number): void {
    noobs.SetSourceVolume(id, volume);
  }

  // Audio
  setVolmeterEnabled(enabled: boolean): void { noobs.SetVolmeterEnabled(enabled); }
  setForceMono(enabled: boolean): void { noobs.SetForceMono(enabled); }
  setAudioSuppression(enabled: boolean): void { noobs.SetAudioSuppression(enabled); }
  setMuteAudioInputs(muted: boolean): void { noobs.SetMuteAudioInputs(muted); }

  // Recording lifecycle
  startBuffer(): void { noobs.StartBuffer(); }
  startRecording(offsetSeconds: number): void { noobs.StartRecording(offsetSeconds); }
  stopRecording(): void { noobs.StopRecording(); }
  forceStopRecording(): void { noobs.ForceStopRecording(); }
  getLastRecording(): string { return noobs.GetLastRecording(); }
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: same count as the P4 baseline. If new errors appear they are almost certainly name/signature mismatches against the real `noobs` typings — inspect `node_modules/noobs/dist/index.d.ts` and reconcile.

- [ ] **Step 3: Commit**

```bash
git add src/main/platform/recorder/NoobsBackend.ts
git commit -m "refactor(platform): add NoobsBackend Windows impl"
```

---

## Task 4: Define the process poller interface

**Files:**
- Create: `src/main/platform/poller/IProcessPoller.ts`

Current `src/utils/Poller.ts` extends `EventEmitter` and emits `WowProcessEvent.STARTED` / `STOPPED`. The interface preserves that contract so callers (`Manager`) are untouched in Phase 0.

- [ ] **Step 1: Create the interface**

Write to `src/main/platform/poller/IProcessPoller.ts`:

```ts
import type EventEmitter from 'events';

/**
 * Periodically reports whether any WoW client process is running.
 * Emits 'started' / 'stopped' on transitions. Consumers (Manager)
 * attach listeners via the EventEmitter interface.
 */
export interface IProcessPoller extends EventEmitter {
  start(): void;
  stop(): void;
  isWowRunning(): boolean;
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: same count as the P4 baseline.

- [ ] **Step 3: Commit**

```bash
git add src/main/platform/poller/IProcessPoller.ts
git commit -m "refactor(platform): define IProcessPoller interface"
```

---

## Task 5: Implement WinRustPsPoller

**Files:**
- Create: `src/main/platform/poller/WinRustPsPoller.ts`
- Create: `src/__tests__/platform/WinRustPsPoller.test.ts`

Lifts the `rust-ps.exe`-spawning logic out of the existing `src/utils/Poller.ts` into a standalone class that implements `IProcessPoller`. The existing `Poller` singleton becomes a thin wrapper (Task 13).

- [ ] **Step 1: Write failing unit test**

Write to `src/__tests__/platform/WinRustPsPoller.test.ts`:

```ts
import { EventEmitter } from 'events';
import type { ChildProcessWithoutNullStreams } from 'child_process';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('electron', () => ({
  app: { isPackaged: false },
}));

jest.mock('config/ConfigService', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({
      get: jest.fn((key: string) => {
        if (key === 'recordRetail') return true;
        if (key === 'recordClassic') return false;
        if (key === 'recordEra') return false;
        return undefined;
      }),
    }),
  },
}));

import { spawn } from 'child_process';
import WinRustPsPoller from 'main/platform/poller/WinRustPsPoller';
import { WowProcessEvent } from 'main/types';

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = jest.fn();
}

describe('WinRustPsPoller', () => {
  beforeEach(() => {
    (spawn as jest.Mock).mockReset();
  });

  it('emits STARTED when Retail is detected and recordRetail is true', (done) => {
    const child = new FakeChild();
    (spawn as jest.Mock).mockReturnValue(child as unknown as ChildProcessWithoutNullStreams);

    const poller = new WinRustPsPoller();
    poller.on(WowProcessEvent.STARTED, () => {
      expect(poller.isWowRunning()).toBe(true);
      done();
    });

    poller.start();
    child.stdout.emit('data', JSON.stringify({ Retail: true, Classic: false }));
  });

  it('emits STOPPED after STARTED when Retail disappears', (done) => {
    const child = new FakeChild();
    (spawn as jest.Mock).mockReturnValue(child as unknown as ChildProcessWithoutNullStreams);

    const poller = new WinRustPsPoller();
    const events: string[] = [];
    poller.on(WowProcessEvent.STARTED, () => events.push('started'));
    poller.on(WowProcessEvent.STOPPED, () => {
      events.push('stopped');
      expect(events).toEqual(['started', 'stopped']);
      done();
    });

    poller.start();
    child.stdout.emit('data', JSON.stringify({ Retail: true, Classic: false }));
    child.stdout.emit('data', JSON.stringify({ Retail: false, Classic: false }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/platform/WinRustPsPoller.test.ts -c '{"transform":{"\\.(ts|tsx|js|jsx)$":"ts-jest"},"moduleDirectories":["node_modules","src"]}' 2>&1 | tail -20`
Expected: FAIL — either "Cannot find module 'main/platform/poller/WinRustPsPoller'" or similar resolution error.

(If the Jest CLI shape conflicts with the repo's existing config, instead run `npx jest src/__tests__/platform/WinRustPsPoller.test.ts 2>&1 | tail -20` — the top-level `jest` config in `package.json` sets the transform already; the `moduleDirectories` just needs to resolve `main/...` imports via `tsconfig.json`'s `baseUrl: "./src"`. If resolution fails, add `moduleDirectories: ['node_modules', 'src']` to the top-level Jest config in `package.json > jest` as part of this step.)

- [ ] **Step 3: Implement the poller**

Write to `src/main/platform/poller/WinRustPsPoller.ts`:

```ts
import EventEmitter from 'events';
import path from 'path';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { app } from 'electron';
import ConfigService from 'config/ConfigService';
import { WowProcessEvent } from 'main/types';
import type { IProcessPoller } from './IProcessPoller';

/**
 * Windows process poller. Spawns the `rust-ps.exe` binary shipped with
 * the app, which periodically emits `{"Retail":bool,"Classic":bool}`
 * JSON on stdout.
 */
export default class WinRustPsPoller extends EventEmitter implements IProcessPoller {
  private cfg = ConfigService.getInstance();
  private wowRunning = false;
  private child: ChildProcessWithoutNullStreams | undefined;

  private readonly binary = app.isPackaged
    ? path.join(process.resourcesPath, 'binaries', 'rust-ps.exe')
    : path.join(__dirname, '../../../../binaries', 'rust-ps.exe');

  isWowRunning(): boolean {
    return this.wowRunning;
  }

  start(): void {
    this.stop();
    console.info('[WinRustPsPoller] Start');
    this.child = spawn(this.binary);
    this.child.stdout.on('data', this.handleStdout);
    this.child.stderr.on('data', this.handleStderr);
  }

  stop(): void {
    console.info('[WinRustPsPoller] Stop');
    this.wowRunning = false;
    if (this.child) {
      this.child.kill();
      this.child = undefined;
    }
  }

  private handleStdout = (data: string | Buffer) => {
    let parsed: { Retail?: boolean; Classic?: boolean };
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      return; // multi-JSON blobs on resume from sleep; ignore
    }

    const { Retail = false, Classic = false } = parsed;
    const recordRetail = this.cfg.get<boolean>('recordRetail');
    const recordClassic = this.cfg.get<boolean>('recordClassic');
    const recordEra = this.cfg.get<boolean>('recordEra');

    const running =
      (recordRetail && Retail) ||
      (recordClassic && Classic) ||
      (recordEra && Classic);

    if (this.wowRunning === running) return;

    if (running) this.emit(WowProcessEvent.STARTED);
    else this.emit(WowProcessEvent.STOPPED);

    this.wowRunning = running;
  };

  private handleStderr = (data: string | Buffer) => {
    console.warn('[WinRustPsPoller] stderr:', data.toString());
  };
}
```

Note the `binary` path: `__dirname` in the compiled main-process bundle is `dist/main/`, so the relative path to the source-tree `binaries/rust-ps.exe` is `../../../../binaries/rust-ps.exe` (four levels up). Verify by comparing to the current `src/utils/Poller.ts:38-39` values — the difference is that `Poller.ts` lives one directory higher, so the existing `'../../binaries'` becomes `'../../../../binaries'` in the new location.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/platform/WinRustPsPoller.test.ts 2>&1 | tail -10`
Expected: `Tests: 2 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/main/platform/poller/WinRustPsPoller.ts src/__tests__/platform/WinRustPsPoller.test.ts
git commit -m "refactor(platform): add WinRustPsPoller impl + unit tests"
```

If you had to modify `package.json > jest` to add `moduleDirectories`, include `package.json` in the add.

---

## Task 6: Define the WoW path resolver interface

**Files:**
- Create: `src/main/platform/paths/IWowPathResolver.ts`

- [ ] **Step 1: Create the interface**

Write to `src/main/platform/paths/IWowPathResolver.ts`:

```ts
export type WowFlavour = 'retail' | 'classic' | 'classic_era' | 'classic_ptr';

/**
 * Locates the per-flavour `Logs` folder for a WoW installation.
 * Used during first-time setup to auto-configure log paths.
 */
export interface IWowPathResolver {
  /** Roots under which WoW installations are expected to exist. */
  searchRoots(): string[];
  /** Join a root + flavour to produce the absolute Logs directory. */
  joinLogPath(root: string, flavour: WowFlavour): string;
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: same count as the P4 baseline.

- [ ] **Step 3: Commit**

```bash
git add src/main/platform/paths/IWowPathResolver.ts
git commit -m "refactor(platform): define IWowPathResolver interface"
```

---

## Task 7: Implement WinWowPathResolver

**Files:**
- Create: `src/main/platform/paths/WinWowPathResolver.ts`
- Create: `src/__tests__/platform/WinWowPathResolver.test.ts`

Source of truth for the existing `wowInstallSearchPaths` constant currently in `src/main/constants.ts:1836`. Move the Windows list behind this impl so `constants.ts` can stay a Windows-flavoured fallback. Keep the export in `constants.ts` intact for now — this plan does not delete it — but switch the live caller in `util.ts` to the resolver.

- [ ] **Step 1: Write failing unit test**

Write to `src/__tests__/platform/WinWowPathResolver.test.ts`:

```ts
import WinWowPathResolver from 'main/platform/paths/WinWowPathResolver';

describe('WinWowPathResolver', () => {
  const r = new WinWowPathResolver();

  it('includes C: and D: Program Files variants', () => {
    const roots = r.searchRoots();
    expect(roots).toContain('C:\\Program Files\\World of Warcraft');
    expect(roots).toContain('D:\\World of Warcraft');
  });

  it('joins a retail log path with Windows backslashes', () => {
    const joined = r.joinLogPath('C:\\World of Warcraft', 'retail');
    expect(joined).toBe('C:\\World of Warcraft\\_retail_\\Logs');
  });

  it('joins a classic_era log path', () => {
    const joined = r.joinLogPath('D:\\World of Warcraft', 'classic_era');
    expect(joined).toBe('D:\\World of Warcraft\\_classic_era_\\Logs');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/platform/WinWowPathResolver.test.ts 2>&1 | tail -10`
Expected: FAIL — "Cannot find module 'main/platform/paths/WinWowPathResolver'".

- [ ] **Step 3: Implement the resolver**

Write to `src/main/platform/paths/WinWowPathResolver.ts`:

```ts
import type { IWowPathResolver, WowFlavour } from './IWowPathResolver';

const FLAVOUR_DIR: Record<WowFlavour, string> = {
  retail: '_retail_',
  classic: '_classic_',
  classic_era: '_classic_era_',
  classic_ptr: '_classic_ptr_',
};

/**
 * Windows WoW path resolver. Scans the common drive-letter install
 * locations Battle.net uses on Windows.
 */
export default class WinWowPathResolver implements IWowPathResolver {
  searchRoots(): string[] {
    return [
      'C:\\World of Warcraft',
      'C:\\Program Files\\World of Warcraft',
      'C:\\Program Files (x86)\\World of Warcraft',
      'D:\\World of Warcraft',
      'D:\\Program Files\\World of Warcraft',
      'D:\\Program Files (x86)\\World of Warcraft',
      'E:\\World of Warcraft',
      'E:\\Program Files\\World of Warcraft',
      'E:\\Program Files (x86)\\World of Warcraft',
    ];
  }

  joinLogPath(root: string, flavour: WowFlavour): string {
    return `${root}\\${FLAVOUR_DIR[flavour]}\\Logs`;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/platform/WinWowPathResolver.test.ts 2>&1 | tail -10`
Expected: `Tests: 3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/main/platform/paths/WinWowPathResolver.ts src/__tests__/platform/WinWowPathResolver.test.ts
git commit -m "refactor(platform): add WinWowPathResolver impl + unit tests"
```

---

## Task 8: Define + implement file reveal

**Files:**
- Create: `src/main/platform/files/IFileReveal.ts`
- Create: `src/main/platform/files/WinFileReveal.ts`
- Create: `src/__tests__/platform/WinFileReveal.test.ts`

Tiny adapter. Current callsite in `src/main/util.ts:310-316` spawns `explorer.exe /select,"..."`. macOS equivalent will spawn `open -R` later.

- [ ] **Step 1: Create the interface**

Write to `src/main/platform/files/IFileReveal.ts`:

```ts
/**
 * Reveals a file in the platform's file manager, selecting it.
 * Windows: explorer.exe /select,<path>
 * macOS:   open -R <path>
 */
export interface IFileReveal {
  reveal(filePath: string): void;
}
```

- [ ] **Step 2: Write failing unit test**

Write to `src/__tests__/platform/WinFileReveal.test.ts`:

```ts
jest.mock('child_process', () => ({
  exec: jest.fn((_cmd: string, _cb: () => void) => undefined),
}));

import { exec } from 'child_process';
import WinFileReveal from 'main/platform/files/WinFileReveal';

describe('WinFileReveal', () => {
  beforeEach(() => {
    (exec as unknown as jest.Mock).mockReset();
  });

  it('invokes explorer.exe /select with backslash-normalised path', () => {
    const r = new WinFileReveal();
    r.reveal('C:/foo/bar/baz.mp4');
    expect(exec).toHaveBeenCalledWith(
      'explorer.exe /select,"C:\\foo\\bar\\baz.mp4"',
      expect.any(Function),
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/__tests__/platform/WinFileReveal.test.ts 2>&1 | tail -10`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Write to `src/main/platform/files/WinFileReveal.ts`:

```ts
import { exec } from 'child_process';
import type { IFileReveal } from './IFileReveal';

/** Windows file reveal — opens Explorer with the file highlighted. */
export default class WinFileReveal implements IFileReveal {
  reveal(filePath: string): void {
    const windowsPath = filePath.replace(/\//g, '\\');
    const cmd = `explorer.exe /select,"${windowsPath}"`;
    exec(cmd, () => {});
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/__tests__/platform/WinFileReveal.test.ts 2>&1 | tail -10`
Expected: `Tests: 1 passed`.

- [ ] **Step 6: Commit**

```bash
git add src/main/platform/files/IFileReveal.ts src/main/platform/files/WinFileReveal.ts src/__tests__/platform/WinFileReveal.test.ts
git commit -m "refactor(platform): add IFileReveal + WinFileReveal"
```

---

## Task 9: Define + implement ffmpeg path provider

**Files:**
- Create: `src/main/platform/ffmpeg/IFfmpegPathProvider.ts`
- Create: `src/main/platform/ffmpeg/WinFfmpegPathProvider.ts`
- Create: `src/__tests__/platform/WinFfmpegPathProvider.test.ts`

Wraps the current dev/prod path derivation in `VideoProcessQueue.ts:37-45`. Current Windows behavior: reuse the `ffmpeg.exe` shipped in `node_modules/noobs/dist/bin/`.

- [ ] **Step 1: Create the interface**

Write to `src/main/platform/ffmpeg/IFfmpegPathProvider.ts`:

```ts
/**
 * Provides the absolute path to the ffmpeg binary to use for
 * post-processing (cutting, remuxing) of recorded files.
 */
export interface IFfmpegPathProvider {
  getPath(): string;
}
```

- [ ] **Step 2: Write failing unit test**

Write to `src/__tests__/platform/WinFfmpegPathProvider.test.ts`:

```ts
jest.mock('main/util', () => ({
  fixPathWhenPackaged: (p: string) => p,
}));

import path from 'path';
import WinFfmpegPathProvider from 'main/platform/ffmpeg/WinFfmpegPathProvider';

describe('WinFfmpegPathProvider', () => {
  it('returns a path ending in noobs/dist/bin/ffmpeg.exe', () => {
    const p = new WinFfmpegPathProvider().getPath();
    expect(p.replace(/\\/g, '/')).toContain('noobs/dist/bin/ffmpeg.exe');
    expect(path.isAbsolute(p)).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/__tests__/platform/WinFfmpegPathProvider.test.ts 2>&1 | tail -10`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Write to `src/main/platform/ffmpeg/WinFfmpegPathProvider.ts`:

```ts
import path from 'path';
import { fixPathWhenPackaged } from 'main/util';
import type { IFfmpegPathProvider } from './IFfmpegPathProvider';

const devMode = process.env.NODE_ENV === 'development';
const REL = 'node_modules/noobs/dist/bin/ffmpeg.exe';

/**
 * Windows ffmpeg path. Reuses the ffmpeg.exe dynamically linked by the
 * noobs bundle so we don't ship a duplicate ~60 MB binary.
 */
export default class WinFfmpegPathProvider implements IFfmpegPathProvider {
  getPath(): string {
    const abs = devMode
      ? path.resolve(__dirname, '../../../../release/app/', REL)
      : path.resolve(__dirname, '../../../../', REL);
    return fixPathWhenPackaged(abs);
  }
}
```

Note: `__dirname` is deeper than in `VideoProcessQueue.ts`, so the relative prefix is `../../../../` (four levels) instead of `../../` (two levels). The reference value is: current `VideoProcessQueue.ts:41` uses `../../release/app/` from `dist/main/`. This file lives at `dist/main/platform/ffmpeg/` (two levels deeper), so prefix gains two `../` — hence four total.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/__tests__/platform/WinFfmpegPathProvider.test.ts 2>&1 | tail -10`
Expected: `Tests: 1 passed`.

- [ ] **Step 6: Commit**

```bash
git add src/main/platform/ffmpeg/IFfmpegPathProvider.ts src/main/platform/ffmpeg/WinFfmpegPathProvider.ts src/__tests__/platform/WinFfmpegPathProvider.test.ts
git commit -m "refactor(platform): add IFfmpegPathProvider + WinFfmpegPathProvider"
```

---

## Task 10: Create the platform factory

**Files:**
- Create: `src/main/platform/index.ts`
- Create: `src/__tests__/platform/PlatformFactory.test.ts`

Single entry point. All call sites go through the factory. For Phase 0 every factory unconditionally returns the Windows impl (no `process.platform` branch yet — Plan 2 adds that).

- [ ] **Step 1: Write failing unit test**

Write to `src/__tests__/platform/PlatformFactory.test.ts`:

```ts
import {
  getRecorderBackend,
  getProcessPoller,
  getWowPathResolver,
  getFileReveal,
  getFfmpegPathProvider,
} from 'main/platform';
import NoobsBackend from 'main/platform/recorder/NoobsBackend';
import WinRustPsPoller from 'main/platform/poller/WinRustPsPoller';
import WinWowPathResolver from 'main/platform/paths/WinWowPathResolver';
import WinFileReveal from 'main/platform/files/WinFileReveal';
import WinFfmpegPathProvider from 'main/platform/ffmpeg/WinFfmpegPathProvider';

jest.mock('noobs', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('electron', () => ({
  app: { isPackaged: false },
}));

jest.mock('config/ConfigService', () => ({
  __esModule: true,
  default: { getInstance: () => ({ get: () => undefined }) },
}));

describe('platform factory', () => {
  it('returns NoobsBackend for the recorder backend', () => {
    expect(getRecorderBackend()).toBeInstanceOf(NoobsBackend);
  });
  it('returns WinRustPsPoller for the process poller', () => {
    expect(getProcessPoller()).toBeInstanceOf(WinRustPsPoller);
  });
  it('returns WinWowPathResolver for the WoW path resolver', () => {
    expect(getWowPathResolver()).toBeInstanceOf(WinWowPathResolver);
  });
  it('returns WinFileReveal for file reveal', () => {
    expect(getFileReveal()).toBeInstanceOf(WinFileReveal);
  });
  it('returns WinFfmpegPathProvider for ffmpeg path', () => {
    expect(getFfmpegPathProvider()).toBeInstanceOf(WinFfmpegPathProvider);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/platform/PlatformFactory.test.ts 2>&1 | tail -10`
Expected: FAIL — "Cannot find module 'main/platform'".

- [ ] **Step 3: Implement the factory**

Write to `src/main/platform/index.ts`:

```ts
import NoobsBackend from './recorder/NoobsBackend';
import WinRustPsPoller from './poller/WinRustPsPoller';
import WinWowPathResolver from './paths/WinWowPathResolver';
import WinFileReveal from './files/WinFileReveal';
import WinFfmpegPathProvider from './ffmpeg/WinFfmpegPathProvider';

import type { IRecorderBackend } from './recorder/IRecorderBackend';
import type { IProcessPoller } from './poller/IProcessPoller';
import type { IWowPathResolver } from './paths/IWowPathResolver';
import type { IFileReveal } from './files/IFileReveal';
import type { IFfmpegPathProvider } from './ffmpeg/IFfmpegPathProvider';

export type {
  IRecorderBackend,
  IProcessPoller,
  IWowPathResolver,
  IFileReveal,
  IFfmpegPathProvider,
};
export type { RecorderCapabilities, SignalCallback } from './recorder/IRecorderBackend';
export type { WowFlavour } from './paths/IWowPathResolver';
export type {
  ObsData,
  ObsListItem,
  ObsProperty,
  SceneItemPosition,
  Signal,
  SourceDimensions,
} from './recorder/types';

let recorderBackend: IRecorderBackend | undefined;
let processPoller: IProcessPoller | undefined;
let wowPathResolver: IWowPathResolver | undefined;
let fileReveal: IFileReveal | undefined;
let ffmpegPathProvider: IFfmpegPathProvider | undefined;

export function getRecorderBackend(): IRecorderBackend {
  if (!recorderBackend) recorderBackend = new NoobsBackend();
  return recorderBackend;
}

export function getProcessPoller(): IProcessPoller {
  if (!processPoller) processPoller = new WinRustPsPoller();
  return processPoller;
}

export function getWowPathResolver(): IWowPathResolver {
  if (!wowPathResolver) wowPathResolver = new WinWowPathResolver();
  return wowPathResolver;
}

export function getFileReveal(): IFileReveal {
  if (!fileReveal) fileReveal = new WinFileReveal();
  return fileReveal;
}

export function getFfmpegPathProvider(): IFfmpegPathProvider {
  if (!ffmpegPathProvider) ffmpegPathProvider = new WinFfmpegPathProvider();
  return ffmpegPathProvider;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/platform/PlatformFactory.test.ts 2>&1 | tail -10`
Expected: `Tests: 5 passed`.

- [ ] **Step 5: Full test suite sanity**

Run: `npx jest src/__tests__/platform 2>&1 | tail -10`
Expected: all platform tests pass (11 total across the 5 files).

- [ ] **Step 6: Commit**

```bash
git add src/main/platform/index.ts src/__tests__/platform/PlatformFactory.test.ts
git commit -m "refactor(platform): add factory entry point"
```

---

## Task 11: Swap renderer noobs imports to platform types

**Files:**
- Modify: `src/renderer/preload.d.ts`
- Modify: `src/renderer/AudioSourceControls.tsx`
- Modify: `src/main/preload.ts`

Strictly an import swap. Zero runtime change.

- [ ] **Step 1: Update `src/renderer/preload.d.ts`**

Find line 5:
```ts
import { ObsProperty, SceneItemPosition, SourceDimensions } from 'noobs';
```

Replace with:
```ts
import type { ObsProperty, SceneItemPosition, SourceDimensions } from 'main/platform/recorder/types';
```

- [ ] **Step 2: Update `src/main/preload.ts`**

Find line 2:
```ts
import { ObsProperty, SceneItemPosition, SourceDimensions } from 'noobs';
```

Replace with:
```ts
import type { ObsProperty, SceneItemPosition, SourceDimensions } from './platform/recorder/types';
```

- [ ] **Step 3: Update `src/renderer/AudioSourceControls.tsx`**

Find line 41:
```ts
import { ObsListItem } from 'noobs';
```

Replace with:
```ts
import type { ObsListItem } from 'main/platform/recorder/types';
```

- [ ] **Step 4: Verify type-check**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: same count as the P4 baseline.

- [ ] **Step 5: Verify lint**

Run: `npm run lint 2>&1 | tail -5`
Expected: same status as P4 baseline.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/preload.d.ts src/main/preload.ts src/renderer/AudioSourceControls.tsx
git commit -m "refactor: route renderer type imports through platform module"
```

---

## Task 12: Refactor Recorder.ts to use IRecorderBackend

**Files:**
- Modify: `src/main/Recorder.ts`

This is the largest mechanical change — 86 noobs call sites. Done in one task rather than split because the changes are purely `s/noobs\./this.backend\./g` and must land together (partial state has mixed call shapes). Do it carefully and commit once type-check is clean.

- [ ] **Step 1: Replace the noobs import**

Find (around line 49-55):
```ts
import noobs, {
  ObsData,
  SceneItemPosition,
  Signal,
  SourceDimensions,
} from 'noobs';
```

Replace with:
```ts
import type {
  ObsData,
  SceneItemPosition,
  Signal,
  SourceDimensions,
} from 'main/platform/recorder/types';
import { getRecorderBackend } from 'main/platform';
import type { IRecorderBackend } from 'main/platform/recorder/IRecorderBackend';
```

- [ ] **Step 2: Add a `backend` field to the Recorder class**

Find the other singleton private fields near the top of the class body (e.g. `private cfg = ConfigService.getInstance();` around line 200-210). Add directly beneath:

```ts
/**
 * Platform recorder backend — Windows wraps `noobs`, macOS wraps
 * `obs-studio-node` (added in a later phase).
 */
private backend: IRecorderBackend = getRecorderBackend();
```

- [ ] **Step 3: Global find-and-replace all `noobs.*` calls**

For each unique call, rewrite:
- `noobs.Init(` → `this.backend.init(`
- `noobs.InitPreview(` → `this.backend.initPreview(`
- `noobs.Shutdown()` → `this.backend.shutdown()`
- `noobs.SetBuffering(` → `this.backend.setBuffering(`
- `noobs.SetDrawSourceOutline(` → `this.backend.setDrawSourceOutline(`
- `noobs.ResetVideoContext(` → `this.backend.resetVideoContext(`
- `noobs.GetPreviewInfo()` → `this.backend.getPreviewInfo()`
- `noobs.ConfigurePreview(` → `this.backend.configurePreview(`
- `noobs.ShowPreview()` → `this.backend.showPreview()`
- `noobs.HidePreview()` → `this.backend.hidePreview()`
- `noobs.DisablePreview()` → `this.backend.disablePreview()`
- `noobs.SetRecordingCfg(` → `this.backend.setRecordingCfg(`
- `noobs.SetVideoEncoder(` → `this.backend.setVideoEncoder(`
- `noobs.ListVideoEncoders()` → `this.backend.listVideoEncoders()`
- `noobs.CreateSource(` → `this.backend.createSource(`
- `noobs.DeleteSource(` → `this.backend.deleteSource(`
- `noobs.AddSourceToScene(` → `this.backend.addSourceToScene(`
- `noobs.RemoveSourceFromScene(` → `this.backend.removeSourceFromScene(`
- `noobs.GetSourceSettings(` → `this.backend.getSourceSettings(`
- `noobs.SetSourceSettings(` → `this.backend.setSourceSettings(`
- `noobs.GetSourceProperties(` → `this.backend.getSourceProperties(`
- `noobs.GetSourcePos(` → `this.backend.getSourcePos(`
- `noobs.SetSourcePos(` → `this.backend.setSourcePos(`
- `noobs.SetSourceVolume(` → `this.backend.setSourceVolume(`
- `noobs.SetVolmeterEnabled(` → `this.backend.setVolmeterEnabled(`
- `noobs.SetForceMono(` → `this.backend.setForceMono(`
- `noobs.SetAudioSuppression(` → `this.backend.setAudioSuppression(`
- `noobs.SetMuteAudioInputs(` → `this.backend.setMuteAudioInputs(`
- `noobs.StartBuffer()` → `this.backend.startBuffer()`
- `noobs.StartRecording(` → `this.backend.startRecording(`
- `noobs.StopRecording()` → `this.backend.stopRecording()`
- `noobs.ForceStopRecording()` → `this.backend.forceStopRecording()`
- `noobs.GetLastRecording()` → `this.backend.getLastRecording()`

Use a single-file find/replace in your editor (Cmd+Opt+F in most editors, or `sed -i '' 's/noobs\.Init(/this.backend.init(/g' src/main/Recorder.ts` etc.). Perform one rewrite at a time and type-check between each rewrite to catch any signature drift early.

- [ ] **Step 4: Verify no `noobs.` references remain in Recorder.ts**

Run: `grep -n "noobs\." src/main/Recorder.ts`
Expected: empty output.

- [ ] **Step 5: Verify import of `noobs` module no longer present**

Run: `grep -n "from 'noobs'" src/main/Recorder.ts`
Expected: empty output.

- [ ] **Step 6: Verify type-check**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: same count as the P4 baseline. If new errors appear, they signal missed call sites or signature drift — fix by comparing the interface in `IRecorderBackend.ts` against the original `noobs` typings.

- [ ] **Step 7: Verify lint**

Run: `npm run lint 2>&1 | tail -5`
Expected: same status as P4 baseline.

- [ ] **Step 8: Commit**

```bash
git add src/main/Recorder.ts
git commit -m "refactor: route Recorder through IRecorderBackend"
```

---

## Task 13: Refactor Poller.ts to delegate to IProcessPoller

**Files:**
- Modify: `src/utils/Poller.ts`

The public API of `Poller` (singleton, `start()`, `stop()`, `isWowRunning()`, `.on(event, fn)`) is preserved. The internals become a thin forwarder to `getProcessPoller()`.

- [ ] **Step 1: Rewrite `src/utils/Poller.ts` entirely**

Replace the full file content with:

```ts
import EventEmitter from 'events';
import { getProcessPoller } from 'main/platform';
import type { IProcessPoller } from 'main/platform/poller/IProcessPoller';

/**
 * Process poller singleton. Delegates to the platform-specific
 * implementation (rust-ps.exe on Windows, pgrep on macOS in a later
 * phase). Retained as a singleton so existing callers (`Manager`) do
 * not need changes.
 */
export default class Poller extends EventEmitter {
  private static instance: Poller;
  private impl: IProcessPoller = getProcessPoller();

  static getInstance(): Poller {
    if (!Poller.instance) Poller.instance = new Poller();
    return Poller.instance;
  }

  private constructor() {
    super();
    // Forward every event emitted by the impl to our own listeners.
    this.impl.on('started' as never, (...args: unknown[]) =>
      this.emit('started', ...args),
    );
    this.impl.on('stopped' as never, (...args: unknown[]) =>
      this.emit('stopped', ...args),
    );
  }

  isWowRunning(): boolean {
    return this.impl.isWowRunning();
  }

  start(): void {
    this.impl.start();
  }

  stop(): void {
    this.impl.stop();
  }
}
```

Note: the existing code uses `WowProcessEvent.STARTED`/`STOPPED` as event names. Those enum values resolve to the literal strings `'started'` / `'stopped'` (verify at `src/main/types.ts` — search for `WowProcessEvent`). If they resolve to different strings, adjust the two `this.impl.on(...)` calls accordingly.

- [ ] **Step 2: Verify the event strings match**

Run: `grep -A 3 "enum WowProcessEvent" src/main/types.ts`
Expected: shows the enum values. If `STARTED = 'started'` and `STOPPED = 'stopped'`, leave the code as written. Otherwise change the string literals in the `this.impl.on(...)` and `this.emit(...)` calls to the actual values (e.g. `'wow-started'` / `'wow-stopped'`).

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: same count as the P4 baseline.

- [ ] **Step 4: Verify lint**

Run: `npm run lint 2>&1 | tail -5`
Expected: same status as P4 baseline.

- [ ] **Step 5: Commit**

```bash
git add src/utils/Poller.ts
git commit -m "refactor: route Poller through IProcessPoller"
```

---

## Task 14: Refactor util.ts first-time-setup to use WowPathResolver

**Files:**
- Modify: `src/main/util.ts` (the `runFirstTimeSetupActionsNoObs` function, around line 1103-1140)

Replace the two hardcoded `wowInstallSearchPaths[i] + '\\_retail_\\Logs'` loops with calls to the resolver. Keep the import of `wowInstallSearchPaths` in place — other files may still use it — but this function stops referencing it.

- [ ] **Step 1: Add the import at the top of util.ts**

Near the existing `import { specializationById, wowInstallSearchPaths } from './constants';` line (around line 36), add a new import below it:

```ts
import { getWowPathResolver } from 'main/platform';
```

- [ ] **Step 2: Rewrite the retail detection loop**

Find (around line 1108-1123):

```ts
  if (!isRetailConfigured) {
    console.info('[Util] Attempt to first time configure retail installation');

    for (let i = 0; i < wowInstallSearchPaths.length; i++) {
      const installPath = wowInstallSearchPaths[i] + '\\_retail_\\Logs';
      const installExists = existsSync(installPath);

      if (installExists) {
        console.info('[Util] Found retail WoW installation at', installPath);
        cfg.set('retailLogPath', installPath);
        cfg.set('recordRetail', true);
        break;
      }
    }
  }
```

Replace with:

```ts
  if (!isRetailConfigured) {
    console.info('[Util] Attempt to first time configure retail installation');
    const resolver = getWowPathResolver();

    for (const root of resolver.searchRoots()) {
      const installPath = resolver.joinLogPath(root, 'retail');
      if (existsSync(installPath)) {
        console.info('[Util] Found retail WoW installation at', installPath);
        cfg.set('retailLogPath', installPath);
        cfg.set('recordRetail', true);
        break;
      }
    }
  }
```

- [ ] **Step 3: Rewrite the classic detection loop**

Find (around line 1127-1142):

```ts
  if (!isClassicConfigured) {
    console.info('[Util] Attempt to first time configure classic installation');

    for (let i = 0; i < wowInstallSearchPaths.length; i++) {
      const installPath = wowInstallSearchPaths[i] + '\\_classic_\\Logs';
      const installExists = existsSync(installPath);

      if (installExists) {
        console.info('[Util] Found classic WoW installation at', installPath);
        cfg.set('classicLogPath', installPath);
        cfg.set('recordClassic', true);
        break;
      }
    }
  }
```

Replace with:

```ts
  if (!isClassicConfigured) {
    console.info('[Util] Attempt to first time configure classic installation');
    const resolver = getWowPathResolver();

    for (const root of resolver.searchRoots()) {
      const installPath = resolver.joinLogPath(root, 'classic');
      if (existsSync(installPath)) {
        console.info('[Util] Found classic WoW installation at', installPath);
        cfg.set('classicLogPath', installPath);
        cfg.set('recordClassic', true);
        break;
      }
    }
  }
```

- [ ] **Step 4: Verify type-check**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: same count as the P4 baseline.

- [ ] **Step 5: Commit**

```bash
git add src/main/util.ts
git commit -m "refactor: route first-time setup through WowPathResolver"
```

---

## Task 15: Refactor util.ts file reveal to use IFileReveal

**Files:**
- Modify: `src/main/util.ts` (the `openSystemExplorer` function, around line 310-316)

- [ ] **Step 1: Rewrite the function**

Find (around line 308-316):

```ts
/**
 * Open a folder in system explorer.
 */
const openSystemExplorer = (filePath: string) => {
  const windowsPath = filePath.replace(/\//g, '\\');
  const cmd = `explorer.exe /select,"${windowsPath}"`;
  exec(cmd, () => {});
};
```

Replace with:

```ts
/**
 * Reveal a file in the system file manager (Explorer on Windows,
 * Finder on macOS).
 */
const openSystemExplorer = (filePath: string) => {
  getFileReveal().reveal(filePath);
};
```

- [ ] **Step 2: Add the import near the top of util.ts**

Near the existing `import { getWowPathResolver } from 'main/platform';` added in Task 14, extend it:

```ts
import { getFileReveal, getWowPathResolver } from 'main/platform';
```

- [ ] **Step 3: Remove now-unused `exec` import if nothing else uses it**

Run: `grep -n "^import.*exec\|\bexec(" src/main/util.ts`
If `exec` is only referenced on the (now-removed) line we just deleted, remove it from the import line at the top of `util.ts`. Otherwise leave the import alone.

- [ ] **Step 4: Verify type-check + lint**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` — expected: same as baseline.
Run: `npm run lint 2>&1 | tail -5` — expected: same as baseline.

- [ ] **Step 5: Commit**

```bash
git add src/main/util.ts
git commit -m "refactor: route file reveal through IFileReveal"
```

---

## Task 16: Refactor VideoProcessQueue ffmpeg path to use provider

**Files:**
- Modify: `src/main/VideoProcessQueue.ts` (around line 30-50)

- [ ] **Step 1: Replace the hardcoded path derivation**

Find (around line 35-45):

```ts
const atomicQueue = require('atomic-queue');
const devMode = process.env.NODE_ENV === 'development';
const isDebug = devMode || process.env.DEBUG_PROD === 'true';

// Use the dynamically linked ffmpeg.exe we package with OBS in noobs. This
// allows us to avoid including a static ffmpeg.exe which is an extra 60MB.
const ffmpegPathRel = 'node_modules/noobs/dist/bin/ffmpeg.exe';

let ffmpegPathAbs = devMode
  ? path.resolve(__dirname, '../../release/app/', ffmpegPathRel)
  : path.resolve(__dirname, '../../', ffmpegPathRel);

ffmpegPathAbs = fixPathWhenPackaged(ffmpegPathAbs);
```

Replace with:

```ts
const atomicQueue = require('atomic-queue');
const devMode = process.env.NODE_ENV === 'development';
const isDebug = devMode || process.env.DEBUG_PROD === 'true';

const ffmpegPathAbs = getFfmpegPathProvider().getPath();
```

- [ ] **Step 2: Add the import near the top of VideoProcessQueue.ts**

Add with the other `main/` imports:

```ts
import { getFfmpegPathProvider } from 'main/platform';
```

- [ ] **Step 3: Remove the now-unused `fixPathWhenPackaged` import if nothing else uses it**

Run: `grep -n "fixPathWhenPackaged" src/main/VideoProcessQueue.ts`
If the only reference was the line we just replaced, remove it from the import. Otherwise leave it.

- [ ] **Step 4: Verify type-check + lint**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"` — expected: same as baseline.
Run: `npm run lint 2>&1 | tail -5` — expected: same as baseline.

- [ ] **Step 5: Commit**

```bash
git add src/main/VideoProcessQueue.ts
git commit -m "refactor: route ffmpeg path through IFfmpegPathProvider"
```

---

## Task 17: Final verification

**Files:** (no new files — verification only)

- [ ] **Step 1: Confirm `noobs` is imported in exactly one source file**

Run: `grep -rn "from 'noobs'\|require('noobs')" src --include="*.ts" --include="*.tsx"`
Expected: exactly one line — `src/main/platform/recorder/NoobsBackend.ts: import noobs from 'noobs';`. Any other hits are leftover call sites that must be converted before continuing.

- [ ] **Step 2: Run the full platform test suite**

Run: `npx jest src/__tests__/platform 2>&1 | tail -15`
Expected: all tests across the five new test files pass. Total: 11+ tests.

- [ ] **Step 3: Run the full repo test suite**

Run: `npm test 2>&1 | tail -20`
Expected: same pass/fail shape as the P4 baseline. Note the repo's existing UTs are a known WIP — any failures present before this plan are acceptable. Any *new* failures must be fixed before proceeding.

- [ ] **Step 4: Full type-check**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: exact same count as the P4 baseline.

- [ ] **Step 5: Full lint**

Run: `npm run lint 2>&1 | tail -5`
Expected: exact same status as the P4 baseline.

- [ ] **Step 6: Production build (fail-fast catches webpack misconfig)**

Run: `npm run build 2>&1 | tail -30`
Expected: build succeeds for both `main` and `renderer` bundles. Any error here means webpack couldn't resolve a `main/platform/...` import or similar — fix and re-run.

- [ ] **Step 7: Windows smoke test (manual)**

On a Windows machine with a WoW install:
1. Run `npm start`.
2. Verify the app launches without errors in the console.
3. Start a manual recording, let it run for 5 seconds, stop it.
4. Verify an MKV file lands in the configured storage path.
5. Open the video folder — "Open In Explorer" button reveals the file with it highlighted.
6. Close the app, reopen it, verify first-time-setup did not re-fire (config persisted).

All six must pass. If any fail, the failure points to one of the refactored adapters — triage and fix before moving to Plan 2.

- [ ] **Step 8: Final commit (if any stray `.gitignore`/`package.json` changes accumulated)**

Run: `git status --short`
If anything is unstaged (e.g. Jest config edits from Task 5 Step 2), commit them:

```bash
git add -A
git commit -m "chore: Jest/tsconfig tweaks for platform module resolution"
```

If nothing is unstaged, skip this step.

- [ ] **Step 9: Branch state summary**

Run: `git log --oneline feat/macos-port ^main | wc -l`
Expected: ~16–18 commits (one per task plus the three spec commits already present).

Run: `git diff main...feat/macos-port --stat | tail -5`
Inspect: the total line count should be approximately +1,200 / −200 (new interfaces + adapters added, Recorder.ts call sites swapped in place).

---

## Rollback

If any Task 1–10 unit tests fail or Task 17 smoke test fails on Windows:

1. `git log --oneline -20` to find the last known-good commit.
2. `git reset --hard <sha>` to roll back within the branch — this branch is not yet pushed and has no other collaborators.
3. Triage the failure in isolation before re-attempting.

The refactor is fully reversible via git because Windows behavior is meant to be identical before and after.

---

## Notes for the next plan

After this plan completes:
- `src/main/platform/` is the one-stop shop for platform-specific behavior.
- Every adapter has exactly one implementation. Plan 2 (macOS adapters + OSN backend) adds a second implementation behind each interface and a `process.platform === 'darwin'` branch inside the factories.
- The `wowInstallSearchPaths` constant in `src/main/constants.ts` is now unused by live code but still exported. Plan 2 can delete it; doing so in Plan 2 (rather than here) keeps Phase 0 as a strict "no behavior change" refactor from the user's perspective.
