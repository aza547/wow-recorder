import path from 'path';
import { ESupportedEncoders, QualityPresets } from './obsEnums';
import { AudioSourceType } from './types';

const isMacOS = process.platform === 'darwin';

const MAC_DEFAULT_OBS_APP_PATH = '/Applications/OBS.app';

const MAC_VIDEO_TOOLBOX_H264_ENCODERS = [
  ESupportedEncoders.APPLE_H264_HARDWARE,
  ESupportedEncoders.APPLE_H264_SOFTWARE,
];

const getNoobsRootPath = (defaultDistPath: string) => {
  if (!isMacOS) {
    return defaultDistPath;
  }

  return (
    process.env.WCR_OBS_APP_PATH || defaultDistPath || MAC_DEFAULT_OBS_APP_PATH
  );
};

const getOverlaySourceType = () => 'image_source';

const getWindowCaptureSourceType = () => 'window_capture';

const getGameCaptureSourceType = () =>
  isMacOS ? 'window_capture' : 'game_capture';

const getMonitorCaptureSourceType = () =>
  isMacOS ? 'display_capture' : 'monitor_capture';

const getAudioSourceType = (type: AudioSourceType) => {
  if (!isMacOS) {
    return type;
  }

  switch (type) {
    case AudioSourceType.OUTPUT:
    case AudioSourceType.PROCESS:
      return 'sck_audio_capture';
    case AudioSourceType.INPUT:
      return 'coreaudio_input_capture';
    default:
      return type;
  }
};

const isAppleH264Encoder = (encoder: string) =>
  MAC_VIDEO_TOOLBOX_H264_ENCODERS.includes(encoder as ESupportedEncoders);

const getVideoToolboxBitrate = (quality: string) => {
  switch (quality) {
    case QualityPresets.ULTRA:
      return 30000;
    case QualityPresets.HIGH:
      return 20000;
    case QualityPresets.MODERATE:
      return 16000;
    case QualityPresets.LOW:
      return 8000;
    default:
      return 16000;
  }
};

const getPackagedObsAppPath = (resourcesPath: string) =>
  path.join(resourcesPath, 'obs', 'OBS.app');

export {
  getAudioSourceType,
  getGameCaptureSourceType,
  getMonitorCaptureSourceType,
  getNoobsRootPath,
  getOverlaySourceType,
  getPackagedObsAppPath,
  getVideoToolboxBitrate,
  getWindowCaptureSourceType,
  isAppleH264Encoder,
  isMacOS,
};
