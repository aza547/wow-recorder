import { VideoCategory } from 'types/VideoCategory';
import { CloudObject, RendererVideo } from '../main/types';
import { areDatesWithinSeconds, getVideoCategoryFilter } from './rendererutils';

/**
 * The video state, and utility mutation methods.
 */
export default class StateManager {
  private static instance: StateManager | undefined;

  private ipc = window.electron.ipcRenderer;

  private cloudList: CloudObject[] = [];

  private diskVideos: RendererVideo[] = [];

  private cloudVideos: RendererVideo[] = [];

  private setVideoState: React.Dispatch<React.SetStateAction<RendererVideo[]>>;

  private category: VideoCategory;

  private numberToLoad = 10;

  private setCategoryCounters: React.Dispatch<
    React.SetStateAction<Record<string, number>>
  >;

  private setMoreAvailable: React.Dispatch<React.SetStateAction<boolean>>;

  public changeCategory(category: VideoCategory) {
    this.category = category;
    this.refresh();
  }

  /**
   * This is a singleton which allows us to avoid complications of the useRef hook recreating
   * the class on each render but discarding it if it's already set; that doesn't work nicely
   * when we set listeners in the class.
   */
  public static getInstance(
    /* eslint-disable prettier/prettier */
    category: VideoCategory,
    setVideoState: React.Dispatch<React.SetStateAction<RendererVideo[]>>,
    setCategoryCounters: React.Dispatch<React.SetStateAction<Record<string, number>>>,
    setMoreAvailable: React.Dispatch<React.SetStateAction<boolean>>,
    /* eslint-enable prettier/prettier */
  ) {
    if (StateManager.instance) {
      return StateManager.instance;
    }

    StateManager.instance = new StateManager(
      category,
      setVideoState,
      setCategoryCounters,
      setMoreAvailable
    );

    return StateManager.instance;
  }

  /**
   * Constructor.
   */
  constructor(
    /* eslint-disable prettier/prettier */
    category: VideoCategory,
    setVideoState: React.Dispatch<React.SetStateAction<RendererVideo[]>>,
    setCategoryCounters: React.Dispatch<React.SetStateAction<Record<string, number>>>,
    setMoreAvailable: React.Dispatch<React.SetStateAction<boolean>>,
    /* eslint-enable prettier/prettier */
  ) {
    this.category = category;
    this.setVideoState = setVideoState;
    this.setCategoryCounters = setCategoryCounters;
    this.setMoreAvailable = setMoreAvailable;
    this.setupListeners();
  }

  /**
   * Sends an IPC request to the back end for the latest resources, and
   * applies them to the frontend.
   */
  public async refresh() {
    this.diskVideos = (await this.ipc.invoke(
      'getVideoStateDisk',
      []
    )) as RendererVideo[];

    this.cloudList = (await this.ipc.invoke(
      'getVideoListCloud',
      []
    )) as CloudObject[];

    this.applyVideoState();
    this.updateCategoryCounters();
  }

  private async applyVideoState() {
    this.uncorrelate();
    const correlated = await this.batchCorrelateVideos();
    console.log("state", correlated);
    this.setVideoState(correlated);
  }

  /**
   * Correlates all the videos together, loading cloud videos in batches, up
   * until we reach our video loaded target. This saves us making thousands
   * of cloud requests.
   */
  private async batchCorrelateVideos() {
    const correlated: RendererVideo[] = [];
    const categoryFilter = getVideoCategoryFilter(this.category);

    this.diskVideos
      .filter(categoryFilter)
      .forEach((video) => StateManager.correlateVideo(video, correlated));

    const categoryList = this.cloudList.filter((obj) =>
      this.cloudCategoryFilter(obj)
    );

    let countTargetReached = correlated.length > this.numberToLoad;
    let correlateTargetReached = false;
    let cloudVideosRemain = true;

    let batchStart = 0;
    const batchSize = 10;

    this.cloudVideos = [];

    while (
      !(countTargetReached && correlateTargetReached) &&
      cloudVideosRemain
    ) {
      // eslint-disable-next-line no-await-in-loop
      const cloudBatch = await this.loadCloudBatch(
        categoryList,
        batchStart,
        batchSize
      );

      console.log("batchlen", cloudBatch.length);
      this.cloudVideos.push(...cloudBatch);

      for (let i = 0; i < cloudBatch.length; i++) {
        const video = cloudBatch[i];
        const correlateIndex = StateManager.correlateVideo(video, correlated);

        if (correlateIndex > this.numberToLoad) {
          // If we're correlating cloud videos to other videos beyond
          // the number of videos we need to load, we can stop.
          correlateTargetReached = true;
        }
      }

      batchStart += cloudBatch.length;

      if (batchStart >= categoryList.length) {
        cloudVideosRemain = false;
      }

      if (correlated.length > this.numberToLoad) {
        countTargetReached = true;
      }
    }

    if (!cloudVideosRemain && correlated.length <= this.numberToLoad) {
      this.setMoreAvailable(false);
    } else {
      this.setMoreAvailable(true);
    }

    correlated
      .slice(0, this.numberToLoad)
      .sort(StateManager.reverseChronologicalVideoSort)
      .forEach((video) => {
        video.multiPov.sort(StateManager.povNameSort);
      });

    return correlated;
  }

