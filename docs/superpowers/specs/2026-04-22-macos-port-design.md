# macOS Port — Design Spec

**Date:** 2026-04-22
**Status:** Approved (pending user review of written spec)
**Scope:** Full cross-platform fork — macOS becomes a first-class platform alongside Windows with a shared codebase. No rewrite of Windows; platform differences isolated behind abstractions.

---

## 1. Goals & Non-Goals

### Goals
- Ship a notarized, auto-updating macOS build of Warcraft Recorder with feature parity for the core recording/replay/review loop.
- Preserve Windows behavior byte-for-byte — zero regressions on the existing install base.
- Factor platform differences behind small, testable adapter interfaces so the orchestration code (`Manager`, `Activity`, parsing, renderer) stays single-source.

### Non-Goals
- Linux support (no current demand; design leaves door open via the same adapter pattern).
- Game Capture on macOS — not possible; no DirectX/Vulkan hook injection equivalent on the platform.
- AV1 hardware encoding on macOS — Apple's media engine lacks AV1 encode as of 2026.
- Fully unattended CI verification of real on-GPU capture with TCC-gated macOS APIs — still requires a manual smoke pass before release (Screen Recording consent is kernel-gated and user-interactive).

---

## 2. Constraints & Platform Facts

- **`noobs`** (aza547's libobs binding, current recorder backend) is **Windows-only** per its README. It is used in ~40 call sites in `src/main/Recorder.ts`.
- **`obs-studio-node`** (Streamlabs) supports Windows + macOS including Apple Silicon. It is the only production-quality Node binding to libobs with macOS support.
- **macOS capture**: only Display Capture (ScreenCaptureKit in OBS 30+) and Window Capture. No Game Capture.
- **macOS encoders**: VideoToolbox H.264 + HEVC (hardware), `obs_x264` (software). No NVENC/AMD/QSV. No AV1 hw encode.
- **TCC permissions** required on macOS: Screen Recording, Microphone (conditional), Accessibility (conditional).
- **Signing & notarization** required for ScreenCaptureKit consent + auto-update UX to work cleanly.
- **Cross-platform libs already in the tree**: `uiohook-napi` (global hotkeys), `electron`, `electron-updater`, `electron-store`, `fluent-ffmpeg`.

---

## 3. High-Level Architecture

```
┌──────────────────────────────────────────────┐
│ Renderer (React)                              │
│   Capability-driven UI — no platform branches │
│     in components. Reads RecorderCapabilities │
│     via IPC.                                  │
│   Conditional chrome on titlebar only.        │
└──────────────────────────────────────────────┘
                     │ IPC (preload)
┌──────────────────────────────────────────────┐
│ Main process — shared orchestration           │
│   Manager, Activity, LogHandler, Combatant,   │
│   VideoProcessQueue, Storage, Config          │
└──────────────────────────────────────────────┘
                     │ platform adapters
┌──────────────────────────────────────────────┐
│ Platform adapters (new)                       │
│   IRecorderBackend    noobs (win) / osn (mac) │
│   IProcessPoller      rust-ps / pgrep         │
│   IPermissionsGate    noop / TCC              │
│   IFileReveal         explorer / open -R      │
│   IWowPathResolver    drives / /Applications  │
│   FfmpegPathProvider  noobs-bundled / static  │
└──────────────────────────────────────────────┘
```

### New files (proposed)
- `src/main/platform/index.ts` — platform detector + adapter factory.
- `src/main/platform/recorder/IRecorderBackend.ts` — interface + types.
- `src/main/platform/recorder/types.ts` — `ObsData`, `SceneItemPosition`, `ObsProperty`, `Signal` lifted from `noobs`.
- `src/main/platform/recorder/NoobsBackend.ts` — wraps current `noobs` calls.
- `src/main/platform/recorder/OsnBackend.ts` — wraps `obs-studio-node` for mac.
- `src/main/platform/poller/{WinRustPsPoller,MacPgrepPoller}.ts` — behind `IProcessPoller`.
- `src/main/platform/permissions/MacTccGate.ts` — Screen Recording / Mic / Accessibility checks.
- `src/main/platform/paths/WowPathResolver.{win,mac}.ts`.
- `src/main/platform/files/Reveal.{win,mac}.ts`.
- `scripts/notarize.js` — `@electron/notarize` hook.
- `assets/entitlements.mac.plist`.
- `assets/icon/icon.icns`.
- `assets/icon/tray/Template.png` + `Template@2x.png`.

---

## 4. Recorder Backend Interface

Every `noobs.*` call in `src/main/Recorder.ts` goes through `IRecorderBackend`. Interface:

```ts
interface IRecorderBackend {
  // Lifecycle
  initialize(windowHandle: Buffer): Promise<void>;
  shutdown(): Promise<void>;

  // Video context
  resetVideoContext(fps: number, width: number, height: number): void;
  getPreviewInfo(): { canvasWidth: number; canvasHeight: number };

  // Recording output
  setRecordingCfg(outputPath: string, container: 'mkv' | 'mp4'): void;
  setVideoEncoder(encoder: string, settings: ObsData): void;
  listVideoEncoders(): string[];

  // Scene / sources
  createSource(id: string, type: string): string;
  deleteSource(id: string): void;
  addSourceToScene(name: string): void;
  removeSourceFromScene(name: string): void;
  getSourceSettings(id: string): ObsData;
  setSourceSettings(id: string, settings: ObsData): void;
  getSourceProperties(id: string): ObsProperty[];
  setSourcePos(id: string, pos: SceneItemPosition): void;
  setSourceVolume(id: string, volume: number): void;

  // Audio
  setVolmeterEnabled(enabled: boolean): void;
  setForceMono(enabled: boolean): void;
  setAudioSuppression(enabled: boolean): void;

  // Signals (recording start/stop/crash/etc.)
  on(event: Signal, handler: (data: unknown) => void): void;

  // Recording lifecycle
  startBuffer(): Promise<void>;
  stopBuffer(): Promise<void>;
  startRecording(offset: number): Promise<void>;
  stopRecording(): Promise<string /* output path */>;
  forceStop(): Promise<void>;

  capabilities: RecorderCapabilities;
}

interface RecorderCapabilities {
  captureModes: Array<'game_capture' | 'window_capture' | 'monitor_capture'>;
  encoders: string[]; // ESupportedEncoders values
  supportsReplayBuffer: boolean;
}
```

### Windows backend (`NoobsBackend`)
- Thin pass-through to current `noobs` module.
- Capabilities: `['game_capture','window_capture','monitor_capture']`, encoders include NVENC, AMD, QSV (all variants), `OBS_X264`.
- Zero behavior change vs. today.

### macOS backend (`OsnBackend`)
- Wraps `obs-studio-node`.
- Capabilities: `['window_capture','monitor_capture']`, encoders `['VT_H264','VT_HEVC','OBS_X264']`, `supportsReplayBuffer: true`.
- Mapping:
  - `createSource('game_capture', …)` → rejected (not in capabilities; UI hides).
  - `createSource('window_capture', …)` → OSN `window_capture` (prefer the ScreenCaptureKit-backed `screen_capture` with `type: window` on macOS 14+ if available).
  - `createSource('monitor_capture', …)` → OSN `display_capture` (ScreenCaptureKit on 14+).
- Encoder mapping:
  - `VT_H264` → `com.apple.videotoolbox.videoencoder.ave.avc`
  - `VT_HEVC` → `com.apple.videotoolbox.videoencoder.ave.hevc`
  - `OBS_X264` → `obs_x264` (unchanged)
- Encoder settings reuse existing CQP/CRF logic — VideoToolbox accepts `rate_control: 'CRF'` or `'CQP'` equivalently in OSN.

### Renderer integration
- `Recorder.getInstance().capabilities` exposed via IPC, cached client-side with React Query.
- Settings components (`VideoSourceControls.tsx`, `VideoBaseControls.tsx`) read capability list and render dropdown options from it — no `process.platform` branches in renderer code.
- `rendererutils.ts` encoder label map gains: `VT_H264` → "Apple VideoToolbox H.264", `VT_HEVC` → "Apple VideoToolbox HEVC". Existing `isHardwareEncoder = value !== OBS_X264` heuristic stays correct.

### Risk
OSN's macOS binary may lag upstream libobs. Pin a known-good version during Phase 2; fall back to CoreGraphics-based `display_capture` if ScreenCaptureKit source missing.

---

## 5. Capture Modes & Permissions (macOS)

### Capture
- **Window Capture**: latch onto WoW window by owning process name (`World of Warcraft`, `World of Warcraft Classic`). Re-poll every 2s while WoW process is known-running but capture not latched — same pattern as current `findWindowInterval`. OSN returns window list via `GetSourceProperties`.
- **Display Capture**: user picks display or "primary". Works under fullscreen WoW.
- **No Game Capture** — capabilities omit it; renderer hides option; config validation rejects `game_capture` on darwin and migrates existing `obsCaptureMode === 'game_capture'` values to `window_capture` on startup.

### Permissions gate (`MacTccGate`)
Checks via Electron's `systemPreferences`:
- `getMediaAccessStatus('screen')` — Screen Recording (required).
- `getMediaAccessStatus('microphone')` — Microphone (required only if any audio input source configured).
- `isTrustedAccessibilityClient(false)` — Accessibility (required only if any hotkey configured).

Flow on `Manager` init:
1. **Screen Recording missing** → blocking modal: "Warcraft Recorder needs Screen Recording permission. [Open Settings] [Quit]". Settings deep link: `x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture`. On window focus, re-check and auto-dismiss when granted.
2. **Accessibility missing (hotkeys configured)** → non-blocking banner: "Global hotkeys disabled — grant Accessibility in System Settings". Deep link: `x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility`. Don't start `uIOhook` until granted.
3. **Microphone** → lazy — trigger `askForMediaAccess('microphone')` when user adds a mic source. Show inline warning on the source row if denied.

After any grant, show toast "Permissions updated — restart recommended" with relaunch button (`app.relaunch() + app.exit()`).

### Entitlements (`assets/entitlements.mac.plist`)
```xml
<key>com.apple.security.device.microphone</key> <true/>
<key>com.apple.security.cs.allow-jit</key> <true/>
<key>com.apple.security.cs.allow-unsigned-executable-memory</key> <true/>
<key>com.apple.security.cs.disable-library-validation</key> <true/>
```

### Info.plist keys
- `NSMicrophoneUsageDescription`
- `NSCameraUsageDescription` (reserved — webcam source not yet implemented but declared for future)
- `NSScreenCaptureDescription` (macOS 15+ annual re-consent prompt text)

### Hotkeys
`uiohook-napi` runs on macOS. No code changes except Accessibility pre-check before starting the hook.

---

## 6. WoW Paths, Log Pipeline, Poller, File Ops

### `IWowPathResolver`
Windows impl returns current hardcoded drive-scan list with backslash joins. macOS impl returns:
- `/Applications/World of Warcraft/_retail_/Logs`
- `/Applications/World of Warcraft/_classic_/Logs`
- `/Applications/World of Warcraft/_classic_era_/Logs`
- `/Applications/World of Warcraft/_classic_ptr_/Logs`
- Home-dir fallback: `~/Applications/World of Warcraft/...`

`runFirstTimeSetupActionsNoObs` in `src/main/util.ts:1103` refactored to iterate `resolver.searchRoots()` instead of hardcoded `wowInstallSearchPaths`.

### Combat log pipeline
No changes — `CombatLogWatcher` is pure Node fs, cross-platform. Line endings `\r\n` on both platforms; existing `trimEnd()` handles both.

`Recorder.ts:1474-1478` game-capture process annotations (`[Wow.exe]:` etc) only fire on Windows — guard with `if (backend.capabilities.captureModes.includes('game_capture'))` or `process.platform === 'win32'`.

### `IProcessPoller`
- Windows: current `rust-ps.exe`-spawning poller (rename class to `WinRustPsPoller`).
- macOS: `MacPgrepPoller` — `setInterval(2000)` spawning `pgrep -x "World of Warcraft"` and `pgrep -x "World of Warcraft Classic"`. Emits `started`/`stopped` on transitions. Respects `recordRetail`/`recordClassic`/`recordEra` config gates. Classic+Era share the `World of Warcraft Classic` binary (verified — same pattern as Windows where Classic+Era share a process name).

Factory in `Poller.getInstance()` picks impl by `process.platform`. No caller changes.

### FFmpeg binary
Current: `node_modules/noobs/dist/bin/ffmpeg.exe`. On macOS, ship a universal static `ffmpeg` binary as `extraResources/binaries/ffmpeg` (~30MB). Signed + notarized with the bundle. `getFfmpegPath()` in platform module returns the right path; `VideoProcessQueue.ts:39` replaced with this call.

### `IFileReveal`
- Windows: current `explorer.exe /select,"..."` (in `src/main/util.ts:313`).
- macOS: `spawn('open', ['-R', filepath])`.

Single `revealFile(path)` function — no renderer changes, same IPC.

### Auto-updater
`electron-updater` supports macOS with `latest-mac.yml` + ZIP (DMG for initial install). Release uploads: `WarcraftRecorder-X.Y.Z.dmg`, `WarcraftRecorder-X.Y.Z-mac.zip`, `latest-mac.yml`, `.blockmap`. Same GitHub-provider publish config.

---

## 7. Renderer, Window Chrome, Settings

### Window chrome (`src/main/main.ts:178`)
```ts
const isMac = process.platform === 'darwin';
window = new BrowserWindow({
  show: false,
  height: 1020 * 0.9,
  width: 1980 * 0.8,
  icon: getAssetPath('./icon/small-icon.png'),
  frame: isMac, // native frame on mac
  titleBarStyle: isMac ? 'hiddenInset' : undefined,
  trafficLightPosition: isMac ? { x: 12, y: 14 } : undefined,
  title: `Warcraft Recorder v${appVersion}`,
  webPreferences: { sandbox: true, preload: /* … */ },
});
```

### Renderer titlebar
- `platform` context provided via preload constant (one-shot at startup).
- On macOS: reserve ~80px left padding for traffic lights, hide Windows min/max/close buttons, keep `-webkit-app-region: drag` on empty titlebar / `no-drag` on interactive elements (pattern already used on Windows).

### Settings — capability-driven
`Recorder.capabilities` IPC → cached in React Query. Components consume that; no platform branching in component files. Examples:

```tsx
const caps = useRecorderCapabilities();
<Select options={caps.captureModes.map(modeLabel)} />
<Select options={caps.encoders.map(encoderLabel)} />
```

### Localisation
New phrase keys in `src/localisation/phrases.ts`:
- `MacLogPathExampleRetail`, `MacLogPathExampleClassic`, `MacLogPathExampleEra`
- `PermissionScreenRecordingMissingTitle`, `PermissionScreenRecordingBody`, `PermissionOpenSettings`
- `PermissionAccessibilityBannerBody`
- `EncoderVtH264`, `EncoderVtHevc`

English gold-standard across all 4 language files; others carry `// TODO: translate` until native speakers review. Log-path description phrases stay single-key; renderer interpolates the platform-appropriate example from the resolver.

### Tray & menu
- `assets/icon/tray/Template.png` + `Template@2x.png` — auto-adapts to menu bar light/dark.
- macOS app menu template: About / Quit / Edit menu (Cut/Copy/Paste/Select All) via Electron role-based items. Keep current Windows template as-is.
- `app.on('window-all-closed')`: don't quit on macOS (hide-to-tray / dock behavior).
- `Cmd+Q` quits, `Cmd+W` hides.

---

## 8. Build & Packaging

### electron-builder additions to `package.json > build`
```json
"mac": {
  "category": "public.app-category.utilities",
  "target": [
    { "target": "dmg", "arch": ["universal"] },
    { "target": "zip", "arch": ["universal"] }
  ],
  "artifactName": "WarcraftRecorder-${version}-${arch}.${ext}",
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "assets/entitlements.mac.plist",
  "entitlementsInherit": "assets/entitlements.mac.plist",
  "notarize": false,
  "extendInfo": {
    "NSMicrophoneUsageDescription": "Warcraft Recorder needs microphone access to capture your voice during encounters.",
    "NSCameraUsageDescription": "Warcraft Recorder does not use your camera.",
    "LSUIElement": false
  }
},
"dmg": {
  "sign": false,
  "contents": [
    { "x": 130, "y": 220 },
    { "x": 410, "y": 220, "type": "link", "path": "/Applications" }
  ]
},
"afterSign": "scripts/notarize.js"
```

Notarization handled in `scripts/notarize.js` using `@electron/notarize` with env vars `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`. Per-platform `extraResources` lets Windows skip the mac ffmpeg binary and vice versa.

### Native deps
- Keep `uiohook-napi` (cross-platform).
- Move `noobs` and `obs-studio-node` out of unconditional imports. Backend files lazy `require` the appropriate module: `require('noobs')` only on `win32`, `require('obs-studio-node')` only on `darwin`. Prevents webpack from bundling the wrong native module per platform.
- Add `obs-studio-node` to `release/app/package.json` at a pinned version. `electron-rebuild` on both platforms.

### Dev setup
- `npm start` on macOS: `electron-rebuild` compiles `uiohook-napi` + `obs-studio-node` against Electron ABI.
- Relax `check-native-dep.js` if it errors on mac-specific native deps.
- webpack / build configs stay platform-neutral (verified — no .exe baked in).

---

## 9. Testing

### Unit tests
- Existing Jest tests run on macOS unchanged (parsing + config are pure TS).
- New tests:
  - `platform/PlatformFactory.test.ts` — correct adapter per `process.platform`.
  - `MacPgrepPoller.test.ts` — mock `child_process.spawn`, assert event emissions.
  - `WowPathResolver.mac.test.ts` — mock `existsSync`, verify path detection.

### Integration / E2E

Three layers, each with a clear scope:

#### Layer 1 — Python log-replay E2E (cross-platform)
The existing `tests/src/*.py` scripts are **not UI automation** — they're log-replay harnesses. They spawn the packaged app binary via subprocess, write pre-captured combat-log fixtures with refreshed timestamps into the configured `retailLogPath` / `classicLogPath`, then assert that MP4 + metadata JSON output appears. This is portable to macOS with small changes:
- Replace hardcoded Windows paths in `tests/src/test.py` (top-level `RETAIL_LOG_PATH`, `CLASSIC_LOG_PATH`, `ERA_LOG_PATH`, `PTR_LOG_PATH`, `STORAGE_PATH`) with env-var overrides so CI can point at macOS paths.
- Replace Windows-only `%#m` / `%#d` strftime specifiers in `replace_date()` with POSIX `%-m` / `%-d`. Either branch on `os.name` or use a shared helper.
- Parameterize the app binary path: today tests expect an installed `.exe`; extend to accept a path to `.app/Contents/MacOS/WarcraftRecorder` on darwin.
- All test fixtures (combat log lines, metadata assertions) are platform-neutral — no changes needed.
- Keep the test harness checked in at `tests/src/`; mac CI runs the same suite with different env.

#### Layer 2 — Playwright-for-Electron UI regression (cross-platform)
New harness under `tests/e2e/`. Uses `@playwright/test` with the `electron` launcher to drive the dev or packaged app. Covers:
- Settings UI: capture-mode dropdown shows `game_capture` only on Windows; shows only `window_capture`/`monitor_capture` on macOS. Encoder dropdown shows platform-appropriate options.
- First-run permissions wizard on macOS: assert the blocking modal appears when `MacTccGate.getMediaAccessStatus('screen')` is stubbed as `denied` (inject stubs via an env-var backdoor in `MacTccGate` — see Layer 3 note below).
- Window chrome: assert `titleBarStyle: 'hiddenInset'` on macOS launch, `frame: false` custom chrome on Windows.
- Platform-agnostic: settings persistence, navigation, video list rendering, preview rendering.

Runs on both `windows-latest` and `macos-latest` GitHub Actions runners. Fast enough for per-PR gating. Does **not** attempt real recording — Playwright can't drive a real GPU capture session meaningfully, and TCC isn't user-grantable in CI.

#### Layer 3 — Manual smoke checklist (macOS)
Unavoidable for the bits CI can't touch. Executed before each release on real hardware:
- First-run permissions wizard fires; Screen Recording + Mic prompts succeed.
- Window Capture latches onto running WoW.
- Recording produces valid MKV with VideoToolbox H.264.
- Replay buffer → real recording on encounter start.
- Global hotkey (push-to-talk) works post-Accessibility grant.
- Auto-updater picks up a newer release.
- Notarized DMG installs without Gatekeeper warning.

#### TCC in CI — scope note
Real TCC grants are kernel-gated and user-interactive. Two escape hatches for CI if we ever want to exercise the real permissions flow:
- **Self-hosted macOS runner with SIP disabled** — pre-seed the TCC database with grants for the app bundle ID. Heavy ops burden, out of scope for Phase 3.
- **Permissions stub via env var** — `MacTccGate` honors `WCR_TCC_STUB=screen:granted,mic:denied` in non-packaged builds for testing. Implemented as part of Layer 2 so Playwright can exercise both branches of the wizard. Production builds ignore the env var.

---

## 10. Migration

### Windows users
Zero impact. Backend factory returns `NoobsBackend`; all current code paths preserved.

### Config migration on macOS
On first run (or first launch after cross-platform cloud config sync):
- If `obsCaptureMode === 'game_capture'` → migrate to `'window_capture'`.
- If `obsRecEncoder` refers to NVENC/AMD/QSV/AV1 → migrate to `VT_H264`.
- Default `retailLogPath`/`classicLogPath` populated from `WowPathResolver.mac` when empty.
- `storagePath` default: `~/Library/Application Support/WarcraftRecorder/Warcraft Recorder Videos`.

---

## 11. Rollout Phases

### Phase 0 — prep (no behavior change, ships to Windows)
1. Extract `IRecorderBackend`; `NoobsBackend` wraps existing calls; refactor `Recorder.ts` to use interface. Regression test on Windows.
2. Extract `IProcessPoller`, `IWowPathResolver`, `IFileReveal` behind interfaces with Windows impls only.

### Phase 1 — mac skeleton
3. Platform detector + factory; mac adapters for poller, paths, reveal, permissions gate. `OsnBackend` stub returning empty capabilities.
4. Window chrome branch, menu.ts mac template, tray template icons.
5. Dev build launches on macOS, permissions prompt fires, no recording yet.

### Phase 2 — mac recording
6. Implement `OsnBackend` — initialize, display/window capture, VT encoder, replay buffer.
7. First-time setup on macOS — log paths, capture mode defaults.
8. Manual smoke tests green.

### Phase 3 — distribution
9. Entitlements, notarize script, DMG config, CI workflow (GitHub Actions `macos-latest` + signing secrets).
10. First macOS-marked release (e.g. `v8.0.0` — major bump for arch refactor), announced as mac preview.

### Phase 4 — polish
11. Localisation sweep for mac-specific phrases across all 4 languages.
12. Universal binary verified on M-series + Intel mac.
13. Auto-updater end-to-end verified.
14. Python log-replay E2E ported cross-platform (env-var paths, POSIX strftime, parameterised binary path). Full retail/classic/era suites run on mac CI.
15. Playwright-for-Electron UI regression harness added under `tests/e2e/`, wired into GitHub Actions for both `windows-latest` and `macos-latest`. Permissions-wizard stub landed behind `WCR_TCC_STUB` env var.

### Effort estimate
- Phase 0: 3–5 days
- Phase 1: 5–7 days
- Phase 2: 7–14 days (riskiest — OSN learning curve)
- Phase 3: 3–5 days
- Phase 4: 5–7 days (includes Playwright harness + Python port)
- **Total: ~3.5–6 weeks of focused work.**

---

## 12. Open Questions & Risks

- **OSN ScreenCaptureKit source availability**: the exact OSN version to pin is TBD until Phase 2 proof-of-concept. Fallback: legacy CoreGraphics-based `display_capture`.
- **Universal binary for native deps**: `obs-studio-node` must ship arm64 + x64 slices (or be built for both). Confirm in Phase 2.
- **Apple Developer ID**: user does not yet have an account; required before Phase 3.
- **CI signing**: GitHub Actions secrets for notarization credentials must be set before the first mac release.
- **`check-native-dep.js`**: may reject mac-specific native deps; relax only as needed, don't blanket-disable.
