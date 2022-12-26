import ConfigService from '../main/ConfigService';
import { categoryRecordingSettings } from '../main/constants';
import { VideoCategory } from '../types/VideoCategory';

const allowRecordCategory = (cfg: ConfigService, category: VideoCategory) => {
  const categoryConfig = categoryRecordingSettings[category];

  if (!categoryConfig) {
    console.info('[LogUtils] Unrecognised category', category);
    return false;
  }

  const categoryAllowed = cfg.get<boolean>(categoryConfig.configKey);

  if (!categoryAllowed) {
    console.info('[LogUtils] Configured to not record:', category);
    return false;
  }

  console.info('[LogUtils] Good to record:', category);
  return true;
};

// eslint-disable-next-line import/prefer-default-export
export { allowRecordCategory };
