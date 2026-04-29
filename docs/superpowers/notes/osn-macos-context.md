# obs-studio-node on macOS 26 — Context Dump

**Date:** 2026-04-28
**Branch:** `feat/macos-osn-backend`
**Why this exists:** Anyone returning to Phase 2 (OsnBackend impl) needs to know why we ship obs64 + libobs binary patches in dev, why those patches do NOT need to ship to end users, and what the real production path looks like. Future regressions on macOS OSN init will look familiar after reading this.

---

## TL;DR

- OSN 0.26.17 (Streamlabs S3 tarball, Apr 2026) **fails to initialise on macOS 26.3.1 when launched from a non-bundle context** (e.g. Terminal-spawned Node).
- Failure mode: obs64 child process traps in `crashpad::SpawnSubprocess` ("crashed on child side of fork pre-exec"). The Node-side IPC client hangs forever in `OBS_API_initAPI`.
- Two arm64 binary patches (in `bin/obs64` and `Frameworks/libobs.framework/.../libobs`) sidestep the crash and let init return 0 — **for dev-time iteration only**.
- The real fix is **proper code signing + running from inside a signed `.app` bundle**. Streamlabs Desktop does both, ships unpatched OSN, and works fine. We expect the same once Plan 3 (electron-builder DMG + notarize) is complete.
- **Do NOT ship the binary patches to end users.** They are a dev workaround for ad-hoc / unsigned execution context, not a real bug fix.

---

## Environment at investigation time

- Hardware: Apple M3 Pro
- OS: macOS 26.3.1 (Tahoe), build 25D2128
- Arch: arm64
- Node: v22.22.1
- Electron (target): 38
- OSN: 0.26.17 from `https://s3-us-west-2.amazonaws.com/obsstudionodes3.streamlabs.com/osn-0.26.17-release-osx-arm64.tar.gz`
  - `obs_studio_client.0.3.21.0.node`
  - libobs `CFBundleShortVersionString: 31.1.2`, identifier `com.obsproject.libobs`
- Xcode: 26.2.0

---

## Failure mode (unpatched OSN on macOS 26)

`scripts/osn-spike-unpatched.js` exercises the bare-minimum init+shutdown flow:

```
1. spawn obs64 manually, wait for "server - start watcher" on stdout
2. osn.IPC.connect(pipeName)
3. osn.NodeObs.SetWorkingDirectory(OSN.app/distribute/obs-studio-node)
4. osn.NodeObs.OBS_API_initAPI('en-US', userDataPath, version)
   ← HANGS HERE INDEFINITELY
```

obs64 child process crashes silently on the IPC server side. Node-side `OBS_API_initAPI` blocks on a semaphore waiting for the IPC reply that never arrives.

`~/Library/Logs/DiagnosticReports/obs64-*.ips` shows the obs64 crash:

```
Exception: EXC_BREAKPOINT (SIGTRAP), brk 0
Termination: "Trace/BPT trap: 5"
asi: libsystem_c.dylib: ["crashed on child side of fork pre-exec"]

faultingThread frames (top of stack):
  logging::LogMessage::~LogMessage
  logging::ErrnoLogMessage::~ErrnoLogMessage
  crashpad::SpawnSubprocess
  crashpad::HandlerStarter::CommonStart
  crashpad::CrashpadClient::StartHandler
  util::CrashManager::SetupCrashpad
  util::CrashManager::Initialize
  OBS_API::OBS_API_initAPI                    ← we never see this return
  ipc::server::client_call_function
  ipc::server_instance_osx::worker_rep
```

Translation: obs64 sets up Google's Crashpad crash reporter as part of `OBS_API_initAPI`. Crashpad spawns a handler subprocess via `fork()` + `posix_spawn`. On macOS 26, the child process **traps between fork and exec** before the handler binary launches. The signal is a `brk 0` instruction (Chromium's `CHECK_*` assertion mechanism), preceded by an `errno` log — a system call returned an error that Crashpad treats as fatal.

The `responsibleProc` field in the crash report is `"Terminal"` because we spawned obs64 from a Terminal-spawned Node script. macOS 26 enforces stricter post-fork execution restrictions for processes whose responsible process is unsigned or operates outside an `.app` bundle context.

---

## Why Streamlabs Desktop works on the same OS

