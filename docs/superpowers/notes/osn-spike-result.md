# Task 2 — OSN Feasibility Spike: Result

**Outcome: PASS.** `node scripts/osn-spike.js` prints `spike: OK` and exits 0 (verified twice, repeatable).

**Platform:** macOS arm64 (Apple M3 Pro, macOS 26.3.1)
**OSN version:** 0.26.17 (`obs_studio_client.0.3.21.0.node`, OBS API 31.1.3)

---

## Working startup protocol

```
1. spawn obs64 manually:  obs64 <pipeName> DEVMODE_VERSION <obs64BinaryPath>
2. wait for obs64 stdout: "server - start watcher"
3. IPC.connect(pipeName)   // NOT IPC.host() — see race condition below
4. NodeObs.SetWorkingDirectory(OSN_ROOT)   // required before initAPI
5. NodeObs.OBS_API_initAPI('en-US', userDataPath, version)  // returns 0
```

### Shutdown workaround

`OBS_API_destroyOBS_API()` sends an IPC request to obs64 and blocks synchronously (`sem_wait`) for the reply. On macOS, obs64 exits before sending the reply, so `sem_wait` never fires and Node hangs indefinitely.

Workaround: kill obs64 with SIGTERM before calling disconnect, skip `destroyOBS_API`.

```
OBS_service_removeCallback()
obs64proc.kill('SIGTERM')
await 500ms
IPC.disconnect()
```

This will be the production pattern in `OsnBackend.shutdown()`.

---

## Why IPC.host() fails (SIGABRT, exit 134)

`IPC.host()` internally calls `posix_spawnp` to start obs64 and returns **immediately** — no readiness wait. Node then calls `initAPI` while obs64's IPC server isn't listening yet. The socket read returns a short/empty buffer; `function_reply::deserialize` throws `std::exception`; the catch block in `read_callback_msg` rethrows it across the NAPI boundary → SIGABRT.

Using `IPC.connect()` to a pre-warmed obs64 avoids the race entirely.

---

## Binary patches (arm64, applied to OSN 0.26.17)

Both patched binaries were re-signed with `codesign --force --sign -`.

### libobs — `find_libobs_data_file` null guard
File: `Frameworks/libobs.framework/Versions/A/libobs`
Offset: `0x2dff4`
Old: `bl strlen`  (AARCH64: `94 xx xx xx`)
New: `cbz x0, #76`  (skip to return-NULL when UTF8String is NULL)

Root cause: `[NSBundle bundleWithIdentifier:@"com.obsproject.libobs"]` returns `nil`
→ `[nil path]` → NULL → `strlen(NULL)` → SIGSEGV.

### obs64 — `finalize_global_signals` null guard
File: `bin/obs64`
Offset: `0x1c014c`
Old: `adrp x1, 191`  (bytes: `e1 05 00 f0`)
New: `cbz x0, +20`   (bytes: `a0 00 00 34`) — skip to function epilogue when handler is null

Root cause: `obs_get_signal_handler()` returns NULL when OBS not initialized
→ `signal_handler_disconnect(NULL, "source_create", ...)` → SIGSEGV at `NULL+0xe0`.

---

## OBS modules confirmed loaded on macOS

- OpenGL 4.1 Metal (Apple M3 Pro)
- mac-videotoolbox (VideoToolbox encoders available)
- mac-capture, mac-avcapture, mac-avcapture-legacy
- mac-virtualcam, mac-syphon
- coreaudio-encoder, obs-x264, obs-ffmpeg, obs-outputs
- obs-transitions, obs-filters, text-freetype2, vlc-video, rtmp-services

Not available (expected): decklink, obs-browser (no CEF framework), mediasoup-connector.

---

## Key OSN API surface (macOS)

```javascript
const osn = require('obs-studio-node');
// osn.NodeObs — raw OBS proxy
// osn.IPC     — IPC controller

osn.IPC.setServerPath(binaryPath, workingDir)  // override helper path
osn.IPC.host(pipeName)       // spawns obs64 async — DO NOT USE (race)
osn.IPC.connect(pipeName)    // connect to pre-running obs64 — USE THIS
osn.IPC.disconnect()

osn.NodeObs.SetWorkingDirectory(obsRoot)
osn.NodeObs.OBS_API_initAPI(locale, userDataPath, version)  // -> 0 = OK
osn.NodeObs.OBS_service_removeCallback()
osn.NodeObs.OBS_API_destroyOBS_API()  // hangs on macOS — skip, kill obs64 instead
```

---

## Notes for OsnBackend implementation (Task 3)

1. `OsnBackend` must spawn obs64 as a `child_process` and wait for `"server - start watcher"` before calling `IPC.connect`.
2. Store the `ChildProcess` handle to kill on `shutdown()`.
3. `SetWorkingDirectory` must be called before `initAPI`.
4. Shutdown: `removeCallback` → kill obs64 → `IPC.disconnect`. Skip `destroyOBS_API`.
5. The binary patches in `bin/obs64` and `Frameworks/libobs.framework/...` are permanent for this OSN version — document in packaging steps.
