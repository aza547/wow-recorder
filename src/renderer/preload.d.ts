import ElectronStore from 'electron-store';
import { Channels } from 'main/preload';
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

        getPreviewInfo(): Promise<{
          canvasWidth: number;
          canvasHeight: number;
          previewWidth: number;
          previewHeight: number;
        }>;

        getSourcePosition(
          src: string,
        ): Promise<SceneItemPosition & SourceDimensions>;

        setSourcePosition(src: string, target: { x: number; y: number, width: number, height: number }): void;
      };
    };
  }
}

export {};
