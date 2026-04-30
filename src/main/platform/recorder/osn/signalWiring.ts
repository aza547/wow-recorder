import type { Signal } from '../types';
import type { SignalCallback } from '../IRecorderBackend';

interface OsnSignal {
  type: string;
  signal: string;
  code: number;
  error?: string;
}

/**
 * Subscribe to OSN output signals and forward them as the noobs-shaped
 * `Signal` object Recorder.ts expects. Side-channel: capture the last
 * recorded file path on 'wrote'/'stop' signals so getLastRecording()
 * returns it.
 */
export function subscribeOsnSignals(
  osn: typeof import('obs-studio-node'),
  callback: SignalCallback,
  onLastRecordingPath: (filePath: string) => void,
): void {
  osn.NodeObs.OBS_service_connectOutputSignals((signal: OsnSignal) => {
    // Recorder.handleSignal switches on `signal.id` (noobs shape), but
    // OSN sends `{type, signal, code, error}`. Remap so `id` carries the
    // signal name ('start'/'stop'/'wrote'/etc) Recorder expects.
    const remapped = {
      type: signal.type,
      id: signal.signal,
      signal: signal.signal,
      code: signal.code,
      error: signal.error,
    };
    try {
      callback(remapped as unknown as Signal);
    } catch (err) {
      console.error('[OsnBackend] signal callback threw', err);
    }

    // Side-channel: pull last-written path on terminal recording signals.
    if (signal.signal === 'wrote' || signal.signal === 'stop') {
      try {
        const NodeObs = osn.NodeObs as unknown as Record<string, unknown>;
        const getter = NodeObs.OBS_service_getLastRecording;
        if (typeof getter === 'function') {
          const p = (getter as () => string)();
          if (typeof p === 'string' && p.length > 0) {
            onLastRecordingPath(p);
          }
        }
      } catch (err) {
        console.warn('[OsnBackend] OBS_service_getLastRecording threw', err);
      }
    }
  });
}
