import { VideoCategory } from 'types/VideoCategory';
import { RendererVideo, StorageFilter } from '../main/types';
import { areDatesWithinSeconds } from './rendererutils';

/**
 * The video state, and utility mutation methods.
 */
export default class StateManager {
  private static instance: StateManager | undefined;

  private ipc = window.electron.ipcRenderer;

  private raw: RendererVideo[] = [];

  private disk: RendererVideo[] = [];

  private cloud: RendererVideo[] = [];

  private storageFilter = StorageFilter.BOTH;

  private setVideoState: React.Dispatch<React.SetStateAction<RendererVideo[]>>;

  /**
   * This is a singleton which allows us to avoid complications of the useRef hook recreating
   * the class on each render but discarding it if it's already set; that doesn't work nicely
   * when we set listeners in the class.
   */
  public static getInstance(
    setVideoState: React.Dispatch<React.SetStateAction<RendererVideo[]>>,
  ) {
    if (StateManager.instance) {
      return StateManager.instance;
    }

    StateManager.instance = new StateManager(setVideoState);

    return StateManager.instance;
  }

  /**
   * Constructor.
   */
  constructor(
    setVideoState: React.Dispatch<React.SetStateAction<RendererVideo[]>>,
  ) {
    this.setVideoState = setVideoState;
  }

  /**
   * Sends an IPC request to the back end for the latest resources, and
   * applies them to the frontend.
   */
  public async refresh() {
    this.raw = (await this.ipc.invoke('getVideoState', [])) as RendererVideo[];
    this.disk = this.raw.filter((video) => !video.cloud);
    this.cloud = this.raw.filter((video) => video.cloud);
    const correlated = this.correlate();
    this.setVideoState(correlated);
  }

  /**
   * Update the Storage Filter and re-correlate the videos. This filter is
   * unique in that it's done before grouping of videos, so it happens here
   * instead of in the VideoFilter class.
   * @param storageFilter The new storage filter to apply.
   */
  public async updateStorageFilter(storageFilter: StorageFilter) {
    this.storageFilter = storageFilter;
    const correlated = this.correlate();
    this.setVideoState(correlated);
  }

  public getRawDiskVideos() {
    return this.disk;
  }

  public getRawCloudVideos() {
    return this.cloud;
  }

  /**
   * Walk the raw video list and correlate them into a single list. This is
   * done by looking for videos with the same hash and start time, and
   * linking them together.
   */
  private correlate() {
    this.uncorrelate();
    const correlated: RendererVideo[] = [];

    if (this.storageFilter !== StorageFilter.CLOUD) {
      this.disk.forEach((rv) => StateManager.correlateVideo(rv, correlated));
    }

    if (this.storageFilter !== StorageFilter.DISK) {
      this.cloud.forEach((rv) => StateManager.correlateVideo(rv, correlated));
    }

    correlated.sort(StateManager.reverseChronologicalVideoSort);
    return correlated;
  }

  private static correlateVideo(video: RendererVideo, videos: RendererVideo[]) {
    if (video.uniqueHash === undefined || video.start === undefined) {
      // We don't have the fields required to correlate this video to
      // any other so just add it and move on.
      videos.push(video);
      return videos.length;
    }

    // We might be able to correlate this, so loop over each of the videos we
    // already know about and look for a match.
    for (let i = 0; i < videos.length; i++) {
      const videoToCompare = videos[i];
      const sameHash = videoToCompare.uniqueHash === video.uniqueHash;

      const isVideoClip = video.category === VideoCategory.Clips;
      const isCompareClip = videoToCompare.category === VideoCategory.Clips;

      if (
        (isVideoClip || isCompareClip) &&
        video.videoName !== videoToCompare.videoName
      ) {
        // Only correlate clips if they are the literally the same video
        // with different storage. Otherwise we end up grouping from the
        // parent hash which is confusing.

        continue;
      }

      if (!sameHash || videoToCompare.start === undefined) {
        // Mismatching hash or no start time so either these videos or
        // not correlated or we can't prove they are these are correlated.
        continue;
      }

      // The hash is the same, but it could still be similar pull from a
      // different time so check the date. Don't look for an exact match
      // here as I'm not sure how accurate the start event in the combat log
      // is between players; surely it can vary slightly depending on local
      // system clock etc.
      const d1 = new Date(video.start);
      const d2 = new Date(videoToCompare.start);
      const closeStartTime = areDatesWithinSeconds(d1, d2, 60);

      if (sameHash && closeStartTime) {
        // The video is a different POV of the same activity, link them and
        // break, we will never have more than one "parent" video so if we've
        // found it we're good to drop out and save some CPU cycles.

        videoToCompare.multiPov.push(video);
        return i;
      }
    }

    // We didn't correlate this video with another so just add it like
    // it is a normal video, this is the fallback case.
    videos.push(video);
    return videos.length;
  }

  public async deleteVideos(videos: RendererVideo[]) {
    videos.forEach((v) => {
      const index = this.raw.indexOf(v);

      if (index > -1) {
        this.raw.splice(index, 1);
      }
    });

    this.disk = this.raw.filter((video) => !video.cloud);
    this.cloud = this.raw.filter((video) => video.cloud);

    const correlated = this.correlate();
    this.setVideoState(correlated);
  }

  public async setProtected(protect: boolean, videos: RendererVideo[]) {
    videos.forEach((video) => {
      const index = this.raw.indexOf(video);

      if (index > -1) {
        this.raw[index].isProtected = protect;
      }
    });

    this.disk = this.raw.filter((video) => !video.cloud);
    this.cloud = this.raw.filter((video) => video.cloud);

    const correlated = this.correlate();
    this.setVideoState(correlated);
  }

  public setTag(tag: string, videos: RendererVideo[]) {
    videos.forEach((video) => {
      const index = this.raw.indexOf(video);

      if (index > -1) {
        this.raw[index].tag = tag;
      }
    });

    this.disk = this.raw.filter((video) => !video.cloud);
    this.cloud = this.raw.filter((video) => video.cloud);

    const correlated = this.correlate();
    this.setVideoState(correlated);
  }

  private static reverseChronologicalVideoSort(
    A: RendererVideo,
    B: RendererVideo,
  ) {
    let metricA;
    let metricB;

    if (A.clippedAt) {
      metricA = A.clippedAt;
    } else if (A.start) {
      metricA = A.start;
    } else {
      metricA = A.mtime;
    }

    if (B.clippedAt) {
      metricB = B.clippedAt;
    } else if (B.start) {
      metricB = B.start;
    } else {
      metricB = B.mtime;
    }

    return metricB - metricA;
  }

  /**
   * Detatches any videos attached to the multiPov property of other videos.
   * We need this because we correlate them in this class, but we access by
   * reference so without undoing it we can have phantom videos sticking
   * around in the UI.
   */
  private uncorrelate() {
    this.raw.forEach((video) => {
      video.multiPov = [];
    });
  }
}
