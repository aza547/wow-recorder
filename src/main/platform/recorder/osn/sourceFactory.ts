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
  // Capture sources — macOS uses `screen_capture` (ScreenCaptureKit) for both
  // window and display modes; the `type` field selects which.
  window_capture: {
    sourceId: 'screen_capture',
    // type=1 = window. Specific window selected via subsequent
    // setSourceSettings call once Recorder.ts knows the target.
    defaults: { type: 1 },
  },
  monitor_capture: {
    sourceId: 'screen_capture',
    defaults: { type: 0 }, // type=0 = display
  },
  display_capture: {
    sourceId: 'screen_capture',
    defaults: { type: 0 },
  },
  // Audio
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
