import { VideoCategory } from 'types/VideoCategory';
import { RendererVideo } from '../main/types';
import { areDatesWithinSeconds } from './rendererutils';

/**
 * The video state, and utility mutation methods.
 */
export default class StateManager {
  private ipc = window.electron.ipcRenderer;

  private raw: RendererVideo[] = [];

  private setVideoState: React.Dispatch<React.SetStateAction<RendererVideo[]>>;

  constructor(
    setVideoState: React.Dispatch<React.SetStateAction<RendererVideo[]>>
  ) {
    this.setVideoState = setVideoState;
  }

  public async refresh() {
    this.raw = (await this.ipc.invoke('getVideoState', [])) as RendererVideo[];
    this.set();
  }

  private set() {
    const correlated: RendererVideo[] = [];
    const cloudVideos = this.raw.filter((video) => video.cloud);
    const diskVideos = this.raw.filter((video) => !video.cloud);

    cloudVideos.forEach((video) =>
      StateManager.correlateVideo(video, correlated)
    );

    diskVideos.forEach((video) =>
      StateManager.correlateVideo(video, correlated)
    );

    correlated
      .sort(StateManager.reverseChronologicalVideoSort)
      .forEach((video) => {
        video.multiPov.sort(StateManager.povNameSort);
      });

    this.setVideoState(correlated);
  }

  private static correlateVideo(video: RendererVideo, videos: RendererVideo[]) {
    // If we can prove this video is another POV of the same activity
    // we will group them in the UI.
    let correlated = false;

    if (video.uniqueHash === undefined || video.start === undefined) {
      // We don't have the fields required to correlate this video to
      // any other so just add it and move on.
      videos.push(video);
      return;
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
      const closeStartTime = areDatesWithinSeconds(d1, d2, 5);

      if (sameHash && closeStartTime) {
        // The video is a different POV of the same activity, link them and
        // break, we will never have more than one "parent" video so if we've
        // found it we're good to drop out and save some CPU cycles.
        correlated = true;
        videoToCompare.multiPov.push(video);
        break;
      }
    }

    if (!correlated) {
      // We didn't correlate this video with another so just add it like
      // it is a normal video, this is the fallback case.
      videos.push(video);
    }
  }

  public deleteVideo(video: RendererVideo) {
    const index = this.raw.indexOf(video);

    if (index < 0) {
      // Should never happen.
      return;
    }

    this.raw.splice(index, 1);
    this.set();
  }

  public toggleProtect(video: RendererVideo) {
    const index = this.raw.indexOf(video);

    if (index < 0) {
      // Should never happen.
      return;
    }

    this.raw[index].isProtected = !this.raw[index].isProtected;
    this.set();
  }

  public tag(video: RendererVideo, tag: string) {
    const index = this.raw.indexOf(video);

    if (index < 0) {
      // Should never happen.
      return;
    }

    this.raw[index].tag = tag;
    this.set();
  }

  private static reverseChronologicalVideoSort(
    A: RendererVideo,
    B: RendererVideo
  ) {
    const metricA = A.start ? A.start : A.mtime;
    const metricB = B.start ? B.start : B.mtime;
    return metricB - metricA;
  }

  private static povNameSort(a: RendererVideo, b: RendererVideo) {
    const playerA = a.player?._name;
    const playerB = b.player?._name;
    if (!playerA || !playerB) return 0;
    return playerA.localeCompare(playerB);
  }
}
