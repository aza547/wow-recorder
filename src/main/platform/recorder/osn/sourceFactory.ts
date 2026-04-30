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
  // SLOBS uses 'screen_capture' (ScreenCaptureKit-backed) on macOS — it
  // renders into the IOSurface display target reliably on macOS 14+.
  // The legacy 'display_capture' / 'window_capture' (CGDisplayStream /
  // CGWindowList) sources stay registered but draw into a separate
  // target that doesn't reach our preview surface.
  window_capture: {
    sourceId: 'screen_capture',
    defaults: { type: 1 }, // SCK type 1 = Window
  },
  monitor_capture: {
    sourceId: 'screen_capture',
    defaults: { type: 0 }, // SCK type 0 = Display
  },
  display_capture: {
    sourceId: 'screen_capture',
    defaults: { type: 0 },
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
