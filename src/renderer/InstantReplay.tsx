import { useCallback, useEffect, useRef, useState } from 'react';
import { Backdrop, CircularProgress, Slider } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeDownIcon from '@mui/icons-material/VolumeDown';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeMuteIcon from '@mui/icons-material/VolumeMute';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import RefreshIcon from '@mui/icons-material/Refresh';
import screenfull from 'screenfull';
import { AppState, RecStatus, VideoPlayerSettings } from 'main/types';
import { Button } from './components/Button/Button';
import { Tooltip } from './components/Tooltip/Tooltip';
import Separator from './components/Separator/Separator';
import { secToMmSs } from './rendererutils';
import { Radio } from 'lucide-react';

const ipc = window.electron.ipcRenderer;

const sliderSx = {
  '& .MuiSlider-thumb': {
    color: 'white',
    width: '10px',
    height: '10px',
    '&:hover': {
      color: '#bb4220',
      boxShadow: 'none',
    },
  },
  '& .MuiSlider-track': {
    color: '#bb4220',
    height: '4px',
  },
  '& .MuiSlider-rail': {
    color: '#bb4220',
    height: '4px',
  },
  '& .MuiSlider-active': {
    color: '#bb4220',
  },
};

interface IProps {
  appState: AppState;
  recorderStatus: RecStatus;
}

