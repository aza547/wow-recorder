import { RendererVideo } from 'main/types';

type VideoProtectionIpc = {
  invoke(
    channel: 'videoButtonDisk' | 'videoButtonCloud',
    args: unknown[],
  ): Promise<unknown>;
};

const protectVideosWithStorage = async (
  ipc: VideoProtectionIpc,
  videos: RendererVideo[],
  protectedState: boolean,
): Promise<RendererVideo[]> => {
  const disk = videos.filter((video) => !video.cloud);
  const cloud = videos.filter((video) => video.cloud);
  const updated: RendererVideo[] = [];

  // Use invoke so the renderer only updates videos whose protection change persisted.
  if (cloud.length > 0) {
    try {
      const cloudUpdated = await ipc.invoke('videoButtonCloud', [
        'protect',
        protectedState,
        cloud,
      ]);
      updated.push(...(Array.isArray(cloudUpdated) ? cloudUpdated : cloud));
    } catch (error) {
      console.error(
        '[Renderer] Failed to update cloud video protection',
        error,
      );
    }
  }

  if (disk.length > 0) {
    try {
      const diskUpdated = await ipc.invoke('videoButtonDisk', [
        'protect',
        protectedState,
        disk,
      ]);
      updated.push(...(Array.isArray(diskUpdated) ? diskUpdated : disk));
    } catch (error) {
      console.error('[Renderer] Failed to update disk video protection', error);
    }
  }

  return updated;
};

export { protectVideosWithStorage };
