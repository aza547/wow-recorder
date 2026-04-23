const mockSystemPreferences = {
  getMediaAccessStatus: jest.fn(),
  isTrustedAccessibilityClient: jest.fn(),
};
const mockShell = {
  openExternal: jest.fn().mockResolvedValue(undefined),
};

jest.mock('electron', () => ({
  systemPreferences: mockSystemPreferences,
  shell: mockShell,
}));

import MacTccGate from 'main/platform/permissions/MacTccGate';

describe('MacTccGate', () => {
  beforeEach(() => {
    mockSystemPreferences.getMediaAccessStatus.mockReset();
    mockSystemPreferences.isTrustedAccessibilityClient.mockReset();
    mockShell.openExternal.mockReset();
  });

  it('reads screen + microphone status via systemPreferences and accessibility via trust', () => {
    mockSystemPreferences.getMediaAccessStatus.mockImplementation((k) =>
      k === 'screen' ? 'granted' : 'denied',
    );
    mockSystemPreferences.isTrustedAccessibilityClient.mockReturnValue(true);

    const snap = new MacTccGate().snapshot();
    expect(snap).toEqual({
      screen: 'granted',
      microphone: 'denied',
      accessibility: 'granted',
    });
  });

  it('canRecord reflects screen status', () => {
    mockSystemPreferences.getMediaAccessStatus.mockReturnValue('granted');
    mockSystemPreferences.isTrustedAccessibilityClient.mockReturnValue(false);
    expect(new MacTccGate().canRecord()).toBe(true);

    mockSystemPreferences.getMediaAccessStatus.mockImplementation((k) =>
      k === 'screen' ? 'denied' : 'granted',
    );
    expect(new MacTccGate().canRecord()).toBe(false);
  });

  it('canUseGlobalHotkeys reflects accessibility trust', () => {
    mockSystemPreferences.getMediaAccessStatus.mockReturnValue('granted');
    mockSystemPreferences.isTrustedAccessibilityClient.mockReturnValue(false);
    expect(new MacTccGate().canUseGlobalHotkeys()).toBe(false);

    mockSystemPreferences.isTrustedAccessibilityClient.mockReturnValue(true);
    expect(new MacTccGate().canUseGlobalHotkeys()).toBe(true);
  });

  it('opens the correct deep link for screen', () => {
    new MacTccGate().openSettingsFor('screen');
    expect(mockShell.openExternal).toHaveBeenCalledWith(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
    );
  });

  it('opens the correct deep link for microphone', () => {
    new MacTccGate().openSettingsFor('microphone');
    expect(mockShell.openExternal).toHaveBeenCalledWith(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
    );
  });

  it('opens the correct deep link for accessibility', () => {
    new MacTccGate().openSettingsFor('accessibility');
    expect(mockShell.openExternal).toHaveBeenCalledWith(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
    );
  });
});
