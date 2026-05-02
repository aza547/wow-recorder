# macOS Port — Beta 1 Status (2026-05-01)

**Tag:** `v7.7.0-beta.1`
**Branch:** `feat/macos-osn-backend`
**Distribution:** GitHub Releases on the fork (`yuripiratello/wow-recorder`) via `.github/workflows/release-mac-beta.yml`. Workflow fires on `v*-beta*` tag push, packages a Developer-ID-signed + notarized `.dmg` + `.zip` + `latest-mac.yml` for `electron-updater`.

This note exists so a future Claude instance picking up the port can see the diff between what the planning docs (`plans/2026-04-22-phase{0,1,2,2c}-*.md` + `plans/2026-04-30-mac-editor-service.md`) describe and what actually shipped. The plan files are accurate for what they cover; everything below is **post-plan delta** that didn't get its own plan file.

---

## What landed for the recording pipeline

- **Replay buffer + recording** verified end-to-end with a real Mythic+ dungeon run on macOS Tahoe (M3 Pro). Encoded to MKV, remuxed to MP4 by `VideoProcessQueue`, played back without errors.
- **VideoToolbox encoders** (`VT_H264`, `VT_HEVC`) supported via `Recorder.getEncoderSettings`, mapped through a new `getVtQualityFromQuality` preset table (CRF rate control + `quality` 0-100, opposite polarity from x264 CRF). `useRecorderCapabilities` FALLBACK is now a cross-platform superset so the encoder dropdown isn't briefly missing VT entries before the IPC resolves.
- **Window capture** auto-attaches to WoW. `windowMatch` accepts `[Wow]` / `[World of Warcraft]` / `[WowClassic]` prefixes (OSN's `mac_screen_capture` formats names as `[<AppName>] <WindowTitle>`). Mac branch of `configureWindowCaptureSource` sets SCK-specific keys (`type: 1`, `show_cursor`, `hide_obs`) instead of the Windows-specific `capture_mode` / `method` / `compatibility`.
- **Audio**: input enumeration restored after a too-broad property short-circuit was scoped to `coreaudio_output_capture` only. `coreaudio_output_capture` properties are synthesized to avoid TCC sync-IPC hangs. Volmeters lazy-attach: `setVolmeterEnabled` flips a `volmetersWanted` flag, and `attachVolmeter` runs on each existing input + on subsequent `createSource` calls.
- **PROCESS audio source on Mac** maps to SCK type 0/1/2 in `Recorder.configureAudioSources`: empty/`desktop`/`default` → system desktop audio (type 0); bundle id with dot → app capture (type 2); window title → window capture (type 1). `sck_audio_capture` is the source under the hood; rolled back from a fully-async create path that hung sync IPC during SCK init.

## What landed for the editor

- **EditorService** + transparent React overlay shipped — see `plans/2026-04-30-mac-editor-service.md` Resolution section. libobs draws the green selection rectangle + transform handles itself when the preview is created via `OBS_content_createSourcePreviewDisplay(sceneName)` instead of source-less `OBS_content_createDisplay`. The Phase A binding patch (`OBS_content_setOutlineColor`) was never required.
- DOM orange boxes removed on Mac. `RecorderPreview.tsx` Mac branch renders a transparent overlay div forwarding mouse events via `ipc.editorMouseDown(toEditorEv(e))`. `toEditorEv` includes `buttons: e.buttons` for ghost-drag detection.

## What landed for combat log handling

- **macOS polling fallback** for `CombatLogWatcher`. `fs.watch` on FSEvents only delivers `rename` events for create/delete and coalesces in-place appends, missing `CHALLENGE_MODE_START` / `ENCOUNTER_START` lines. `macPollOnce` polls the directory every 2s; `process()` short-circuits when `bytesToRead < 1`, so the cost is negligible when the log isn't being written.

## What landed for build / packaging

- **Codesign disambiguation** in `scripts/sign-osn-binaries.js`. When both "Developer ID Application" and "Apple Distribution" certs for the same team are present in the keychain, `codesign --sign "Yuri Piratello (Y36BG56F47)"` rejects the bare team-suffixed name as ambiguous. The script now resolves to the SHA-1 of the Developer ID Application cert via `security find-identity`, falling back to the configured value when only one match exists.
- **Notarization-ready signing**: `--timestamp=none` is no longer the default. Opt out with `WCR_SKIP_TIMESTAMP=1` for local dev iteration.
- **deasync prebuilt-blob exclusion**: `deasync` npm ships .node files for every arch+node-ABI combo, including darwin-x64 binaries built against an SDK older than 10.9 (notarization rejects). `package.json > build.files` now excludes `**/node_modules/deasync/bin/{darwin-x64,linux,win32}-*`. The rebuild output at `build/Release/deasync.node` plus the `darwin-arm64-*` prebuilds are kept.
- **GitHub Actions workflow** (`.github/workflows/release-mac-beta.yml`) on a macos-14 (arm64) runner. Tag-triggered (`v*-beta*`). Imports the Developer ID `.p12` from `MAC_CERT_P12_BASE64` + `MAC_CERT_PASSWORD` secrets into a temp keychain, optionally writes an App Store Connect API key from `APPLE_API_KEY_BASE64` for notarization, runs `clean → build → build:dll → electron-builder build --publish always`. Guarded with `if: github.repository == 'yuripiratello/wow-recorder'` — cannot fire on upstream after a future PR merge. `build.publish.owner` points at the fork; revert in upstream PR.
- **Mac targets**: `package.json > build.mac.target` extended to `[dir, zip, dmg]`. `zip` is required by `electron-updater` on mac.

## Known issues at beta 1 cut

- `replayBuffer.stop()` throws `Invalid replay buffer output` on Mac during `forceStopRecording`. Synthetic `deactivate` signal recovers the state machine, so non-fatal — but it's a real OSN binding gap. Reproduces on encoder-change reconfigure.
- `app-update.yml` ENOENT in dev launches. electron-builder generates the file inside the bundle during the publish step, so released bundles will have it; only ad-hoc dev runs see the error.
- No notarization in dev builds (uses `WCR_SKIP_TIMESTAMP=1` by convention). Tahoe Gatekeeper blocks first launch unless user right-clicks → Open. CI builds are notarized when the Apple API key secrets are present.
- `OBS_content_setOutlineColor` is still unbound in OSN's JS layer. Not needed for current selection UI (libobs uses its own default outline color). If a future feature wants per-source outline tinting, the Phase A binding patch in `plans/2026-04-30-mac-editor-service.md` is the path.
- No SCK desktop-audio path beyond `coreaudio_output_capture`. SCK redirect was rolled back because `osn.InputFactory.create('sck_audio_capture')` hangs sync IPC during SCK init. Async create + lazy attach would unblock this.
- `app.dock` icon shows the bundled icon but no badging. No Touch Bar support. No `LSUIElement` agent mode (would let WCR run without a Dock entry — currently `false` to keep the menu bar visible during dev).

## Reading order for someone picking this up

1. `specs/2026-04-22-macos-port-design.md` — overall design and goals.
2. `notes/osn-macos-context.md` — why OSN init worked locally with binary patches but the real fix is signing + bundle context.
3. `plans/2026-04-30-mac-editor-service.md` — editor service with up-to-date Resolution section explaining how it actually shipped.
4. `git log --oneline feat/macos-osn-backend` — five most recent commits cover the post-plan delta:
   - `feat(mac): port osn backend, editor service, audio + window capture`
   - `fix(recorder): support Apple VideoToolbox encoders`
   - `fix(scripts): disambiguate codesign identity`
   - `ci: mac beta release workflow`
   - `fix(build): notarization-ready signing + drop legacy deasync prebuilds`
