import path from 'path';
import fs from 'fs';
import { ChildProcess, execFileSync, spawn } from 'child_process';
import { app, screen } from 'electron';
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

const READY_LINE = 'server - start watcher';
const READY_TIMEOUT_MS = 10000;

/**
 * Map OSN's EPropertyType numeric enum to the lowercase strings
 * Recorder.ts inherited from the noobs API ('list', 'int', etc.).
 */
const OSN_PROP_TYPE_NAMES: Record<number, string> = {
  0: 'invalid',
  1: 'boolean',
  2: 'int',
  3: 'float',
  4: 'text',
  5: 'path',
  6: 'list',
  7: 'color',
  8: 'button',
  9: 'font',
  10: 'editable_list',
  11: 'frame_rate',
  12: 'group',
  13: 'color_alpha',
  14: 'capture',
};

/**
 * Translate one OSN IProperty into the noobs-shaped object Recorder.ts
 * iterates. List-type properties carry their items array directly on
 * the result (not nested under `details`) to match noobs's surface.
 */
/**
 * macOS OSN source properties use slightly different names than Windows
 * noobs (Recorder.ts's heritage). Alias mac names → noobs names so
 * Recorder.ts's `properties.find(p => p.name === 'monitor_id')` etc.
 * lookups still work.
 */
const MAC_PROP_NAME_ALIASES: Record<string, string> = {
  display_uuid: 'monitor_id',
};

function adaptOsnProperty(p: import('obs-studio-node').IProperty): ObsProperty {
  const typeNum = p.type as unknown as number;
  const typeStr = OSN_PROP_TYPE_NAMES[typeNum] ?? String(typeNum);
  const aliasedName = MAC_PROP_NAME_ALIASES[p.name] ?? p.name;
  const out: Record<string, unknown> = {
    name: aliasedName,
    description: p.description,
    type: typeStr,
  };
  if (typeStr === 'list') {
    const list = p as unknown as import('obs-studio-node').IListProperty;
    const items = list.details?.items ?? [];
    out.items = items.map((it) => ({ name: it.name, value: it.value }));
  }
  return out as unknown as ObsProperty;
}

/**
 * Synthesize a property list for `screen_capture` on macOS when OSN's
 * native properties getter returns null. Uses Electron's `screen` API
 * to enumerate displays + a placeholder window list. Recorder.ts
 * iterates these via `properties.find(p => p.name === 'monitor_id')`
 * and `'window'` so we expose both names.
 */
/**
 * Cached desktopCapturer window list. Populated async by
 * `refreshMacWindowList()` since `getSources` is async but
 * `getSourceProperties` is sync. List entries: { name, value }
 * where value is the CGWindowID-bearing source id.
 */
let cachedMacWindows: { name: string; value: string }[] = [];

export async function refreshMacWindowList(): Promise<void> {
  if (process.platform !== 'darwin') return;
  try {
    const { desktopCapturer } = await import('electron');
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 0, height: 0 },
      fetchWindowIcons: false,
    });
    cachedMacWindows = sources
      .filter((s) => s.name && !s.name.startsWith('Warcraft Recorder'))
      .map((s) => ({ name: s.name, value: s.id }));
    console.info('[OsnBackend] mac window list refreshed:', cachedMacWindows.length);
  } catch (err) {
    console.warn('[OsnBackend] refreshMacWindowList threw', err);
  }
}

function synthesiseScreenCaptureProperties(): ObsProperty[] {
  const displays = screen.getAllDisplays();
  const monitorItems = displays.map((d, idx) => ({
    name: d.label || `Display ${idx + 1}`,
    value: String(d.id),
  }));

  return [
    {
      name: 'monitor_id',
      description: 'Display',
      type: 'list',
      items: monitorItems,
    } as unknown as ObsProperty,
    {
      name: 'window',
      description: 'Window',
      type: 'list',
      items: cachedMacWindows,
    } as unknown as ObsProperty,
  ];
}

/**
 * Synthesize a property list for `coreaudio_*_capture` on macOS when
 * OSN's properties getter returns null. Returns a minimal `device_id`
 * list with just the system default — Recorder.ts asserts this exists
 * before configuring an audio source. Real device enumeration via
 * CoreAudio is a follow-up; the default device works for smoke tests.
 */
function synthesiseCoreAudioProperties(): ObsProperty[] {
  return [
    {
      name: 'device_id',
      description: 'Device',
      type: 'list',
      items: [{ name: 'Default', value: 'default' }],
    } as unknown as ObsProperty,
  ];
}

/**
 * Minimal property list for `sck_audio_capture`. The real OBS getter
 * blocks on SCK initialization on macOS — we don't need the values
 * for `application`/`window` here since the user picks them via the
 * renderer's app/window picker (or "Add Desktop Audio" presets
 * type=0). Recorder.configureAudioSources reads `device_id` for
 * non-PROCESS sources and skips device lookup for PROCESS, so
 * exposing a pseudo `device_id` keeps any future code paths happy.
 */
function synthesiseSckAudioProperties(): ObsProperty[] {
  return [
    {
      name: 'type',
      description: 'Capture Type',
      type: 'list',
      items: [
        { name: 'Desktop Audio', value: 0 },
        { name: 'Window', value: 1 },
        { name: 'Application', value: 2 },
      ],
    } as unknown as ObsProperty,
    {
      name: 'device_id',
      description: 'Device',
      type: 'list',
      items: [{ name: 'Desktop Audio', value: 'desktop' }],
    } as unknown as ObsProperty,
  ];
}

function encoderToOsnId(encoder: string): string {
  // Map our pseudo-IDs to the real OSN encoder IDs used by
  // VideoEncoderFactory.create(). x264 / VT use distinct identifiers.
  switch (encoder) {
    case 'VT_H264':
      return 'com.apple.videotoolbox.videoencoder.ave.avc';
    case 'VT_HEVC':
      return 'com.apple.videotoolbox.videoencoder.ave.hevc';
    default:
      return encoder; // obs_x264, h264_texture_amf, etc.
  }
}

function encoderToSimpleName(encoder: string): string {
  // Map our ESupportedEncoders values + raw OSN IDs to the OSN
  // Simple-mode RecEncoder values. VT_H264 / VT_HEVC enum entries land
  // in Task 10; this map already accepts them so Task 10 is a one-line
  // capabilities update.
  switch (encoder) {
    case 'OBS_X264':
    case 'obs_x264':
      return 'x264';
    case 'VT_H264':
    case 'com.apple.videotoolbox.videoencoder.ave.avc':
      return 'apple_h264';
    case 'VT_HEVC':
    case 'com.apple.videotoolbox.videoencoder.ave.hevc':
      return 'apple_hevc';
    default:
      console.warn(
        '[OsnBackend] unknown encoder id, falling back to x264:',
        encoder,
      );
      return 'x264';
  }
}

/**
 * macOS recorder backend — wraps obs-studio-node.
 *
 * Two macOS-specific lifecycle quirks (see docs/superpowers/notes/osn-macos-context.md):
 *   1. We must spawn obs64 ourselves and wait for its stdout readiness
 *      banner before calling IPC.connect — IPC.host races and crashes.
 *   2. We must NOT call OBS_API_destroyOBS_API on shutdown — it hangs
 *      forever on a semaphore. Instead we kill obs64 with SIGTERM and
 *      disconnect.
 */
export default class OsnBackend implements IRecorderBackend {
  private osn: typeof import('obs-studio-node') | undefined;
  private obs64: ChildProcess | undefined;
  private initialized = false;

  private cachedPreviewDimensions = {
    canvasWidth: 0,
    canvasHeight: 0,
    previewWidth: 0,
    previewHeight: 0,
  };

  private scene: import('obs-studio-node').IScene | undefined;
  private sceneName = 'wcr-scene';
  private sceneItems = new Map<string, import('obs-studio-node').ISceneItem>();
  private inputs = new Map<string, import('obs-studio-node').IInput>();
  private volmeters = new Map<string, import('obs-studio-node').IVolmeter>();
  private volmetersWanted = false;
  private cachedSourceProperties = new Map<string, ObsProperty[]>();
  private inputSourceIds = new Map<string, string>();

