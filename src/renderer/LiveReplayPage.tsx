import { ActivityStatus, VideoPlayerSettings } from 'main/types';
import { useEffect, useRef, useState } from 'react';
import { Slider } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeDownIcon from '@mui/icons-material/VolumeDown';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeMuteIcon from '@mui/icons-material/VolumeMute';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import screenfull from 'screenfull';
import { Button } from './components/Button/Button';
import { Radio } from 'lucide-react';
import Separator from './components/Separator/Separator';
import { secToMmSs } from './rendererutils';
import Spinner from './components/Spinner/Spinner';
import { cn } from './components/utils';

const ipc = window.electron.ipcRenderer;
// >1x makes no sense for a live stream — you'd overtake the recording.
const playbackRates = [0.25, 0.5, 1];

/**
 * How many seconds before the true live edge we target when seeking to live.
 * Gives the browser room to buffer ahead without immediately stalling at the
 * tip of the growing MKV file.
 */
const LIVE_EDGE_LATENCY = 5;

/**
 * Within this many seconds of the live edge, the player is considered "at
 * live" for UI purposes — shows the LIVE indicator and disables the Live
 * button.  Set higher than LIVE_EDGE_LATENCY so the user is shown as live
 * right after jumpToLive() completes.
 */
const LIVE_THRESHOLD = 8;

// Mirrors VideoPlayer.tsx's sliderBaseSx exactly.
const sliderBaseSx = {
  '& .MuiSlider-thumb': {
    color: 'white',
    width: '10px',
    height: '10px',
    '&:hover': { color: '#bb4220', boxShadow: 'none' },
  },
  '& .MuiSlider-track': { color: '#bb4220', height: '4px' },
  '& .MuiSlider-rail': { color: '#bb4220', height: '4px' },
};

type IProps = {
  activityStatus: ActivityStatus | null;
};

/**
 * A full-page view that streams the current in-progress MKV recording via the
 * live:// protocol, with no remuxing.  This is the page counterpart of
 * LiveReplayDialog — the same player logic but rendered inline inside Layout
 * rather than inside a Dialog.
 *
 * Key difference from the dialog: on mount and when the user clicks "Live",
 * the player seeks to the actual live edge (elapsed − LIVE_EDGE_LATENCY)
 * rather than the buffered.end() position, which is only a few seconds ahead
 * of the play-head when starting from byte 0.
 *
 * The progress bar uses a "behind live" model: the right edge is always the
 * live edge (0), and the thumb shows a negative offset (−X:XX) when the
 * user has scrubbed back.
 */
