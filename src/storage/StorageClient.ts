interface StorageClient {
  ready(): Promise<boolean>;
  refreshStatus(): Promise<void>;
  refreshVideos(): Promise<void>;
  deleteVideos(videoNames: string[]): Promise<string[]>;
  tagVideos(videoNames: string[], tag: string): Promise<string[]>;
  protectVideos(videoNames: string[], protect: boolean): Promise<string[]>;
}

export default StorageClient;
