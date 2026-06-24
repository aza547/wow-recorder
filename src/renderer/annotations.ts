import { ExcalidrawElement } from '@excalidraw/excalidraw/dist/types/excalidraw/element/types';

/**
 * A single time-stamped snapshot of the drawing scene. `t` is the video
 * position in seconds; `elements` is the full Excalidraw scene at that moment.
 *
 * VOD markup is stored as a time-ordered list of these keyframes rather than a
 * single whole-VOD overlay, so annotations become a time-sensitive record:
 * what you drew at 0:30 is distinct from what you drew at 2:10.
 */
export type Keyframe = {
  t: number;
  elements: ExcalidrawElement[];
};

type AnnotationRecord = {
  version: 2;
  keyframes: Keyframe[];
};

/**
 * How long (seconds) a keyframe's drawing stays on screen during playback
 * before it clears ("flash" display). The caller passes the live playhead,
 * which freezes on pause, so a keyframe visible at the moment of pausing stays
 * up until playback resumes and moves past the window.
 */
export const FLASH_WINDOW_SECONDS = 5;

/** Bounds for the user-adjustable flash window (the duration slider). */
export const FLASH_WINDOW_MIN_SECONDS = 1;
export const FLASH_WINDOW_MAX_SECONDS = 30;

/**
 * Edits within this many seconds of an existing keyframe update that keyframe
 * in place rather than spawning a new one, so a burst of strokes at one spot
 * doesn't fragment into many near-identical keyframes.
 */
export const KEYFRAME_MERGE_TOLERANCE_SECONDS = 0.75;

const EMPTY: ExcalidrawElement[] = [];

/**
 * Parse the persisted annotation string into a sorted keyframe list. Accepts
 * both the current keyframe-record format and the legacy single-scene format (a
 * bare Excalidraw element array), which is migrated to one keyframe at t=0.
 */
export const parseKeyframes = (raw: string | null | undefined): Keyframe[] => {
  if (!raw) {
    return [];
  }

  try {
    const data = JSON.parse(raw);

    if (Array.isArray(data)) {
      // Legacy format: a bare element array applied to the whole VOD. Anchor it
      // as a single keyframe at the start so old annotations still show. Drop
      // soft-deleted (isDeleted) tombstones.
      const visible = (data as ExcalidrawElement[]).filter(
        (el) => !el.isDeleted,
      );

      return visible.length ? [{ t: 0, elements: visible }] : [];
    }

    if (data && Array.isArray(data.keyframes)) {
      // Drop soft-deleted tombstones, then drop any keyframe left empty.
      return (data.keyframes as Keyframe[])
        .map((k) => ({
          t: Number(k.t) || 0,
          elements: Array.isArray(k.elements)
            ? k.elements.filter((el) => !el.isDeleted)
            : [],
        }))
        .filter((k) => k.elements.length > 0)
        .sort((a, b) => a.t - b.t);
    }
  } catch {
    console.error('[Annotations] Failed to parse stored annotations');
  }

  return [];
};

/**
 * Serialize keyframes for persistence. Returns '[]' when there is nothing to
 * keep, which the disk layer already treats as "clear annotations".
 */
export const serializeKeyframes = (keyframes: Keyframe[]): string => {
  const nonEmpty = keyframes.filter((k) => k.elements.length > 0);

  if (nonEmpty.length === 0) {
    return '[]';
  }

  const record: AnnotationRecord = { version: 2, keyframes: nonEmpty };
  return JSON.stringify(record);
};

/**
 * Insert or update the keyframe at time `t` with `elements`. An existing
 * keyframe within the merge tolerance is replaced; otherwise a new one is
 * inserted (kept sorted by time). Empty `elements` removes the keyframe at that
 * time, so erasing everything at a moment deletes that keyframe.
 */
export const upsertKeyframe = (
  keyframes: Keyframe[],
  t: number,
  elements: readonly ExcalidrawElement[],
): Keyframe[] => {
  const next = keyframes.filter(
    (k) => Math.abs(k.t - t) > KEYFRAME_MERGE_TOLERANCE_SECONDS,
  );

  if (elements.length > 0) {
    next.push({ t, elements: [...elements] });
  }

  return next.sort((a, b) => a.t - b.t);
};

/**
 * The keyframe at or just before `t`, but only while `t` is within the flash
 * window after it; otherwise null. Yields "flash near the timestamp, then
 * clear". Because the caller passes the live (freeze-on-pause) playhead, a
 * keyframe visible when the user pauses stays visible.
 */
export const activeFlashKeyframe = (
  keyframes: Keyframe[],
  t: number,
  windowSeconds = FLASH_WINDOW_SECONDS,
): Keyframe | null => {
  return keyframes.reduce<Keyframe | null>((best, k) => {
    const inWindow = k.t <= t + 1e-3 && t - k.t <= windowSeconds;
    if (!inWindow) return best;
    return !best || k.t > best.t ? k : best;
  }, null);
};

/** Convenience: elements of the active flash keyframe at `t`, or empty. */
export const flashElementsAt = (
  keyframes: Keyframe[],
  t: number,
  windowSeconds = FLASH_WINDOW_SECONDS,
): ExcalidrawElement[] => {
  const active = activeFlashKeyframe(keyframes, t, windowSeconds);
  return active ? active.elements : EMPTY;
};

/** Times of all keyframes, for drawing timeline markers. */
export const keyframeTimes = (keyframes: Keyframe[]): number[] =>
  keyframes.map((k) => k.t);
