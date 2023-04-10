import { RendererVideo } from 'main/types';

export default class VideoFilter {
  private currentDate = new Date();

  private static goodResultFilters = [
    'win',
    'wins',
    'won',
    'victory',
    'time',
    'timed',
    'kill',
    'killed',
  ];

  private static badResultFilters = [
    'loss',
    'lose',
    'losses',
    'lost',
    'deplete',
    'depleted',
    'wipe',
    'wiped',
  ];

  private static todayFilters = ['today'];

  private static yesterdayFilters = ['yesterday'];

  private resultFilter: boolean | undefined;

  private todayFilter: boolean | undefined;

  private yesterdayFilter: boolean | undefined;

  private keystoneLevelFilter: number | undefined;

  private invalid = false;

  constructor(query: string) {
    if (query === '') {
      return;
    }

    const filterArray = query.split(' ').map((f) => f.toLowerCase());

    filterArray.forEach((filter: string) => {
      if (VideoFilter.goodResultFilters.includes(filter)) {
        this.addResultFilter(true);
        return;
      }

      if (VideoFilter.badResultFilters.includes(filter)) {
        this.addResultFilter(false);
        return;
      }

      if (VideoFilter.todayFilters.includes(filter)) {
        this.addTodayFilter();
        return;
      }

      if (VideoFilter.yesterdayFilters.includes(filter)) {
        this.addYesterdayFilter();
        return;
      }

      const keystoneUpgradeMatch = filter.match(/\+(\d+)/);

      if (keystoneUpgradeMatch) {
        this.addKeystoneLevelFilter(parseInt(keystoneUpgradeMatch[1], 10));
        return;
      }

      // If we've not recognised all the filters, add the invalid filter.
      // This will remove all the videos and prompt the user to re-evaluate
      // their query.
      this.addInvalidFilter();
    });
  }

  filter(video: RendererVideo) {
    if (this.invalid) {
      return false;
    }

    if (
      !this.filterResult(video) ||
      !this.filterToday(video) ||
      !this.filterYesterday(video) ||
      !this.filterKeystoneLevel(video)
    ) {
      return false;
    }

    return true;
  }

  addResultFilter(result: boolean) {
    this.resultFilter = result;
  }

  addTodayFilter() {
    this.todayFilter = true;
  }

  addYesterdayFilter() {
    this.yesterdayFilter = true;
  }

  addKeystoneLevelFilter(level: number) {
    this.keystoneLevelFilter = level;
  }

  addInvalidFilter() {
    this.invalid = true;
  }

  private filterResult(video: RendererVideo) {
    if (this.resultFilter === undefined) {
      return true;
    }

    const { result } = video;

    if (this.resultFilter !== result) {
      return false;
    }

    return true;
  }

  private filterToday(video: RendererVideo) {
    if (this.todayFilter === undefined) {
      return true;
    }

    const videoDate = new Date(video.mtime);

    const isFromToday =
      videoDate.getDate() === this.currentDate.getDate() &&
      videoDate.getMonth() === this.currentDate.getMonth() &&
      videoDate.getFullYear() === this.currentDate.getFullYear();

    if (isFromToday) {
      return true;
    }

    return false;
  }

  private filterYesterday(video: RendererVideo) {
    if (this.yesterdayFilter === undefined) {
      return true;
    }

    const videoDate = new Date(video.mtime);

    const isFromToday =
      videoDate.getDate() === this.currentDate.getDate() - 1 &&
      videoDate.getMonth() === this.currentDate.getMonth() &&
      videoDate.getFullYear() === this.currentDate.getFullYear();

    if (isFromToday) {
      return true;
    }

    return false;
  }

  private filterKeystoneLevel(video: RendererVideo) {
    if (this.keystoneLevelFilter === undefined) {
      return true;
    }

    const { level } = video;

    if (level === undefined) {
      return false;
    }

    if (level !== this.keystoneLevelFilter) {
      return false;
    }

    return true;
  }

  static getSuggestions() {
    const allValidFilters = [
      ...this.goodResultFilters,
      ...this.badResultFilters,
      ...this.todayFilters,
      ...this.yesterdayFilters,
      '+15',
    ];

    const suggestions: string[] = [];

    while (suggestions.length < 5) {
      const randomIndex = Math.floor(Math.random() * allValidFilters.length);
      const randomSelection = allValidFilters[randomIndex];

      if (!suggestions.includes(randomSelection)) {
        suggestions.push(randomSelection);
      }
    }

    return `Suggestions: ${suggestions.join(', ')}`;
  }
}
