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

const NOT_IMPL = 'OsnBackend not yet implemented (Phase 2 — Plan 2b)';

/**
 * macOS recorder backend STUB. Phase 1 only — every method either no-ops
 * or throws so the app boots cleanly but recording fails loudly.
 * Plan 2b will replace the bodies with real obs-studio-node calls.
 */
export default class OsnBackend implements IRecorderBackend {
  public readonly capabilities: RecorderCapabilities = {
    captureModes: [CaptureModeCapability.WINDOW, CaptureModeCapability.MONITOR],
    encoders: [ESupportedEncoders.OBS_X264],
    supportsReplayBuffer: false,
  };

  init(_options: BackendInitOptions): void {
    throw new Error(NOT_IMPL);
  }
  initPreview(_hwnd: Buffer): void {
    throw new Error(NOT_IMPL);
  }
  shutdown(): void {}
  setBuffering(_enabled: boolean): void {}
  setDrawSourceOutline(_enabled: boolean): void {}

  resetVideoContext(_fps: number, _width: number, _height: number): void {}
  getPreviewInfo(): {
    canvasWidth: number;
    canvasHeight: number;
    previewWidth: number;
    previewHeight: number;
  } {
    return { canvasWidth: 0, canvasHeight: 0, previewWidth: 0, previewHeight: 0 };
  }

  configurePreview(_x: number, _y: number, _w: number, _h: number): void {}
  showPreview(): void {}
  hidePreview(): void {}
  disablePreview(): void {}

  setRecordingCfg(_outputPath: string, _container: string): void {}
  setVideoEncoder(_encoder: string, _settings: ObsData): void {}
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
