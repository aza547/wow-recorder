import { Flavour, Metadata } from 'main/types';

import { IConfigService } from '../config/ConfigService';

import { VideoCategory } from '../types/VideoCategory';
import Activity from './Activity';

/**
 * Class representing a manual recording.
 */
export default class Manual extends Activity {
  constructor(startDate: Date, flavour: Flavour, cfg: IConfigService) {
    super(startDate, VideoCategory.Manual, flavour, cfg);
  }

  /**
   * Minimal set of valid metadata, we know nothing.
   */
  getMetadata(): Metadata {
    return {
      category: VideoCategory.Manual,
      flavour: this.flavour,
      duration: this.duration,
      result: this.result,
      overrun: this.overrun,
      combatants: [],
      start: this.startDate.getTime(),
    };
  }

  getFileName(): string {
    return 'Manual';
  }
}
