import { shell, systemPreferences } from 'electron';
import type {
  IPermissionsGate,
  PermissionKey,
  PermissionStatus,
  PermissionsSnapshot,
} from './IPermissionsGate';

const SETTINGS_URL: Record<PermissionKey, string> = {
  screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
};

function normaliseMediaStatus(s: string): PermissionStatus {
  // Electron returns 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown'.
  // We collapse 'restricted' (institutional MDM block) into 'denied' since the
  // user cannot grant it from our settings flow anyway.
  if (s === 'granted' || s === 'denied' || s === 'not-determined' || s === 'unknown') {
    return s as PermissionStatus;
  }
  if (s === 'restricted') return 'denied';
  return 'unknown';
}

/**
 * macOS TCC gate. Reads Screen Recording + Microphone status via the
 * Electron `systemPreferences` API and Accessibility status via
 * `isTrustedAccessibilityClient`. Deep-links open the correct Privacy
 * pane so the user can toggle the grant without hunting through menus.
 */
export default class MacTccGate implements IPermissionsGate {
  snapshot(): PermissionsSnapshot {
    return {
      screen: normaliseMediaStatus(systemPreferences.getMediaAccessStatus('screen')),
      microphone: normaliseMediaStatus(systemPreferences.getMediaAccessStatus('microphone')),
      accessibility: systemPreferences.isTrustedAccessibilityClient(false)
        ? 'granted'
        : 'denied',
    };
  }

  canRecord(): boolean {
    return this.snapshot().screen === 'granted';
  }

  canUseGlobalHotkeys(): boolean {
    return this.snapshot().accessibility === 'granted';
  }

  openSettingsFor(key: PermissionKey): void {
    shell.openExternal(SETTINGS_URL[key]);
  }
}