const InstantReplay = ({ appState, recorderStatus }: IProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const videoPlayerSettings = ipc.sendSync('videoPlayerSettings', [
    'get',
  ]) as VideoPlayerSettings;

  const [volume, setVolume] = useState(videoPlayerSettings.volume);
  const [muted, setMuted] = useState(videoPlayerSettings.muted);
  const [playing, setPlaying] = useState(false);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [spinner, setSpinner] = useState(true);

  const isDragging = useRef(false);
  const progressSyncRef = useRef<number | null>(null);
  // Tracks whether we've done the initial seek-to-end after the first load.
  const hasAutoSeekedRef = useRef(false);

  const isRecording = recorderStatus === RecStatus.Recording;

  // ------------------------------------------------------------------
  // Progress bar sync
  // ------------------------------------------------------------------

  const startProgressSync = () => {
    if (progressSyncRef.current) return;
    progressSyncRef.current = window.setInterval(() => {
      if (!videoRef.current || isDragging.current) return;
      setProgress(videoRef.current.currentTime);
    }, 100);
  };

  const stopProgressSync = () => {
    if (!progressSyncRef.current) return;
    window.clearInterval(progressSyncRef.current);
    progressSyncRef.current = null;
  };

  // ------------------------------------------------------------------
  // Refresh: reload the source to pick up newly written fragments.
  // Cache-bust so the VOD handler doesn't serve a stale response.
  // ------------------------------------------------------------------

  const doRefresh = useCallback(() => {
    if (!videoRef.current || !filePath) return;
    hasAutoSeekedRef.current = false;
    setSpinner(true);
    videoRef.current.src = `vod://wcr/${filePath}`;
    videoRef.current.load();
  }, [filePath]);

  // ------------------------------------------------------------------
  // On mount: resolve the recording file path
  // ------------------------------------------------------------------

  useEffect(() => {
    ipc.getRecordingFilePath().then((path) => {
      setFilePath(path ?? null);
      if (!path) setSpinner(false);
    });

    return () => {
      stopProgressSync();
    };
  }, []);

  // ------------------------------------------------------------------
  // Load the video once we know the file path
  // ------------------------------------------------------------------

  useEffect(() => {
    if (!filePath || !videoRef.current) return;
    videoRef.current.src = `vod://wcr/${filePath}`;
    videoRef.current.load();
  }, [filePath]);

  // ------------------------------------------------------------------
  // Sync volume / muted to the video element
  // ------------------------------------------------------------------

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.volume = volume;
    videoRef.current.muted = muted;
  }, [volume, muted]);

  // ------------------------------------------------------------------
  // Persist volume settings to main process
  // ------------------------------------------------------------------

  useEffect(() => {
    const settings: VideoPlayerSettings = { volume, muted };
    ipc.sendMessage('videoPlayerSettings', ['set', settings]);
  }, [volume, muted]);

  // ------------------------------------------------------------------
  // Media session: prevent background key capture
  // ------------------------------------------------------------------

  useEffect(() => {
    ipc.on('window-focus-status', (arg: unknown) => {
      const focused = arg as boolean;
      if (focused) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
      } else {
        navigator.mediaSession.setActionHandler('play', () => {});
        navigator.mediaSession.setActionHandler('pause', () => {});
      }
    });
    return () => ipc.removeAllListeners('window-focus-status');
  }, []);

  // ------------------------------------------------------------------
  // Pause when the app is minimized to tray
  // ------------------------------------------------------------------

  useEffect(() => {
    ipc.on('pausePlayer', () => {
      videoRef.current?.pause();
    });
    return () => ipc.removeAllListeners('pausePlayer');
  }, []);

  // ------------------------------------------------------------------
  // Keyboard shortcuts
  // ------------------------------------------------------------------

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return;
      const video = videoRef.current;

      if (e.key === 'k' || e.key === ' ') {
        if (video.paused) {
          video.play().catch(console.error);
        } else {
          video.pause();
        }
        e.preventDefault();
        e.stopPropagation();
      }

      if (e.key === 'j' || e.key === 'ArrowLeft') {
        video.currentTime = Math.max(0, video.currentTime - 5);
        setProgress(video.currentTime);
      }

      if (e.key === 'l' || e.key === 'ArrowRight') {
        video.currentTime = Math.min(video.currentTime + 5, video.duration);
        setProgress(video.currentTime);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // ------------------------------------------------------------------
  // Video event handlers
  // ------------------------------------------------------------------

  const handleCanPlay = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const dur = video.duration;
    const validDuration = isFinite(dur) && !isNaN(dur);

    if (validDuration) setDuration(dur);
    setSpinner(false);

    // On the first load (or after a manual refresh), jump to the end
    // so the user sees the most recent content.
    if (!hasAutoSeekedRef.current && validDuration && dur > 0) {
      hasAutoSeekedRef.current = true;
      video.currentTime = Math.max(0, dur - 0.5);
      setProgress(video.currentTime);
      video.play().catch(console.error);
    }
  };

  const handleDurationChange = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    if (isFinite(dur) && !isNaN(dur)) setDuration(dur);
  };

  const handlePlay = () => {
    setPlaying(true);
    startProgressSync();
  };

  const handlePause = () => {
    setPlaying(false);
    stopProgressSync();
  };

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    console.error('[LiveReplay] Video error:', e);
    setSpinner(false);
  };

  // ------------------------------------------------------------------
  // Control actions
  // ------------------------------------------------------------------

  const togglePlaying = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(console.error);
    } else {
      videoRef.current.pause();
    }
  };

  const toggleMuted = () => setMuted((v) => !v);

  const toggleFullscreen = () => {
    const el = document.getElementById('live-player-and-controls');
    if (el) screenfull.toggle(el);
  };

  const handleProgressChange = (_e: Event, value: number | number[]) => {
    if (typeof value === 'number') setProgress(value);
  };

  const handleProgressCommitted = (
    _e: React.SyntheticEvent | Event,
    value: number | number[],
  ) => {
    isDragging.current = false;
    if (typeof value !== 'number' || !videoRef.current) return;
    videoRef.current.currentTime = value;
  };

  const handleVolumeChange = (_e: Event, value: number | number[]) => {
    if (typeof value === 'number') {
      setMuted(false);
      setVolume(value / 100);
    }
  };

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------

  const getVolumeIcon = () => {
    if (muted)
      return <VolumeOffIcon sx={{ color: 'white', fontSize: '22px' }} />;
    if (volume === 0)
      return <VolumeMuteIcon sx={{ color: 'white', fontSize: '22px' }} />;
    if (volume < 0.5)
      return <VolumeDownIcon sx={{ color: 'white', fontSize: '22px' }} />;
    return <VolumeUpIcon sx={{ color: 'white', fontSize: '22px' }} />;
  };

  const renderTimeDisplay = () => {
    const currentStr = secToMmSs(progress);
    const totalStr =
      duration > 0 && isFinite(duration) ? secToMmSs(duration) : '--:--';

    return (
      <div className="mx-1 flex">
        <span className="whitespace-nowrap text-foreground-lighter text-[11px] font-semibold font-mono">
          {currentStr} / {totalStr}
        </span>
      </div>
    );
  };

  const renderControls = () => (
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
        sx={{ m: 1, width: '75px', ...sliderSx }}
        value={muted ? 0 : volume * 100}
        onChange={handleVolumeChange}
        valueLabelFormat={Math.round}
        valueLabelDisplay="auto"
        onKeyDown={(e) => e.preventDefault()}
      />

      {/* Progress */}
      <Slider
        sx={{ ...sliderSx, m: 2, width: '100%' }}
        value={progress}
        onChange={handleProgressChange}
        onChangeCommitted={handleProgressCommitted}
        onMouseDown={() => {
          isDragging.current = true;
        }}
        onKeyDown={(e) => e.preventDefault()}
        max={duration > 0 ? duration : 1}
        step={0.01}
      />

      {renderTimeDisplay()}

      <Separator className="mx-2" orientation="vertical" />
      {/* Manual refresh */}
      <Tooltip content="Reload to pick up new content">
        <Button variant="ghost" size="xs" onClick={doRefresh}>
          <RefreshIcon sx={{ color: 'white', fontSize: '20px' }} />
        </Button>
      </Tooltip>

      {/* Fullscreen */}
      <Button variant="ghost" size="xs" onClick={toggleFullscreen}>
        <FullscreenIcon sx={{ color: 'white' }} />
      </Button>
    </div>
  );

  // ------------------------------------------------------------------
  // No-recording placeholder
  // ------------------------------------------------------------------

  const renderNoRecording = () => (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 bg-black">
      <Radio size={48} className="text-muted-foreground opacity-40" />
      <p className="text-foreground text-base font-semibold opacity-60">
        No active recording
      </p>
      <p className="text-foreground-lighter text-sm opacity-40">
        Live Replay is available while a recording is in progress.
      </p>
    </div>
  );

  if (!filePath) {
    return (
      <div id="live-player-and-controls" className="w-full h-full">
        {spinner ? (
          <div className="w-full h-full bg-black flex items-center justify-center">
            <CircularProgress color="inherit" />
          </div>
        ) : (
          renderNoRecording()
        )}
      </div>
    );
  }

  return (
    <div id="live-player-and-controls" className="w-full h-full">
      <div
        className="relative"
        style={{ height: 'calc(100% - 40px)', backgroundColor: 'black' }}
      >
        <video
          ref={videoRef}
          className="w-full h-full"
          style={{ backgroundColor: 'black', cursor: 'pointer' }}
          onCanPlay={handleCanPlay}
          onDurationChange={handleDurationChange}
          onPlay={handlePlay}
          onPause={handlePause}
          onError={handleError}
          onClick={togglePlaying}
          onDoubleClick={toggleFullscreen}
        />

        {/* Banner when recording has stopped */}
        {!isRecording && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm font-semibold px-4 py-2 rounded-full border border-white/20 whitespace-nowrap">
            Recording stopped — showing last captured content
          </div>
        )}

        <Backdrop
          open={spinner}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          }}
        >
          <CircularProgress color="inherit" />
        </Backdrop>
      </div>

      {renderControls()}
    </div>
  );
};

export default InstantReplay;
