export type PermissionStatus =
  | 'granted'
  | 'denied'
  | 'unknown'
  | 'not-determined';

export type PermissionKey = 'screen' | 'microphone' | 'accessibility';

export interface PermissionsSnapshot {
  screen: PermissionStatus;
  microphone: PermissionStatus;
  accessibility: PermissionStatus;
}

/**
 * Platform permission gate. macOS reports real TCC state via
 * `systemPreferences`; Windows treats every permission as granted
 * because the relevant APIs (DirectX capture, uiohook) work without
 * explicit grants.
 */
export interface IPermissionsGate {
  /** Current status for all three permission categories. */
  snapshot(): PermissionsSnapshot;
  /** True iff screen recording is granted (the minimum required to record). */
  canRecord(): boolean;
  /** True iff all listeners can attach (uiohook hotkeys). */
  canUseGlobalHotkeys(): boolean;
  /** Open the OS Settings pane for the given category (no-op on platforms without one). */
  openSettingsFor(key: PermissionKey): void;
}
