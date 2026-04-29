import type { ObsData } from '../types';

/**
 * Resolved source = native OSN source ID + sensible default settings.
 * Maps the source-type strings the rest of the app passes (which were
 * historically Windows-noobs strings like `window_capture`, `image_source`)
 * to the macOS OSN source IDs.
 */
export interface ResolvedSource {
  sourceId: string;
  defaults: ObsData;
}

const MAP: Record<string, ResolvedSource> = {
  // Capture sources — OSN's mac-capture plugin registers separate source
  // IDs for window vs display capture (legacy CGWindowList /
  // CGDisplayStream impls). The newer ScreenCaptureKit-based 'sck_*'
  // sources may exist on macOS 14+ but the legacy ones are universally
  // available and what OSN's properties getter returns data for.
  window_capture: {
    sourceId: 'window_capture',
    defaults: {},
  },
  monitor_capture: {
    sourceId: 'display_capture',
    defaults: {},
  },
  display_capture: {
    sourceId: 'display_capture',
    defaults: {},
  },
  // Audio — map Windows WASAPI source types to macOS CoreAudio.
  // Recorder.ts only knows the wasapi_* names from its noobs heritage;
  // we redirect them on mac.
  wasapi_input_capture: {
    sourceId: 'coreaudio_input_capture',
    defaults: {},
  },
  wasapi_output_capture: {
    sourceId: 'coreaudio_output_capture',
    defaults: {},
  },
  wasapi_process_output_capture: {
    // No mac equivalent (per-process audio). Fall back to whole-system
    // output capture; user loses per-app audio isolation but recording
    // still produces audio.
    sourceId: 'coreaudio_output_capture',
    defaults: {},
  },
  coreaudio_input_capture: {
    sourceId: 'coreaudio_input_capture',
    defaults: {},
  },
  coreaudio_output_capture: {
    sourceId: 'coreaudio_output_capture',
    defaults: {},
  },
  // Pass-through types
  image_source: { sourceId: 'image_source', defaults: {} },
  browser_source: { sourceId: 'browser_source', defaults: {} },
};

export function resolveMacSource(callerType: string): ResolvedSource {
  return MAP[callerType] ?? { sourceId: callerType, defaults: {} };
}