  private recording = false;
  private replayBuffering = false;
  private lastRecordingPath = '';

  // ISimpleRecording.start() rejects with "Invalid video encoder" unless we
  // explicitly create + assign IVideoEncoder. OBS_settings_saveSettings
  // alone doesn't bind an IVideoEncoder to the legacySettings recording.
  private lastEncoderRawId: string | undefined;
  private lastEncoderSettings: ObsData = {};
  private cachedRecordingEncoder:
    | import('obs-studio-node').IVideoEncoder
    | undefined;
  private cachedRecordingAudioEncoder:
    | import('obs-studio-node').IAudioEncoder
    | undefined;
  private lastRecOutputPath: string | undefined;
  private lastRecContainer: string | undefined;

  private previewKey = 'wcr-preview';
  private previewHwnd: Buffer | undefined;
  private previewActive = false;
  // Streamlabs Desktop's preview pattern (see github.com/streamlabs/desktop
  // app/services/video.ts): on macOS, OSN's CAOpenGLLayer renders below
  // Electron's WebContents layer when attached to the main BrowserWindow,
  // so they use `node-window-rendering` to spin up a sibling Cocoa
  // NSWindow positioned over the preview region and pipe the OBS render
  // target into it via an IOSurface.
  private nwr: typeof import('node-window-rendering') | undefined;
  private previewIOSurface = false;
  private cachedPreviewLocalX: number | undefined;
  private cachedPreviewLocalY: number | undefined;
  private surfaceWidth = 0;
  private surfaceHeight = 0;
  private rebuildTimer: NodeJS.Timeout | undefined;
  private signalCallback: import('./IRecorderBackend').SignalCallback | undefined;

  // SLOBS pattern (settings-v2/video.ts): an explicit IVideo context is
  // required for OBS_content_createDisplay's 4th arg AND for binding to
  // recording outputs. Without it, createDisplay renders black and
  // ISimpleRecording::Start NULL-derefs at +0x1c. The legacy
  // OBS_settings_saveSettings('Video', ...) call configures the global
  // video info but doesn't materialise the JS-side IVideo handle.
  private videoContext: import('obs-studio-node').IVideo | undefined;
  private videoFps = 30;
  private videoWidth = 1920;
  private videoHeight = 1080;
  private didResetVideoContextOnce = false;

  public readonly capabilities: RecorderCapabilities = {
    captureModes: [CaptureModeCapability.WINDOW, CaptureModeCapability.MONITOR],
    encoders: [
      ESupportedEncoders.OBS_X264,
      ESupportedEncoders.VT_H264,
      ESupportedEncoders.VT_HEVC,
    ],
    supportsReplayBuffer: true,
  };

  private getOsn(): typeof import('obs-studio-node') {
    if (!this.osn) {
      this.osn = require('obs-studio-node');
    }
    return this.osn!;
  }

  private osnRoot(): string {
    // Webpack bundles main into .erb/dll/main.bundle.dev.js (dev) or
    // release/app/dist/main/main.js (prod). With node.__dirname=false,
    // __dirname resolves to that output dir regardless of source path.
    // Dev path: .erb/dll → ../../release/app → release/app at repo root.
    // Prod path: process.resourcesPath/app/node_modules.
    if (app.isPackaged) {
      return path.join(
        process.resourcesPath,
        'app',
        'node_modules',
        'obs-studio-node',
      );
    }
    return path.resolve(
      __dirname,
      '../../release/app/node_modules/obs-studio-node',
    );
  }

  private obs64Path(): string {
    return path.join(this.osnRoot(), 'bin', 'obs64');
  }

