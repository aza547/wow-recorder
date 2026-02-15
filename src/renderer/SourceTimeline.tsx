import { RendererVideo } from 'main/types';
import { getPlayerClass, getPlayerName, secToMmSs } from './rendererutils';
import { useCallback, useMemo, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { WoWClassColor } from 'main/constants';

const MIN_DURATION = 10;

/**
 * Represents a single segment in the timeline with its own duration.
 * The videoName from RendererVideo is used as the unique key.
 */
export type TimelineSegment = {
  video: RendererVideo;
  duration: number;
};

interface SourceTimelineProps {
  sources: RendererVideo[];
  onChange: (segments: TimelineSegment[]) => void;
}

/**
 * Deduplicates sources by videoName, preferring disk copies over cloud.
 * Returns the unique videos and the fight duration (shortest source).
 */
function deduplicateSources(sources: RendererVideo[]): {
  videos: RendererVideo[];
  fightDuration: number;
} {
  const videos = new Map<string, RendererVideo>();
  let duration = Number.MAX_SAFE_INTEGER;

  sources.forEach((rv) => {
    const existing = videos.get(rv.videoName);

    if (!existing) {
      videos.set(rv.videoName, rv);
    } else if (existing.cloud && !rv.cloud) {
      videos.set(rv.videoName, rv);
    }

    duration = Math.min(duration, rv.duration ?? 0);
  });

  return {
    videos: [...videos.values()],
    fightDuration: Math.max(duration, MIN_DURATION),
  };
}

/**
 * Returns the WoW class color hex string for a video's player,
 * falling back to grey for unknown classes.
 */
function getSegmentColor(video: RendererVideo): string {
  const playerClass = getPlayerClass(video);
  return WoWClassColor[playerClass] ?? 'grey';
}

/**
 * Formats seconds into a friendly mm:ss string.
 */
function formatDuration(s: number): string {
  return secToMmSs(Math.round(s));
}

/**
 * A draggable + resizable timeline for arranging video sources.
 *
 * The timeline represents the total fight duration (the shortest source).
 * Each segment is a slice of that fixed total — e.g. a 3 min fight with
 * 3 viewpoints starts as 1 min each. Dragging edges redistributes time
 * between neighbours while keeping the total constant.
 *
 * Features:
 * - Rectangles colored by WoW class, sized proportionally to duration
 * - Drag & drop to reorder viewpoints
 * - Drag left/right edges to resize (min 10s per segment)
 */
export default function SourceTimeline({
  sources,
  onChange,
}: SourceTimelineProps) {
  const { videos: deduplicated, fightDuration } = useMemo(
    () => deduplicateSources(sources),
    [sources],
  );

  // Each viewpoint gets an equal share of the fight duration initially.
  const [segments, setSegments] = useState<TimelineSegment[]>(() => {
    const count = deduplicated.length;
    const perSegment = count > 0 ? fightDuration / count : fightDuration;
    return deduplicated.map((v) => ({
      video: v,
      duration: Math.max(perSegment, MIN_DURATION),
    }));
  });

  // --- Drag-to-reorder state ---
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  // --- Edge-resize state ---
  const resizeRef = useRef<{
    segmentIdx: number;
    edge: 'left' | 'right';
    startX: number;
    startDuration: number;
    neighbourDuration: number;
    totalWidth: number;
    totalDuration: number;
  } | null>(null);

  // The total is always the fight duration (fixed). Segment durations
  // are slices of this total that must sum to fightDuration.

  // Propagate changes up.
  const commitSegments = useCallback(
    (next: TimelineSegment[]) => {
      setSegments(next);
      onChange(next);
    },
    [onChange],
  );

  // ─── Drag & Drop (reorder) ──────────────────────────────────

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setOverIdx(idx);
  };

  const handleDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();

    if (dragIdx === null || dragIdx === dropIdx) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }

    const next = [...segments];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(dropIdx, 0, moved);
    commitSegments(next);
    setDragIdx(null);
    setOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
  };

  // ─── Edge Resize ────────────────────────────────────────────

  const handleEdgeMouseDown = (
    e: React.MouseEvent,
    segmentIdx: number,
    edge: 'left' | 'right',
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const neighbourIdx = edge === 'left' ? segmentIdx - 1 : segmentIdx + 1;

    if (neighbourIdx < 0 || neighbourIdx >= segments.length) return;

    const container = (e.currentTarget as HTMLElement).closest(
      '[data-timeline-container]',
    );

    if (!container) return;

    resizeRef.current = {
      segmentIdx,
      edge,
      startX: e.clientX,
      startDuration: segments[segmentIdx].duration,
      neighbourDuration: segments[neighbourIdx].duration,
      totalWidth: container.getBoundingClientRect().width,
      totalDuration: fightDuration,
    };

    const handleMouseMove = (me: MouseEvent) => {
      if (!resizeRef.current) return;

      const {
        segmentIdx: sIdx,
        edge: sEdge,
        startX,
        startDuration,
        neighbourDuration,
        totalWidth,
        totalDuration: td,
      } = resizeRef.current;

      const dx = me.clientX - startX;
      const durationDelta = (dx / totalWidth) * td;

      let newDuration: number;
      let newNeighbourDuration: number;

      if (sEdge === 'right') {
        // Dragging right edge: grow self, shrink right neighbour
        newDuration = startDuration + durationDelta;
        newNeighbourDuration = neighbourDuration - durationDelta;
      } else {
        // Dragging left edge: shrink self, grow left neighbour
        newDuration = startDuration - durationDelta;
        newNeighbourDuration = neighbourDuration + durationDelta;
      }

      // Enforce minimums.
      if (newDuration < MIN_DURATION) {
        const overflow = MIN_DURATION - newDuration;
        newDuration = MIN_DURATION;
        newNeighbourDuration -= overflow;
      }

      if (newNeighbourDuration < MIN_DURATION) {
        const overflow = MIN_DURATION - newNeighbourDuration;
        newNeighbourDuration = MIN_DURATION;
        newDuration -= overflow;
      }

      // Safety clamp.
      newDuration = Math.max(MIN_DURATION, newDuration);
      newNeighbourDuration = Math.max(MIN_DURATION, newNeighbourDuration);

      const nIdx = sEdge === 'left' ? sIdx - 1 : sIdx + 1;

      setSegments((prev) => {
        const next = [...prev];
        next[sIdx] = { ...next[sIdx], duration: newDuration };
        next[nIdx] = { ...next[nIdx], duration: newNeighbourDuration };
        return next;
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      // Commit final state.
      setSegments((prev) => {
        onChange(prev);
        return prev;
      });

      resizeRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Source Timeline</span>
        <span>Fight Duration: {formatDuration(fightDuration)}</span>
      </div>

      {/* Timeline bar */}
      <div
        data-timeline-container
        className="flex w-full h-20 rounded-md overflow-hidden border border-border"
      >
        {segments.map((seg, idx) => {
          const widthPercent = (seg.duration / fightDuration) * 100;
          const isDragging = dragIdx === idx;
          const isOver = overIdx === idx;
          const bgColor = getSegmentColor(seg.video);

          return (
            <div
              key={seg.video.videoName}
              className={[
                'relative flex items-center justify-center select-none',
                'transition-opacity',
                isDragging ? 'opacity-40' : 'opacity-100',
                isOver ? 'ring-2 ring-white ring-inset' : '',
              ].join(' ')}
              style={{
                width: `${widthPercent}%`,
                minWidth: 40,
                backgroundColor: bgColor,
              }}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
            >
              {/* Left resize handle (not on first segment) */}
              {idx > 0 && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/30 z-10"
                  onMouseDown={(e) => handleEdgeMouseDown(e, idx, 'left')}
                />
              )}

              {/* Content */}
              <div className="flex flex-col items-center gap-0.5 pointer-events-none px-2 overflow-hidden">
                <GripVertical size={14} className="text-white/60" />
                <span className="text-[11px] text-white font-medium truncate max-w-full">
                  {getPlayerName(seg.video) || seg.video.videoName}
                </span>
                <span className="text-[10px] text-white/70">
                  {formatDuration(seg.duration)}
                </span>
              </div>

              {/* Right resize handle (not on last segment) */}
              {idx < segments.length - 1 && (
                <div
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/30 z-10"
                  onMouseDown={(e) => handleEdgeMouseDown(e, idx, 'right')}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Per-segment detail list */}
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        {segments.map((seg) => (
          <div key={seg.video.videoName} className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: getSegmentColor(seg.video) }}
            />
            <span className="font-medium text-foreground">
              {getPlayerName(seg.video) || seg.video.videoName}
            </span>
            <span className="ml-auto">{formatDuration(seg.duration)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