Streamlabs Desktop ships the same OSN 0.26.x family from the same Streamlabs S3 bucket, **unpatched**, and runs cleanly on macOS 26.

Differences:

| | Our dev spike | Streamlabs Desktop |
|---|---|---|
| Code signing | `adhoc, linker-signed` (no Apple ID) | Apple Developer ID signed |
| `OSN.app` bundle signature | `not signed at all` | Notarized as part of full app |
| Bundled binary signing | None — TeamIdentifier="" | Re-signed by Streamlabs CI |
| Launching context | Terminal → Node → obs64 | StreamlabsDesktop.app (signed) → obs64 |
| Responsible process | Terminal | Streamlabs Desktop itself |
| OSN source modifications | None | None |

Key: Streamlabs Desktop's CI build pipeline re-signs every bundled native binary (obs64, libobs.framework, Helpers, crashpad_handler) with their Apple Developer ID team certificate before notarizing the `.app`. This satisfies macOS 26's post-fork sandbox check that's killing our dev spike.

Their `package.json` lists `obs-studio-node` as `https://.../osn-0.0.0-release.tar.gz` — a CI placeholder. They don't ship a forked OSN with patches. They rely entirely on signing + bundle context to satisfy macOS.

---

## The dev workaround — binary patches at hardcoded offsets

Two arm64 patches applied to `release/app/node_modules/obs-studio-node/`:

### Patch 1 — libobs `find_libobs_data_file` null guard

File: `Frameworks/libobs.framework/Versions/A/libobs`
Offset: `0x2dff4`
Change: `bl strlen` (`94 xx xx xx`) → `cbz x0, #76` (skip-to-return-NULL when arg is null)

Original symptom (crash without patch on this code path):
- `[NSBundle bundleWithIdentifier:@"com.obsproject.libobs"]` → nil (bundle not registered when libobs loads outside `.app` context)
- `[nil path]` → NULL
- `strlen(NULL)` → SIGSEGV at NULL+0

The patch makes `find_libobs_data_file` return NULL gracefully. Caller (libobs module loader) handles NULL.

### Patch 2 — obs64 `finalize_global_signals` null guard

File: `bin/obs64`
Offset: `0x1c014c`
Change: `adrp x1, 191` (`e1 05 00 f0`) → `cbz x0, +20` (`a0 00 00 34`) — skip to function epilogue when global signal handler is null.

Original symptom:
- `obs_get_signal_handler()` returns NULL (OBS not fully initialised after a partial init failure)
- `signal_handler_disconnect(NULL, "source_create", ...)` → SIGSEGV at NULL+0xe0

### Why both patches were needed for the dev path

Even though the **direct cause** of our hang is Crashpad fork-pre-exec failure, the patches let init proceed past the partial-init recovery code paths that DO trip on the null bundle / null signal handler. Without the patches, init recovery itself crashes; with them, init succeeds at returning 0 (the Crashpad subprocess never gets fully attached but obs64 keeps running anyway).

Backups exist at:
- `bin/obs64.orig2` (md5 `f5b9d0b27cc2aec097efa1f742cbdacb` — same as `OSN.app/.../bin/obs64`)
- `Frameworks/libobs.framework/Versions/A/libobs.orig`

Both patched binaries were re-signed with `codesign --force --sign -` (ad-hoc).

---

## Spike scripts in this repo

| File | Purpose | Outcome |
|---|---|---|
| `scripts/osn-spike.js` | First spike — patched binaries + manual obs64 spawn + IPC.connect | ✅ `spike: OK`, init returns 0 |
| `scripts/osn-spike-clean.js` | Re-spike via standard IPC.host (no manual spawn, no patches) | ❌ SIGABRT — IPC race + std::exception across NAPI |
| `scripts/osn-spike-unpatched.js` | Re-spike via OSN.app unpatched binaries + manual spawn + IPC.connect | ❌ HANG at `OBS_API_initAPI` |

Run any of them with `node scripts/<name>.js`.

---

## The IPC race (separate but real)

Independent of binary patches: `osn.IPC.host(pipe)` calls `posix_spawnp` to start obs64 and **returns immediately**. Node-side `initAPI` then runs before obs64's IPC server is listening on the Unix socket. The socket read returns short/empty; `function_reply::deserialize` throws `std::exception`; the catch in `read_callback_msg` rethrows across the NAPI boundary → SIGABRT.

