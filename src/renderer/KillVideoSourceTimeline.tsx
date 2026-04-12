import { KillVideoMusicTrack, KillVideoSegment } from 'main/types';
import {
  getPlayerClass,
  getPlayerName,
  getPlayerSpecID,
  getWoWClassColor,
  secToMmSs,
} from './rendererutils';
import React, {
  Dispatch,
  ReactNode,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { specImages } from './images';
import { Copy, Film, Music, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import { getLocalePhrase } from 'localisation/translations';
import { Language, Phrase } from 'localisation/phrases';

const ipc = window.electron.ipcRenderer;

/**
 * Renders a waveform as an SVG path.
 */
const WaveformSVG = ({ peaks }: { peaks: number[] }) => {
  if (peaks.length === 0) return null;

  const w = peaks.length;
  const h = 40;
  const mid = h / 2;

  // Build a mirrored waveform path.
  let d = `M0,${mid}`;
  peaks.forEach((p, i) => {
    const x = (i / (w - 1)) * 100;
    const amp = p * mid * 0.9;
    d += ` L${x},${mid - amp}`;
  });

  // Go back along the bottom (mirror).
  for (let i = peaks.length - 1; i >= 0; i--) {
    const x = (i / (w - 1)) * 100;
    const amp = peaks[i] * mid * 0.9;
    d += ` L${x},${mid + amp}`;
  }

  d += ' Z';

  return (
    <svg
      viewBox={`0 0 100 ${h}`}
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full pointer-events-none"
    >
      <path d={d} fill="rgba(255,255,255,0.2)" />
    </svg>
  );
};

interface SourceTimelineProps {
  segments: KillVideoSegment[];
  setSegments: Dispatch<SetStateAction<KillVideoSegment[]>>;
  musicTracks: KillVideoMusicTrack[];
  setMusicTracks: Dispatch<SetStateAction<KillVideoMusicTrack[]>>;
  singleAudio: boolean;
  audioTrackPlayer: string;
  children?: ReactNode;
  language: Language;
}

/**
 * A draggable + resizable timeline for arranging video sources.
 *
 * The timeline represents the total fight duration (the shortest source).
 * Each segment is a slice of that fixed total — e.g. a 3 min fight with
 * 3 viewpoints starts as 1 min each. Dragging edges redistributes time
 * between neighbours while keeping the total constant.
 *
 * This was written in part by Copilot. Take it with a grain of salt.
 *
 * Features:
 * - Rectangles colored by WoW class, sized proportionally to duration
 * - Drag & drop to reorder viewpoints
 * - Drag left/right edges to resize (min 10s per segment)
 */
const KillVideoSourceTimeline = (props: SourceTimelineProps) => {
  const {
    segments,
    setSegments,
    musicTracks,
    setMusicTracks,
    singleAudio,
    audioTrackPlayer,
    language,
  } = props;

  const videoDuration = segments.reduce(
    (sum, seg) => sum + (seg.stop - seg.start),
    0,
  );

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [overBin, setOverBin] = useState(false);
  const [playheadTime, setPlayheadTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const seekingRef = useRef(false);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const musicAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const timelineWrapperRef = useRef<HTMLDivElement>(null);

  const canRemove = segments.length > 2;

  const activeSegment = useMemo(() => {
    for (const seg of segments) {
      if (playheadTime >= seg.start && playheadTime < seg.stop) return seg;
    }
    return segments[segments.length - 1];
  }, [segments, playheadTime]);

  const videoSrc = useMemo(() => {
    const src = activeSegment.video.videoSource;
    return src.startsWith('https://') ? src : `vod://wcr/${src}`;
  }, [activeSegment]);

  // Seek the preview video when the playhead is moved manually.
  useEffect(() => {
    const el = videoPreviewRef.current;
    if (el && el.readyState >= 2 && seekingRef.current) {
      el.currentTime = playheadTime;
      seekingRef.current = false;
    }
  }, [playheadTime]);

  // Seek the preview video when the source changes after load.
  const handleVideoLoaded = useCallback(() => {
    const el = videoPreviewRef.current;
    if (el) {
      el.currentTime = playheadTime;
      if (playing) el.play().catch(() => {});
    }
  }, [playheadTime, playing]);

  // Sync playhead from video playback.
  const handleTimeUpdate = useCallback(() => {
    const el = videoPreviewRef.current;
    if (el && !seekingRef.current) {
      setPlayheadTime(el.currentTime);
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    const el = videoPreviewRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  }, []);

  // Fetch waveform data for music tracks that don't have it yet.
  useEffect(() => {
    const pendingTracks = musicTracks.filter((t) => !t.waveform);
    if (pendingTracks.length === 0) return;

    let cancelled = false;

    const fetchWaveforms = async () => {
      for (const track of pendingTracks) {
        if (cancelled) return;
        const peaks = await ipc.getWaveform(track.path, 200);

        if (cancelled || peaks.length === 0) continue;

        setMusicTracks((prev) =>
          prev.map((t) => (t.id === track.id ? { ...t, waveform: peaks } : t)),
        );
      }
    };

    fetchWaveforms();

    return () => {
      cancelled = true;
    };
  }, [musicTracks, setMusicTracks]);

  // Sync music audio playback with the video preview and playhead.
  useEffect(() => {
    const hasMusicTracks = musicTracks.length > 0;
    if (!hasMusicTracks) return;

    const refs = musicAudioRefs.current;

    // Find which music track the playhead is currently in.
    const activeTrack = musicTracks.find(
      (t) => playheadTime >= t.start && playheadTime < t.stop,
    );

    refs.forEach((audioEl, trackId) => {
      if (activeTrack && trackId === activeTrack.id) {
        // This track is active — set the time offset within the track.
        const offsetInTrack = playheadTime - activeTrack.start;

        // Use the offset directly (1:1 mapping). The backend trims
        // each track with atrim so the audio file plays from the start
        // for the allocated duration.
        const clampedOffset =
          audioEl.duration > 0
            ? Math.min(offsetInTrack, audioEl.duration)
            : offsetInTrack;

        if (
          Math.abs(audioEl.currentTime - clampedOffset) > 0.5 ||
          seekingRef.current
        ) {
          audioEl.currentTime = clampedOffset;
        }

        audioEl.muted = muted;

        if (playing && audioEl.paused) {
          audioEl.play().catch(() => {});
        } else if (!playing && !audioEl.paused) {
          audioEl.pause();
        }
      } else {
        // Not the active track — pause it.
        if (!audioEl.paused) audioEl.pause();
      }
    });
  }, [playheadTime, playing, muted, musicTracks]);

  // Manage audio elements for music tracks.
  const setMusicAudioRef = useCallback(
    (trackId: string, el: HTMLAudioElement | null) => {
      if (el) {
        musicAudioRefs.current.set(trackId, el);
      } else {
        musicAudioRefs.current.delete(trackId);
      }
    },
    [],
  );

  // True when cursor is over a valid insertion gap (not a no-op position).
  const showDropIndicator =
    dragIdx !== null &&
    overIdx !== null &&
    overIdx !== dragIdx &&
    overIdx !== dragIdx + 1;

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
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    setOverIdx(e.clientX < midX ? idx : idx + 1);
  };

  const normalizeSegments = (segs: KillVideoSegment[]) => {
    let cursor = 0;

    return segs.map((seg) => {
      const duration = seg.stop - seg.start;
      const next = { ...seg, start: cursor, stop: cursor + duration };
      cursor += duration;
      return next;
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();

    if (
      dragIdx === null ||
      overIdx === null ||
      overIdx === dragIdx ||
      overIdx === dragIdx + 1
    ) {
      setDragIdx(null);
      setOverIdx(null);
      return;
    }

    const next = [...segments];
    const [moved] = next.splice(dragIdx, 1);
    const insertIdx = overIdx > dragIdx ? overIdx - 1 : overIdx;
    next.splice(insertIdx, 0, moved);

    setSegments(normalizeSegments(next));

    setDragIdx(null);
    setOverIdx(null);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
    setOverBin(false);
  };

  const handleBinDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragIdx !== null && canRemove) {
      removeSegment(dragIdx);
    }
    setDragIdx(null);
    setOverIdx(null);
    setOverBin(false);
  };

  const removeSegment = (idx: number) => {
    if (segments.length <= 2) return;

    const removedDuration = segments[idx].stop - segments[idx].start;
    const remaining = segments.filter((_, i) => i !== idx);
    const extraEach = removedDuration / remaining.length;

    let cursor = 0;
    const updated = remaining.map((seg) => {
      const newDuration = seg.stop - seg.start + extraEach;
      const newSeg = { ...seg, start: cursor, stop: cursor + newDuration };
      cursor += newDuration;
      return newSeg;
    });

    setSegments(updated);
  };

  const duplicateSegment = (idx: number) => {
    const seg = segments[idx];
    const originalDuration = seg.stop - seg.start;
    const halfDuration = originalDuration / 2;

    const duplicate: KillVideoSegment = {
      id: crypto.randomUUID(),
      video: seg.video,
      start: 0,
      stop: halfDuration,
    };

    const next = [...segments];
    next[idx] = { ...seg, stop: seg.start + halfDuration };
    next.splice(idx + 1, 0, duplicate);

    setSegments(normalizeSegments(next));
  };

  const supportedAudioExtensions = ['.mp3', '.wav', '.ogg', '.flac', '.m4a'];

  const [musicDragOver, setMusicDragOver] = useState(false);
  const [musicDragIdx, setMusicDragIdx] = useState<number | null>(null);
  const [musicOverIdx, setMusicOverIdx] = useState<number | null>(null);
  const [musicOverBin, setMusicOverBin] = useState(false);
  const musicTimelineRef = useRef<HTMLDivElement>(null);

  const normalizeMusicTracks = (tracks: KillVideoMusicTrack[]) => {
    if (tracks.length === 0) return tracks;
    const totalDuration = videoDuration;
    const totalTrackDuration = tracks.reduce(
      (sum, t) => sum + (t.stop - t.start),
      0,
    );
    const scale = totalDuration / totalTrackDuration;
    let cursor = 0;
    return tracks.map((t) => {
      const duration = (t.stop - t.start) * scale;
      const next = { ...t, start: cursor, stop: cursor + duration };
      cursor += duration;
      return next;
    });
  };

  const getAudioFileDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        resolve(audio.duration || 60);
        URL.revokeObjectURL(audio.src);
      };
      audio.onerror = () => {
        resolve(60); // Fallback to 60s if we can't read duration.
        URL.revokeObjectURL(audio.src);
      };
      audio.src = URL.createObjectURL(file);
    });
  };

  const handleMusicDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setMusicDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const audioFiles = files.filter((f) =>
      supportedAudioExtensions.some((ext) =>
        f.name.toLowerCase().endsWith(ext),
      ),
    );

    if (audioFiles.length === 0) return;

    const newTracks: KillVideoMusicTrack[] = [];

    for (const f of audioFiles) {
      const duration = await getAudioFileDuration(f);
      newTracks.push({
        id: crypto.randomUUID(),
        name: f.name,
        path: ipc.getPathForFile(f),
        start: 0,
        stop: duration,
      });
    }

    setMusicTracks((prev) => normalizeMusicTracks([...prev, ...newTracks]));
  };

  const removeMusicTrack = (idx: number) => {
    setMusicTracks((prev) => {
      if (prev.length <= 1) return [];
      const next = prev.filter((_, i) => i !== idx);
      return normalizeMusicTracks(next);
    });
  };

  const musicShowDropIndicator =
    musicDragIdx !== null &&
    musicOverIdx !== null &&
    musicOverIdx !== musicDragIdx &&
    musicOverIdx !== musicDragIdx + 1;

  const handleMusicDragStart = (idx: number) => {
    setMusicDragIdx(idx);
  };

  const handleMusicDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    setMusicOverIdx(e.clientX < midX ? idx : idx + 1);
  };

  const handleMusicDrop2 = (e: React.DragEvent) => {
    e.preventDefault();

    if (
      musicDragIdx === null ||
      musicOverIdx === null ||
      musicOverIdx === musicDragIdx ||
      musicOverIdx === musicDragIdx + 1
    ) {
      setMusicDragIdx(null);
      setMusicOverIdx(null);
      return;
    }

    const next = [...musicTracks];
    const [moved] = next.splice(musicDragIdx, 1);
    const insertIdx =
      musicOverIdx > musicDragIdx ? musicOverIdx - 1 : musicOverIdx;
    next.splice(insertIdx, 0, moved);

    setMusicTracks(normalizeMusicTracks(next));
    setMusicDragIdx(null);
    setMusicOverIdx(null);
  };

  const handleMusicDragEnd = () => {
    setMusicDragIdx(null);
    setMusicOverIdx(null);
    setMusicOverBin(false);
  };

  const handleMusicBinDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (musicDragIdx !== null) {
      removeMusicTrack(musicDragIdx);
    }
    setMusicDragIdx(null);
    setMusicOverIdx(null);
    setMusicOverBin(false);
  };

  const musicResizeRef = useRef<{
    trackIdx: number;
    edge: 'left' | 'right';
    startX: number;
    startDuration: number;
    neighbourDuration: number;
    totalWidth: number;
    totalDuration: number;
  } | null>(null);

  const handleMusicEdgeMouseDown = (
    e: React.MouseEvent,
    trackIdx: number,
    edge: 'left' | 'right',
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const neighbourIdx = edge === 'left' ? trackIdx - 1 : trackIdx + 1;
    if (neighbourIdx < 0 || neighbourIdx >= musicTracks.length) return;

    const container = musicTimelineRef.current;
    if (!container) return;

    musicResizeRef.current = {
      trackIdx,
      edge,
      startX: e.clientX,
      startDuration: musicTracks[trackIdx].stop - musicTracks[trackIdx].start,
      neighbourDuration:
        musicTracks[neighbourIdx].stop - musicTracks[neighbourIdx].start,
      totalWidth: container.getBoundingClientRect().width,
      totalDuration: videoDuration,
    };

    const handleMouseMove = (me: MouseEvent) => {
      if (!musicResizeRef.current) return;

      const {
        trackIdx: tIdx,
        edge: tEdge,
        startX,
        startDuration,
        neighbourDuration,
        totalWidth,
        totalDuration: td,
      } = musicResizeRef.current;

      const dx = me.clientX - startX;
      const durationDelta = (dx / totalWidth) * td;

      let newDuration: number;
      let newNeighbourDuration: number;

      if (tEdge === 'right') {
        newDuration = startDuration + durationDelta;
        newNeighbourDuration = neighbourDuration - durationDelta;
      } else {
        newDuration = startDuration - durationDelta;
        newNeighbourDuration = neighbourDuration + durationDelta;
      }

      const minDuration = 5;
      const combined = startDuration + neighbourDuration;
      newDuration = Math.max(
        minDuration,
        Math.min(newDuration, combined - minDuration),
      );
      newNeighbourDuration = combined - newDuration;

      setMusicTracks((prev) => {
        const next = [...prev];
        if (tEdge === 'right') {
          const nIdx = tIdx + 1;
          const boundary = prev[tIdx].start + newDuration;
          next[tIdx] = { ...next[tIdx], stop: boundary };
          next[nIdx] = { ...next[nIdx], start: boundary };
        } else {
          const nIdx = tIdx - 1;
          const boundary = prev[nIdx].start + newNeighbourDuration;
          next[nIdx] = { ...next[nIdx], stop: boundary };
          next[tIdx] = { ...next[tIdx], start: boundary };
        }
        return next;
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      musicResizeRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
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
      startDuration: segments[segmentIdx].stop - segments[segmentIdx].start,
      neighbourDuration:
        segments[neighbourIdx].stop - segments[neighbourIdx].start,
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

      const minSegmentDuration = 15;
      const combined = startDuration + neighbourDuration;

      newDuration = Math.max(
        minSegmentDuration,
        Math.min(newDuration, combined - minSegmentDuration),
      );
      newNeighbourDuration = combined - newDuration;

      setSegments((prev) => {
        const next = [...prev];

        if (sEdge === 'right') {
          const nIdx = sIdx + 1;
          const boundary = prev[sIdx].start + newDuration;
          next[sIdx] = { ...next[sIdx], stop: boundary };
          next[nIdx] = { ...next[nIdx], start: boundary };
        } else {
          const nIdx = sIdx - 1;
          const boundary = prev[nIdx].start + newNeighbourDuration;
          next[nIdx] = { ...next[nIdx], stop: boundary };
          next[sIdx] = { ...next[sIdx], start: boundary };
        }

        return next;
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      resizeRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const updatePlayheadFromMouse = useCallback(
    (clientX: number) => {
      const wrapper = timelineWrapperRef.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      setPlayheadTime(pct * videoDuration);
    },
    [videoDuration],
  );

  const handlePlayheadMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      seekingRef.current = true;
      updatePlayheadFromMouse(e.clientX);

      const handleMove = (me: MouseEvent) => {
        seekingRef.current = true;
        updatePlayheadFromMouse(me.clientX);
      };

      const handleUp = () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    },
    [updatePlayheadFromMouse],
  );

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

  const playheadPct =
    videoDuration > 0 ? (playheadTime / videoDuration) * 100 : 0;

  return (
    <div className="flex flex-col w-full">
      {/* Video preview + settings side by side */}
      <div className="flex flex-row gap-3 items-start mb-3">
        <div className="relative flex-1 min-w-0 aspect-video h-[350px] bg-black rounded-lg overflow-hidden shadow-lg group">
          <video
            ref={videoPreviewRef}
            key={activeSegment.video.videoName}
            src={videoSrc}
            className="w-full h-full object-contain cursor-pointer"
            onLoadedData={handleVideoLoaded}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setPlaying(false)}
            onClick={togglePlayPause}
            muted={muted}
          />
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="absolute bottom-2 right-2 p-1.5 rounded-md bg-black/60 text-white/80 hover:text-white hover:bg-black/80 transition-opacity"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
        {props.children && (
          <div className="flex-shrink-0 pl-3 border-l border-card self-stretch flex items-start">
            {props.children}
          </div>
        )}
      </div>

      {/* Hidden audio elements for music track playback */}
      {musicTracks.map((track) => (
        <audio
          key={track.id}
          ref={(el) => setMusicAudioRef(track.id, el)}
          src={`vod://wcr/${track.path}`}
          preload="auto"
          className="hidden"
        />
      ))}

      {/* Timeline */}
      <div className="flex rounded-lg border border-card overflow-hidden bg-background/50">
        {/* Track labels */}
        <div className="flex flex-col shrink-0 w-20 bg-muted/30 border-r border-card">
          <div className="h-6" />
          <div className="h-14 flex items-center gap-1.5 px-2.5 border-t border-card">
            <Film size={12} className="shrink-0 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground font-medium">
              Video
            </span>
          </div>
          <div className="h-7 flex items-center gap-1.5 px-2.5 border-t border-card">
            <Volume2 size={12} className="shrink-0 text-emerald-500/70" />
            <span className="text-[11px] text-muted-foreground font-medium">
              Audio
            </span>
          </div>
          {musicTracks.length > 0 && (
            <div className="h-10 flex items-center gap-1.5 px-2.5 border-t border-card">
              <Music size={12} className="shrink-0 text-purple-400/70" />
              <span className="text-[11px] text-muted-foreground font-medium">
                Music
              </span>
            </div>
          )}
        </div>

        {/* Timeline content */}
        <div
          className="flex-1 flex flex-col min-w-0 relative"
          ref={timelineWrapperRef}
        >
          {/* Ruler */}
          <div
            className="relative h-6 cursor-pointer select-none bg-muted/10"
            onMouseDown={handlePlayheadMouseDown}
          >
            <div className="absolute top-0 left-0 flex flex-col items-start">
              <div className="w-px h-2 bg-border" />
              <span className="text-[9px] text-muted-foreground leading-none mt-0.5 ml-0.5">
                0:00
              </span>
            </div>
            {minorTicks.map((t) => {
              const pct = (t / videoDuration) * 100;
              return (
                <div
                  key={`minor-${t}`}
                  className="absolute top-0 w-px h-1.5 bg-border/50"
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
                  <div className="w-px h-2 bg-border" />
                  <span className="text-[9px] text-muted-foreground leading-none mt-0.5">
                    {secToMmSs(t)}
                  </span>
                </div>
              );
            })}
            <div className="absolute top-0 right-0 flex flex-col items-end">
              <div className="w-px h-2 bg-border" />
              <span className="text-[9px] text-muted-foreground leading-none mt-0.5 mr-0.5">
                {secToMmSs(videoDuration)}
              </span>
            </div>
          </div>

          {/* Video segments row */}
          <div
            data-timeline-container
            className="flex h-14 overflow-hidden border-t border-card"
          >
            {showDropIndicator && overIdx === 0 && (
              <div className="flex-shrink-0 w-0.5 h-full bg-white rounded-full" />
            )}
            {segments.map((seg, idx) => {
              const widthPercent =
                ((seg.stop - seg.start) / videoDuration) * 100;
              const isDragging = dragIdx === idx;

              const playerClass = getPlayerClass(seg.video);
              const bgColor =
                playerClass === 'UNKNOWN'
                  ? '#4b5563'
                  : getWoWClassColor(playerClass);

              return (
                <React.Fragment key={seg.id}>
                  <div
                    className={[
                      'relative flex items-center justify-center select-none cursor-grab group/seg',
                      'transition-opacity',
                      isDragging ? 'opacity-40' : 'opacity-100',
                    ].join(' ')}
                    style={{
                      width: `${widthPercent}%`,
                      backgroundColor: bgColor,
                    }}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={handleDrop}
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
                        border: '1px solid rgba(0,0,0,0.4)',
                        objectFit: 'cover',
                      }}
                    />

                    <div className="absolute top-1 right-1 grid grid-cols-3 gap-[2px] pointer-events-none opacity-40">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-[3px] h-[3px] rounded-full bg-black/50"
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      title={getLocalePhrase(
                        language,
                        Phrase.KillVideoDuplicate,
                      )}
                      className="absolute bottom-1 right-1 p-0.5 rounded bg-black/40 text-white/70 hover:text-white hover:bg-black/60 opacity-0 group-hover/seg:opacity-100 transition-opacity z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateSegment(idx);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <Copy size={12} />
                    </button>

                    <div className="text-black/90 flex flex-col items-center pointer-events-none px-2 pt-2 overflow-hidden">
                      <span className="text-[11px] font-bold truncate max-w-full drop-shadow-[0_1px_0_rgba(255,255,255,0.2)]">
                        {getPlayerName(seg.video) || seg.video.videoName}
                      </span>
                      <span className="text-[10px]">
                        {secToMmSs(seg.stop - seg.start)}
                      </span>
                    </div>
                  </div>

                  {idx < segments.length - 1 && (
                    <div
                      className={[
                        'flex-shrink-0 w-2 h-full z-10 flex flex-col items-center justify-center gap-[2px] cursor-col-resize transition-colors',
                        showDropIndicator && overIdx === idx + 1
                          ? 'bg-white/30'
                          : 'hover:bg-white/10',
                      ].join(' ')}
                      onMouseDown={(e) => handleEdgeMouseDown(e, idx, 'right')}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setOverIdx(idx + 1);
                      }}
                      onDrop={handleDrop}
                    >
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className={[
                            'w-[2px] h-[2px] rounded-full',
                            showDropIndicator && overIdx === idx + 1
                              ? 'bg-white'
                              : 'bg-white/25',
                          ].join(' ')}
                        />
                      ))}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
            {showDropIndicator && overIdx === segments.length && (
              <div className="flex-shrink-0 w-0.5 h-full bg-white rounded-full" />
            )}
          </div>

          {/* Video audio row */}
          <div className="flex h-7 overflow-hidden border-t border-card">
            {singleAudio ? (
              <div className="w-full h-full flex items-center justify-center bg-emerald-800/50 overflow-hidden">
                <span className="text-[10px] text-emerald-200/80 truncate px-2 font-medium">
                  {audioTrackPlayer}
                </span>
              </div>
            ) : (
              segments.map((seg, idx) => {
                const widthPercent =
                  ((seg.stop - seg.start) / videoDuration) * 100;
                return (
                  <div
                    key={`audio-${seg.id}`}
                    className="h-full flex items-center justify-center bg-emerald-800/40 overflow-hidden"
                    style={{
                      width: `${widthPercent}%`,
                      borderRight:
                        idx < segments.length - 1
                          ? '1px solid rgba(255,255,255,0.06)'
                          : 'none',
                    }}
                  >
                    <span className="text-[9px] text-emerald-200/50 truncate px-1">
                      {getPlayerName(seg.video)}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Music tracks row */}
          {musicTracks.length > 0 && (
            <div
              ref={musicTimelineRef}
              data-timeline-container
              className="flex h-10 overflow-hidden border-t border-card"
            >
              {musicShowDropIndicator && musicOverIdx === 0 && (
                <div className="flex-shrink-0 w-0.5 h-full bg-white rounded-full" />
              )}
              {musicTracks.map((track, idx) => {
                const widthPercent =
                  ((track.stop - track.start) / videoDuration) * 100;
                const isDragging = musicDragIdx === idx;

                return (
                  <React.Fragment key={track.id}>
                    <div
                      className={[
                        'relative flex items-center justify-center select-none cursor-grab group/music',
                        'transition-opacity bg-purple-700/50 overflow-hidden',
                        isDragging ? 'opacity-40' : 'opacity-100',
                      ].join(' ')}
                      style={{ width: `${widthPercent}%` }}
                      draggable
                      onDragStart={() => handleMusicDragStart(idx)}
                      onDragOver={(e) => handleMusicDragOver(e, idx)}
                      onDrop={handleMusicDrop2}
                      onDragEnd={handleMusicDragEnd}
                    >
                      {track.waveform && <WaveformSVG peaks={track.waveform} />}
                      <button
                        type="button"
                        className="absolute top-0.5 right-0.5 p-0.5 rounded text-white/40 hover:text-white opacity-0 group-hover/music:opacity-100 transition-opacity z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeMusicTrack(idx);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <X size={10} />
                      </button>
                      <div className="text-white/90 flex flex-col items-center pointer-events-none px-1 overflow-hidden z-[1]">
                        <span className="text-[10px] font-medium truncate max-w-full">
                          {track.name}
                        </span>
                      </div>
                    </div>

                    {idx < musicTracks.length - 1 && (
                      <div
                        className={[
                          'flex-shrink-0 w-1.5 h-full z-10 flex flex-col items-center justify-center gap-[2px] cursor-col-resize transition-colors',
                          musicShowDropIndicator && musicOverIdx === idx + 1
                            ? 'bg-white/30'
                            : 'hover:bg-white/10',
                        ].join(' ')}
                        onMouseDown={(e) =>
                          handleMusicEdgeMouseDown(e, idx, 'right')
                        }
                        onDragOver={(e) => {
                          e.preventDefault();
                          setMusicOverIdx(idx + 1);
                        }}
                        onDrop={handleMusicDrop2}
                      >
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div
                            key={i}
                            className={[
                              'w-[2px] h-[2px] rounded-full',
                              musicShowDropIndicator && musicOverIdx === idx + 1
                                ? 'bg-white'
                                : 'bg-white/25',
                            ].join(' ')}
                          />
                        ))}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
              {musicShowDropIndicator &&
                musicOverIdx === musicTracks.length && (
                  <div className="flex-shrink-0 w-0.5 h-full bg-white rounded-full" />
                )}
            </div>
          )}

          {/* Playhead */}
          <div
            className="absolute top-0 w-0.5 bg-white/90 z-20 pointer-events-auto cursor-ew-resize"
            style={{
              left: `${playheadPct}%`,
              height: '100%',
              transform: 'translateX(-50%)',
            }}
            onMouseDown={handlePlayheadMouseDown}
          >
            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-white" />
          </div>
        </div>
      </div>

      {/* Playhead time display */}
      <div className="flex justify-start ml-20 mt-1">
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {secToMmSs(playheadTime)} / {secToMmSs(videoDuration)}
        </span>
      </div>

      {/* Trash bin — accepts both video segments and music tracks */}
      {(canRemove || musicDragIdx !== null) && (
        <div
          className={[
            'flex items-center justify-center gap-2 w-full h-8 mt-1.5 rounded-md border border-dashed transition-colors',
            overBin || musicOverBin
              ? 'border-red-500 bg-red-500/10 text-red-400'
              : dragIdx !== null || musicDragIdx !== null
                ? 'border-card bg-muted/10 text-muted-foreground'
                : 'border-transparent bg-transparent text-transparent',
          ].join(' ')}
          onDragOver={(e) => {
            e.preventDefault();
            if (dragIdx !== null) setOverBin(true);
            if (musicDragIdx !== null) setMusicOverBin(true);
          }}
          onDragLeave={() => {
            setOverBin(false);
            setMusicOverBin(false);
          }}
          onDrop={(e) => {
            if (dragIdx !== null) handleBinDrop(e);
            else if (musicDragIdx !== null) handleMusicBinDrop(e);
          }}
        >
          <Trash2 size={14} />
          <span className="text-xs">
            {getLocalePhrase(language, Phrase.KillVideoRemove)}
          </span>
        </div>
      )}

      {/* Music drop zone to add tracks */}
      <div className="mt-2 mb-1">
        <div
          className={[
            'flex items-center justify-center w-full h-9 rounded-md border border-dashed transition-colors',
            musicDragOver
              ? 'border-purple-400 bg-purple-500/10 text-purple-300'
              : 'border-border/40 text-muted-foreground/60 hover:border-card hover:text-muted-foreground/80',
          ].join(' ')}
          onDragOver={(e) => {
            e.preventDefault();
            setMusicDragOver(true);
          }}
          onDragLeave={() => setMusicDragOver(false)}
          onDrop={handleMusicDrop}
        >
          <Music size={14} className="mr-2" />
          <span className="text-xs">
            {getLocalePhrase(language, Phrase.KillVideoMusicDropHint)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default KillVideoSourceTimeline;
