import {
  DeathMarkers,
  RendererVideo,
  SliderMark,
  VideoMarker,
  VideoPlayerSettings,
} from 'main/types';
import {
  MutableRefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Box, Slider, Typography } from '@mui/material';
import { Resizable } from 're-resizable';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeDownIcon from '@mui/icons-material/VolumeDown';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeMuteIcon from '@mui/icons-material/VolumeMute';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import MovieIcon from '@mui/icons-material/Movie';
import ClearIcon from '@mui/icons-material/Clear';
import DoneIcon from '@mui/icons-material/Done';
import { OnProgressProps } from 'react-player/base';
import ReactPlayer from 'react-player';
import screenfull from 'screenfull';
import { ConfigurationSchema } from 'main/configSchema';
import DeathIcon from '../../assets/icon/death.png';
import {
  convertNumToDeathMarkers,
  getAllDeathMarkers,
  getEncounterMarkers,
  getOwnDeathMarkers,
  getRoundMarkers,
  isClip,
  isMythicPlusUtil,
  isSoloShuffleUtil,
  secToMmSs,
} from './rendererutils';
import { Button } from './components/Button/Button';
import { Tooltip } from './components/Tooltip/Tooltip';

interface IProps {
  video: RendererVideo;
  persistentProgress: MutableRefObject<number>;
  playerHeight: MutableRefObject<number>;
  config: ConfigurationSchema;
}

const ipc = window.electron.ipcRenderer;
const playbackRates = [0.25, 0.5, 1, 2];
const style = { backgroundColor: 'black' };
const progressInterval = 100;

const sliderSx = {
  '& .MuiSlider-thumb': {
    color: 'white',
    width: '16px',
    height: '16px',
    '&:hover': {
      color: '#bb4220',
      boxShadow: 'none',
    },
  },
  '& .MuiSlider-track': {
    color: '#bb4220',
  },
  '& .MuiSlider-rail': {
    color: '#bb4220',
  },
  '& .MuiSlider-active': {
    color: '#bb4220',
  },
};