Workaround in OsnBackend: spawn obs64 manually, watch its stdout for the line `"server - start watcher"`, then call `osn.IPC.connect(pipe)` instead of `IPC.host(pipe)`.

This race is **not** macOS 26-specific. It's a long-standing OSN bug that happens to be papered over inside Streamlabs Desktop's launcher (they probably do their own readiness wait too). We need our own.

---

## Production strategy

When Plan 3 (electron-builder DMG + notarize) lands:

1. **electron-builder's `afterSign` hook** will iterate every native binary inside our packaged `.app` bundle (`obs64`, `libobs.framework/Versions/A/libobs`, `Frameworks/*Helper.app`, `crashpad_handler`, `obs-ffmpeg-mux`, etc.) and re-sign each with our Apple Developer ID.

2. **The packaged + notarized app launches obs64 from inside its own bundle**, so the responsible process is the signed Warcraft Recorder app, not Terminal.

3. **Binary patches are NOT applied** to the production OSN.

4. **The IPC.connect-with-readiness-wait pattern stays.** That's a real OSN bug and our OsnBackend handles it regardless of signing.

If after step 1-3 init still fails, we revisit. But based on Streamlabs Desktop's working setup, it should not.

---

## Dev workflow until Plan 3 lands

1. Fresh `npm install` will overwrite our patched binaries with the unpatched Streamlabs S3 versions. To re-apply:
   - Diff `bin/obs64.orig2` vs `bin/obs64` is the obs64 patch. Diff `Frameworks/libobs.framework/Versions/A/libobs.orig` vs `libobs` is the libobs patch.
   - A repeatable patch script lives at... (TODO if needed — for now, manual hex edits at the offsets above).
2. The spike scripts (`scripts/osn-spike*.js`) are useful as smoke tests when OSN updates or macOS updates land.
3. When testing `npm start` with a real OsnBackend, expect init to succeed in dev only with patches applied.

---

## Recommended postinstall guard (deferred)

Eventually add a `release/app/scripts/patch-osn-mac.js` postinstall step that detects darwin + the right OSN version and applies the patches automatically. **Conditioned on `process.env.NODE_ENV !== 'production'` and not running inside a packaged `.app`** so production builds don't get patched binaries.

This isn't blocking for Plan 2b — manual patches are fine for dev — but is a quality-of-life improvement once the OsnBackend lands.

---

## Useful crash-report parsing recipe

```bash
ls -lt ~/Library/Logs/DiagnosticReports/obs64-*.ips | head -1
cat ~/Library/Logs/DiagnosticReports/obs64-*.ips | tail -1 | jq '.threads[0].frames[:10]'
```

Top-of-stack symbols immediately tell you whether it's the Crashpad bug above or something new.

---

## Open questions

- Does Streamlabs Desktop have a pre-launch script that pre-warms obs64 or sets env vars we're missing? (Worth checking their `app.ts` or main process bootstrap — couldn't find publicly accessible source for the relevant init.)
- Is there a way to make Crashpad init non-fatal when its subprocess can't fork? OSN may not expose a flag.
- Do older OSN versions (0.25.x, 0.24.x) still hit the macOS 26 fork-pre-exec issue? Worth a one-off downgrade test if patches become brittle.

---

## Phase 2c outcome (2026-04-29)

### Signed dev build

Working signed build at `release/build/mac-arm64/WarcraftRecorder.app`:
- Identity: `Developer ID Application: Yuri Piratello (Y36BG56F47)`, Team `Y36BG56F47`
- Hardened runtime active, all 9 entitlements applied
- `codesign --verify --deep --strict` passes

### Build pipeline (`scripts/`)

1. **`relativise-osn-symlinks.js` (afterPack)** — three structural fixups:
   - **Drop `OSN.app/`**: nested duplicate of root `obs-studio-node/` tree. `module.js` falls back to root paths when `hasDeveloperApp` is false; `OsnBackend` already targets root `bin/obs64`. Codesign rejects the `OSN.app/distribute/` layout as "unsealed contents present in the bundle root".
   - **Relativise absolute symlinks**: OSN ships ~22 absolute symlinks into the source-repo path. Codesign rejects those as "invalid destination for symbolic link in bundle". Walk + rewrite to bundle-relative paths.
   - **Repair framework layout**: OSN's `libobs.framework`, `Syphon.framework`, `Chromium Embedded Framework.framework` ship with only `Versions/A/...` and no `Versions/Current` symlink or top-level convenience links. Codesign rejects as "bundle format unrecognized". Walk each `*.framework`, create `Versions/Current → A` and the top-level entries.