  private ensureScene(): import('obs-studio-node').IScene {
    if (this.scene) return this.scene;
    const osn = this.getOsn();
    this.scene = osn.SceneFactory.create(this.sceneName);
    osn.Global.setOutputSource(0, this.scene);
    return this.scene;
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  init(options: BackendInitOptions): void {
    if (this.initialized) {
      console.warn('[OsnBackend] init called twice — ignoring');
      return;
    }

    const osn = this.getOsn();
    const helperPath = this.obs64Path();
    if (!fs.existsSync(helperPath)) {
      throw new Error(
        `[OsnBackend] obs64 helper missing at ${helperPath} — did npm install run?`,
      );
    }

    const obsRoot = this.osnRoot();
    const osnBinDir = path.join(obsRoot, 'bin');
    const userDataPath = path.join(app.getPath('userData'), 'osn-data');
    fs.mkdirSync(userDataPath, { recursive: true });

    const pipeName = `wcr-osn-${process.pid}`;

    console.info('[OsnBackend] init', {
      helper: helperPath,
      workingDir: osnBinDir,
      userData: userDataPath,
      pipe: pipeName,
    });

    // Kill any orphan obs64 processes from prior runs that crashed
    // without their parent reaping them. Multiple concurrent obs64
    // instances contend for ScreenCaptureKit + CoreAudio handles,
    // which deadlocks the new helper's `mac_screen_capture` source
    // init (observed: 2026-05-01 hang where 3 orphan obs64s stalled
    // SCK). pkill is best-effort; failures are non-fatal.
    if (process.platform === 'darwin') {
      try {
        execFileSync('pkill', ['-9', '-f', 'obs-studio-node/bin/obs64'], {
          stdio: 'ignore',
        });
        console.info('[OsnBackend] pkilled orphan obs64 processes');
      } catch {
        // pkill exits 1 if no matches — ignore.
      }
    }

    // Override the IPC server path to our patched dev binary. module.js
    // already called setServerPath at require-time pointing at OSN.app's
    // unpatched obs64 — we need the patched one.
    osn.IPC.setServerPath(helperPath, osnBinDir);

    // Step 1: spawn obs64 + wait for readiness. We must do this
    // synchronously from the caller's POV so init() retains the
    // void-returning shape the IRecorderBackend interface requires.
    this.obs64 = this.spawnObs64Sync(helperPath, pipeName);

    // Step 2: connect to the running obs64.
    console.info('[OsnBackend] IPC.connect');
    const connectResult = osn.IPC.connect(pipeName);
    if (connectResult !== 0) {
      this.killObs64();
      throw new Error(
        `[OsnBackend] IPC.connect failed with code ${connectResult}`,
      );
    }

    // Step 3: tell OBS where its data + plugins live. Pass the OSN
    // package root (NOT bin/) so libobs resolves data/, PlugIns/,
    // Frameworks/ relative to the same anchor the spike script proved
    // works. Pointing at bin/ leaves data/ unreachable and OBS_API_initAPI
    // returns -1.
    osn.NodeObs.SetWorkingDirectory(obsRoot);

    // Step 4: real init.
    console.info('[OsnBackend] OBS_API_initAPI');
    const initRes = osn.NodeObs.OBS_API_initAPI(
      'en-US',
      userDataPath,
      app.getVersion(),
    );

    if (initRes !== 0) {
      this.killObs64();
      throw new Error(
        `[OsnBackend] OBS_API_initAPI failed with code ${initRes}`,
      );
    }

    // Subscribe to OSN output signals and forward to caller's callback.
    const { subscribeOsnSignals } = require('./osn/signalWiring');
    this.signalCallback = options.signalCallback;
    subscribeOsnSignals(osn, options.signalCallback, (path: string) => {
      this.lastRecordingPath = path;
      console.info('[OsnBackend] last recording path =', path);
    });

    void options.noobsDistPath;
    void options.logPath;

    this.initialized = true;
  }

  /**
   * Spawn obs64 and block until its IPC server is ready (stdout banner)
   * or the timeout elapses. We use a poll-on-data buffer that resolves a
   * `Future`-style flag and `deasync`-via-Atomics.wait isn't available,
   * so this method actually does an event-driven wait with a hard
   * timeout — the caller (`init`) is expected to be called early in app
   * startup where blocking ~1s is acceptable.
   *
   * Note: this uses a synchronous spawn but waits via a SharedArrayBuffer
   * + Atomics.wait pattern would let init stay synchronous. For Phase 2
   * we accept that init is invoked from an async-tolerant context (it
   * already is — Recorder.initializeObs is called from createWindow).
   * If callers regress, we revisit.
   */
  private spawnObs64Sync(binaryPath: string, pipeName: string): ChildProcess {
    const child = spawn(binaryPath, [pipeName, 'DEVMODE_VERSION', binaryPath], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let ready = false;
    let stdoutBuf = '';
    let stderrBuf = '';
    let exitCode: number | null = null;
    let exitSignal: NodeJS.Signals | null = null;

    child.stdout?.on('data', (chunk: Buffer) => {
      const s = chunk.toString();
      stdoutBuf += s;
      if (!ready && stdoutBuf.includes(READY_LINE)) {
        ready = true;
      }
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString();
    });
    child.on('exit', (code, signal) => {
      exitCode = code;
      exitSignal = signal;
    });

    // Synchronous wait with bounded poll. Uses a tight nextTick loop —
    // OK because obs64 readiness arrives within ~50-200ms in practice.
    // Replace with Atomics.wait + worker thread if this becomes a perf
    // problem.
    const deadline = Date.now() + READY_TIMEOUT_MS;

    // We must turn the whole init() into async OR busy-wait. Pick async
    // path: defer the ready-check via a synchronous busy loop on event
    // loop ticks. This is ugly — long term init should be async — but
    // matches the sync IRecorderBackend.init signature and gets us
    // unblocked.
    const busyWait = require('deasync');
    let done = false;
    let error: Error | undefined;

    const poll = () => {
      if (ready) {
        done = true;
        return;
      }
      if (exitCode !== null || exitSignal !== null) {
        done = true;
        error = new Error(
          `[OsnBackend] obs64 exited before ready (code=${exitCode}, signal=${exitSignal})\nstderr: ${stderrBuf}`,
        );
        return;
      }
      if (Date.now() > deadline) {
        done = true;
        error = new Error(
          `[OsnBackend] obs64 readiness timeout after ${READY_TIMEOUT_MS}ms\nstdout: ${stdoutBuf}\nstderr: ${stderrBuf}`,
        );
        return;
      }
      setTimeout(poll, 25);
    };
    poll();

    busyWait.loopWhile(() => !done);

    if (error) {
      try {
        child.kill();
      } catch (killErr) {
        console.warn('[OsnBackend] failed to kill obs64 child', killErr);
      }
      throw error;
    }

    console.info('[OsnBackend] obs64 ready (pid=' + child.pid + ')');
    return child;
  }

  private killObs64(): void {
    if (!this.obs64) return;
    try {
      this.obs64.kill('SIGTERM');
    } catch (err) {
      console.error('[OsnBackend] killObs64 failed', err);
    }
    this.obs64 = undefined;
  }

  initPreview(hwnd: Buffer): void {
    this.previewHwnd = hwnd;
    try {
      // Packaged on Mac: nwr lives at Contents/Resources/node-window-rendering
      // (electron-builder extraResources). In dev it's resolved from
      // release/app/node_modules. Bypass webpack's static require analysis
      // via __non_webpack_require__ since the path is runtime-only.
      const nwrPath = app.isPackaged
        ? path.join(process.resourcesPath, 'node-window-rendering')
        : 'node-window-rendering';
      // eval('require') bypasses webpack's static analysis so the path
      // resolves against Node's real require at runtime.
      // eslint-disable-next-line no-eval
      const nodeRequire = eval('require') as NodeRequire;
      this.nwr = nodeRequire(nwrPath);
    } catch (err) {
      console.error(
        '[OsnBackend] node-window-rendering require failed — preview disabled',
        err,
      );
    }
    console.info('[OsnBackend] initPreview cached hwnd, nwr loaded:', !!this.nwr);
  }

  /**
   * (Re)create the IOSurface + nwr child window for the current preview
   * size. Called from showPreview and on every size change — IOSurface is
   * sized at creation time, so resize means destroy + recreate.
   */
  private rebuildPreviewSurface(): void {
    if (!this.nwr || !this.previewHwnd) return;
    const osn = this.getOsn();
    if (this.previewIOSurface) {
      try {
        this.nwr.destroyWindow(this.previewKey);
      } catch (err) {
        console.warn('[OsnBackend] nwr.destroyWindow threw', err);
      }
      try {
        this.nwr.destroyIOSurface(this.previewKey);
      } catch (err) {
        console.warn('[OsnBackend] nwr.destroyIOSurface threw', err);
      }
      this.previewIOSurface = false;
    }
    let surfaceId: number | undefined;
    try {
      console.info('[OsnBackend] rebuild: createIOSurface');
      surfaceId = osn.NodeObs.OBS_content_createIOSurface(this.previewKey);
      console.info('[OsnBackend] rebuild: createIOSurface returned', surfaceId);
    } catch (err) {
      console.error('[OsnBackend] OBS_content_createIOSurface failed', err);
      return;
    }
    if (typeof surfaceId !== 'number') {
      console.error('[OsnBackend] createIOSurface did not return a number:', surfaceId);
      return;
    }
    try {
      console.info('[OsnBackend] rebuild: nwr.createWindow');
      // SLOBS pattern: NSView added on top of WebContents in subview
      // order. View's hitTest: returns nil so mouse events fall through
      // to DOM. OBS draws selection/transform UI itself via
      // setShouldDrawUI(true) — no DOM overlay handles needed.
      // (Requires OBS_content_setOutlineColor JS binding patched in,
      // see Phase A in 2026-04-30-mac-editor-service.md.)
      this.nwr.createWindow(this.previewKey, this.previewHwnd);
      console.info('[OsnBackend] rebuild: nwr.connectIOSurface', surfaceId);
      this.nwr.connectIOSurface(this.previewKey, surfaceId);
      this.previewIOSurface = true;
      this.surfaceWidth = this.cachedPreviewDimensions.previewWidth;
      this.surfaceHeight = this.cachedPreviewDimensions.previewHeight;
      console.info('[OsnBackend] preview IOSurface attached, id', surfaceId);
    } catch (err) {
      console.error('[OsnBackend] nwr createWindow/connectIOSurface failed', err);
    }
  }

  shutdown(): void {
    if (!this.initialized) return;
    const osn = this.osn;

    // Tear down scene graph BEFORE killing obs64 so OSN releases handles
    // cleanly. Errors swallowed — the kill below is the real escape hatch.
    for (const item of this.sceneItems.values()) {
      try {
        item.remove();
        // eslint-disable-next-line no-empty
      } catch {}
    }
    this.sceneItems.clear();
    for (const input of this.inputs.values()) {
      try {
        input.release();
        // eslint-disable-next-line no-empty
      } catch {}
      try {
        input.remove();
        // eslint-disable-next-line no-empty
      } catch {}
    }
    this.inputs.clear();
    this.scene = undefined;

    try {
      osn?.NodeObs.OBS_service_removeCallback?.();
    } catch (err) {
      console.warn('[OsnBackend] removeCallback threw', err);
    }

    // Kill obs64 BEFORE IPC.disconnect — calling
    // OBS_API_destroyOBS_API on macOS hangs on a semaphore that obs64
    // exits without satisfying. Killing the helper first avoids the hang.
    this.killObs64();

    // Brief delay so the disconnect doesn't race with obs64 shutdown.
    const start = Date.now();
    while (Date.now() - start < 500) {
      // tight busy-wait — only 500ms total during app shutdown
    }

    try {
      osn?.IPC.disconnect();
    } catch (err) {
      console.warn('[OsnBackend] IPC.disconnect threw', err);
    }

    this.initialized = false;
  }

  setBuffering(_enabled: boolean): void {
    // No equivalent in OSN simple flow; replay buffer manages itself.
  }

  setDrawSourceOutline(_enabled: boolean): void {
    // Preview-only feature; deferred.
  }

  // ─── Stubs for the rest — replaced in later Phase 2 tasks ──────────────

  resetVideoContext(fps: number, width: number, height: number): void {
    const osn = this.getOsn();

    // OSN settings categories use this shape:
    //   [{ nameSubCategory, parameters: [{ name, currentValue, type }] }]
    // Mirror what Streamlabs Desktop's setting-manager does.
    const baseRes = `${width}x${height}`;
    const video = [
      {
        nameSubCategory: 'Untitled',
        parameters: [
          { name: 'Base', currentValue: baseRes, type: 'OBS_PROPERTY_LIST' },
          { name: 'Output', currentValue: baseRes, type: 'OBS_PROPERTY_LIST' },
          {
            name: 'FPSCommon',
            currentValue: String(fps),
            type: 'OBS_PROPERTY_LIST',
          },
          {
            name: 'FPSType',
            currentValue: 'Common FPS Values',
            type: 'OBS_PROPERTY_LIST',
          },
        ],
      },
    ];

    console.info('[OsnBackend] resetVideoContext', { fps, width, height });

    // SLOBS-style canvas rebuild: encoders + the dedicated recording
    // hold refs to the current IVideo. Release them before writing
    // the new IVideoInfo so the next start() picks up fresh state
    // bound to the new canvas dims. Caller is responsible for having
    // already stopped the recording / replay buffer.
    //
    // First call (initialisation) skips teardown: addSourceToScene
    // for the chat overlay calls ensureVideoContext early, so the
    // simple `videoContext !== undefined` heuristic would fire on
    // init and clobber the SimpleReplayBuffer singleton's `recording`
    // before it's been set up — observed cause of SIGKILL during
    // configureVideoSources at startup.
    const isReconfigure = this.didResetVideoContextOnce;
    if (isReconfigure) {
      this.releaseEncodersAndRecording();
    }
    this.didResetVideoContextOnce = true;

    osn.NodeObs.OBS_settings_saveSettings('Video', video);

    this.videoFps = fps;
    this.videoWidth = width;
    this.videoHeight = height;
    this.ensureVideoContext();

    // Re-bind scene items to the (possibly-new) IVideo handle — their
    // canvas-match check in DrawSelectedSource needs the bound canvas
    // to equal the display's canvas, otherwise the green selection
    // outline silently no-ops.
    if (isReconfigure) {
      this.rebindSceneItemsToVideoContext();
    }

    // Update canvas dims; preserve preview rect from the most recent
    // configurePreview call. Clobbering previewWidth/Height to canvas
    // here would force sf=1.0 in EditorService until the renderer's
    // ResizeObserver fires another configurePreview, breaking hit-test
    // accuracy mid-resolution-change.
    this.cachedPreviewDimensions.canvasWidth = width;
    this.cachedPreviewDimensions.canvasHeight = height;
    if (
      !this.cachedPreviewDimensions.previewWidth ||
      !this.cachedPreviewDimensions.previewHeight
    ) {
      this.cachedPreviewDimensions.previewWidth = width;
      this.cachedPreviewDimensions.previewHeight = height;
    }
  }

  /**
   * SLOBS-style IVideo context establishment. Creates the IVideo via
   * VideoFactory.create() once, then writes IVideoInfo into both the new
   * context AND the global Video.legacySettings so OBS sees consistent
   * config across the modern + legacy paths.
   */
  private ensureVideoContext(): import('obs-studio-node').IVideo | undefined {
    const osn = this.getOsn();
    const VideoFactory = osn.VideoFactory as
      | { create?: () => import('obs-studio-node').IVideo }
      | undefined;
    if (!this.videoContext) {
      try {
        if (typeof VideoFactory?.create !== 'function') {
          console.warn('[OsnBackend] VideoFactory.create unavailable');
          return undefined;
        }
        this.videoContext = VideoFactory.create();
      } catch (err) {
        console.error('[OsnBackend] VideoFactory.create threw', err);
        return undefined;
      }
    }
    // SLOBS pattern: read legacySettings from the freshly-created IVideo
    // (OBS_settings_saveSettings('Video') configured those), then mirror
    // into video + global Video. If legacySettings is missing fields,
    // backfill from our cached resetVideoContext call.
    let legacy: Record<string, unknown> = {};
    try {
      const ls = (
        this.videoContext as unknown as {
          legacySettings?: Record<string, unknown>;
        }
      ).legacySettings;
      if (ls && typeof ls === 'object') legacy = { ...ls };
    } catch (err) {
      console.warn('[OsnBackend] read legacySettings threw', err);
    }
    // Our cached width/height (from the most recent resetVideoContext)
    // win over stale `legacy` from a previously-created IVideo. OBS's
    // saveSettings('Video', baseRes) does not always propagate back to
    // the legacySettings of an existing IVideo, leaving the canvas at
    // 1920x1080 defaults while sceneItem.position math expects whatever
    // the user configured. Using `this.videoWidth` as the primary
    // source-of-truth avoids that drift.
    const info = {
      fpsNum: this.videoFps,
      fpsDen: 1,
      baseWidth: this.videoWidth,
      baseHeight: this.videoHeight,
      outputWidth: this.videoWidth,
      outputHeight: this.videoHeight,
      outputFormat: (legacy.outputFormat as number) ?? 2,
      colorspace: (legacy.colorspace as number) ?? 2,
      range: (legacy.range as number) ?? 1,
      scaleType: (legacy.scaleType as number) ?? 3,
      fpsType: (legacy.fpsType as number) ?? 0,
    } as unknown as import('obs-studio-node').IVideoInfo;
    console.info('[OsnBackend] videoContext info', info);
    try {
      this.videoContext.video = info;
      this.videoContext.legacySettings = info;
    } catch (err) {
      console.warn('[OsnBackend] videoContext info assignment threw', err);
    }
    try {
      const Video = osn.Video as unknown as {
        video?: import('obs-studio-node').IVideoInfo;
        legacySettings?: import('obs-studio-node').IVideoInfo;
      };
      Video.video = info;
      Video.legacySettings = info;
    } catch (err) {
      console.warn('[OsnBackend] osn.Video info assignment threw', err);
    }
    return this.videoContext;
  }
  getPreviewInfo() {
    return this.cachedPreviewDimensions;
  }
  configurePreview(x: number, y: number, w: number, h: number): void {
    // SLOBS pattern: renderer sends already-flipped point coords on Mac
    // (rect.left, window.innerHeight - rect.bottom, rect.width, rect.height).
    // nwr.moveWindow + IOSurface render target both work in point space
    // with bottom-left origin, so pass through directly.
    const px = Math.round(x);
    const py = Math.round(y);
    const pw = Math.max(1, Math.round(w));
    const ph = Math.max(1, Math.round(h));
    console.info('[OsnBackend] configurePreview coords', { px, py, pw, ph });

    const sizeChanged = pw !== this.surfaceWidth || ph !== this.surfaceHeight;

    this.cachedPreviewLocalX = px;
    this.cachedPreviewLocalY = py;
    this.cachedPreviewDimensions.previewWidth = pw;
    this.cachedPreviewDimensions.previewHeight = ph;

    if (!this.previewActive) return;
    if (sizeChanged) {
      const osn = this.getOsn();
      try {
        osn.NodeObs.OBS_content_resizeDisplay(this.previewKey, pw, ph);
      } catch (err) {
        console.warn('[OsnBackend] resizeDisplay threw', err);
      }
      // The IOSurface is sized at creation time; nwr's NSView frame
      // tracks IOSurface dims, not the OBS display viewport. Rebuilding
      // mid-burst breaks the OBS render path (preview goes black), so
      // debounce the rebuild for 250ms — once the resize stream
      // settles, recreate the IOSurface at the final size so the
      // NSView frame matches the user's new preview dimensions.
      if (this.rebuildTimer) clearTimeout(this.rebuildTimer);
      this.rebuildTimer = setTimeout(() => {
        this.rebuildTimer = undefined;
        if (!this.previewActive) return;
        try {
          this.rebuildPreviewSurface();
          // After rebuild, re-anchor at the latest cached origin.
          const finalX = this.cachedPreviewLocalX ?? 0;
          const finalY = this.cachedPreviewLocalY ?? 0;
          this.nwr?.moveWindow(this.previewKey, finalX, finalY);
        } catch (err) {
          console.warn('[OsnBackend] debounced IOSurface rebuild threw', err);
        }
      }, 250);
    }
    try {
      this.nwr?.moveWindow(this.previewKey, px, py);
    } catch (err) {
      console.warn('[OsnBackend] nwr.moveWindow threw', err);
    }
  }
  showPreview(): void {
    if (this.previewActive) return;
    if (!this.previewHwnd || !this.nwr) {
      console.warn(
        '[OsnBackend] showPreview — hwnd or nwr missing, preview disabled',
      );
      return;
    }
    const osn = this.getOsn();
    const w = Math.max(1, this.cachedPreviewDimensions.previewWidth);
    const h = Math.max(1, this.cachedPreviewDimensions.previewHeight);
    try {
      console.info('[OsnBackend] showPreview step 1: createDisplay');
      const ctx = this.ensureVideoContext();
      // Use SourcePreviewDisplay with our scene as the bound source so
      // libobs `GetSourceForUIEffects` returns the scene, enabling
      // `DrawSelectedSource` enumeration. The plain `createDisplay`
      // path falls through to channel-0 transition lookup, which fails
      // when channel 0 holds a scene directly (no transition wrapper),
      // silently skipping all UI drawing. Signature:
      //   (hwnd, sourceName, key, renderAtBottom, IVideo)
      this.ensureScene();
      osn.NodeObs.OBS_content_createSourcePreviewDisplay(
        this.previewHwnd,
        this.sceneName,
        this.previewKey,
        false,
        ctx,
      );
      console.info('[OsnBackend] showPreview step 2: resizeDisplay', { w, h });
      osn.NodeObs.OBS_content_resizeDisplay(this.previewKey, w, h);
      console.info('[OsnBackend] showPreview step 3: setShouldDrawUI');
      // SLOBS pattern: OBS draws selection rectangle + transform handles
      // itself. Default outline color in libobs is 0xFFA8E61A (green) so
      // no setOutlineColor needed. Required: scene items must be bound
      // to the same IVideo canvas as the display (see addSourceToScene)
      // — otherwise libobs `DrawSelectedSource` early-exits silently.
      osn.NodeObs.OBS_content_setShouldDrawUI(this.previewKey, true);
      this.previewActive = true;
      console.info('[OsnBackend] showPreview step 4: rebuildPreviewSurface');
      this.rebuildPreviewSurface();
      const px = this.cachedPreviewLocalX ?? 0;
      const py = this.cachedPreviewLocalY ?? 0;
      console.info('[OsnBackend] showPreview step 5: moveWindow', { x: px, y: py });
      this.nwr.moveWindow(this.previewKey, px, py);
      console.info('[OsnBackend] preview shown', { x: px, y: py, w, h });
    } catch (err) {
      console.error('[OsnBackend] showPreview failed', err);
    }
  }
  hidePreview(): void {
    if (!this.previewActive) return;
    const osn = this.getOsn();
    if (this.nwr && this.previewIOSurface) {
      try {
        this.nwr.destroyWindow(this.previewKey);
      } catch (err) {
        console.warn('[OsnBackend] nwr.destroyWindow threw', err);
      }
      try {
        this.nwr.destroyIOSurface(this.previewKey);
      } catch (err) {
        console.warn('[OsnBackend] nwr.destroyIOSurface threw', err);
      }
      this.previewIOSurface = false;
    }
    try {
      osn.NodeObs.OBS_content_destroyDisplay(this.previewKey);
    } catch (err) {
      console.warn('[OsnBackend] hidePreview destroyDisplay threw', err);
    }
    this.previewActive = false;
    this.surfaceWidth = 0;
    this.surfaceHeight = 0;
  }
  disablePreview(): void {
    this.hidePreview();
  }
  setRecordingCfg(outputPath: string, container: string): void {
    const osn = this.getOsn();

    // Output 'Mode' must be set to Simple before nameSubCategory='Recording'
    // accepts our path/format params. Stream the two saves separately so
    // the Mode change applies first.
    osn.NodeObs.OBS_settings_saveSettings('Output', [
      {
        nameSubCategory: 'Untitled',
        parameters: [
          { name: 'Mode', currentValue: 'Simple', type: 'OBS_PROPERTY_LIST' },
        ],
      },
    ]);

    osn.NodeObs.OBS_settings_saveSettings('Output', [
      {
        nameSubCategory: 'Recording',
        parameters: [
          {
            name: 'RecFilePath',
            currentValue: outputPath,
            type: 'OBS_PROPERTY_PATH',
          },
          {
            name: 'RecFormat',
            currentValue: container,
            type: 'OBS_PROPERTY_LIST',
          },
        ],
      },
    ]);

    console.info('[OsnBackend] setRecordingCfg', { outputPath, container });
    this.lastRecOutputPath = outputPath;
    this.lastRecContainer = container;
  }
  setVideoEncoder(encoder: string, settings: ObsData): void {
    const osn = this.getOsn();
    const recEncoder = encoderToSimpleName(encoder);

    const params: Array<{
      name: string;
      currentValue: string | number;
      type: string;
    }> = [
      {
        name: 'RecEncoder',
        currentValue: recEncoder,
        type: 'OBS_PROPERTY_LIST',
      },
    ];

    // Map quality settings to OSN Simple-mode names. settings.rate_control,
    // settings.crf and settings.cqp come from Recorder.ts:getEncoderSettings.
    if (settings.rate_control) {
      params.push({
        name: 'RecRB',
        currentValue: String(settings.rate_control),
        type: 'OBS_PROPERTY_LIST',
      });
    }
    if (settings.crf !== undefined) {
      params.push({
        name: 'RecCRF',
        currentValue: Number(settings.crf),
        type: 'OBS_PROPERTY_INT',
      });
    }
    if (settings.cqp !== undefined) {
      params.push({
        name: 'RecCQP',
        currentValue: Number(settings.cqp),
        type: 'OBS_PROPERTY_INT',
      });
    }

    console.info('[OsnBackend] setVideoEncoder', {
      encoder,
      recEncoder,
      settings,
    });
    osn.NodeObs.OBS_settings_saveSettings('Output', [
      { nameSubCategory: 'Recording', parameters: params },
    ]);

    // Cache for ensureRecordingEncoder() — invalidate any previous encoder.
    this.lastEncoderRawId = encoderToOsnId(encoder);
    this.lastEncoderSettings = settings;
    if (this.cachedRecordingEncoder) {
      try {
        this.cachedRecordingEncoder.release();
      } catch {
        // ignore — encoder may already be released or in-use
      }
      this.cachedRecordingEncoder = undefined;
    }
  }
  listVideoEncoders(): string[] {
    // Capability-driven Settings UI reads from `capabilities.encoders`,
    // not this method, but Recorder.configureBase falls through here as a
    // best-available probe. Mirror our capabilities.encoders list.
    return this.capabilities.encoders;
  }
  createSource(id: string, type: string): string {
    const osn = this.getOsn();
    const { resolveMacSource } = require('./osn/sourceFactory');
    const { sourceId, defaults } = resolveMacSource(type);
    const input = osn.InputFactory.create(sourceId, id, defaults);
    this.inputs.set(id, input);
    this.inputSourceIds.set(id, sourceId);
    console.info('[OsnBackend] createSource', { id, type, sourceId });
    // Audio settings panel may have already enabled volmeters before
    // this source existed; attach now so the meter bar reacts on
    // first device select instead of needing a settings reopen.
    this.attachVolmeter(id);
    return id;
  }

  deleteSource(id: string): void {
    const input = this.inputs.get(id);
    const vm = this.volmeters.get(id);
    if (vm) {
      try {
        vm.detach();
      } catch {
        /* ignore */
      }
      try {
        vm.destroy();
      } catch {
        /* ignore */
      }
      this.volmeters.delete(id);
    }
    // Always clear the maps — even if input was already gone or
    // release/remove throws, our state must not hold stale refs that
    // the next createSource cycle could collide with.
    this.inputs.delete(id);
    this.inputSourceIds.delete(id);
    this.cachedSourceProperties.delete(id);
    const item = this.sceneItems.get(id);
    if (item) {
      try {
        item.remove();
      } catch {
        // Item may have been auto-removed when its source died.
      }
      this.sceneItems.delete(id);
    }
    if (!input) return;
    let releaseFailed = false;
    try {
      input.release();
    } catch {
      // Source ref already invalid (auto-released by OBS or removed
      // out from under us). No point trying remove() if release
      // failed — same underlying ref, will throw the same way.
      releaseFailed = true;
    }
    if (releaseFailed) return;
    try {
      input.remove();
    } catch {
      // Best-effort.
    }
  }

  addSourceToScene(name: string): void {
    const input = this.inputs.get(name);
    if (!input) {
      console.warn(
        '[OsnBackend] addSourceToScene: no input registered for',
        name,
      );
      return;
    }
    const scene = this.ensureScene();
    const item = scene.add(input);
    // Bind item to our IVideo context so the display's canvas-match
    // check in libobs `DrawSelectedSource` passes; without this the
    // selection outline (and overflow gizmos) silently no-op even with
    // setShouldDrawUI(true). SLOBS does the same in scene-item.ts.
    const ctx = this.ensureVideoContext();
    if (ctx) {
      try {
        item.video = ctx;
      } catch (err) {
        console.warn('[OsnBackend] sceneItem.video assignment threw', err);
      }
    }
    this.sceneItems.set(name, item);
  }

  removeSourceFromScene(name: string): void {
    const item = this.sceneItems.get(name);
    if (!item) return;
    try {
      item.remove();
    } catch (e) {
      console.warn('[OsnBackend] removeSourceFromScene threw', e);
    }
    this.sceneItems.delete(name);
  }

  getSourceSettings(id: string): ObsData {
    const input = this.inputs.get(id);
    if (!input) return {};
    return (input.settings as ObsData) ?? {};
  }

  setSourceSettings(id: string, settings: ObsData): void {
    const input = this.inputs.get(id);
    if (!input) return;
    // Reverse the aliasing done in adaptOsnProperty so Recorder.ts
    // can write `monitor_id` and OSN's mac display_capture source
    // sees the value under its real key (`display_uuid`).
    const translated: ObsData = { ...settings };
    if ('monitor_id' in translated) {
      translated.display_uuid = translated.monitor_id;
      delete translated.monitor_id;
    }
    input.update(translated);
  }

  getSourceProperties(id: string): ObsProperty[] {
    const input = this.inputs.get(id);
    if (!input) {
      console.warn(
        '[OsnBackend] getSourceProperties: no input for id',
        id,
        'known ids:',
        Array.from(this.inputs.keys()),
      );
      return [];
    }
    // Short-circuit for sources whose libobs property fetch blocks on
    // macOS:
    //   - coreaudio_output_capture: no public output-device list API.
    //   - sck_audio_capture: SCK init can hang during enumeration.
    // Both return synthesised lists so Recorder.configureAudioSources
    // can proceed without blocking the OSN sync IPC.
    const sourceId = this.inputSourceIds.get(id) ?? '';
    if (sourceId === 'coreaudio_output_capture') {
      console.info(
        '[OsnBackend] getSourceProperties (synth coreaudio_output)',
        id,
      );
      return synthesiseCoreAudioProperties();
    }
    if (sourceId === 'sck_audio_capture') {
      console.info('[OsnBackend] getSourceProperties (synth sck_audio)', id);
      return synthesiseSckAudioProperties();
    }

    // Cache OSN sync IPC results per source. Repeat property fetches
    // for the same input (e.g. configureAudioSources then UI dropdown)
    // can hang on the second call when libobs's CoreAudio/SCK enum
    // is mid-flight. Using the cached snapshot from the first call
    // avoids the freeze; refresh happens via deleteSource invalidating
    // the cache entry.
    //
    // Exception: mac_screen_capture sources need fresh enumeration
    // on every call because attachCaptureSource polls for the WoW
    // window — caching would freeze the list and block matching once
    // WoW launches after the first poll.
    const skipCache = sourceId === 'mac_screen_capture';
    if (!skipCache) {
      const cached = this.cachedSourceProperties.get(id);
      if (cached) return cached;
    }
    const props = input.properties;
    // OSN's `input.properties` getter returns null for `screen_capture`
    // on macOS regardless of source readiness — the IPC reply just
    // doesn't arrive. Synthesize the property list Recorder.ts expects
    // using Electron APIs as a fallback so monitor + window selection
    // still works.
    if (!props) {
      const sourceId = this.inputSourceIds.get(id) ?? '';
      console.warn(
        '[OsnBackend] getSourceProperties: input.properties null, synthesising for',
        id,
        'sourceId:',
        sourceId,
      );
      if (sourceId === 'screen_capture') {
        return synthesiseScreenCaptureProperties();
      }
      if (
        sourceId === 'coreaudio_input_capture' ||
        sourceId === 'coreaudio_output_capture'
      ) {
        return synthesiseCoreAudioProperties();
      }
      return [];
    }
    const out: ObsProperty[] = [];
    // OSN's IProperty walking: `props.first()`, then `prop.next()`, until null.
    // Adapted into the noobs-shaped object Recorder.ts expects: lowercase
    // type strings, list-typed properties exposed with `items` directly on
    // the property (not nested in `details`).
    let p: import('obs-studio-node').IProperty | undefined = props.first();
    while (p) {
      out.push(adaptOsnProperty(p));
      p = p.next() ?? undefined;
    }
    // CoreAudio device-list fallback no longer needed here: the
    // coreaudio_*_capture short-circuit above returns synthesised
    // props before reaching this walk. Block kept guarded for safety
    // in case future code paths land non-coreaudio sources here that
    // still need empty-list patching — currently a no-op.
    const sourceIdAfter = this.inputSourceIds.get(id) ?? '';
    if (
      sourceIdAfter === 'coreaudio_input_capture' ||
      sourceIdAfter === 'coreaudio_output_capture'
    ) {
      const deviceProp = out.find((o) => o.name === 'device_id') as
        | (ObsProperty & { items?: { name: string; value: string }[] })
        | undefined;
      if (deviceProp && (!deviceProp.items || deviceProp.items.length === 0)) {
        deviceProp.items = [{ name: 'Default', value: 'default' }];
      }
    }
    console.info(
      '[OsnBackend] getSourceProperties',
      id,
      '→',
      out.map((o) => `${o.name}:${o.type}`).join(', '),
    );
    // Diagnostic: dump window list entries when this is the
    // mac_screen_capture source so we can see how SCK names WoW.
    const windowProp = out.find((o) => o.name === 'window') as
      | (ObsProperty & { items?: { name: string; value: unknown }[] })
      | undefined;
    if (windowProp?.items?.length) {
      // Brief: just count + WoW match status. Full dump removed to
      // avoid spamming logs during attachCaptureSource's 5s polling.
      const wowMatch = windowProp.items.find((it) =>
        /^\[Wow(?:Classic)?\]|^\[World of Warcraft/.test(String(it.name)),
      );
      console.info(
        '[OsnBackend] window items count:',
        windowProp.items.length,
        wowMatch ? `wow=${String(wowMatch.name)}` : 'wow=none',
      );
    }
    if (!skipCache) this.cachedSourceProperties.set(id, out);
    return out;
  }
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
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        cropLeft: 0,
        cropRight: 0,
        cropTop: 0,
        cropBottom: 0,
        width: 0,
        height: 0,
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

  setSceneItemSelected(id: string, selected: boolean): void {
    const item = this.sceneItems.get(id);
    if (item) item.selected = selected;
  }

  clearSceneItemSelection(): void {
    this.sceneItems.forEach((it) => {
      try {
        it.selected = false;
      } catch {
        /* item may have been removed mid-flight */
      }
    });
  }

  listSceneItems(): string[] {
    if (!this.scene) return [];
    return this.scene.getItems().map((it) => it.source.name);
  }

  setVolmeterEnabled(enabled: boolean): void {
    this.volmetersWanted = enabled;
    if (enabled) {
      // Attach volmeter to every CURRENT input. New inputs created
      // after this call get attached lazily in createSource.
      this.inputs.forEach((_input, id) => this.attachVolmeter(id));
    } else {
      this.volmeters.forEach((vm) => {
        try {
          vm.detach();
        } catch {
          /* ignore */
        }
        try {
          vm.destroy();
        } catch {
          /* ignore */
        }
      });
      this.volmeters.clear();
    }
  }

  private attachVolmeter(id: string): void {
    if (!this.volmetersWanted) return;
    if (this.volmeters.has(id)) return;
    const input = this.inputs.get(id);
    if (!input) return;
    try {
      const osn = this.getOsn();
      const vm = osn.VolmeterFactory.create(1); // EFaderType.IEC
      vm.attach(input);
      this.volmeters.set(id, vm);
    } catch (err) {
      console.warn(
        '[OsnBackend] VolmeterFactory.create/attach threw for',
        id,
        err,
      );
    }
  }

  setForceMono(_enabled: boolean): void {
    // Global audio setting via OBS_settings_saveSettings('Audio', ...).
    // Mic-only feature; deferred until mic audio source lands.
  }

  setAudioSuppression(_enabled: boolean): void {
    // Same rationale as setForceMono — mic-only feature, deferred.
  }

  setMuteAudioInputs(muted: boolean): void {
    for (const input of this.inputs.values()) {
      // Heuristic: only audio sources expose audioMixers. Filter by that
      // so we don't accidentally mute the video capture source.
      if ((input as { audioMixers?: number }).audioMixers !== undefined) {
        input.muted = muted;
      }
    }
  }
  /**
   * Lazy-init the OSN modern factory objects. `legacySettings` returns
   * a singleton already-configured by OBS_settings_saveSettings, so our
   * existing setRecordingCfg/setVideoEncoder calls feed into it.
   * Modern start()/stop() calls bypass the broken legacy
   * OBS_service_startReplayBuffer that uses streaming-encoder context.
   */
  private getReplayBuffer(): import('obs-studio-node').ISimpleReplayBuffer {
    const osn = this.getOsn();
    return osn.SimpleReplayBufferFactory.legacySettings;
  }

  private dedicatedRecording:
    | import('obs-studio-node').ISimpleRecording
    | undefined;

  private getRecording(): import('obs-studio-node').ISimpleRecording {
    const osn = this.getOsn();
    // Use a dedicated SimpleRecording instance separate from the
    // replay buffer's inner recording (which is the legacySettings
    // singleton, assigned to rb.recording in startBuffer). Sharing the
    // singleton between the two outputs left OBS unable to finalise
    // the recording's mkv — ffmpeg later refused the partial file with
    // "Invalid data found when processing input".
    if (!this.dedicatedRecording) {
      this.dedicatedRecording = osn.SimpleRecordingFactory.create();
    }
    return this.dedicatedRecording;
  }

  /**
   * Release everything that holds a reference to the current IVideo
   * context. Called before resetVideoContext when the canvas
   * resolution changes — encoders + the dedicated recording instance
   * are bound to the IVideo at create time, so they must be torn
   * down before the IVideo is replaced. SLOBS pattern: drop refs,
   * recreate after new context is up. Recreate happens lazily on
   * the next ensureRecordingEncoder / startBuffer / startRecording.
   */
  private releaseEncodersAndRecording(): void {
    if (this.cachedRecordingEncoder) {
      try {
        this.cachedRecordingEncoder.release();
      } catch (err) {
        console.warn('[OsnBackend] cachedRecordingEncoder.release threw', err);
      }
      this.cachedRecordingEncoder = undefined;
    }
    if (this.cachedRecordingAudioEncoder) {
      try {
        this.cachedRecordingAudioEncoder.release();
      } catch (err) {
        console.warn(
          '[OsnBackend] cachedRecordingAudioEncoder.release threw',
          err,
        );
      }
      this.cachedRecordingAudioEncoder = undefined;
    }
    if (this.dedicatedRecording) {
      try {
        this.dedicatedRecording.release?.();
      } catch (err) {
        console.warn('[OsnBackend] dedicatedRecording.release threw', err);
      }
      this.dedicatedRecording = undefined;
    }
    // Drop the replay buffer's inner recording binding. The buffer
    // itself is a singleton (SimpleReplayBufferFactory.legacySettings)
    // and gets re-bound in startBuffer.
    try {
      const osn = this.getOsn();
      const rb = osn.SimpleReplayBufferFactory.legacySettings;
      // Cast: ISimpleReplayBuffer.recording is settable but typed
      // strictly. null is safe — startBuffer reassigns before .start().
      (rb as unknown as { recording: unknown }).recording = null;
    } catch (err) {
      console.warn('[OsnBackend] rb.recording = null threw', err);
    }
  }

  /**
   * Re-bind every scene item's `.video` to the current IVideo so the
   * libobs DrawSelectedSource canvas-match check passes after a
   * resetVideoContext (which replaces the IVideo handle).
   */
  private rebindSceneItemsToVideoContext(): void {
    const ctx = this.ensureVideoContext();
    if (!ctx) return;
    this.sceneItems.forEach((item, name) => {
      try {
        item.video = ctx;
      } catch (err) {
        console.warn(
          '[OsnBackend] rebind sceneItem.video threw for',
          name,
          err,
        );
      }
    });
  }

  /**
   * Lazily build an IVideoEncoder for the recording/replay-buffer outputs.
   * SimpleRecording.start() rejects with "Invalid video encoder" when
   * legacySettings.videoEncoder is unset; OBS_settings_saveSettings
   * configures the simple-mode RecEncoder string but doesn't materialise
   * the IVideoEncoder object.
   */
  private ensureRecordingEncoder(): import('obs-studio-node').IVideoEncoder {
    if (this.cachedRecordingEncoder) return this.cachedRecordingEncoder;
    if (!this.lastEncoderRawId) {
      throw new Error(
        '[OsnBackend] ensureRecordingEncoder called before setVideoEncoder',
      );
    }
    const osn = this.getOsn();
    const enc = osn.VideoEncoderFactory.create(
      this.lastEncoderRawId,
      'wcr-recording-encoder',
      this.lastEncoderSettings as Record<string, unknown>,
    );
    console.info('[OsnBackend] created IVideoEncoder', {
      id: this.lastEncoderRawId,
      settings: this.lastEncoderSettings,
    });
    this.cachedRecordingEncoder = enc;
    return enc;
  }

  /**
   * ISimpleRecording.audioEncoder must be set before Start; obs64 SIGABRTs
   * inside ISimpleRecording::Start otherwise.
   */
  private ensureRecordingAudioEncoder(): import('obs-studio-node').IAudioEncoder {
    if (this.cachedRecordingAudioEncoder) return this.cachedRecordingAudioEncoder;
    const osn = this.getOsn();
    const enc = osn.AudioEncoderFactory.create('ffmpeg_aac', 'wcr-rec-audio');
    console.info('[OsnBackend] created IAudioEncoder', { id: 'ffmpeg_aac' });
    this.cachedRecordingAudioEncoder = enc;
    return enc;
  }

  startBuffer(): void {
    if (this.replayBuffering) {
      console.info('[OsnBackend] startBuffer — already running, synthesising start signal');
      // Replay buffer never actually stops between activities (stopRecording
      // only finalises a save). Recorder.startObsBuffer waits on a fresh
      // 'start' signal — emit one synthetically so the state machine
      // advances back to recording (Ready in the UI) instead of being
      // stuck on Waiting.
      this.signalCallback?.({
        type: 'replay-buffer',
        id: 'start',
        signal: 'start',
        code: 0,
        error: '',
      } as unknown as import('./types').Signal);
      return;
    }
    // Diagnostic bypass: SimpleReplayBuffer.start() returns "Failed to make
    // IPC call" on macOS with no obs64-side error logged. When
    // WCR_OSN_BUFFER_BYPASS=1, fall back to SimpleRecording.start() to
    // confirm the recording IPC path works end-to-end.
    if (process.env.WCR_OSN_BUFFER_BYPASS === '1') {
      console.info(
        '[OsnBackend] startBuffer — BYPASS active, delegating to startRecording',
      );
      this.startRecording(0);
      // forceStop will attempt rb.stop() on this flag — wrapped in try/catch
      // so the bogus IPC error is harmless for the diagnostic.
      this.replayBuffering = true;
      return;
    }
    console.info('[OsnBackend] startBuffer (SimpleReplayBuffer)');
    const osn = this.getOsn();
    const rb = this.getReplayBuffer();
    // SimpleReplayBuffer.Start dereferences `replayBuffer->recording`;
    // GetLegacySettings doesn't populate it, so we must explicitly
    // assign a SimpleRecording. Use the legacySettings singleton so
    // OBS_settings_saveSettings('Output', 'Recording') flows through.
    const inner = osn.SimpleRecordingFactory.legacySettings;
    const ctx = this.ensureVideoContext();
    if (ctx) inner.video = ctx;
    inner.quality = 1; // HighQuality — see startRecording note
    inner.videoEncoder = this.ensureRecordingEncoder();
    inner.audioEncoder = this.ensureRecordingAudioEncoder();
    if (this.lastRecOutputPath) inner.path = this.lastRecOutputPath;
    if (this.lastRecContainer) {
      inner.format = this
        .lastRecContainer as import('obs-studio-node').ERecordingFormat;
    }
    rb.recording = inner;
    if (this.lastRecOutputPath) rb.path = this.lastRecOutputPath;
    if (this.lastRecContainer) {
      rb.format = this
        .lastRecContainer as import('obs-studio-node').ERecordingFormat;
    }
    rb.fileFormat = '%CCYY-%MM-%DD %hh-%mm-%ss';
    rb.duration = 30; // 30s rolling buffer
    rb.usesStream = false; // use recording encoders (not streaming)
    rb.signalHandler = (signal) => {
      console.info('[OsnBackend] replay-buffer signal', signal);
      // Forward to the global callback so Recorder.handleSignal's
      // startQueue.shift() sees the 'start' event. Per-output signals
      // don't flow through OBS_service_connectOutputSignals.
      const s = signal as unknown as {
        type?: string;
        signal?: string;
        code?: number;
        error?: string;
      };
      this.signalCallback?.({
        type: s.type ?? 'replay-buffer',
        id: s.signal ?? '',
        signal: s.signal,
        code: s.code ?? 0,
        error: s.error ?? '',
      } as unknown as import('./types').Signal);
    };
    rb.start();
    this.replayBuffering = true;
  }

  startRecording(offsetSeconds: number): void {
    if (this.recording) {
      console.info('[OsnBackend] startRecording — already running, ignoring');
      return;
    }
    console.info('[OsnBackend] startRecording', { offsetSeconds });
    void offsetSeconds;
    const rec = this.getRecording();
    const ctx = this.ensureVideoContext();
    if (ctx) rec.video = ctx;
    // ERecordingQuality.HighQuality = 1. SLOBS' SimpleRecording::Start
    // only calls obs_encoder_set_video_mix for the video encoder when
    // quality is HighQuality / HigherQuality (via UpdateRecordingSettings_crf).
    // Default (Stream=0) skips the binding and the encoder fails with
    // "encoder has no media set" at output start.
    rec.quality = 1;
    rec.videoEncoder = this.ensureRecordingEncoder();
    rec.audioEncoder = this.ensureRecordingAudioEncoder();
    if (this.lastRecOutputPath) rec.path = this.lastRecOutputPath;
    if (this.lastRecContainer) {
      rec.format = this
        .lastRecContainer as import('obs-studio-node').ERecordingFormat;
    }
    rec.signalHandler = (signal) => {
      console.info('[OsnBackend] recording signal', signal);
      const s = signal as unknown as {
        type?: string;
        signal?: string;
        code?: number;
        error?: string;
      };
      // Pull lastFile() on stop signals so getLastRecording works.
      if (s.signal === 'stop' || s.signal === 'wrote') {
        try {
          const p = rec.lastFile();
          if (p) this.lastRecordingPath = p;
        } catch {
          // ignore
        }
      }
      // Forward to global callback so Recorder.handleSignal sees it.
      this.signalCallback?.({
        type: s.type ?? 'recording',
        id: s.signal ?? '',
        signal: s.signal,
        code: s.code ?? 0,
        error: s.error ?? '',
      } as unknown as import('./types').Signal);
    };
    rec.start();
    this.recording = true;
  }

  stopRecording(): void {
    if (!this.recording) {
      console.info('[OsnBackend] stopRecording — not running, ignoring');
      return;
    }
    console.info('[OsnBackend] stopRecording');
    const rec = this.getRecording();
    // rec.stop() can throw "Invalid recording output" when the
    // replay buffer's inner recording is the same legacy singleton
    // (rb.recording = SimpleRecordingFactory.legacySettings) — OBS
    // already finalised the output file and treats a second stop as
    // an error. The .mkv is on disk regardless, so capture the path
    // and swallow the redundant-stop error.
    try {
      rec.stop();
    } catch (err) {
      console.warn(
        '[OsnBackend] rec.stop threw (likely redundant stop on already-finalised output)',
        err,
      );
    }
    try {
      const p = rec.lastFile();
      if (p) this.lastRecordingPath = p;
    } catch {
      // ignore
    }
    // rec.lastFile() can return empty when rec.stop() threw — fall back
    // to scanning the recording directory for the newest .mkv.
    if (!this.lastRecordingPath && this.lastRecOutputPath) {
      try {
        const dir = this.lastRecOutputPath;
        const files = fs
          .readdirSync(dir)
          .filter((f) => f.endsWith('.mkv'))
          .map((f) => ({
            name: f,
            mtime: fs.statSync(path.join(dir, f)).mtimeMs,
          }))
          .sort((a, b) => b.mtime - a.mtime);
        if (files.length > 0) {
          this.lastRecordingPath = path.join(dir, files[0].name);
          console.info(
            '[OsnBackend] lastFile fallback:',
            this.lastRecordingPath,
          );
        }
      } catch (err) {
        console.warn('[OsnBackend] lastFile dir-scan threw', err);
      }
    }
    this.recording = false;
    // Synthesise a 'wrote' signal so Recorder.stopObsRecording's
    // stopQueue.shift() resolves promptly. Recorder.handleSignal
    // listens for `EOBSOutputSignal.Deactivate` ('deactivate') to push
    // onto stopQueue. Some replay-buffer save flows skip the global
    // output-signal channel, so emit it ourselves.
    this.signalCallback?.({
      type: 'recording',
      id: 'deactivate',
      signal: 'deactivate',
      code: 0,
      error: '',
    } as unknown as import('./types').Signal);
  }

  /**
   * Returns true when the SimpleReplayBuffer singleton's underlying
   * recording binding is non-null. After a video-context reset (encoder
   * change, resolution change, etc.) `releaseEncodersAndRecording` clears
   * `legacySettings.recording` to null, which leaves the rb in a "no
   * output" state where `getReplayBuffer().stop(true)` throws "Invalid
   * replay buffer output". Detect that state explicitly so we can skip
   * the stop call and treat it as already-stopped.
   */
  private replayBufferOutputValid(): boolean {
    try {
      const rb = this.getOsn().SimpleReplayBufferFactory.legacySettings;
      return (rb as unknown as { recording: unknown }).recording != null;
    } catch {
      return false;
    }
  }

  forceStopRecording(): void {
    let didAnything = false;

    if (this.recording) {
      didAnything = true;
      try {
        this.getRecording().stop(true);
      } catch (err) {
        console.warn(
          '[OsnBackend] forceStopRecording — recording.stop threw, continuing',
          err,
        );
      }
      this.recording = false;
    }

    if (this.replayBuffering) {
      didAnything = true;
      if (this.replayBufferOutputValid()) {
        try {
          this.getReplayBuffer().stop(true);
        } catch (err) {
          // Race: libobs may have torn the output down between the
          // validity check and the stop call. Log + carry on; the
          // synthetic deactivate below still unblocks the state machine.
          console.warn(
            '[OsnBackend] forceStopRecording — replayBuffer.stop threw, continuing',
            err,
          );
        }
      } else {
        console.info(
          '[OsnBackend] forceStopRecording — replay buffer output already invalid, skipping stop',
        );
      }
      this.replayBuffering = false;
    }

    if (didAnything) {
      // Emit a synthetic 'deactivate' so Recorder.forceStopOBS's
      // stopQueue.shift() unblocks. libobs's own deactivate signal is
      // unreliable on Mac when the rb output was already invalid (no stop
      // happened, no signal fired) — synthesising guarantees the bomb
      // timer doesn't reject and Manager.reconfigureBase can proceed.
      this.signalCallback?.({
        type: 'recording',
        id: 'deactivate',
        signal: 'deactivate',
        code: 0,
        error: '',
      } as unknown as import('./types').Signal);
    }
  }

  getLastRecording(): string {
    return this.lastRecordingPath;
  }
}
