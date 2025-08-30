import { BrowserWindow } from 'electron';
import { RendererVideo } from 'main/types';

export default abstract class StorageClient {
  protected window?: BrowserWindow;

  /**
   * Set the frontend window for messaging.
   */
  setWindow(window: BrowserWindow) {
    this.window = window;
  }

  /**
   * Send a message to the frontend.
   */
  send(channel: string, ...args: unknown[]) {
    if (!this.window) return;
    this.window.webContents.send(channel, ...args);
  }

  abstract ready(): boolean;
  abstract refreshStatus(): Promise<void>;
  abstract getVideos(): Promise<RendererVideo[]>;
  abstract deleteVideos(videoNames: string[]): Promise<void>;
  abstract tagVideos(videoNames: string[], tag: string): Promise<void>;
  abstract protectVideos(videoNames: string[], protect: boolean): Promise<void>;
}
