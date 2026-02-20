import { KillVideoSegment } from 'main/types';
import {
  getPlayerClass,
  getPlayerName,
  getPlayerSpecID,
  getWoWClassColor,
  secToMmSs,
} from './rendererutils';
import React, {
  Dispatch,
  SetStateAction,
  useMemo,
  useRef,
  useState,
} from 'react';
import { specImages } from './images';

interface SourceTimelineProps {
  segments: KillVideoSegment[];
  setSegments: Dispatch<SetStateAction<KillVideoSegment[]>>;
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
const KillVideoSourceTimeline = (props: SourceTimelineProps) => {
  const { segments, setSegments } = props;

  const videoDuration = segments.reduce(
    (sum, seg) => sum + (seg.stop - seg.start),
    0,
  );

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const resizeRef = useRef<{
    segmentIdx: number;
    edge: 'left' | 'right';
    startX: number;
    startDuration: number;
    neighbourDuration: number;
    totalWidth: number;
    totalDuration: number;
  } | null>(null);

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
    setSegments(next);
    setDragIdx(null);
    setOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
  };

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
      totalDuration: videoDuration,
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
        return prev;
      });

      resizeRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Build tick marks for the timeline ruler.
  const { majorTicks, minorTicks } = useMemo(() => {
    const major: number[] = [];
    const minor: number[] = [];

    // Pick a sensible major interval based on fight length.
    let majorInterval = 30;
    if (videoDuration > 600) majorInterval = 120;
    else if (videoDuration > 300) majorInterval = 60;
    else if (videoDuration > 120) majorInterval = 30;
    else majorInterval = 15;

    const minorInterval = majorInterval / 2;

    for (let t = minorInterval; t < videoDuration; t += minorInterval) {
      // Check if this is a major tick (within a small epsilon).
      if (Math.abs(t % majorInterval) < 0.01) {
        major.push(t);
      } else {
        minor.push(t);
      }
    }

    return { majorTicks: major, minorTicks: minor };
  }, [videoDuration]);

  return (
    <div className="flex flex-col gap-0 w-full">
      <div data-timeline-container className="flex w-full h-20 overflow-hidden">
        {segments.map((seg, idx) => {
          const widthPercent = ((seg.stop - seg.start) / videoDuration) * 100;
          const isDragging = dragIdx === idx;
          const isOver = overIdx === idx;

          const playerClass = getPlayerClass(seg.video);
          const bgColor =
            playerClass === 'UNKNOWN' ? 'gray' : getWoWClassColor(playerClass);

          return (
            <React.Fragment key={seg.video.videoName}>
              <div
                className={[
                  'relative flex items-center justify-center select-none',
                  'transition-opacity rounded-md',
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

                <div className="absolute top-1 right-1 grid grid-cols-3 gap-[2px] pointer-events-none">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-[3px] h-[3px] rounded-full bg-black/40"
                    />
                  ))}
                </div>

                <div className="text-[10px] text-black rounded-sm flex flex-col items-center pointer-events-none px-2 pt-2 overflow-hidden">
                  <span className="font-bold truncate max-w-full">
                    {getPlayerName(seg.video) || seg.video.videoName}
                  </span>
                  <span>{secToMmSs(seg.stop - seg.start)}</span>
                </div>
              </div>

              {idx < segments.length - 1 && (
                <div
                  className={
                    'flex-shrink-0 w-3 h-full z-10 flex flex-col items-center justify-center gap-[3px] cursor-col-resize transition-colors rounded-md'
                  }
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
                      className={'w-[3px] h-[3px] rounded-full bg-white/30'}
                    />
                  ))}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="relative w-full h-6 mt-2">
        <div className="absolute top-0 left-0 right-0 h-px bg-card" />
        <div className="absolute top-0 left-0 flex flex-col items-start">
          <div className="w-px h-2 bg-card" />
          <span className="text-[9px] text-card-foreground leading-none mt-0.5">
            0:00
          </span>
        </div>

        {minorTicks.map((t) => {
          const pct = (t / videoDuration) * 100;
          return (
            <div
              key={`minor-${t}`}
              className="absolute top-0 w-px h-1 bg-card"
              style={{ left: `${pct}%` }}
            />
          );
        })}

        {majorTicks.map((t) => {
          const pct = (t / videoDuration) * 100;
          return (
            <div
              key={t}
              className="absolute top-0 flex flex-col items-center"
              style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
            >
              <div className="w-px h-2 bg-card" />
              <span className="text-[9px] text-card-foreground leading-none mt-0.5">
                {secToMmSs(t)}
              </span>
            </div>
          );
        })}

        <div className="absolute top-0 right-0 flex flex-col items-end">
          <div className="w-px h-2 bg-card" />
          <span className="text-[9px] text-card-foreground leading-none mt-0.5">
            {secToMmSs(videoDuration)}
          </span>
        </div>
      </div>
    </div>
  );
  return <></>;
};

export default KillVideoSourceTimeline;