2. **`sign-osn-binaries.js` (afterSign)** — re-sign every Mach-O / framework / dylib / helper-app inside the bundled OSN tree with our Developer ID. Uses `WCR_SIGN_IDENTITY` env (SHA hash) to disambiguate when both `Apple Distribution` and `Developer ID Application` certs share the team-name string.

### `package.json` build config

- `mac.identity` short form (e.g. `"Yuri Piratello (Y36BG56F47)"`) — electron-builder rejects the `Developer ID Application: ` prefix.
- `mac.signIgnore` includes `Chromium Embedded Framework\\.framework` and `obs-studio-node/` so electron-builder doesn't recursively sign OSN's pre-shipped frameworks; we re-sign in afterSign.
- `mac.asar: false` is critical — OSN's native modules need direct filesystem access.
- `target: "dir"` (not dmg/zip) for fast iteration.

### Launch + TCC behaviour

`tccutil reset All org.WarcraftRecorder` clears prior grants. App launches with no permission prompts; OBS init succeeds, sources/encoders enumerate, MacPgrepPoller detects WoW running. The signed bundle has its own TCC identity rooted in `org.WarcraftRecorder`.

### Recording-start blocker (still open)

`SimpleReplayBufferFactory.legacySettings.start()` returns generic `Failed to make IPC call` with no obs64-side error logged. Diagnostic env knob `WCR_OSN_BUFFER_BYPASS=1` routes startBuffer to `SimpleRecordingFactory.legacySettings.start()` to surface the real error.

Findings via bypass:
- Without explicit `IVideoEncoder`: obs64 returns `Invalid video encoder`. Fix: `VideoEncoderFactory.create('obs_x264', 'wcr-recording-encoder', settings)` and assign to `rec.videoEncoder`.
- With video encoder but no `IAudioEncoder`: obs64 SIGABRTs inside `osn::ISimpleRecording::Start +4880`, EXC_BAD_ACCESS at 0x1c. Fix: `AudioEncoderFactory.create('ffmpeg_aac', 'wcr-rec-audio')` → `rec.audioEncoder`.
- With both encoders set: obs64 still SIGABRTs at the same `Start +4880` 0x1c. Setting `rec.path` and `rec.format` doesn't help. Setting `rec.video = osn.Video` returns `Invalid argument` (osn.Video is the class function, not an IVideo instance — there's no JS-exposed accessor for the global legacy video context).
- Crash dumps under `~/Library/Application Support/WarcraftRecorder/osn-data/Crashpad/completed/*.dmp`. Backtrace reproduced cleanly with `lldb --batch -o "target create --core ..." -o "thread select 4" -o "bt"`.

Next leads:
- AdvancedRecording (via `AdvancedRecordingFactory.create()`) sidesteps `legacySettings` entirely — full explicit setup, including video binding via the factory `create()` constructor.
- Inspect Streamlabs Desktop's recording start path (their main bootstrap) for the IVideo wiring pattern OSN expects.
- The 0x1c offset suggests a pointer-to-struct read where the struct's field at byte 28 is dereferenced against null. Likely the `streaming` sub-output or an internal `obs_output_t*` that legacySettings doesn't set.

### Useful diagnostic commands

```bash
# Build signed
export CSC_NAME="Yuri Piratello (Y36BG56F47)"
export WCR_SIGN_IDENTITY="F30532B3B818C7850575812B103026F11A5C9FF4"
npm run package

# Verify signature
codesign --verify --deep --strict --verbose=2 release/build/mac-arm64/WarcraftRecorder.app

# Reset TCC + launch with diagnostic bypass
tccutil reset All org.WarcraftRecorder
WCR_OSN_BUFFER_BYPASS=1 release/build/mac-arm64/WarcraftRecorder.app/Contents/MacOS/WarcraftRecorder

# Latest crash dump
ls -t ~/Library/Application\ Support/WarcraftRecorder/osn-data/Crashpad/completed/*.dmp | head -1
```
