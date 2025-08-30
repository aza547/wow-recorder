import { BrowserWindow } from 'electron';
import Recorder from './Recorder';
import { getBaseConfig, validateBaseConfig } from 'utils/configUtils';
import ConfigService from 'config/ConfigService';

export class RecorderFactory {
  /**
   * Config service instance.
   */
  private static cfg = ConfigService.getInstance();

  /**
   * Create a recorder configured with the base config.
   *
   * @param window - the main electron window
   * @throws if the base config is invalid
   */
  static async create(window: BrowserWindow) {
    const config = getBaseConfig(this.cfg);
    validateBaseConfig(config);
    const recorder = new Recorder(window);
    await recorder.configureBase(config);
    return recorder;
  }
}
