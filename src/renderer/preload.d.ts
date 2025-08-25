import ElectronStore from 'electron-store';
import { Channels } from 'main/preload';
import { AudioSourceType, VideoSourceName, WCRSceneItem } from 'main/types';
import { ObsProperty, SceneItemPosition, SourceDimensions } from 'noobs';

declare global {
  interface Window {
    electron: {
      store: ElectronStore;
      ipcRenderer: {
        sendMessage(channel: Channels, args: unknown[]): void;
        sendSync(channel: Channels, args: unknown[]): any;
        invoke(channel: Channels, args: unknown[]): Promise<any>;
        on(
          channel: string,
          func: (...args: unknown[]) => void,
        ): (() => void) | undefined;
        once(channel: string, func: (...args: unknown[]) => void): void;
        removeAllListeners(channel: string): void;

        getDisplayInfo(): Promise<{
          canvasWidth: number;
          canvasHeight: number;
          previewWidth: number;
          previewHeight: number;
        }>;

        configurePreview(x: number, y: number, width: number, height: number): void;
        showPreview(): void;
        hidePreview(): void;
        disablePreview(): void;

        getSourcePosition(
          src: WCRSceneItem,
        ): Promise<SceneItemPosition & SourceDimensions>;
        resetSourcePosition(src: WCRSceneItem): void;
        setSourcePosition(src: WCRSceneItem, target: { x: number; y: number, width: number, height: number }): void;

        audioSettingsOpen(): Promise<void>;
        audioSettingsClosed(): Promise<void>;
        createAudioSource(id: string, type: AudioSourceType): Promise<string>;
        getAudioSourceProperties(id: string): Promise<ObsProperty[]>;
        deleteAudioSource(id: string): void;
        setAudioSourceDevice(id: string, device: string): void;
        setAudioSourceWindow(id: string, window: string): void;
        setAudioSourceVolume(id: string, volume: number): void;
        setForceMono(enabled: boolean): void;
        setAudioSuppression(enabled: boolean): void;
      };
    };
  }
}

export {};
