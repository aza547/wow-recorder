import { RendererVideo } from 'main/types';
import {
  getPlayerClass,
  getPlayerName,
  getPlayerSpecID,
  secToMmSs,
} from './rendererutils';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { WoWClassColor } from 'main/constants';
import { specImages } from './images';

const minDuration = 30;

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
    fightDuration: Math.max(duration, minDuration),
  };
}

/**
 * Returns the WoW class color hex string for a video's player,
 * falling back to grey for unknown classes.
 */
function getSegmentColor(video: RendererVideo): string {
  const playerClass = getPlayerClass(video);
  const hex = WoWClassColor[playerClass] ?? 'grey';
  // Append alpha to make the background less intense while keeping text crisp.
  return hex.startsWith('#') ? `${hex}B3` : hex;
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
      duration: Math.max(perSegment, minDuration),
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
      if (newDuration < minDuration) {
        const overflow = minDuration - newDuration;
        newDuration = minDuration;
        newNeighbourDuration -= overflow;
      }

      if (newNeighbourDuration < minDuration) {
        const overflow = minDuration - newNeighbourDuration;
        newNeighbourDuration = minDuration;
        newDuration -= overflow;
      }

      // Safety clamp.
      newDuration = Math.max(minDuration, newDuration);
      newNeighbourDuration = Math.max(minDuration, newNeighbourDuration);

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

  // Build tick marks for the timeline ruler.
  const { majorTicks, minorTicks } = useMemo(() => {
    const major: number[] = [];
    const minor: number[] = [];

    // Pick a sensible major interval based on fight length.
    let majorInterval = 30;
    if (fightDuration > 600) majorInterval = 120;
    else if (fightDuration > 300) majorInterval = 60;
    else if (fightDuration > 120) majorInterval = 30;
    else majorInterval = 15;

    const minorInterval = majorInterval / 2;

    for (let t = minorInterval; t < fightDuration; t += minorInterval) {
      // Check if this is a major tick (within a small epsilon).
      if (Math.abs(t % majorInterval) < 0.01) {
        major.push(t);
      } else {
        minor.push(t);
      }
    }

    return { majorTicks: major, minorTicks: minor };
  }, [fightDuration]);

  return (
    <div className="flex flex-col gap-0 w-full">
      {/* Timeline bar */}
      <div data-timeline-container className="flex w-full h-20 overflow-hidden">
        {segments.map((seg, idx) => {
          const widthPercent = (seg.duration / fightDuration) * 100;
          const isDragging = dragIdx === idx;
          const isOver = overIdx === idx;
          const bgColor = getSegmentColor(seg.video);

          return (
            <React.Fragment key={seg.video.videoName}>
              <div
                className={[
                  'relative flex items-center justify-center select-none',
                  'transition-opacity border-card border-2 border-r',
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
                {/* Spec icon – top-left corner */}
                <img
                  src={
                    specImages[
                      getPlayerSpecID(seg.video) as keyof typeof specImages
                    ]
                  }
                  alt="spec"
                  className="absolute top-1 left-1 w-4 h-4 rounded-[15%] pointer-events-none"
                  style={{
                    border: '1px solid black',
                    objectFit: 'cover',
                  }}
                />

                {/* Drag indicator – top-right corner */}
                <div className="absolute top-1 right-1 grid grid-cols-3 gap-[2px] pointer-events-none">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-[3px] h-[3px] rounded-full bg-black/40"
                    />
                  ))}
                </div>

                {/* Content */}
                <div className="text-[10px] text-black rounded-sm flex flex-col items-center pointer-events-none px-2 pt-2 overflow-hidden">
                  <span className="font-bold truncate max-w-full">
                    {getPlayerName(seg.video) || seg.video.videoName}
                  </span>
                  <span>{formatDuration(seg.duration)}</span>
                </div>
              </div>

              {/* Resize handle + drop zone between segments */}
              {idx < segments.length - 1 && (
                <div
                  className={[
                    'flex-shrink-0 w-3 h-full z-10 flex flex-col items-center justify-center gap-[3px]',
                    'cursor-col-resize transition-colors',
                    dragIdx !== null && dragIdx !== idx && dragIdx !== idx + 1
                      ? 'bg-blue-500/30 hover:bg-blue-500/60'
                      : 'hover:bg-white/20',
                  ].join(' ')}
                  onMouseDown={(e) => handleEdgeMouseDown(e, idx, 'right')}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setOverIdx(idx);
                  }}
                  onDrop={(e) => handleDrop(e, idx + 1)}
                >
                  {/* Vertical grip dots */}
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={[
                        'w-[3px] h-[3px] rounded-full',
                        dragIdx !== null &&
                        dragIdx !== idx &&
                        dragIdx !== idx + 1
                          ? 'bg-blue-400/80'
                          : 'bg-white/30',
                      ].join(' ')}
                    />
                  ))}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Timeline ruler */}
      <div className="relative w-full h-6 mt-1">
        {/* Tick line across the top */}
        <div className="absolute top-0 left-0 right-0 h-px bg-border" />

        {/* Start tick + label */}
        <div className="absolute top-0 left-0 flex flex-col items-start">
          <div className="w-px h-2 bg-border" />
          <span className="text-[9px] text-muted-foreground/70 leading-none mt-0.5">
            0:00
          </span>
        </div>

        {/* Minor ticks */}
        {minorTicks.map((t) => {
          const pct = (t / fightDuration) * 100;
          return (
            <div
              key={`minor-${t}`}
              className="absolute top-0 w-px h-1 bg-border"
              style={{ left: `${pct}%` }}
            />
          );
        })}

        {/* Major ticks */}
        {majorTicks.map((t) => {
          const pct = (t / fightDuration) * 100;
          return (
            <div
              key={t}
              className="absolute top-0 flex flex-col items-center"
              style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
            >
              <div className="w-px h-2 bg-border" />
              <span className="text-[9px] text-muted-foreground/70 leading-none mt-0.5">
                {formatDuration(t)}
              </span>
            </div>
          );
        })}

        {/* End tick + label */}
        <div className="absolute top-0 right-0 flex flex-col items-end">
          <div className="w-px h-2 bg-border" />
          <span className="text-[9px] text-muted-foreground/70 leading-none mt-0.5">
            {formatDuration(fightDuration)}
          </span>
        </div>
      </div>
    </div>
  );
}
