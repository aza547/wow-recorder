import {
  ObsBaseConfig,
  ObsVideoConfig,
  ObsAudioConfig,
  FlavourConfig,
  ObsOverlayConfig,
} from 'main/types';
import path from 'path';
import ConfigService from '../main/ConfigService';
import { categoryRecordingSettings } from '../main/constants';
import { VideoCategory } from '../types/VideoCategory';

const allowRecordCategory = (cfg: ConfigService, category: VideoCategory) => {
  if (category === VideoCategory.Clips) {
    console.info('[configUtils] Clips are never recorded directly');
    return false;
  }

  const categoryConfig = categoryRecordingSettings[category];

  if (!categoryConfig) {
    console.info('[configUtils] Unrecognised category', category);
    return false;
  }

  const categoryAllowed = cfg.get<boolean>(categoryConfig.configKey);

  if (!categoryAllowed) {
    console.info('[configUtils] Configured to not record:', category);
    return false;
  }

  console.info('[configUtils] Good to record:', category);
  return true;
};

const getObsBaseConfig = (cfg: ConfigService): ObsBaseConfig => {
  const storagePath = cfg.getPath('storagePath');
  let obsPath: string;

  if (cfg.get<boolean>('separateBufferPath')) {
    obsPath = cfg.getPath('bufferStoragePath');
  } else {
    obsPath = path.join(storagePath, '.temp');
  }

  return {
    storagePath: cfg.get<string>('storagePath'),
    maxStorage: cfg.get<number>('maxStorage'),
    obsPath,
    obsOutputResolution: cfg.get<string>('obsOutputResolution'),
    obsFPS: cfg.get<number>('obsFPS'),
    obsQuality: cfg.get<string>('obsQuality'),
    obsRecEncoder: cfg.get<string>('obsRecEncoder'),
    cloudStorage: cfg.get<boolean>('cloudStorage'),
    cloudUpload: cfg.get<boolean>('cloudUpload'),
    cloudAccountName: cfg.get<string>('cloudAccountName'),
    cloudAccountPassword: cfg.get<string>('cloudAccountPassword'),
    cloudGuildName: cfg.get<string>('cloudGuildName'),
  };
};

const getObsVideoConfig = (cfg: ConfigService): ObsVideoConfig => {
  return {
    obsCaptureMode: cfg.get<string>('obsCaptureMode'),
    monitorIndex: cfg.get<number>('monitorIndex'),
    captureCursor: cfg.get<boolean>('captureCursor'),
  };
};

const getObsAudioConfig = (cfg: ConfigService): ObsAudioConfig => {
  return {
    audioInputDevices: cfg.get<string>('audioInputDevices'),
    audioOutputDevices: cfg.get<string>('audioOutputDevices'),
    obsForceMono: cfg.get<boolean>('obsForceMono'),
    speakerVolume: cfg.get<number>('speakerVolume'),
    micVolume: cfg.get<number>('micVolume'),
    pushToTalk: cfg.get<boolean>('pushToTalk'),
    pushToTalkKey: cfg.get<number>('pushToTalkKey'),
    pushToTalkMouseButton: cfg.get<number>('pushToTalkMouseButton'),
    pushToTalkModifiers: cfg.get<string>('pushToTalkModifiers'),
    obsAudioSuppression: cfg.get<boolean>('obsAudioSuppression'),
  };
};

const getFlavourConfig = (cfg: ConfigService): FlavourConfig => {
  return {
    recordClassic: cfg.get<boolean>('recordClassic'),
    classicLogPath: cfg.get<string>('classicLogPath'),
    recordRetail: cfg.get<boolean>('recordRetail'),
    retailLogPath: cfg.get<string>('retailLogPath'),
    recordEra: cfg.get<boolean>('recordEra'),
    eraLogPath: cfg.get<string>('eraLogPath'),
  };
};

const getOverlayConfig = (cfg: ConfigService): ObsOverlayConfig => {
  return {
    chatOverlayEnabled: cfg.get<boolean>('chatOverlayEnabled'),
    chatOverlayWidth: cfg.get<number>('chatOverlayWidth'),
    chatOverlayHeight: cfg.get<number>('chatOverlayHeight'),
    chatOverlayXPosition: cfg.get<number>('chatOverlayXPosition'),
    chatOverlayYPosition: cfg.get<number>('chatOverlayYPosition'),
  };
};

// eslint-disable-next-line import/prefer-default-export
export {
  allowRecordCategory,
  getObsBaseConfig,
  getObsVideoConfig,
  getObsAudioConfig,
  getFlavourConfig,
  getOverlayConfig,
};
