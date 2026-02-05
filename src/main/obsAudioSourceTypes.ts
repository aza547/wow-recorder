/**
 * Platform-specific OBS audio source type mappings.
 */
import { isLinux } from './platform';
import { AudioSourceType } from './types';

// Platform audio source type mapping
const AudioSourceOBSType: Record<AudioSourceType, string> =
  isLinux
    ? {
        [AudioSourceType.OUTPUT]: 'pulse_output_capture',
        [AudioSourceType.INPUT]: 'pulse_input_capture',
        [AudioSourceType.PROCESS]: 'pipewire_audio_application_capture',
      }
    : {
        [AudioSourceType.OUTPUT]: 'wasapi_output_capture',
        [AudioSourceType.INPUT]: 'wasapi_input_capture',
        [AudioSourceType.PROCESS]: 'wasapi_process_output_capture',
      };

/**
 * Get the OBS source type string for a given AudioSourceType.
 * Used to pass in values to noobs/CreateSource.
 */
export function getOBSAudioSourceType(type: AudioSourceType): string {
  return AudioSourceOBSType[type];
}
