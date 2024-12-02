import { VideoCategory } from 'types/VideoCategory';
import { AppState, RendererVideo } from '../main/types';
import {
  areDatesWithinSeconds,
  getVideoCategoryFilter,
  povCloudFirstNameSort,
} from './rendererutils';
import VideoFilter from './VideoFilter';

/**
 * The video state, and utility mutation methods.
 */
export default class StateManager {
  private static instance: StateManager | undefined;

  private ipc = window.electron.ipcRenderer;

  private raw: RendererVideo[] = [];

  private setVideoState: React.Dispatch<React.SetStateAction<RendererVideo[]>>;

  private appState: AppState;

  private setAppState: React.Dispatch<React.SetStateAction<AppState>>;

  /**
   * This is a singleton which allows us to avoid complications of the useRef hook recreating
   * the class on each render but discarding it if it's already set; that doesn't work nicely
   * when we set listeners in the class.
   */
  public static getInstance(
    setVideoState: React.Dispatch<React.SetStateAction<RendererVideo[]>>,
    appState: AppState,
    setAppState: React.Dispatch<React.SetStateAction<AppState>>
  ) {
    if (StateManager.instance) {
      return StateManager.instance;
    }

    StateManager.instance = new StateManager(
      setVideoState,
      appState,
      setAppState
    );

    return StateManager.instance;
  }

  /**
   * Constructor.
   */
  constructor(
    setVideoState: React.Dispatch<React.SetStateAction<RendererVideo[]>>,
    appState: AppState,
    setAppState: React.Dispatch<React.SetStateAction<AppState>>
  ) {
    this.setVideoState = setVideoState;
    this.appState = appState;
    this.setAppState = setAppState;
  }

  public updateAppState(appState: AppState) {
    this.appState = appState;
  }

  /**
   * Sends an IPC request to the back end for the latest resources, and
   * applies them to the frontend.
   */
  public async refresh() {
    this.raw = (await this.ipc.invoke('getVideoState', [])) as RendererVideo[];

    // console.time('correlate');
    const correlated = this.correlate();
    // console.timeEnd('correlate');

    // console.time('setstate');
    this.setVideoState(correlated);
    // console.timeEnd('setstate');

    const { category, videoFilterQuery, playingVideo } = this.appState;

    if (!playingVideo) {
      // If we haven't yet selected a video, then select the first
      // in the currently selected category.
      const categoryFilter = getVideoCategoryFilter(category);
      const categoryState = correlated.filter(categoryFilter);

      const filteredState = categoryState.filter((video) =>
        new VideoFilter(videoFilterQuery, video).filter()
      );

      const first = filteredState[0];
      const viewpoints = [first, ...first.multiPov].sort(povCloudFirstNameSort);

      this.setAppState((prevState) => {
        return {
          ...prevState,
          playingVideo: viewpoints[0],
        };
      });
    }
  }

  private correlate() {
    this.uncorrelate();
    const correlated: RendererVideo[] = [];

    const cloudVideos = this.raw.filter((video) => video.cloud);
    const diskVideos = this.raw.filter((video) => !video.cloud);

    cloudVideos.forEach((video) =>
      StateManager.correlateVideo(video, correlated)
    );

    diskVideos.forEach((video) =>
      StateManager.correlateVideo(video, correlated)
    );

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

      const clipCompare = videoToCompare.category === VideoCategory.Clips;
      const isClip = video.category === VideoCategory.Clips;

      if ((clipCompare && !isClip) || (isClip && !clipCompare)) {
        // We only correlate clips with other clips. Go next.
        // eslint-disable-next-line no-continue
        continue;
      }

      if (!sameHash || videoToCompare.start === undefined) {
        // Mismatching hash or no start time so either these videos or
        // not correlated or we can't prove they are these are correlated.
        // eslint-disable-next-line no-continue
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

  public async deleteVideo(video: RendererVideo) {
    const index = this.raw.indexOf(video);

    if (index > -1) {
      this.raw.splice(index, 1);
      const correlated = this.correlate();
      this.setVideoState(correlated);
    }
  }

  public async bulkDeleteVideo(videos: RendererVideo[]) {
    videos.forEach((v) => {
      const index = this.raw.indexOf(v);

      if (index > -1) {
        this.raw.splice(index, 1);
      }
    });

    const correlated = this.correlate();
    this.setVideoState(correlated);
  }

  public async toggleProtect(video: RendererVideo) {
    const index = this.raw.indexOf(video);

    if (index > -1) {
      this.raw[index].isProtected = !this.raw[index].isProtected;
      const correlated = this.correlate();
      this.setVideoState(correlated);
    }
  }

  public tag(video: RendererVideo, tag: string) {
    const index = this.raw.indexOf(video);

    if (index > -1) {
      this.raw[index].tag = tag;
      const correlated = this.correlate();
      this.setVideoState(correlated);
    }
  }

  private static reverseChronologicalVideoSort(
    A: RendererVideo,
    B: RendererVideo
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