  /**
   * Perfo
   */
  private async updateCategoryCounters() {
    const categoryCounters: Record<string, number> = {};

    this.cloudList.forEach((obj) => {
      const { key } = obj;
      const split = key.split('/');
      const category = split[0] as VideoCategory;

      if (categoryCounters[category] === undefined) {
        categoryCounters[category] = 1;
      } else {
        categoryCounters[category]++;
      }
    });

    this.diskVideos.forEach((video) => {
      const { category } = video;

      if (categoryCounters[category] === undefined) {
        categoryCounters[category] = 1;
      } else {
        categoryCounters[category]++;
      }
    });

    this.setCategoryCounters(categoryCounters);
  }

  private async loadCloudBatch(
    objects: CloudObject[],
    start: number,
    size: number
  ): Promise<RendererVideo[]> {
    const cloudPromises = objects
      .sort(StateManager.reverseChronologicalKeySort)
      .slice(start, start + size)
      .map((obj) => obj.key)
      .map((key) => this.ipc.invoke('loadVideoMetadataCloud', [key]));

    const cloudVideos = (
      await Promise.all(cloudPromises.map((p) => p.catch((e) => e)))
    ).filter((result) => !(result instanceof Error));

    return cloudVideos;
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
      const closeStartTime = areDatesWithinSeconds(d1, d2, 10);

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

  public deleteVideo(video: RendererVideo) {
    if (video.cloud) {
      this.deleteCloudVideo(video);
    } else {
      this.deleteDiskVideo(video);
    }
  }

  public toggleProtect(video: RendererVideo) {
    if (video.cloud) {
      this.toggleProtectCloudVideo(video);
    } else {
      this.toggleProtectDiskVideo(video);
    }
  }

  public tag(video: RendererVideo, tag: string) {
    if (video.cloud) {
      this.tagCloudVideo(video, tag);
    } else {
      this.tagDiskVideo(video, tag);
    }
  }

  private deleteDiskVideo(video: RendererVideo) {
    const index = this.diskVideos.indexOf(video);

    if (index > -1) {
      this.diskVideos.splice(index, 1);
      this.applyVideoState();
    }
  }

  private deleteCloudVideo(video: RendererVideo) {
    const index = this.cloudVideos.indexOf(video);

    if (index > -1) {
      this.cloudVideos.splice(index, 1);
    }

    // Remove the key from the cloud list also, so badge counts are correct.
    const jsonKey = video.videoSource.replace('.mp4', '.json');
    this.cloudList = this.cloudList.filter((obj) => obj.key !== jsonKey);
    this.applyVideoState();
  }

  private toggleProtectDiskVideo(video: RendererVideo) {
    const index = this.diskVideos.indexOf(video);

    if (index > -1) {
      this.diskVideos[index].isProtected = !this.diskVideos[index].isProtected;
      this.applyVideoState();
    }
  }

  private toggleProtectCloudVideo(video: RendererVideo) {
    const index = this.cloudVideos.indexOf(video);

    if (index > -1) {
      this.cloudVideos[index].isProtected =
        !this.cloudVideos[index].isProtected;
      this.applyVideoState();
    }
  }

  private tagDiskVideo(video: RendererVideo, tag: string) {
    const index = this.diskVideos.indexOf(video);

    if (index > -1) {
      this.diskVideos[index].tag = tag;
      this.applyVideoState();
    }
  }

  private tagCloudVideo(video: RendererVideo, tag: string) {
    const index = this.cloudVideos.indexOf(video);

    if (index > -1) {
      this.cloudVideos[index].tag = tag;
      this.applyVideoState();
    }
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

  private static reverseChronologicalKeySort(A: CloudObject, B: CloudObject) {
    const splitA = A.key.split('/');
    const splitB = B.key.split('/');

    const timeA = splitA.length < 3 ? 0 : splitA[1];
    const timeB = splitB.length < 3 ? 0 : splitB[1];

    if (timeA > timeB) {
      return -1;
    }

    return 1;
  }

  private cloudCategoryFilter(obj: CloudObject) {
    const { key } = obj;
    const split = key.split('/');
    const category = split[0] as VideoCategory;

    if (!Object.values(VideoCategory).includes(category)) {
      return false;
    }

    return category === this.category;
  }

  //   // This is a weak correlation, not the hard correlation that would be
  //   // provided by also using the uniqueHash if it were available, but it's
  //   // not because we've not read the object yet and we want to avoid doing
  //   // so if possible.
  //   const timeDiffMS = Math.abs(this.lastFilterTime - time);
  //   const correlated = timeDiffMS <= 10 * 1000;

  //   if (correlated) {
  //     return true;
  //   }

  //   const count = this.numLoadedPerCategory[category];

  //   if (count === undefined) {
  //     this.numLoadedPerCategory[category] = 1;
  //     this.lastFilterTime = time;
  //     return true;
  //   }

  //   if (count < this.numberToLoad) {
  //     this.numLoadedPerCategory[category]++;
  //     this.lastFilterTime = time;
  //     return true;
  //   }

  //   return false;
  // }

  // private diskCategoryVideoCountFilter(obj: RendererVideo) {
  //   const { start, category } = obj;

  //   if (!start) {
  //     return false;
  //   }

  //   // This is a weak correlation, not the hard correlation that would be
  //   // provided by also using the uniqueHash if it were available, but it's
  //   // not because we've not read the object yet and we want to avoid doing
  //   // so if possible.
  //   const timeDiffMS = Math.abs(this.lastFilterTime - start);
  //   const correlated = timeDiffMS <= 10 * 1000;

  //   if (correlated) {
  //     return true;
  //   }

  //   const count = this.numLoadedPerCategory[category];

  //   if (count === undefined) {
  //     this.numLoadedPerCategory[category] = 1;
  //     this.lastFilterTime = start;
  //     return true;
  //   }

  //   if (count < this.numberToLoad) {
  //     this.numLoadedPerCategory[category]++;
  //     this.lastFilterTime = start;
  //     return true;
  //   }

  //   return false;
  // }

  /**
   * Allows a hook for the backend to inform us a of new videos that we have
   * generated locally, either on disk or in the cloud.
   */
  private setupListeners() {
    const addVideo = (arg: unknown) => {
      const video = arg as RendererVideo;

      if (video.cloud) {
        this.cloudVideos.push(video as RendererVideo);

        // The badge counters are generated from the list of cloud objects so
        // also put a fake item on the list representing our video so it is
        // included in the count.
        const fake: CloudObject = {
          key: video.videoSource,
          size: 0,
          lastMod: new Date(),
        };

        this.cloudList.push(fake);
      } else {
        this.diskVideos.push(video as RendererVideo);
      }

      this.applyVideoState();
    };

    this.ipc.on('addVideo', addVideo);

    // const deleteVideo = (arg: unknown) => {
    //   const video = arg as RendererVideo;

    //   if (video.cloud) {
    //     const index = this.cloudVideos.indexOf(video);
    //     if (index < 0) return;
    //     this.cloudVideos.splice(index, 1);
    //   } else {
    //     const index = this.diskVideos.indexOf(video);
    //     if (index < 0) return;
    //     this.diskVideos.splice(index, 1);
    //   }
    //   this.set();
    // };
    // this.ipc.on('deleteVideo', deleteVideo);
  }

  /**
   * Detatches any videos attached to the multiPov property of other videos.
   * We need this because we correlate them in this class, but we access by
   * reference so without undoing it we can have phantom videos sticking
   * around in the UI.
   */
  private uncorrelate() {
    this.cloudVideos.forEach((video) => {
      video.multiPov = [];
    });

    this.diskVideos.forEach((video) => {
      video.multiPov = [];
    });
  }
}
