import {
  StorageConfig,
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

const getStorageConfig = (cfg: ConfigService): StorageConfig => {
  return {
    storagePath: cfg.get<string>('storagePath'),
  };
};

const getObsBaseConfig = (cfg: ConfigService): ObsBaseConfig => {
  const storagePath = cfg.getPath('storagePath');
  let bufferPath: string;

  if (cfg.get<boolean>('separateBufferPath')) {
    bufferPath = cfg.getPath('bufferStoragePath');
  } else {
    bufferPath = path.join(storagePath, '.temp');
  }

  return {
    bufferStoragePath: bufferPath,
    obsOutputResolution: cfg.get<string>('obsOutputResolution'),
    obsFPS: cfg.get<number>('obsFPS'),
    obsKBitRate: cfg.get<number>('obsKBitRate'),
    obsRecEncoder: cfg.get<string>('obsRecEncoder'),
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
    pushToTalkKey: cfg.get<string>('pushToTalkKey'),
  };
};

const getFlavourConfig = (cfg: ConfigService): FlavourConfig => {
  return {
    recordClassic: cfg.get<boolean>('recordClassic'),
    classicLogPath: cfg.get<string>('classicLogPath'),
    recordRetail: cfg.get<boolean>('recordRetail'),
    retailLogPath: cfg.get<string>('retailLogPath'),
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
  getStorageConfig,
  getObsBaseConfig,
  getObsVideoConfig,
  getObsAudioConfig,
  getFlavourConfig,
  getOverlayConfig,
};
