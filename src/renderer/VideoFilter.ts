/**
 * VideoFilter class.
 */
export default class VideoFilter {
  private currentDate = new Date();

  private goodResultFilters = ['win', 'wins', 'won', 'victory', 'success'];

  private badResultFilters = ['loss', 'lose', 'losses', 'lost'];

  private todayFilters = ['today'];

  private yesterdayFilters = ['yesterday'];

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
      if (this.goodResultFilters.includes(filter)) {
        this.addResultFilter(true);
        return;
      }

      if (this.badResultFilters.includes(filter)) {
        this.addResultFilter(false);
        return;
      }

      if (this.todayFilters.includes(filter)) {
        this.addTodayFilter();
        return;
      }

      if (this.yesterdayFilters.includes(filter)) {
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

  filter(video: any) {
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

  private filterResult(video: any) {
    if (this.resultFilter === undefined) {
      return true;
    }

    const { result } = video;

    if (this.resultFilter !== result) {
      return false;
    }

    return true;
  }

  private filterToday(video: any) {
    if (this.todayFilter === undefined) {
      return true;
    }

    const videoDate: Date = video.dateObject;

    const isFromToday =
      videoDate.getDay() === this.currentDate.getDay() &&
      videoDate.getMonth() === this.currentDate.getMonth() &&
      videoDate.getFullYear() === this.currentDate.getFullYear();

    if (isFromToday) {
      return true;
    }

    return false;
  }

  private filterYesterday(video: any) {
    if (this.yesterdayFilter === undefined) {
      return true;
    }

    const videoDate: Date = video.dateObject;

    const isFromToday =
      videoDate.getDay() === this.currentDate.getDay() &&
      videoDate.getMonth() === this.currentDate.getMonth() &&
      videoDate.getFullYear() === this.currentDate.getFullYear();

    if (isFromToday) {
      return true;
    }

    return false;
  }

  private filterKeystoneLevel(video: any) {
    if (this.keystoneLevelFilter === undefined) {
      return true;
    }

    const { level } = video;

    if (level > this.keystoneLevelFilter) {
      return false;
    }

    return true;
  }
}
