import { RendererVideo } from 'main/types';

interface StorageClient {
  ready(): boolean;
  refreshStatus(): Promise<void>;
  getVideos(): Promise<RendererVideo[]>;
  deleteVideos(videoNames: string[]): Promise<void>;
  tagVideos(videoNames: string[], tag: string): Promise<void>;
  protectVideos(videoNames: string[], protect: boolean): Promise<void>;
}

export default StorageClient;
