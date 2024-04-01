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
import { Box, Button, Slider, Tooltip, Typography } from '@mui/material';
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
import { setConfigValue } from './useSettings';

interface IProps {
  video: RendererVideo;
  persistentProgress: MutableRefObject<number>;
  playing: boolean;
  setPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  config: ConfigurationSchema;
  setConfig: React.Dispatch<React.SetStateAction<ConfigurationSchema>>;
}

const ipc = window.electron.ipcRenderer;
const playbackRates = [0.25, 0.5, 1, 2];
const style = { backgroundColor: 'black' };
const progressInterval = 100;

const sliderSx = {
  '& .MuiSlider-thumb': {
    color: 'white',
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
  const { video, persistentProgress, playing, setPlaying, config, setConfig } =
    props;
  const { videoSource, cloud } = video;

  const player = useRef<ReactPlayer>(null);
  const progressSlider = useRef<HTMLSpanElement>(null);

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
  const [src, setSrc] = useState<string>('');

  // We set the video player size in the config when it gets resized, on a
  // debounce timer as it fires alot of resize events.
  let debounceTimer: NodeJS.Timer | undefined;

  // Sign the thumbnail URL and render it.
  useEffect(() => {
    const getVideoSignedUrl = async () => {
      const signedUrl = await ipc.invoke('signGetUrl', [videoSource]);
      setSrc(signedUrl);
    };

    if (video.cloud) {
      getVideoSignedUrl();
    } else {
      setSrc(videoSource);
    }
  }, [videoSource, video.cloud]);

  /**
   * Return a death marker appropriate for the MUI slider component.
   */
  const getDeathMark = (marker: VideoMarker): SliderMark => {
    return {
      value: marker.time,
      label: (
        <Tooltip title={marker.text}>
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
              },
              "&[data-index='1']": {
                width: '5px',
                height: '5px',
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
              },
              "&[data-index='2']": {
                backgroundColor: 'white',
                width: '5px',
                height: '20px',
                borderRadius: 0,
                '& .MuiSlider-valueLabel': {
                  fontSize: '0.75rem',
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
        // key={key}
        url={src}
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
      <Button sx={{ color: 'white' }} onClick={togglePlaying}>
        {playing && <PauseIcon sx={{ color: 'white' }} />}
        {!playing && <PlayArrowIcon sx={{ color: 'white' }} />}
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
      return <VolumeOffIcon sx={{ color: 'white' }} />;
    }

    if (volume === 0) {
      return <VolumeMuteIcon sx={{ color: 'white' }} />;
    }

    if (volume < 0.5) {
      return <VolumeDownIcon sx={{ color: 'white' }} />;
    }

    return <VolumeUpIcon sx={{ color: 'white' }} />;
  };

  /**
   * Returns the volume button for the video controls.
   */
  const renderVolumeButton = () => {
    return (
      <Button sx={{ color: 'white' }} onClick={toggleMuted}>
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
      <Box sx={{ mx: 2 }}>
        <Typography
          noWrap
          sx={{
            color: 'white',
            fontSize: 12,
          }}
        >
          {secToMmSs(current)} / {secToMmSs(max)}
        </Typography>
      </Box>
    );
  };

  /**
   * Returns the playback rate button for the video controls.
   */
  const renderPlaybackRateButton = () => {
    const playbackRateText = `${playbackRate}x`;

    return (
      <Tooltip title="Playback Speed">
        <Button sx={{ color: 'white' }} onClick={handleRateChange}>
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

    return (
      <Tooltip title="Clip">
        <div>
          <Button
            sx={{ color: 'white' }}
            onClick={() => setClipMode(true)}
            disabled={cloud}
          >
            <MovieIcon sx={{ color, height: '20px' }} />
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
      <Tooltip title="Confirm">
        <Button sx={{ color: 'white' }} onClick={doClip}>
          <DoneIcon sx={{ color: 'white' }} />
        </Button>
      </Tooltip>
    );
  };

  const renderClipCancelButton = () => {
    return (
      <Tooltip title="Cancel">
        <Button sx={{ color: 'white' }} onClick={() => setClipMode(false)}>
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
      <Tooltip title="Fullscreen">
        <Button sx={{ color: 'white' }} onClick={toggleFullscreen}>
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
        sx={{ m: 2, width: '75px', ...sliderSx }}
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
      <Box
        sx={{
          width: '100%',
          height: '40px',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          border: '1 px solid black',
          backgroundColor: '#1E232C',
        }}
      >
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
      </Box>
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

    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      setConfigValue('videoPlayerHeight', height);

      setConfig((prevState) => {
        return {
          ...prevState,
          videoPlayerHeight: height,
        };
      });
    }, 1000);
  };

  return (
    <>
      <Resizable
        defaultSize={{
          height: `${config.videoPlayerHeight}px`,
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
