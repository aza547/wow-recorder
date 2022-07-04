import { Channels } from 'main/preload';

declare global {
  interface Window {
    electron: {
      store: any;
      ipcRenderer: {
        sendMessage(channel: Channels, args: unknown[]): void;
        sendSync(channel: Channels, args: unknown[]): any;
        invoke(channel: Channels, args: unknown[]): Promise<any>;
        on(
          channel: string,
          func: (...args: unknown[]) => void
        ): (() => void) | undefined;
        once(channel: string, func: (...args: unknown[]) => void): void;
      };
    };
  }
}

export {};
