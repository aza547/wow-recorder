import ElectronStore from 'electron-store';
import { Channels } from 'main/preload';
import { AudioSourceType, RendererVideo, SceneItem } from 'main/types';
import { ObsProperty, SceneItemPosition, SourceDimensions } from 'noobs';
import { TChatMessageWithId } from 'types/api';

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

        configurePreview(
          x: number,
          y: number,
          width: number,
          height: number,
        ): void;
        showPreview(): void;
        hidePreview(): void;
        disablePreview(): void;

        getSourcePosition(
          src: SceneItem,
        ): Promise<SceneItemPosition & SourceDimensions>;
        resetSourcePosition(src: SceneItem): void;
        setSourcePosition(
          src: SceneItem,
          target: {
            x: number;
            y: number;
            width: number;
            height: number;
            cropLeft: number;
            cropRight: number;
            cropTop: number;
            cropBottom: number;
          },
        ): void;

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

        reconfigureBase(): void;
        reconfigureVideo(): void;
        reconfigureAudio(): void;
        reconfigureOverlay(): void;
        reconfigureCloud(): void;

        getSensibleEncoderDefault(): Promise<string>;
        refreshCloudGuilds(): void;
        getOrCreateChatCorrelator(video: RendererVideo): Promise<string>;
        getChatMessages(correlator: string): Promise<TChatMessageWithId[]>;
        postChatMessage(correlator: string, message: string): void;
        deleteChatMessage(id: number): void;
      };
    };
  }
}

export {};
