import { desktopCapturer, shell, systemPreferences } from 'electron';
import {
  MacOSPermissionTarget,
  MacOSPermissions,
  MacOSPermissionState,
} from './types';

const SYSTEM_SETTINGS_URLS: Record<MacOSPermissionTarget, string> = {
  accessibility:
    'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  microphone:
    'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
  screen:
    'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
};

const getMediaAccessStatus = (
  mediaType: 'microphone' | 'screen',
): MacOSPermissionState => {
  if (process.platform !== 'darwin') {
    return 'unknown';
  }

  return systemPreferences.getMediaAccessStatus(mediaType);
};

const getMacOSPermissions = (): MacOSPermissions => {
  const supported = process.platform === 'darwin';

  if (!supported) {
    return {
      accessibility: false,
      microphone: 'unknown',
      screen: 'unknown',
      supported,
    };
  }

  return {
    accessibility: systemPreferences.isTrustedAccessibilityClient(false),
    microphone: getMediaAccessStatus('microphone'),
    screen: getMediaAccessStatus('screen'),
    supported,
  };
};

const requestMacOSPermission = async (
  target: MacOSPermissionTarget,
): Promise<MacOSPermissions> => {
  if (process.platform !== 'darwin') {
    return getMacOSPermissions();
  }

  try {
    if (target === 'microphone') {
      await systemPreferences.askForMediaAccess('microphone');
    } else if (target === 'accessibility') {
      systemPreferences.isTrustedAccessibilityClient(true);
    } else {
      await desktopCapturer.getSources({
        fetchWindowIcons: false,
        thumbnailSize: { height: 1, width: 1 },
        types: ['screen'],
      });
    }
  } catch (error) {
    console.warn('[macOSPermissions] Permission request failed', target, error);
  }

  return getMacOSPermissions();
};

const openMacOSPermissionSettings = async (target: MacOSPermissionTarget) => {
  if (process.platform !== 'darwin') {
    return;
  }

  await shell.openExternal(SYSTEM_SETTINGS_URLS[target]);
};

export {
  getMacOSPermissions,
  openMacOSPermissionSettings,
  requestMacOSPermission,
};
