import type {
  ObsData,
  ObsProperty,
  SceneItemPosition,
  Signal,
  SourceDimensions,
} from './types';

/**
 * Platform-neutral capture-mode identifiers. Each backend maps these
 * to its own native source IDs (Windows noobs: `game_capture` /
 * `window_capture` / `monitor_capture`; macOS OSN: `window_capture` /
 * `display_capture`, no game-capture equivalent).
 */
export enum CaptureModeCapability {
  GAME = 'GAME',
  WINDOW = 'WINDOW',
  MONITOR = 'MONITOR',
}

/**
 * Recording-backend feature flags. Renderer reads these via IPC so the
 * Settings UI can show only options supported on the current platform.
 */
export interface RecorderCapabilities {
  /** Capture source types this backend can create. */
  captureModes: CaptureModeCapability[];
  /** Encoder ids (ESupportedEncoders values) this backend exposes. */
  encoders: string[];
  /** Whether libobs replay buffer is supported. */
  supportsReplayBuffer: boolean;
}

export type SignalCallback = (signal: Signal) => void;

/**
 * Options passed to IRecorderBackend.init(). Each field may be
 * backend-irrelevant (e.g. `noobsDistPath` only matters for NoobsBackend,
 * but is still passed uniformly so the caller doesn't need platform
 * branches).
 */
export interface BackendInitOptions {
  /** Absolute path to libobs data/modules (Windows: `noobs/dist`). */
  noobsDistPath: string;
  /** Absolute path for OBS log output. */
  logPath: string;
  /** Signal callback for recording lifecycle events. */
  signalCallback: SignalCallback;
}

/**
 * Abstract recorder backend. Windows implementation wraps `noobs`;
 * macOS implementation wraps `obs-studio-node` (added in a later plan).
 * Method shapes mirror the underlying `noobs` surface to keep the
 * Windows pass-through trivial.
 */
export interface IRecorderBackend {
  capabilities: RecorderCapabilities;

  // Lifecycle
  init(options: BackendInitOptions): void;
  initPreview(windowHandle: Buffer): void;
  shutdown(): void;
  setBuffering(enabled: boolean): void;
  setDrawSourceOutline(enabled: boolean): void;

  // Video context
  resetVideoContext(fps: number, width: number, height: number): void;
  getPreviewInfo(): {
    canvasWidth: number;
    canvasHeight: number;
    previewWidth: number;
    previewHeight: number;
  };

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
  setSceneItemSelected(id: string, selected: boolean): void;
  clearSceneItemSelection(): void;
  listSceneItems(): string[];

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
