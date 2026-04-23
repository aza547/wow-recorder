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
  init(
    noobsPath: string,
    logPath: string,
    signalCallback: SignalCallback,
  ): void;
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
