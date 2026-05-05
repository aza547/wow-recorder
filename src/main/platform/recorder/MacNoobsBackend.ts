// Native module via raw require — bypass esModuleInterop's
// __importDefault wrapper that ts-loader otherwise injects, which
// turns `noobs.Init` into `noobs.default.Init` at runtime and breaks
// against the actual `module.exports = nativeModule` shape noobs
// ships. The same-shape Win NoobsBackend works because its noobs
// build happens to set `__esModule = true` on the exported object;
// our Mac fork doesn't.
// eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
const noobs: any = require('noobs');
import { ESupportedEncoders } from 'main/obsEnums';
import type {
  ObsData,
  ObsProperty,
  SceneItemPosition,
  SourceDimensions,
} from './types';
import { CaptureModeCapability } from './IRecorderBackend';
import type {
  BackendInitOptions,
  IRecorderBackend,
  RecorderCapabilities,
} from './IRecorderBackend';

/**
 * macOS recorder backend. Same shape as NoobsBackend (Win) — both
 * sit on top of the same `noobs` native module — but advertises the
 * Mac-specific capture mode + encoder set.
 *
 * Built against our own noobs fork's Phase 5 vendored libobs, so no
 * Streamlabs OSN dependency at runtime. Phase 1-4 of the noobs port
 * cover the Mac differences inside the C++ (NSView preview, .plugin
 * bundle paths, CoreAudio source ids, VideoToolbox encoders, etc.) —
 * the JS side just calls the same exports the Windows path does.
 *
 * Game capture is unavailable on macOS (no DirectX/Vulkan hook
 * injection equivalent), so only WINDOW + MONITOR are listed.
 * NVENC / QSV / AMD encoders are similarly Win-only.
 */
export default class MacNoobsBackend implements IRecorderBackend {
  public readonly capabilities: RecorderCapabilities = {
    captureModes: [
      CaptureModeCapability.WINDOW,
      CaptureModeCapability.MONITOR,
    ],
    encoders: [
      ESupportedEncoders.OBS_X264,
      ESupportedEncoders.VT_H264,
      ESupportedEncoders.VT_HEVC,
    ],
    supportsReplayBuffer: true,
  };

  // Lifecycle
  init(options: BackendInitOptions): void {
    noobs.Init(options.noobsDistPath, options.logPath, options.signalCallback);
  }
  initPreview(handle: Buffer): void {
    noobs.InitPreview(handle);
  }
  shutdown(): void {
    noobs.Shutdown();
  }
  setBuffering(enabled: boolean): void {
    noobs.SetBuffering(enabled);
  }
  setDrawSourceOutline(enabled: boolean): void {
    noobs.SetDrawSourceOutline(enabled);
  }

  // Video context
  resetVideoContext(fps: number, width: number, height: number): void {
    noobs.ResetVideoContext(fps, width, height);
  }
  getPreviewInfo(): {
    canvasWidth: number;
    canvasHeight: number;
    previewWidth: number;
    previewHeight: number;
  } {
    return noobs.GetPreviewInfo();
  }

  // Preview window
  configurePreview(x: number, y: number, width: number, height: number): void {
    noobs.ConfigurePreview(x, y, width, height);
  }
  showPreview(): void {
    noobs.ShowPreview();
  }
  hidePreview(): void {
    noobs.HidePreview();
  }
  disablePreview(): void {
    noobs.DisablePreview();
  }

  // Recording output
  setRecordingCfg(outputPath: string, container: string): void {
    noobs.SetRecordingCfg(outputPath, container);
  }
  setVideoEncoder(encoder: string, settings: ObsData): void {
    noobs.SetVideoEncoder(encoder, settings);
  }
  listVideoEncoders(): string[] {
    return noobs.ListVideoEncoders();
  }

  // Sources
  createSource(id: string, type: string): string {
    return noobs.CreateSource(id, type);
  }
  deleteSource(id: string): void {
    noobs.DeleteSource(id);
  }
  addSourceToScene(name: string): void {
    noobs.AddSourceToScene(name);
  }
  removeSourceFromScene(name: string): void {
    noobs.RemoveSourceFromScene(name);
  }
  getSourceSettings(id: string): ObsData {
    return noobs.GetSourceSettings(id);
  }
  setSourceSettings(id: string, settings: ObsData): void {
    noobs.SetSourceSettings(id, settings);
  }
  getSourceProperties(id: string): ObsProperty[] {
    return noobs.GetSourceProperties(id);
  }
  getSourcePos(id: string): SceneItemPosition & SourceDimensions {
    return noobs.GetSourcePos(id);
  }
  setSourcePos(id: string, pos: SceneItemPosition): void {
    noobs.SetSourcePos(id, pos);
  }
  setSourceVolume(id: string, volume: number): void {
    noobs.SetSourceVolume(id, volume);
  }

  // Editor selection — was used by the OSN path's draw-UI selection
  // rectangle. Vanilla libobs doesn't expose that today; leave as
  // no-ops here too. Future: render selection in our own draw
  // callback inside obs_interface_mac.mm.
  setSceneItemSelected(_id: string, _selected: boolean): void {}

  clearSceneItemSelection(): void {}

  listSceneItems(): string[] {
    return [];
  }

  // Audio
  setVolmeterEnabled(enabled: boolean): void {
    noobs.SetVolmeterEnabled(enabled);
  }
  setForceMono(enabled: boolean): void {
    noobs.SetForceMono(enabled);
  }
  setAudioSuppression(enabled: boolean): void {
    noobs.SetAudioSuppression(enabled);
  }
  setMuteAudioInputs(muted: boolean): void {
    noobs.SetMuteAudioInputs(muted);
  }

  // Recording lifecycle
  startBuffer(): void {
    noobs.StartBuffer();
  }
  startRecording(offsetSeconds: number): void {
    noobs.StartRecording(offsetSeconds);
  }
  stopRecording(): void {
    noobs.StopRecording();
  }
  forceStopRecording(): void {
    noobs.ForceStopRecording();
  }
  getLastRecording(): string {
    return noobs.GetLastRecording();
  }
}
