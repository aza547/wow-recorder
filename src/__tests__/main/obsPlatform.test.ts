import { ESupportedEncoders, QualityPresets } from '../../main/obsEnums';
import { AudioSourceType } from '../../main/types';

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

const loadObsPlatform = (platform: NodeJS.Platform) => {
  jest.resetModules();
  Object.defineProperty(process, 'platform', {
    ...originalPlatform,
    value: platform,
  });

  return require('../../main/obsPlatform') as typeof import('../../main/obsPlatform');
};

afterEach(() => {
  jest.resetModules();
  if (originalPlatform) {
    Object.defineProperty(process, 'platform', originalPlatform);
  }
  delete process.env.WCR_OBS_APP_PATH;
});

describe('obsPlatform', () => {
  test('maps capture sources to macOS OBS source IDs', () => {
    const obsPlatform = loadObsPlatform('darwin');

    expect(obsPlatform.isMacOS).toBe(true);
    expect(obsPlatform.getWindowCaptureSourceType()).toBe('window_capture');
    expect(obsPlatform.getGameCaptureSourceType()).toBe('window_capture');
    expect(obsPlatform.getMonitorCaptureSourceType()).toBe('display_capture');
    expect(obsPlatform.getOverlaySourceType()).toBe('image_source');
  });

  test('keeps Windows capture source IDs unchanged', () => {
    const obsPlatform = loadObsPlatform('win32');

    expect(obsPlatform.isMacOS).toBe(false);
    expect(obsPlatform.getWindowCaptureSourceType()).toBe('window_capture');
    expect(obsPlatform.getGameCaptureSourceType()).toBe('game_capture');
    expect(obsPlatform.getMonitorCaptureSourceType()).toBe('monitor_capture');
  });

  test('maps configured audio source types to macOS OBS source IDs', () => {
    const obsPlatform = loadObsPlatform('darwin');

    expect(obsPlatform.getAudioSourceType(AudioSourceType.OUTPUT)).toBe(
      'sck_audio_capture',
    );
    expect(obsPlatform.getAudioSourceType(AudioSourceType.PROCESS)).toBe(
      'sck_audio_capture',
    );
    expect(obsPlatform.getAudioSourceType(AudioSourceType.INPUT)).toBe(
      'coreaudio_input_capture',
    );
  });

  test('keeps configured audio source types unchanged on Windows', () => {
    const obsPlatform = loadObsPlatform('win32');

    expect(obsPlatform.getAudioSourceType(AudioSourceType.OUTPUT)).toBe(
      AudioSourceType.OUTPUT,
    );
    expect(obsPlatform.getAudioSourceType(AudioSourceType.PROCESS)).toBe(
      AudioSourceType.PROCESS,
    );
    expect(obsPlatform.getAudioSourceType(AudioSourceType.INPUT)).toBe(
      AudioSourceType.INPUT,
    );
  });

  test('resolves macOS OBS app path override and packaged path', () => {
    process.env.WCR_OBS_APP_PATH = '/tmp/OBS.app';
    const obsPlatform = loadObsPlatform('darwin');

    expect(obsPlatform.getNoobsRootPath('/Applications/OBS.app')).toBe(
      '/tmp/OBS.app',
    );
    expect(obsPlatform.getPackagedObsAppPath('/tmp/resources')).toBe(
      '/tmp/resources/obs/OBS.app',
    );
  });

  test('recognizes Apple H264 encoders and VideoToolbox bitrates', () => {
    const obsPlatform = loadObsPlatform('darwin');

    expect(
      obsPlatform.isAppleH264Encoder(ESupportedEncoders.APPLE_H264_HARDWARE),
    ).toBe(true);
    expect(
      obsPlatform.isAppleH264Encoder(ESupportedEncoders.APPLE_H264_SOFTWARE),
    ).toBe(true);
    expect(obsPlatform.isAppleH264Encoder(ESupportedEncoders.NVENC_H264)).toBe(
      false,
    );
    expect(obsPlatform.getVideoToolboxBitrate(QualityPresets.ULTRA)).toBe(
      30000,
    );
    expect(obsPlatform.getVideoToolboxBitrate(QualityPresets.HIGH)).toBe(20000);
    expect(obsPlatform.getVideoToolboxBitrate(QualityPresets.MODERATE)).toBe(
      16000,
    );
    expect(obsPlatform.getVideoToolboxBitrate(QualityPresets.LOW)).toBe(8000);
  });
});
