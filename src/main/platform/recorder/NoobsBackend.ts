import noobs from 'noobs';
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
 * Windows recorder backend. Thin pass-through to the `noobs` native module.
 * Any noobs-specific quirk (signal wiring, path fixing, process-name filters)
 * stays in Recorder.ts — this class is deliberately mechanical.
 */
export default class NoobsBackend implements IRecorderBackend {
  public readonly capabilities: RecorderCapabilities = {
    captureModes: [
      CaptureModeCapability.GAME,
      CaptureModeCapability.WINDOW,
      CaptureModeCapability.MONITOR,
    ],
    encoders: [
      ESupportedEncoders.OBS_X264,
      ESupportedEncoders.AMD_H264,
      ESupportedEncoders.AMD_AV1,
      ESupportedEncoders.NVENC_H264,
      ESupportedEncoders.NVENC_AV1,
      ESupportedEncoders.QSV_H264,
      ESupportedEncoders.QSV_AV1,
    ],
    supportsReplayBuffer: true,
  };

  // Lifecycle
  init(options: BackendInitOptions): void {
    noobs.Init(options.noobsDistPath, options.logPath, options.signalCallback);
  }
  initPreview(hwnd: Buffer): void {
    noobs.InitPreview(hwnd);
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
