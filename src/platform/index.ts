/**
 * Platform detection utilities for cross-platform support.
 */

const getPlatform = (): string => {
  if (typeof process !== 'undefined' && process.platform) {
    return process.platform;
  }
  if (typeof navigator !== 'undefined' && navigator.platform) {
    const navPlatform = navigator.platform.toLowerCase();
    if (navPlatform.includes('linux')) return 'linux';
    if (navPlatform.includes('mac')) return 'darwin';
    if (navPlatform.includes('win')) return 'win32';
  }
  return 'win32';
};

const platform = getPlatform();

export const isLinux = platform === 'linux';
export const isWindows = platform === 'win32';
export const isMac = platform === 'darwin';

export const getFileManagerCommand = (filePath: string): string => {
  if (isLinux) {
    const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
    return `xdg-open "${dirPath}"`;
  }
  if (isMac) {
    return `open -R "${filePath}"`;
  }
  const windowsPath = filePath.replace(/\//g, '\\');
  return `explorer.exe /select,"${windowsPath}"`;
};

/**
 * Maps AudioSourceType enum values to platform-specific OBS source type strings.
 */
export const getObsAudioSourceType = (audioSourceType: string): string => {
  if (isLinux) {
    const linuxMapping: Record<string, string> = {
      'wasapi_output_capture': 'pulse_output_capture',
      'wasapi_input_capture': 'pulse_input_capture',
      'wasapi_process_output_capture': 'pulse_output_capture',
    };
    return linuxMapping[audioSourceType] || audioSourceType;
  }
  return audioSourceType;
};

/**
 * Check if process-specific audio capture is available on the current platform.
 */
export const isProcessAudioCaptureAvailable = (): boolean => {
  return !isLinux;
};

/**
 * Get the graphics module name for OBS based on platform.
 */
export const getObsGraphicsModule = (): string => {
  if (isLinux) {
    return 'libobs-opengl';
  }
  return 'libobs-d3d11';
};

/**
 * Get the appropriate OBS capture source type for the current platform.
 */
export const getObsCaptureSourceType = (captureMode: string): string => {
  if (isLinux) {
    return 'pipewire-screen-capture-source';
  }
  return captureMode;
};

/**
 * Check if the given capture mode is available on the current platform.
 */
export const isCaptureSourceAvailable = (captureMode: string): boolean => {
  return true;
};
