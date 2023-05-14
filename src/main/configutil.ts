import path from 'path';
import ConfigService from './ConfigService';
import { ESupportedEncoders } from './obsEnums';

const getBaseRecorderConfig = (cfg: ConfigService) => {
  const storagePath = cfg.getPath('storagePath');
  let bufferPath: string;

  if (cfg.get<boolean>('separateBufferPath')) {
    bufferPath = cfg.getPath('bufferStoragePath');
  } else {
    bufferPath = path.join(storagePath, '.temp');
  }

  const resolution = cfg.get<string>('obsOutputResolution');
  const fps = cfg.get<number>('obsFPS');
  const encoder = cfg.get<string>('obsRecEncoder') as ESupportedEncoders;
  const kBitRate = 1000 * cfg.get<number>('obsKBitRate');

  return { bufferPath, resolution, fps, encoder, kBitRate };
};

const getVideoRecorderConfig = (cfg: ConfigService) => {
  const captureMode = cfg.get<string>('obsCaptureMode');
  const monitorIndex = cfg.get<number>('monitorIndex');
  const captureCursor = cfg.get<boolean>('captureCursor');
  return { captureMode, monitorIndex, captureCursor };
};

const getAudioRecorderConfig = (cfg: ConfigService) => {
  const speakers = cfg.get<string>('audioOutputDevices');
  const speakerMultiplier = cfg.get<number>('speakerVolume');
  const mics = cfg.get<string>('audioInputDevices');
  const micMultiplier = cfg.get<number>('micVolume');
  const forceMono = cfg.get<boolean>('obsForceMono');
  return { speakers, speakerMultiplier, mics, micMultiplier, forceMono };
};

const getOverlayConfig = (cfg: ConfigService) => {
  const overlayEnabled = cfg.get<boolean>('chatOverlayEnabled');
  const width = cfg.get<number>('chatOverlayWidth');
  const height = cfg.get<number>('chatOverlayHeight');
  const xPos = cfg.get<number>('chatOverlayXPosition');
  const yPos = cfg.get<number>('chatOverlayYPosition');
  return { overlayEnabled, width, height, xPos, yPos };
};

export {
  getBaseRecorderConfig,
  getVideoRecorderConfig,
  getAudioRecorderConfig,
  getOverlayConfig,
};
