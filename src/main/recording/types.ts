import type { BaseConfig, MicStatus, ObsAudioConfig, ObsOverlayConfig, ObsVideoConfig } from '../types';
import type { ERecordingState } from '../obsEnums';

export type RecorderImpl = {
  obsState: ERecordingState;
  obsMicState: MicStatus;
  lastFile: string | null;

  // Optional EventEmitter compatibility for the wrapper.
  on?: (eventName: string | symbol, listener: (...args: any[]) => void) => any;

  initializeObs(): void;
  shutdownOBS(): void;

  configureBase(config: BaseConfig, startup: boolean): Promise<void>;
  configureVideoSources(config: ObsVideoConfig): void;
  configureAudioSources(config: ObsAudioConfig): void;
  configureOverlayImageSource(config: ObsOverlayConfig): void;

  attachCaptureSource(): void;
  clearFindWindowInterval(): void;
  removeAudioSources(): void;

  startBuffer(): Promise<void>;
  startRecording(offset: number): Promise<void>;
  stop(): Promise<void>;
  forceStop(timeout: boolean): Promise<void>;

  cleanup(obsPath: string): Promise<void>;
  getSensibleEncoderDefault(): string;
  getAndClearLastFile(): string | null;

  // Linux-only (optional on other platforms).
  saveReplayNow?: () => Promise<string>;
};
