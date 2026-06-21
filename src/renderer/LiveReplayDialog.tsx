import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './components/Dialog/Dialog';
import { ActivityStatus, VideoPlayerSettings } from 'main/types';
import { ReactNode, useEffect, useRef, useState } from 'react';
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
const playbackRates = [0.25, 0.5, 1, 2];

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
  children: ReactNode;
  activityStatus: ActivityStatus;
};

/**
 * A dialog that streams the current in-progress MKV recording via the live://
 * protocol, with no remuxing. The control bar intentionally mirrors
 * VideoPlayer.tsx in visual style (same MUI components, same sizing) so the
 * two can be unified when VideoPlayer is later refactored to accept an
 * arbitrary source URL.
 */
const LiveReplayDialog = ({ children, activityStatus }: IProps) => {
  const [open, setOpen] = useState(false);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
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

  // Wall-clock elapsed timer. This is the source of truth for the scrubber
  // max — not video.duration, which is Infinity for a live stream.
  useEffect(() => {
    if (!open) return;

    const tick = () =>
      setElapsed(Math.floor((Date.now() - activityStatus.start) / 1000));

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
      if (videoRef.current && !isDragging.current && !videoRef.current.seeking) {
        setCurrentTime(videoRef.current.currentTime);
      }
    }, 100);
  };

  const stopProgressSync = () => {
    if (!progressSyncRef.current) return;
    window.clearInterval(progressSyncRef.current);
    progressSyncRef.current = null;
  };

  // ---- Dialog open/close ----

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

  const onOpenChange = (next: boolean) => {
    setOpen(next);

    if (next) {
      fetchLiveUrl();
    } else {
      stopProgressSync();

      // Clear the src so the browser cancels the live:// request, which stops
      // the 500 ms polling loop in the main process.
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
        videoRef.current.load();
      }

      setLiveUrl(null);
      setPlaying(false);
      setCurrentTime(0);
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

    // Clamp to the furthest buffered byte, same logic as jumpToLive.
    const { buffered } = video;
    const cap = buffered.length > 0 ? buffered.end(buffered.length - 1) : 0;
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
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="max-w-4xl w-full p-0 gap-0 overflow-hidden">
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
           *   - Progress slider max is `elapsed` (wall clock), not video.duration.
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

            {/* Progress — max is elapsed, not Infinity */}
            <Slider
              sx={{ mx: 1, flex: 1, ...sliderBaseSx }}
              value={currentTime}
              max={Math.max(elapsed, 1)}
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

            {/* Time: current / total elapsed */}
            <div className="mx-1 flex">
              <span className="whitespace-nowrap text-foreground-lighter text-[11px] font-semibold font-mono">
                {secToMmSs(Math.floor(currentTime))} / {secToMmSs(elapsed)}
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
