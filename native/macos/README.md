# macOS OBS Runtime

Warcraft Recorder uses a patched OBS `obs-ffmpeg` plugin on macOS so replay
buffer saves can use the same `StartRecording(offset)` flow as Windows.

Generated OBS checkouts, build output, and staged binary artifacts are ignored
by git:

```text
native/macos/build/
native/macos/artifacts/
```

The source of truth is the versioned patch set in `native/macos/patches/` plus
the build scripts in `scripts/macos/`.

## Rebuild Patched OBS Artifacts

To clone OBS `30.2.3`, apply Warcraft Recorder's patches, build the required
plugin/helper targets, and stage the outputs:

```bash
scripts/macos/build-obs-ffmpeg.sh
```

The staged layout is:

```text
native/macos/artifacts/obs-30.2.3-arm64/
  app/Contents/MacOS/obs-ffmpeg-mux
  obs/OBS.app/Contents/WCRPlugIns/obs-ffmpeg.plugin
```

To stage already-built local OBS outputs:

```bash
scripts/macos/stage-obs-artifacts.sh \
  /path/to/obs-ffmpeg.plugin \
  /path/to/obs-ffmpeg-mux
```

The plugin must be built against the same OBS/FFmpeg ABI as the bundled
`OBS.app`. The default packaging path expects OBS `30.2.3`.

## Package Runtime

During Electron packaging, `scripts/macos/after-pack.js` copies `OBS.app` into
the generated app bundle, overlays the patched plugin, copies
`obs-ffmpeg-mux` beside the Electron executable, and copies the rebuilt
`noobs.node` addon into `noobs/dist`.

Defaults:

```text
OBS.app source: /Applications/OBS.app
artifacts: native/macos/artifacts/obs-30.2.3-<arch>/
```

Override paths when needed:

```bash
WCR_MACOS_OBS_APP_PATH=/path/to/OBS.app
WCR_MACOS_OBS_ARTIFACT_DIR=/path/to/native/artifacts/obs-30.2.3-arm64
```

## Verify

After packaging, run:

```bash
npm run smoke:macos-app
npm run smoke:macos-obs
```

Pass a specific app bundle with:

```bash
npm run smoke:macos-app -- --app /path/to/WarcraftRecorder.app
npm run smoke:macos-obs -- --app /path/to/WarcraftRecorder.app
```
