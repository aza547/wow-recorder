import ElectronStore from 'electron-store';
import { Channels } from 'main/preload';
import { VideoSourceName } from 'main/types';
import { SceneItemPosition, SourceDimensions } from 'noobs';

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

        getSourcePosition(
          src: VideoSourceName,
        ): Promise<SceneItemPosition & SourceDimensions>;

        resetSourcePosition(src: VideoSourceName): void;
        
        setSourcePosition(src: VideoSourceName, target: { x: number; y: number, width: number, height: number }): void;
      };
    };
  }
}

export {};
