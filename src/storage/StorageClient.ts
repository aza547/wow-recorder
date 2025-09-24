interface StorageClient {
  ready(): Promise<boolean>;
  refreshStatus(): Promise<void>;
  refreshVideos(): Promise<void>;
  deleteVideos(videoNames: string[]): Promise<void>;
  tagVideos(videoNames: string[], tag: string): Promise<void>;
  protectVideos(videoNames: string[], protect: boolean): Promise<void>;
}

export default StorageClient;
