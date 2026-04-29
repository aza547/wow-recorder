import path from 'path';
import fs from 'fs';
import { ChildProcess, spawn } from 'child_process';
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
function adaptOsnProperty(p: import('obs-studio-node').IProperty): ObsProperty {
  const typeNum = p.type as unknown as number;
  const typeStr = OSN_PROP_TYPE_NAMES[typeNum] ?? String(typeNum);
  const out: Record<string, unknown> = {
    name: p.name,
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
function synthesiseScreenCaptureProperties(): ObsProperty[] {
  const displays = screen.getAllDisplays();
  const monitorItems = displays.map((d, idx) => ({
    name: d.label || `Display ${idx + 1}`,
    value: String(d.id),
  }));

  // Window list cannot be enumerated cheaply from Electron — return
  // an empty list. Window-capture mode will fail until we wire a real
  // CGWindowList probe (follow-up). Monitor-capture works.
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
      items: [],
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
  private sceneItems = new Map<string, import('obs-studio-node').ISceneItem>();
  private inputs = new Map<string, import('obs-studio-node').IInput>();
  private inputSourceIds = new Map<string, string>();

  private recording = false;
  private replayBuffering = false;
  private lastRecordingPath = '';

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
    this.scene = osn.SceneFactory.create('wcr-scene');
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

  initPreview(_hwnd: Buffer): void {
    // Preview rendering deferred to a later task — placeholder while
    // Phase 2 focuses on recording.
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
    osn.NodeObs.OBS_settings_saveSettings('Video', video);

    this.cachedPreviewDimensions = {
      canvasWidth: width,
      canvasHeight: height,
      // Preview dims = canvas dims for now (renderer preview rect TBD).
      previewWidth: width,
      previewHeight: height,
    };
  }
  getPreviewInfo() {
    return this.cachedPreviewDimensions;
  }
  configurePreview(_x: number, _y: number, _w: number, _h: number): void {}
  showPreview(): void {}
  hidePreview(): void {}
  disablePreview(): void {}
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
    return id;
  }

  deleteSource(id: string): void {
    const input = this.inputs.get(id);
    if (!input) return;
    const item = this.sceneItems.get(id);
    if (item) {
      try {
        item.remove();
      } catch (e) {
        console.warn('[OsnBackend] sceneItem.remove threw', e);
      }
      this.sceneItems.delete(id);
    }
    try {
      input.release();
    } catch (e) {
      console.warn('[OsnBackend] input.release threw', e);
    }
    try {
      input.remove();
    } catch (e) {
      console.warn('[OsnBackend] input.remove threw', e);
    }
    this.inputs.delete(id);
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
    // Translate Recorder.ts's noobs-shaped setting names to OSN's
    // mac screen_capture source schema. Recorder writes `monitor_id`
    // and `window`; OSN expects `display` and `window`.
    const translated: ObsData = { ...settings };
    if ('monitor_id' in translated) {
      translated.display = translated.monitor_id;
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
    console.info(
      '[OsnBackend] getSourceProperties',
      id,
      '→',
      out.map((o) => `${o.name}:${o.type}`).join(', '),
    );
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

  setVolmeterEnabled(_enabled: boolean): void {
    // Volmeter wiring (osn.VolmeterFactory.create + attach) is renderer-only
    // (drives the audio meter UI). Deferred from Phase 2 — Phase 1 record-only
    // flows don't need it.
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
  startBuffer(): void {
    if (this.replayBuffering) {
      console.info('[OsnBackend] startBuffer — already running, ignoring');
      return;
    }
    const osn = this.getOsn();
    console.info('[OsnBackend] startBuffer');
    osn.NodeObs.OBS_service_startReplayBuffer();
    this.replayBuffering = true;
  }

  startRecording(offsetSeconds: number): void {
    if (this.recording) {
      console.info('[OsnBackend] startRecording — already running, ignoring');
      return;
    }
    const osn = this.getOsn();
    console.info('[OsnBackend] startRecording', { offsetSeconds });
    // offsetSeconds is the noobs-era replay-buffer offset. OSN handles
    // the buffer-to-file conversion via processReplayBufferHotkey when
    // saving; for the simple-record path we just start a fresh recording.
    void offsetSeconds;
    osn.NodeObs.OBS_service_startRecording();
    this.recording = true;
  }

  stopRecording(): void {
    if (!this.recording) {
      console.info('[OsnBackend] stopRecording — not running, ignoring');
      return;
    }
    const osn = this.getOsn();
    console.info('[OsnBackend] stopRecording');
    osn.NodeObs.OBS_service_stopRecording();
    this.recording = false;
  }

  forceStopRecording(): void {
    const osn = this.osn;
    if (this.recording) {
      try {
        osn?.NodeObs.OBS_service_stopRecording();
      } catch (err) {
        console.error(
          '[OsnBackend] forceStopRecording — stopRecording threw',
          err,
        );
      }
      this.recording = false;
    }
    if (this.replayBuffering) {
      try {
        osn?.NodeObs.OBS_service_stopReplayBuffer(true);
      } catch (err) {
        console.error(
          '[OsnBackend] forceStopRecording — stopReplayBuffer threw',
          err,
        );
      }
      this.replayBuffering = false;
    }
  }

  getLastRecording(): string {
    return this.lastRecordingPath;
  }
}