export const VideoPlayer = (props: IProps) => {
  const { video, persistentProgress, config, playerHeight } = props;
  const { videoSource, cloud } = video;

  const player = useRef<ReactPlayer>(null);
  const progressSlider = useRef<HTMLSpanElement>(null);

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [duration, setDuration] = useState<number>(0);
  const [clipMode, setClipMode] = useState<boolean>(false);
  const [clipStartValue, setClipStartValue] = useState<number>(0);
  const [clipStopValue, setClipStopValue] = useState<number>(100);

  // This exists to force a re-render on resizing of the window, so that
  // the coloring of the progress slider remains correct across a resize.
  const [, setWidth] = useState<number>(0);

  // On the initial seek we will attempt to resume playback from the
  // persistentProgress prop. The ideas is that when switching between
  // different POVs of the same activity we want to play from the same
  // point.
  let initialSeek = false;

  // Read and store the video player state of 'volume' and 'muted' so that we may
  // restore it when selecting a different video. This config gets stored as a
  // variable in the main process that we update and retrieve, but is not written
  // to config so is lost on app restart.
  const videoPlayerSettings = ipc.sendSync('videoPlayerSettings', [
    'get',
  ]) as VideoPlayerSettings;

  const [volume, setVolume] = useState<number>(videoPlayerSettings.volume);
  const [muted, setMuted] = useState<boolean>(videoPlayerSettings.muted);

  /**
   * Return a death marker appropriate for the MUI slider component.
   */
  const getDeathMark = (marker: VideoMarker): SliderMark => {
    return {
      value: marker.time,
      label: (
        <Tooltip content={marker.text}>
          <Box
            component="img"
            src={DeathIcon}
            sx={{
              p: '1px',
              height: '13px',
              width: '13px',
              objectFit: 'fill',
            }}
          />
        </Tooltip>
      ),
    };
  };

  /**
   * Get the video timeline markers appropriate for the current video and
   * configuration.
   */
  const getMarks = () => {
    const marks: SliderMark[] = [];

    if (!player.current || duration === 0 || isClip(video)) {
      return marks;
    }

    const deathMarkerConfig = convertNumToDeathMarkers(config.deathMarkers);

    if (deathMarkerConfig === DeathMarkers.ALL) {
      getAllDeathMarkers(video)
        .map(getDeathMark)
        .forEach((m) => marks.push(m));
    } else if (deathMarkerConfig === DeathMarkers.OWN) {
      getOwnDeathMarkers(video)
        .map(getDeathMark)
        .forEach((m) => marks.push(m));
    }

    return marks;
  };

  /**
   * Return all the active video markers given the current video and config.
   */
  const getActiveMarkers = () => {
    const activeMarkers: VideoMarker[] = [];

    if (isMythicPlusUtil(video) && config.encounterMarkers) {
      getEncounterMarkers(video).forEach((m) => activeMarkers.push(m));
    }

    if (isSoloShuffleUtil(video) && config.roundMarkers) {
      getRoundMarkers(video).forEach((m) => activeMarkers.push(m));
    }

    return activeMarkers;
  };

  /**
   * Build a linear gradient CSS property from a list of video makers.
   * Returned string is something of the form:
   *   "linear-gradient(90deg, rgba(1, 1, 1, 1) 0px, rgba(1, 1, 1, 1) 10px, ... max)".
   */
  const markersToLinearGradient = (
    markers: VideoMarker[],
    fillerColor: string
  ) => {
    if (!progressSlider.current || duration === 0 || isClip(video)) {
      // Initial render shows a flash of the default color without this,
      // and this branch also protects us loading anything on the clips
      // category where the markers are bogus as they are just lifted
      // from the parent.
      return `linear-gradient(90deg, ${fillerColor} 0%, ${fillerColor} 100%)`;
    }

    let ptr = 0;
    const gradients = [];
    const sliderWidth = progressSlider.current.getBoundingClientRect().width;
    const pxToSecRatio = sliderWidth / duration;

    markers
      .sort((a, b) => a.time - b.time) // Chronological sort
      .forEach((marker) => {
        if (ptr !== marker.time) {
          // If we've not moved the pointer to this point yet, then add a
          // filler block to the gradient.
          const start = Math.round(ptr * pxToSecRatio);
          const end = Math.round(marker.time * pxToSecRatio);
          gradients.push(`${fillerColor} ${start}px`);
          gradients.push(`${fillerColor} ${end}px`);
        }

        // The pointer must have caught up now, so add the current marker.
        const start = Math.round(marker.time * pxToSecRatio);
        const end = Math.round((marker.time + marker.duration) * pxToSecRatio);
        gradients.push(`${marker.color} ${start}px`);
        gradients.push(`${marker.color} ${end}px`);

        // Move the pointer on.
        ptr = marker.time + marker.duration;
      });

    // If we didn't reach the end, add filler to there. We don't want the
    // last gradient to continue to the end.
    if (ptr !== duration) {
      const start = Math.round(ptr * pxToSecRatio);
      gradients.push(`${fillerColor} ${start}px`);
      gradients.push(`${fillerColor} ${sliderWidth}px`);
    }

    // Build the string from the list of colors and locations.
    const gradient = `linear-gradient(90deg, ${gradients.join(', ')})`;
    return gradient;
  };

  /**
   * Get a linear gradient style for the video rail for the encounter (M+ only)
   * and round (Solo Shuffle only) markers.
   */
  const getRailGradient = () => {
    const fillerColor = '#5A2F27';
    const activeMarkers = getActiveMarkers();
    return markersToLinearGradient(activeMarkers, fillerColor);
  };

  /**
   * Get a linear gradient for the video track for the encounter (M+ only)
   * and round (Solo Shuffle only) markers.
   */
  const getTrackGradient = () => {
    const fillerColor = '#BB4420';
    const activeMarkers = getActiveMarkers();

    // Lower the opacity of everything in the linear gradient otherwise it
    // looks out of place on the slider track. This doesn't need to happen
    // on the slider rail as it has blanket low opacity. Makes a replacement
    // like: "rgba(0, 0, 0, 1) -> rgba(0, 0, 0, 0.4)"
    return markersToLinearGradient(activeMarkers, fillerColor).replace(
      /, 1\)/g,
      ', 0.4)'
    );
  };

  /**
   * Toggle if the video is currently playing or not. You would think this
   * would be straight forward and you could just do setPlaying(!playing). You
   * would be wrong. Seems a limitation on the react-player library we are using.
   *
   * Instead we access the internal player's state and determine if it's playing
   * or not and set the state depending on that. That logic is stolen from here:
   * https://stackoverflow.com/questions/6877403/how-to-tell-if-a-video-element-is-currently-playing.
   */
  const togglePlaying = () => {
    if (!player.current) {
      return;
    }

    const internalPlayer = player.current.getInternalPlayer();
    const { paused, currentTime, ended } = internalPlayer;

    if (currentTime > 0 && !paused && !ended) {
      setPlaying(false);
    } else {
      setPlaying(true);
    }
  };

  /**
   * Handle the user clicking on the rate button by going to the next rate
   * option.
   */
  const handleRateChange = () => {
    const index = playbackRates.indexOf(playbackRate);

    if (index === playbackRates.length - 1) {
      setPlaybackRate(playbackRates[0]);
    } else {
      setPlaybackRate(playbackRates[index + 1]);
    }
  };

  /**
   * Handle an onProgress event fired from the player by updating the
   * progresss bar position.
   */
  const onProgress = (event: OnProgressProps) => {
    persistentProgress.current = event.playedSeconds;
    setProgress(event.played);
  };

  /**
   * Handle a click from the user on the progress slider by seeking to that
   * position.
   */
  const handleProgressSliderChange = (
    _event: Event,
    value: number | number[],
    index: number
  ) => {
    if (!player.current) {
      return;
    }

    if (Array.isArray(value)) {
      setClipStartValue(value[0]);
      setClipStopValue(value[2]);

      if (index === 1) {
        player.current.seekTo(value[1], 'seconds');
      }
    }

    if (typeof value === 'number') {
      player.current.seekTo(value, 'seconds');
    }
  };

  /**
   * Enter / exit fullscreen mode.
   */
  const toggleFullscreen = () => {
    const playerElement = document.getElementById('player-and-controls');

    if (playerElement) {
      screenfull.toggle(playerElement);
    }
  };

  /**
   * Handle the onReady event.
   */
  const onReady = () => {
    if (!player.current) {
      return;
    }

    if (!initialSeek) {
      player.current.seekTo(persistentProgress.current, 'seconds');
      initialSeek = true;
    }

    if (duration > 0) {
      return;
    }

    const durationSec = player.current.getDuration();
    setDuration(durationSec);
    setClipStopValue(durationSec);
  };

  /**
   * Returns the progress slider for the video controls.
   */
  const renderProgressSlider = () => {
    const current = progress * duration;
    const thumbValues = [clipStartValue, current, clipStopValue];

    if (clipMode) {
      const getLabel = (value: number, index: number) => {
        if (clipMode) {
          if (index === 0) return `Start (${secToMmSs(value)})`;
          if (index === 1) return secToMmSs(value);
          if (index === 2) return `End (${secToMmSs(value)})`;
        }

        return secToMmSs(value);
      };

      return (
        <Slider
          ref={progressSlider}
          sx={{
            m: 2,
            width: '100%',
            ...sliderSx,
            '& .MuiSlider-thumb': {
              "&[data-index='0']": {
                backgroundColor: 'white',
                width: '5px',
                height: '20px',
                borderRadius: 0,
                '& .MuiSlider-valueLabel': {
                  fontSize: '0.75rem',
                },
                '&:hover': {
                  backgroundColor: '#bb4220',
                  boxShadow: 'none',
                },
              },
              "&[data-index='1']": {
                width: '10px',
                height: '10px',
                zIndex: 1,
                backgroundColor: 'white',
                '& .MuiSlider-valueLabel': {
                  fontSize: '0.75rem',
                  rotate: '180deg',
                  transform: 'translateY(-15%) scale(1)',
                  '& .MuiSlider-valueLabelCircle': {
                    rotate: '180deg',
                  },
                },
                '&:hover': {
                  backgroundColor: '#bb4220',
                  boxShadow: 'none',
                },
              },
              "&[data-index='2']": {
                backgroundColor: 'white',
                width: '5px',
                height: '20px',
                borderRadius: 0,
                '& .MuiSlider-valueLabel': {
                  fontSize: '0.75rem',
                },
                '&:hover': {
                  backgroundColor: '#bb4220',
                  boxShadow: 'none',
                },
              },
            },
          }}
          valueLabelDisplay="on"
          valueLabelFormat={getLabel}
          value={thumbValues}
          onChange={handleProgressSliderChange}
          max={duration}
          disableSwap
        />
      );
    }

    return (
      <Slider
        ref={progressSlider}
        sx={{
          m: 2,
          width: '100%',
          ...sliderSx,
          '& .MuiSlider-markLabel': {
            top: '20px',
          },
          '& .MuiSlider-mark': {
            backgroundColor: 'white',
            width: '2px',
            height: '4px',
          },
          '& .MuiSlider-rail': {
            background: getRailGradient(),
          },
          '& .MuiSlider-track': {
            background: getTrackGradient(),
            border: 'none',
          },
        }}
        valueLabelDisplay="auto"
        valueLabelFormat={secToMmSs}
        value={current}
        onChange={handleProgressSliderChange}
        max={duration}
        marks={getMarks()}
      />
    );
  };

  /**
   * Returns the video player itself, passing through all necessary callbacks
   * and props for it to function and be controlled.
   */
  const renderPlayer = () => {
    return (
      <ReactPlayer
        id="react-player"
        ref={player}
        height="calc(100% - 40px)"
        width="100%"
        url={videoSource}
        style={style}
        playing={playing}
        volume={volume}
        muted={muted}
        playbackRate={playbackRate}
        progressInterval={progressInterval}
        onProgress={onProgress}
        onClick={togglePlaying}
        onDoubleClick={toggleFullscreen}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onReady={onReady}
      />
    );
  };

  /**
   * Returns the play/pause button for the video controls.
   */
  const renderPlayPause = () => {
    return (
      <Button variant="ghost" size="xs" onClick={togglePlaying}>
        {playing && <PauseIcon sx={{ color: 'white', fontSize: '22px' }} />}
        {!playing && (
          <PlayArrowIcon sx={{ color: 'white', fontSize: '22px' }} />
        )}
      </Button>
    );
  };

  /**
   * Toggles if the volume is muted.
   */
  const toggleMuted = () => {
    setMuted(!muted);
  };

  /**
   * Return an appropriate volume icon for the muted and volume state.
   */
  const getAppropriateVolumeIcon = () => {
    if (muted) {
      return <VolumeOffIcon sx={{ color: 'white', fontSize: '22px' }} />;
    }

    if (volume === 0) {
      return <VolumeMuteIcon sx={{ color: 'white', fontSize: '22px' }} />;
    }

    if (volume < 0.5) {
      return <VolumeDownIcon sx={{ color: 'white', fontSize: '22px' }} />;
    }

    return <VolumeUpIcon sx={{ color: 'white', fontSize: '22px' }} />;
  };

  /**
   * Returns the volume button for the video controls.
   */
  const renderVolumeButton = () => {
    return (
      <Button variant="ghost" size="xs" onClick={toggleMuted}>
        {getAppropriateVolumeIcon()}
      </Button>
    );
  };

  /**
   * Returns the progress text indicator for the video controls.
   */
  const renderProgressText = () => {
    const current = progress * duration;
    const max = duration;

    return (
      <div className="mx-1 flex">
        <span className="whitespace-nowrap text-foreground-lighter text-[11px] font-semibold">
          {secToMmSs(current)} / {secToMmSs(max)}
        </span>
      </div>
    );
  };

  /**
   * Returns the playback rate button for the video controls.
   */
  const renderPlaybackRateButton = () => {
    const playbackRateText = `${playbackRate}x`;

    return (
      <Tooltip content="Playback Speed">
        <Button variant="ghost" size="xs" onClick={handleRateChange}>
          {playbackRateText}
        </Button>
      </Tooltip>
    );
  };

  /**
   * Returns the playback rate button for the video controls.
   */
  const renderClipButton = () => {
    const color = cloud ? 'rgba(239, 239, 240, 0.25)' : 'white';
    const tooltip = cloud ? 'You can only clip locally saved videos' : 'Clip';

    return (
      <Tooltip content={tooltip}>
        <div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setClipMode(true)}
            disabled={cloud}
          >
            <MovieIcon sx={{ color, fontSize: '22px' }} />
          </Button>
        </div>
      </Tooltip>
    );
  };

  /**
   * Make a request to the main process to clip a video.
   */
  const doClip = () => {
    const clipDuration = clipStopValue - clipStartValue;
    const clipOffset = clipStartValue;
    const clipSource = video.videoSource;

    ipc.sendMessage('clip', [clipSource, clipOffset, clipDuration]);
    setClipMode(false);
  };

  /**
   * Render the button to end the clipping session.
   */
  const renderClipFinishedButton = () => {
    return (
      <Tooltip content="Confirm">
        <Button variant="ghost" size="xs" onClick={doClip}>
          <DoneIcon sx={{ color: 'white' }} />
        </Button>
      </Tooltip>
    );
  };

  const renderClipCancelButton = () => {
    return (
      <Tooltip content="Cancel">
        <Button variant="ghost" size="xs" onClick={() => setClipMode(false)}>
          <ClearIcon sx={{ color: 'white' }} />
        </Button>
      </Tooltip>
    );
  };

  /**
   * Returns the fullscreen button for the video controls.
   */
  const renderFullscreenButton = () => {
    return (
      <Tooltip content="Fullscreen">
        <Button variant="ghost" size="xs" onClick={toggleFullscreen}>
          <FullscreenIcon sx={{ color: 'white' }} />
        </Button>
      </Tooltip>
    );
  };

  /**
   * Handle a change event from the volume slider.
   */
  const handleVolumeChange = (_event: Event, value: number | number[]) => {
    if (typeof value === 'number') {
      setMuted(false);
      setVolume(value / 100);
    }
  };

  /**
   * Returns the volume slider.
   */
  const renderVolumeSlider = () => {
    return (
      <Slider
        sx={{ m: 1, width: '75px', ...sliderSx }}
        valueLabelDisplay="auto"
        value={muted ? 0 : volume * 100}
        onChange={handleVolumeChange}
        valueLabelFormat={Math.round}
      />
    );
  };

  /**
   * Returns the entire video control component.
   */
  const renderControls = () => {
    return (
      <div className="w-full h-10 flex flex-row justify-center items-center bg-background-dark-gradient-to border border-background-dark-gradient-to px-1 py-2">
        {renderPlayPause()}
        {renderVolumeButton()}
        {renderVolumeSlider()}
        {renderProgressSlider()}
        {renderProgressText()}
        {!clipMode && !isClip(video) && renderClipButton()}
        {!clipMode && renderPlaybackRateButton()}
        {!clipMode && renderFullscreenButton()}
        {clipMode && renderClipFinishedButton()}
        {clipMode && renderClipCancelButton()}
      </div>
    );
  };

  /**
   * Handle a key down event. It would be nice to pass a "onKeyDown" react
   * callback to the player / controls box, but the player seems to swallow
   * such events, so instead we do this.
   */
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!player.current) {
      return;
    }

    if (e.key === 'k') {
      togglePlaying();
    }

    if (e.key === 'j' || e.key === 'ArrowLeft') {
      const current = player.current.getCurrentTime();
      player.current.seekTo(current - 5, 'seconds');
    }

    if (e.key === 'l' || e.key === 'ArrowRight') {
      const current = player.current.getCurrentTime();
      player.current.seekTo(current + 5, 'seconds');
    }
  };

  // Listener for keydown events when the player is open.
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // This hook updates some state to force a re-render on window resize,
  // otherwise resizing the window (and hence the progress bar) causes
  // all the makers to be offset until next render.
  useLayoutEffect(() => {
    const updateWidth = () => {
      setWidth(window.innerWidth);
    };

    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Inform the main process of a volume or muted state change.
  useEffect(() => {
    const soundSettings: VideoPlayerSettings = { volume, muted };
    ipc.sendMessage('videoPlayerSettings', ['set', soundSettings]);
  }, [volume, muted]);

  // Used to pause when the app is minimized to the system tray.
  useEffect(() => {
    ipc.removeAllListeners('pausePlayer');
    ipc.on('pausePlayer', () => setPlaying(false));
  }, [setPlaying]);

  const onResize = (_unused1: unknown, __unused2: unknown, element: any) => {
    const height = element.clientHeight;

    if (typeof height !== 'number') {
      // Just being cautious as we have no types for this callback.
      return;
    }

    playerHeight.current = height;
  };

  return (
    <>
      <Resizable
        defaultSize={{
          height: `${playerHeight.current}px`,
          width: '100%',
        }}
        enable={{ bottom: true }}
        bounds="parent"
        onResize={onResize}
      >
        <Box
          id="player-and-controls"
          sx={{
            width: '100%',
            height: '100%',
          }}
        >
          {renderPlayer()}
          {renderControls()}
        </Box>
      </Resizable>
    </>
  );
};

export default VideoPlayer;
