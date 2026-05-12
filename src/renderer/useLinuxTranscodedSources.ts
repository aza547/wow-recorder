import { useEffect, useState } from 'react';

/**
 * Hook that owns the renderer-side logic for the Linux-only HEVC (H265) playback
 * transcoder (see src/main/PlaybackTranscoder.ts). It is no-op on non linux plaforms
 * due to callers passing an empty array of items.
 *
 * Callers tell us whether each item is HEVC via metadata. Items that aren't
 * HEVC bypass the transcoder in main and return the source unchanged.
 *
 * The effect re-runs whenever the joined cache keys change.
 */

export interface TranscodedItem {
  source: string;
  cacheKey: string;
  // NVENC_H265 / AMD_H265. Non-HEVC or unknown items skip the transcode entirely.
  isHevc: boolean;
}

export interface TranscodedSources {
  // Resolved playable URL per input item
  srcs: (string | null)[];
  // True if every entry in `srcs` is non-null. Always true on Windows.
  allReady: boolean;
  // Most recent progress event for any in-flight transcode in this set.
  progress: { percent: number; timemark?: string } | null;
}

interface ProgressEvent {
  key: string;
  state: 'start' | 'progress' | 'done' | 'error';
  percent?: number;
  timemark?: string;
  error?: string;
}

const ipc = window.electron.ipcRenderer;

export function useLinuxTranscodedSources(
  items: TranscodedItem[],
): TranscodedSources {
  const [srcs, setSrcs] = useState<(string | null)[]>(() =>
    items.map(() => null),
  );
  const [progress, setProgress] = useState<{
    percent: number;
    timemark?: string;
  } | null>(null);

  // Stable dep: re-run only when the set of cache keys actually changes.
  const depKey = items.map((i) => i.cacheKey).join('|');

  // Reset state in-render when items change so the caller never sees
  // stale srcs/allReady for one frame.
  const [prevDepKey, setPrevDepKey] = useState(depKey);
  if (prevDepKey !== depKey) {
    setPrevDepKey(depKey);
    setSrcs(items.map(() => null));
    setProgress(null);
  }

  useEffect(() => {
    // No-op when no items are passed
    if (items.length === 0) return;

    let cancelled = false;
    const cacheKeys = items.map((i) => i.cacheKey);
    const cacheKeySet = new Set(cacheKeys);

    setSrcs(items.map(() => null));
    setProgress(null);

    const onProgress = (...args: unknown[]) => {
      const ev = args[0] as ProgressEvent;
      if (!cacheKeySet.has(ev.key)) return;
      if (ev.state === 'start') {
        setProgress({ percent: 0 });
      } else if (ev.state === 'progress') {
        setProgress({
          percent: typeof ev.percent === 'number' ? ev.percent : 0,
          timemark: ev.timemark,
        });
      } else {
        // clear the progress when complete or it errored
        setProgress(null);
      }
    };
    const unsubscribeProgress = ipc.on('videoTranscodeProgress', onProgress);

    items.forEach(({ source, cacheKey, isHevc }, i) => {
      ipc
        .invoke('videoPrepareForPlayback', [source, cacheKey, isHevc])
        .then((result: { playableSource: string }) => {
          if (cancelled) return;
          setSrcs((prev) => {
            const next = [...prev];
            next[i] = result.playableSource;
            return next;
          });
        })
        .catch((err: unknown) => {
          // requires an electron IPC failure to fire this
          console.error('[useLinuxTranscodedSources] invoke failed', err);
        });
    });

    return () => {
      cancelled = true;
      unsubscribeProgress?.();
      cacheKeys.forEach((k) => ipc.sendMessage('videoCancelTranscode', [k]));
    };
    // tracks the cache keys so the rebuild only happens when it actually changes
  }, [depKey]);

  const allReady = items.length === 0 || srcs.every((s) => s !== null);
  return { srcs, allReady, progress };
}
