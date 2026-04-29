import path from 'path';
import fs from 'fs';
import { ChildProcess, spawn } from 'child_process';
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
const READY_LINE = 'server - start watcher';
const READY_TIMEOUT_MS = 10000;

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

  public readonly capabilities: RecorderCapabilities = {
    captureModes: [CaptureModeCapability.WINDOW, CaptureModeCapability.MONITOR],
    encoders: [ESupportedEncoders.OBS_X264],
    supportsReplayBuffer: false,
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

    // Step 3: tell OBS where its data + plugins live.
    osn.NodeObs.SetWorkingDirectory(osnBinDir);

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

    this.initialized = true;
    // Signal callback wiring lands in Task 7.
    void options.signalCallback;
    void options.noobsDistPath;
    void options.logPath;
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

  resetVideoContext(_fps: number, _width: number, _height: number): void {
    throw new Error(NOT_IMPL);
  }
  getPreviewInfo() {
    return {
      canvasWidth: 0,
      canvasHeight: 0,
      previewWidth: 0,
      previewHeight: 0,
    };
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
