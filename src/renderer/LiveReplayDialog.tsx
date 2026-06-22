import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './components/Dialog/Dialog';
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

const ipc = window.electron.ipcRenderer;
// >1x makes no sense for a live stream — you'd overtake the recording.
const playbackRates = [0.25, 0.5, 1];

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
  /**
   * Controlled open state — managed by the parent so the dialog's lifecycle
   * is independent of any HoverCard or popover that contains the trigger
   * button.  If the parent unmounts the trigger, the dialog stays open.
   */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityStatus: ActivityStatus;
};

/**
 * A dialog that streams the current in-progress MKV recording via the live://
 * protocol, with no remuxing. The control bar intentionally mirrors
 * VideoPlayer.tsx in visual style (same MUI components, same sizing) so the
 * two can be unified when VideoPlayer is later refactored to accept an
 * arbitrary source URL.
 *
 * The component is intentionally controlled (open / onOpenChange props) rather
 * than self-contained so that the Dialog is mounted at a stable point in the
 * component tree and is not torn down when the HoverCard that contains the
 * trigger button closes.
 */
const LiveReplayDialog = ({ open, onOpenChange, activityStatus }: IProps) => {
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  // liveMax tracks buffered.end() — the true seekable ceiling for a live
  // stream.  It is kept separate from `elapsed` (wall-clock activity
  // duration) because the MKV timestamps and activity-start time are not
  // guaranteed to be perfectly aligned.  Using the buffered end as the
  // slider max means "Live" always puts the thumb at 100 %.
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

  // ---- Side effects ----

  // Fetch the live URL when the dialog opens; clean up resources when it
  // closes.  Using a useEffect here (rather than an onOpenChange callback)
  // means the logic is co-located with the state it touches and runs after
  // the render that sets open=true, which is the correct time to start
  // fetching.
  useEffect(() => {
    if (open) {
      fetchLiveUrl();
    } else {
      stopProgressSync();

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
        videoRef.current.load();
      }

      setLiveUrl(null);
      setPlaying(false);
      setCurrentTime(0);
      setLiveMax(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Wall-clock elapsed timer. Drives the header "X:XX elapsed" label and
  // provides a fallback slider max before any data has been buffered.
  // Also refreshes liveMax every second so the scrubber extends while paused.
  useEffect(() => {
    if (!open) return;

    const tick = () => {
      setElapsed(Math.floor((Date.now() - activityStatus.start) / 1000));
      const video = videoRef.current;
      if (video && video.buffered.length > 0) {
        setLiveMax(video.buffered.end(video.buffered.length - 1));
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [open, activityStatus.start]);

  // Sync volume, muted and playbackRate to the video element. ReactPlayer
  // handles these as props internally; for a raw <video> we must do it
  // explicitly. Runs whenever any of the three values change.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
    video.playbackRate = playbackRate;
  }, [volume, muted, playbackRate]);

  // ---- Progress sync (matches VideoPlayer's startProgressBarSync) ----

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

    try {
      const filePath = await ipc.getLiveRecordingPath();

      if (!filePath) {
        setError('No recording in progress.');
        return;
      }

      setLiveUrl(`live://wcr/${encodeURIComponent(filePath)}`);
    } catch (e) {
      console.error('[LiveReplayDialog] Failed to get recording path:', e);
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

  const onCanPlay = () => setSpinner(false);

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
   * Seek to the furthest received position in the buffer — the live edge.
   * We use video.buffered.end() rather than video.seekable.end() because
   * seekable.end() returns Infinity on a live stream, which throws a
   * non-finite DOMException when assigned to currentTime.
   *
   * play() is called unconditionally so the video resumes if it was paused
   * or had stalled at the buffer boundary waiting for more data.
   */
  const jumpToLive = () => {
    const video = videoRef.current;
    if (!video) return;
    const { buffered } = video;

    if (buffered.length > 0) {
      const liveEdge = buffered.end(buffered.length - 1);

      if (Number.isFinite(liveEdge)) {
        video.currentTime = liveEdge;
        setCurrentTime(liveEdge);
        video.play().catch(() => {});
      }
    }
  };

  const handleRateChange = () => {
    const idx = playbackRates.indexOf(playbackRate);
    setPlaybackRate(playbackRates[(idx + 1) % playbackRates.length]);
  };

  const toggleFullscreen = () => {
    const el = document.getElementById('live-player-container');
    if (el) screenfull.toggle(el);
  };

  // ---- Slider handlers ----

  const handleProgressChange = (_event: Event, value: number | number[]) => {
    if (typeof value === 'number') setCurrentTime(value);
  };

  const handleProgressChangeCommitted = (
    _event: React.SyntheticEvent | Event,
    value: number | number[],
  ) => {
    isDragging.current = false;
    if (typeof value !== 'number') return;

    const video = videoRef.current;
    if (!video) return;

    // Clamp to liveMax (buffered end) so the seek never overshoots what the
    // browser actually has.  Fall back to video.buffered if liveMax is stale.
    const { buffered } = video;
    const cap =
      liveMax > 0
        ? liveMax
        : buffered.length > 0
          ? buffered.end(buffered.length - 1)
          : 0;

    const target = Math.min(value, cap);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
       * onInteractOutside: belt-and-suspenders guard in case Radix ever
       * fires a dismiss from a pointer or focus event outside the content.
       * The primary protection is structural — this component is rendered
       * outside the HoverCard that contains the trigger button, so the
       * HoverCard closing can never unmount this Dialog.
       */}
      <DialogContent
        className="max-w-4xl w-full p-0 gap-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div id="live-player-container" className="w-full bg-black flex flex-col">
          <DialogHeader className="px-4 pt-3 pb-2">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Radio size={13} className="text-red-500 animate-pulse" />
              Live Replay
              <span className="text-foreground/60 font-normal ml-1">
                {secToMmSs(elapsed)} elapsed
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* 16:9 video area */}
          <div className="relative w-full" style={{ aspectRatio: '16 / 9' }}>
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
                onCanPlay={onCanPlay}
                onError={onVideoError}
                onClick={togglePlaying}
                onDoubleClick={toggleFullscreen}
              />
            )}
          </div>

          {/*
           * Control bar — intentionally matches VideoPlayer.tsx's renderControls()
           * in layout, sizing and component choices. Differences are live-specific:
           *   - Progress slider max is the buffered live edge, not video.duration.
           *   - "Live" button instead of clip / cloud / folder buttons.
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

            {/* Progress — max is the live buffered edge, not elapsed wall-clock
                time. This keeps the Live button at 100 % and prevents the
                slider from looking "behind" due to timestamp misalignment. */}
            <Slider
              sx={{ mx: 1, flex: 1, ...sliderBaseSx }}
              value={currentTime}
              max={liveMax > 0 ? liveMax : Math.max(elapsed, 1)}
              step={0.1}
              valueLabelFormat={secToMmSs}
              valueLabelDisplay="auto"
              onChange={handleProgressChange}
              onChangeCommitted={handleProgressChangeCommitted}
              onMouseDown={() => {
                isDragging.current = true;
              }}
              onKeyDown={(e) => e.preventDefault()}
            />

            {/* Time: current / live edge (both in video-time seconds) */}
            <div className="mx-1 flex">
              <span className="whitespace-nowrap text-foreground-lighter text-[11px] font-semibold font-mono">
                {secToMmSs(Math.floor(currentTime))} /{' '}
                {secToMmSs(Math.ceil(liveMax > 0 ? liveMax : elapsed))}
              </span>
            </div>

            <Separator className="mx-2" orientation="vertical" />

            {/* Jump to live edge */}
            <Button
              variant="ghost"
              size="xs"
              onClick={jumpToLive}
              className="whitespace-nowrap text-foreground-lighter text-[11px] font-semibold font-mono"
            >
              <Radio size={12} className="mr-1 text-red-500" />
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
      </DialogContent>
    </Dialog>
  );
};

export default LiveReplayDialog;
