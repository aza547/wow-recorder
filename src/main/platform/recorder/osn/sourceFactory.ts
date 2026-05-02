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
  // OSN's mac-capture plugin in 0.26.x ships `mac_screen_capture`
  // (ScreenCaptureKit-backed) plus the legacy `display_capture` and
  // `window_capture` (CGDisplayStream / CGWindowList). 'screen_capture'
  // is a SLOBS-fork-only ID and doesn't exist here. Use the SCK source
  // for both monitor and window since it integrates with the IOSurface
  // render target reliably on macOS 14+.
  window_capture: {
    sourceId: 'mac_screen_capture',
    defaults: { type: 1 }, // SCK type 1 = Window
  },
  monitor_capture: {
    sourceId: 'mac_screen_capture',
    defaults: { type: 0 }, // SCK type 0 = Display
  },
  display_capture: {
    sourceId: 'mac_screen_capture',
    defaults: { type: 0 },
  },
  // Audio — map Windows WASAPI source types to macOS CoreAudio.
  // Recorder.ts only knows the wasapi_* names from its noobs heritage;
  // we redirect them on mac.
  // CoreAudio defaults stay empty: setting `device_id: 'default'` at
  // create time forces libobs into a synchronous CoreAudio probe
  // (TCC scope dialog + device enumeration) that can hang the OSN
  // helper for tens of seconds. Recorder.configureAudioSources sets
  // `device_id` in setSourceSettings after property fetch instead.
  wasapi_input_capture: {
    sourceId: 'coreaudio_input_capture',
    defaults: {},
  },
  wasapi_output_capture: {
    sourceId: 'coreaudio_output_capture',
    defaults: {},
  },
  wasapi_process_output_capture: {
    // Mac: SCK-based source creation hangs the OSN sync IPC during
    // ScreenCaptureKit init (observed: app freeze on Add Application
    // / Add Desktop Audio button click). Disabled until we land
    // either an async create path or a different audio capture
    // strategy. Falls back to default-output capture so the source
    // doesn't error; users wanting real desktop/per-app audio
    // install BlackHole + Audio MIDI Multi-Output and pick BlackHole
    // as a Microphone input (matches SLOBS Mac docs).
    sourceId: 'coreaudio_output_capture',
    defaults: {},
  },
  sck_audio_capture: {
    // Direct alias kept for future use once SCK init is stable.
    sourceId: 'sck_audio_capture',
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