const LiveReplayPage = ({ activityStatus }: IProps) => {
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  // liveMax tracks the furthest video timestamp that has been buffered.
  // Updated by both the 1-second elapsed ticker and the 100ms progress sync.
  const [liveMax, setLiveMax] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [spinner, setSpinner] = useState(true);

  // Read shared volume/mute state from the main process the same way
  // VideoPlayer.tsx does, so both players behave consistently.
  const savedSettings = ipc.sendSync(
    'videoPlayerSettings',
    ['get'],
  ) as VideoPlayerSettings;

  const [volume, setVolume] = useState(savedSettings.volume);
  const [muted, setMuted] = useState(savedSettings.muted);

  const videoRef = useRef<HTMLVideoElement>(null);
  const isDragging = useRef(false);
  const progressSyncRef = useRef<number | null>(null);
  // Guard: only auto-seek to live once per URL load.
  const hasJumpedToLive = useRef(false);

  // ---- Derived live-edge state ----

  // Best estimate of the live edge in video time.
  //  • liveMax  = video.buffered.end() — the actual video timestamp of the
  //               furthest buffered position (accurate but lags by a few s).
  //  • elapsed  = wall-clock seconds since activityStatus.start — a reliable
  //               proxy because MKV timestamps start at 0 when OBS starts.
  // Taking the max of the two gives the most up-to-date estimate.
  const liveEdge = Math.max(liveMax, elapsed);

  // Seconds behind the live edge.
  const behind = Math.max(0, liveEdge - currentTime);

  // Within LIVE_THRESHOLD of live → show "● LIVE" indicator.
  // Threshold is intentionally larger than LIVE_EDGE_LATENCY so the user sees
  // "LIVE" immediately after jumpToLive() puts them ~5 s behind the tip.
  const isAtLive = behind < LIVE_THRESHOLD;

  // ---- Side effects ----

  // Fetch the live URL on mount; clean up on unmount.
  useEffect(() => {
    fetchLiveUrl();

    return () => {
      stopProgressSync();

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
        videoRef.current.load();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wall-clock elapsed timer.  Also refreshes liveMax every second so the
  // scrubber extends while paused.
  useEffect(() => {
    if (!activityStatus) return;

    const start = activityStatus.start;

    const tick = () => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
      const video = videoRef.current;
      if (video && video.buffered.length > 0) {
        setLiveMax(video.buffered.end(video.buffered.length - 1));
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activityStatus]);

  // Sync volume, muted and playbackRate to the video element imperatively.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
    video.playbackRate = playbackRate;
  }, [volume, muted, playbackRate]);

  // ---- Progress sync ----

  const startProgressSync = () => {
    if (progressSyncRef.current) return;
    progressSyncRef.current = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || isDragging.current || video.seeking) return;
      setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        setLiveMax(video.buffered.end(video.buffered.length - 1));
      }
    }, 100);
  };

  const stopProgressSync = () => {
    if (!progressSyncRef.current) return;
    window.clearInterval(progressSyncRef.current);
    progressSyncRef.current = null;
  };

  // ---- Fetch live URL ----

  const fetchLiveUrl = async () => {
    setLoading(true);
    setError(null);
    setLiveUrl(null);
    setSpinner(true);
    hasJumpedToLive.current = false;

    try {
      const filePath = await ipc.getLiveRecordingPath();

      if (!filePath) {
        setError('No recording in progress.');
        return;
      }

      setLiveUrl(`live://wcr/${encodeURIComponent(filePath)}`);
    } catch (e) {
      console.error('[LiveReplayPage] Failed to get recording path:', e);
      setError('Failed to retrieve the recording path.');
    } finally {
      setLoading(false);
    }
  };

  // ---- Video element event handlers ----

  const onPlay = () => {
    setPlaying(true);
    startProgressSync();
  };

  const onPause = () => {
    setPlaying(false);
    stopProgressSync();
  };

  // Re-show the spinner whenever the browser has to wait for more data (e.g.
  // after a seek to a position that hasn't been buffered yet).
  const onWaiting = () => setSpinner(true);

  const onCanPlay = () => {
    setSpinner(false);

    // On first load, automatically seek to the live edge so the user starts
    // near-live rather than at the beginning of the recording.
    if (!hasJumpedToLive.current) {
      hasJumpedToLive.current = true;
      jumpToLive();
    }
  };

  const onVideoError = () => {
    setError(
      'Stream failed. The recording may not have started yet, or the codec may not be supported.',
    );
    setSpinner(false);
  };

  // ---- Playback controls ----

  const togglePlaying = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const toggleMuted = () => setMuted((prev) => !prev);

  /**
   * Seek to the live edge.
   *
   * Uses the wall-clock elapsed time derived directly from activityStatus
   * rather than video.buffered.end().  buffered.end() only reflects what the
   * browser has already downloaded, so on first load it is just a few seconds
   * ahead of position 0 — not the actual live edge.
   *
   * Subtracting LIVE_EDGE_LATENCY gives the browser a small buffer window so
   * playback doesn't immediately stall at the tip of the growing MKV file.
   */
  const jumpToLive = () => {
    const video = videoRef.current;
    if (!video) return;

    // Compute elapsed directly from the source rather than from stale state.
    const currentElapsed = activityStatus
      ? Math.floor((Date.now() - activityStatus.start) / 1000)
      : elapsed;

    const target = Math.max(0, currentElapsed - LIVE_EDGE_LATENCY);
    video.currentTime = target;
    setCurrentTime(target);
    video.play().catch(() => {});
  };

  const handleRateChange = () => {
    const idx = playbackRates.indexOf(playbackRate);
    setPlaybackRate(playbackRates[(idx + 1) % playbackRates.length]);
  };

  const toggleFullscreen = () => {
    const el = document.getElementById('live-player-container');
    if (el) screenfull.toggle(el);
  };

  // ---- Slider handlers (behind-live model) ----
  //
  // The progress slider uses a coordinate system where:
  //   max = 0       → at the live edge
  //   min = -N      → N seconds behind live
  //   value         → currentTime - liveEdge  (always ≤ 0)
  //
  // This mirrors the visual language of live web players: the thumb sits at
  // the right end when live and moves left when the user scrubs back.

  const sliderValue = currentTime - liveEdge; // ≤ 0

  const handleProgressChange = (_event: Event, value: number | number[]) => {
    if (typeof value === 'number') {
      // Convert the relative-to-live offset back to an absolute video time.
      setCurrentTime(Math.max(0, liveEdge + value));
    }
  };

  const handleProgressChangeCommitted = (
    _event: React.SyntheticEvent | Event,
    value: number | number[],
  ) => {
    isDragging.current = false;
    if (typeof value !== 'number') return;

    const video = videoRef.current;
    if (!video) return;

    const target = Math.max(0, liveEdge + value);
    video.currentTime = target;
    setCurrentTime(target);
  };

  const handleVolumeChange = (_event: Event, value: number | number[]) => {
    if (typeof value === 'number') {
      setMuted(false);
      setVolume(value / 100);
    }
  };

  // ---- Icon helpers (mirrors VideoPlayer.tsx) ----

  const getVolumeIcon = () => {
    if (muted)
      return <VolumeOffIcon sx={{ color: 'white', fontSize: '22px' }} />;
    if (volume === 0)
      return <VolumeMuteIcon sx={{ color: 'white', fontSize: '22px' }} />;
    if (volume < 0.5)
      return <VolumeDownIcon sx={{ color: 'white', fontSize: '22px' }} />;
    return <VolumeUpIcon sx={{ color: 'white', fontSize: '22px' }} />;
  };

  // ---- Render ----

  return (
    <div className="w-full h-full bg-background-higher flex flex-col">
      <div
        id="live-player-container"
        className="w-full h-full bg-black flex flex-col"
      >
        {/* Header */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Radio size={13} className="text-red-500 animate-pulse" />
            Live Replay
            <span className="text-foreground/60 font-normal ml-1">
              {secToMmSs(elapsed)} elapsed
            </span>
          </div>
        </div>

        {/* Video area */}
        <div className="relative w-full flex-1" style={{ minHeight: 0 }}>
          {(loading || spinner) && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
              <Spinner size="40px" />
            </div>
          )}

          {error && !loading && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-red-400 px-4 text-center bg-black">
              {error}
            </div>
          )}

          {liveUrl && !error && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              ref={videoRef}
              src={liveUrl}
              className="w-full h-full"
              style={{ backgroundColor: 'black' }}
              autoPlay
              onPlay={onPlay}
              onPause={onPause}
              onWaiting={onWaiting}
              onCanPlay={onCanPlay}
              onError={onVideoError}
              onClick={togglePlaying}
              onDoubleClick={toggleFullscreen}
            />
          )}
        </div>

        {/*
         * Control bar — behind-live progress model.
         *
         * The slider value is 0 at the live edge and decreases (−X:XX) as the
         * user scrubs backwards.  The time indicator to the right of the bar
         * shows "● LIVE" when within LIVE_THRESHOLD of live, or "−X:XX" when
         * further behind.
         */}
        <div className="w-full h-10 flex flex-row justify-center items-center bg-background-dark-gradient-to border border-background-dark-gradient-to px-1 py-2 rounded-br-sm">
          {/* Play / Pause */}
          <Button variant="ghost" size="xs" onClick={togglePlaying}>
            {playing ? (
              <PauseIcon sx={{ color: 'white', fontSize: '22px' }} />
            ) : (
              <PlayArrowIcon sx={{ color: 'white', fontSize: '22px' }} />
            )}
          </Button>

          {/* Volume */}
          <Button variant="ghost" size="xs" onClick={toggleMuted}>
            {getVolumeIcon()}
          </Button>
          <Slider
            sx={{ m: 1, width: '75px', ...sliderBaseSx }}
            value={muted ? 0 : volume * 100}
            onChange={handleVolumeChange}
            valueLabelFormat={Math.round}
            valueLabelDisplay="auto"
            onKeyDown={(e) => e.preventDefault()}
          />

          {/* Progress — 0 = live edge, negative = seconds behind */}
          <Slider
            sx={{ mx: 1, flex: 1, ...sliderBaseSx }}
            min={-Math.max(liveEdge, 1)}
            max={0}
            value={sliderValue}
            step={0.1}
            valueLabelFormat={(v) =>
              v >= -1 ? 'LIVE' : `\u2212${secToMmSs(-Math.round(v))}`
            }
            valueLabelDisplay="auto"
            onChange={handleProgressChange}
            onChangeCommitted={handleProgressChangeCommitted}
            onMouseDown={() => {
              isDragging.current = true;
            }}
            onKeyDown={(e) => e.preventDefault()}
          />

          {/* Behind-live indicator: "● LIVE" or "−X:XX" */}
          <div className="mx-1 flex items-center min-w-[3.5rem] justify-end">
            {isAtLive ? (
              <span className="whitespace-nowrap text-red-500 text-[11px] font-semibold font-mono flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                LIVE
              </span>
            ) : (
              <span className="whitespace-nowrap text-foreground-lighter text-[11px] font-semibold font-mono">
                &minus;{secToMmSs(Math.round(behind))}
              </span>
            )}
          </div>

          <Separator className="mx-2" orientation="vertical" />

          {/* Jump to live — active (red) when behind, muted when already live */}
          <Button
            variant="ghost"
            size="xs"
            onClick={jumpToLive}
            disabled={isAtLive}
            className={cn(
              'whitespace-nowrap text-[11px] font-semibold font-mono',
              isAtLive
                ? 'text-foreground-lighter opacity-50 cursor-default'
                : 'text-red-400 hover:text-red-300',
            )}
          >
            <Radio
              size={12}
              className={cn('mr-1', isAtLive ? '' : 'text-red-500')}
            />
            Live
          </Button>

          <Separator className="mx-2" orientation="vertical" />

          {/* Playback rate */}
          <Button
            variant="ghost"
            size="xs"
            onClick={handleRateChange}
            className="whitespace-nowrap text-foreground-lighter text-[11px] font-semibold font-mono"
          >
            {playbackRate}x
          </Button>

          {/* Fullscreen */}
          <Button variant="ghost" size="xs" onClick={toggleFullscreen}>
            <FullscreenIcon sx={{ color: 'white', fontSize: '22px' }} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LiveReplayPage;
