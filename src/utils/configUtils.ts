import {
  ObsBaseConfig,
  ObsVideoConfig,
  ObsAudioConfig,
  FlavourConfig,
  ObsOverlayConfig,
  Metadata,
  CloudConfig,
  Flavour,
} from 'main/types';
import path from 'path';
import ConfigService from '../config/ConfigService';
import { categoryRecordingSettings } from '../main/constants';
import { VideoCategory } from '../types/VideoCategory';
import { ESupportedEncoders } from '../main/obsEnums';

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

  const categoryAllowed = cfg.get<boolean>(categoryConfig.allowRecordKey);

  if (!categoryAllowed) {
    console.info('[configUtils] Configured to not record:', category);
    return false;
  }

  console.info('[configUtils] Good to record:', category);
  return true;
};

const shouldUpload = (cfg: ConfigService, metadata: Metadata) => {
  const { category, flavour } = metadata;

  const upload = cfg.get<boolean>('cloudUpload');

  if (!upload) {
    console.info('[configUtils] Cloud upload is disabled');
    return false;
  }

  if (flavour === Flavour.Retail && !cfg.get<boolean>('cloudUploadRetail')) {
    console.info('[configUtils] Retail upload is disabled');
    return false;
  }

  if (flavour === Flavour.Classic && !cfg.get<boolean>('cloudUploadClassic')) {
    console.info('[configUtils] Classic upload is disabled');
    return false;
  }

  if (category === VideoCategory.Clips) {
    const uploadClips = cfg.get<boolean>('cloudUploadClips');
    console.info('[configUtils] Upload clip?', uploadClips);
    return uploadClips;
  }

  const categoryConfig = categoryRecordingSettings[category];

  if (!categoryConfig) {
    console.info('[configUtils] Unrecognised category', category);
    return false;
  }

  const categoryAllowed = cfg.get<boolean>(categoryConfig.autoUploadKey);

  if (!categoryAllowed) {
    console.info('[configUtils] Configured to not upload:', category);
    return false;
  }

  if (category === VideoCategory.Raids) {
    const { difficulty } = metadata;

    const orderedDifficulty = ['lfr', 'normal', 'heroic', 'mythic'];
    const orderedDifficultyIDs = ['LFR', 'N', 'HC', 'M'];

    const minDifficultyToUpload = cfg
      .get<string>('cloudUploadRaidMinDifficulty')
      .toLowerCase();

    if (difficulty === undefined) {
      console.info('[configUtils] Undefined difficulty, not blocking');
      return true;
    }

    const configuredIndex = orderedDifficulty.indexOf(minDifficultyToUpload);
    const actualIndex = orderedDifficultyIDs.indexOf(difficulty);

    if (actualIndex < 0) {
      console.info('[configUtils] Unrecognised difficulty, not blocking');
      return true;
    }

    if (actualIndex < configuredIndex) {
      console.info('[configUtils] Raid encounter below  upload threshold');
      return false;
    }
  }

  if (category === VideoCategory.MythicPlus) {
    const minKeystoneLevel = cfg.get<number>('cloudUploadDungeonMinLevel');
    const { keystoneLevel } = metadata;

    if (keystoneLevel === undefined) {
      console.info('[configUtils] Keystone level undefined, not blocking');
      return true;
    }

    if (keystoneLevel < minKeystoneLevel) {
      console.info('[configUtils] Keystone too low for upload');
      return false;
    }
  }

  console.info('[configUtils] Good to upload:', category);
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

  // Bizzare here bug where the amd_amf_h264 suddenly started massively leaking
  // memory for me, and switching to the texture one resolved it. This migrates
  // all users of the amd_amf_h264 encoder to use h264_texture_amf.
  let obsRecEncoder = cfg.get<string>('obsRecEncoder');

  if (obsRecEncoder === 'amd_amf_h264') {
    obsRecEncoder = ESupportedEncoders.AMD_AMF_H264;
    cfg.set('obsRecEncoder', obsRecEncoder);
  }

  return {
    storagePath: cfg.get<string>('storagePath'),
    maxStorage: cfg.get<number>('maxStorage'),
    obsPath,
    obsOutputResolution: cfg.get<string>('obsOutputResolution'),
    obsFPS: cfg.get<number>('obsFPS'),
    obsQuality: cfg.get<string>('obsQuality'),
    obsRecEncoder,
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
    recordRetailPtr: cfg.get<boolean>('recordRetailPtr'),
    retailLogPath: cfg.get<string>('retailLogPath'),
    recordEra: cfg.get<boolean>('recordEra'),
    eraLogPath: cfg.get<string>('eraLogPath'),
    retailPtrLogPath: cfg.get<string>('retailPtrLogPath'),
  };
};

const getOverlayConfig = (cfg: ConfigService): ObsOverlayConfig => {
  return {
    chatOverlayEnabled: cfg.get<boolean>('chatOverlayEnabled'),
    chatOverlayOwnImage: cfg.get<boolean>('chatOverlayOwnImage'),
    chatOverlayOwnImagePath: cfg.get<string>('chatOverlayOwnImagePath'),
    chatOverlayWidth: cfg.get<number>('chatOverlayWidth'),
    chatOverlayHeight: cfg.get<number>('chatOverlayHeight'),
    chatOverlayScale: cfg.get<number>('chatOverlayScale'),
    chatOverlayXPosition: cfg.get<number>('chatOverlayXPosition'),
    chatOverlayYPosition: cfg.get<number>('chatOverlayYPosition'),

    // While not strictly overlay config, we need this to determine
    // if it's valid to have a custom overlay (which is a paid feature).
    cloudStorage: cfg.get<boolean>('cloudStorage'),
  };
};

const getCloudConfig = (cfg: ConfigService): CloudConfig => {
  return {
    cloudStorage: cfg.get<boolean>('cloudStorage'),
    cloudUpload: cfg.get<boolean>('cloudUpload'),
    cloudAccountName: cfg.get<string>('cloudAccountName'),
    cloudAccountPassword: cfg.get<string>('cloudAccountPassword'),
    cloudGuildName: cfg.get<string>('cloudGuildName'),
  };
};

export {
  allowRecordCategory,
  shouldUpload,
  getObsBaseConfig,
  getObsVideoConfig,
  getObsAudioConfig,
  getFlavourConfig,
  getOverlayConfig,
  getCloudConfig,
};
