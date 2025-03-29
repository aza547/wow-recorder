import {
  AppState,
  DeathMarkers,
  RendererVideo,
  SliderMark,
  TimestampMarker,
  VideoMarker,
  VideoPlayerSettings,
} from 'main/types';
import {
  MutableRefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Backdrop, Box, CircularProgress, Slider } from '@mui/material';
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
import BookmarkIcon from '@mui/icons-material/Bookmark';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import { OnProgressProps } from 'react-player/base';
import ReactPlayer from 'react-player';
import screenfull from 'screenfull';
import { ConfigurationSchema } from 'config/configSchema';
import { getLocalePhrase, Phrase } from 'localisation/translations';
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
  videos: RendererVideo[];
  persistentProgress: MutableRefObject<number>;
  config: ConfigurationSchema;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}

const ipc = window.electron.ipcRenderer;
const playbackRates = [0.25, 0.5, 1, 2];
const style = { backgroundColor: 'black' };
const progressInterval = 100;

const sliderBaseSx = {
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

export const VideoPlayer = (props: IProps) => {
  const { videos, persistentProgress, config, appState, setAppState } = props;
  const { playing, multiPlayerMode, language } = appState;

  if (videos.length < 1 || videos.length > 4) {
    // Protect against stupid programmer errors.
    throw new Error('VideoPlayer should only be passed up to 4 videos');
  }

  // Reference to each player. Required to control the ReactPlayer component.
  const players: MutableRefObject<ReactPlayer | null>[] = videos.map(() =>
    useRef(null),
  );

  const numReady = useRef<number>(0);
  const progressSlider = useRef<HTMLSpanElement>(null);

  // Progress is in seconds. Strictly it is the position of the
  // slider, which is usally the same as the video except for
  // when the user is dragging.
  const [progress, setProgress] = useState<number>(0);

  // While the user is dragging the thumb of the slider, we don't
  // want to update the video position. This is used to conditionally
  // avoid this.
  const [isDragging, setIsDragging] = useState(false);

  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [duration, setDuration] = useState<number>(0);

  // In clipping mode, the user controls three thumbs. The regular thumb
  // that controls the video position, and a start and stop thumb to
  // indicate where the clip should be made from.
  const [clipMode, setClipMode] = useState<boolean>(false);
  const [clipStartValue, setClipStartValue] = useState<number>(0);
  const [clipStopValue, setClipStopValue] = useState<number>(100);

  // For timestamp markers navigation
  const [currentMarkerIndex, setCurrentMarkerIndex] = useState<number>(-1);

  // This exists to force a re-render on resizing of the window, so that
  // the coloring of the progress slider remains correct across a resize.
  const [, setWidth] = useState<number>(0);

  // We show a progress spinner until the video is ready to play.
  const [spinner, setSpinner] = useState<boolean>(true);

  // On the initial seek we will attempt to resume playback from the
  // persistentProgress prop. The ideas is that when switching between
  // different POVs of the same activity we want to play from the same
  // point.
  const timestamp = `#t=${persistentProgress.current}`;
  const clippable = !multiPlayerMode && !videos[0].cloud;

  // Deliberatly don't update the source when the timestamp changes. That's
  // just the initial playhead position. We only care to change sources when
  // the videos we are meant to be playing changes.
  const srcs = videos.map((rv) => useRef<string>(rv.videoSource + timestamp));

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
   * Set if the video is playing or not.
   */
  const setPlaying = useCallback(
    (v: boolean) => {
      setAppState((prevState) => {
        return {
          ...prevState,
          playing: v,
        };
      });
    },
    [setAppState],
  );

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
   * Return a timestamp marker appropriate for the MUI slider component.
   */
  const getTimestampMark = (marker: TimestampMarker): SliderMark => {
    return {
      value: marker.time,
      label: (
        <Tooltip content={`${marker.playerName} - ${new Date(marker.date).toLocaleTimeString()}`}>
          <BookmarkIcon
            sx={{
              p: '1px',
              height: '13px',
              width: '13px',
              color: '#4CAF50',
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

    if (duration === 0 || isClip(videos[0])) {
      return marks;
    }

    const deathMarkerConfig = convertNumToDeathMarkers(config.deathMarkers);

    if (deathMarkerConfig === DeathMarkers.ALL) {
      getAllDeathMarkers(videos[0], language)
        .map(getDeathMark)
        .forEach((m) => marks.push(m));
    } else if (deathMarkerConfig === DeathMarkers.OWN) {
      getOwnDeathMarkers(videos[0], language)
        .map(getDeathMark)
        .forEach((m) => marks.push(m));
    }

    // Add timestamp markers if they exist
    if (videos[0].timestampMarkers && videos[0].timestampMarkers.length > 0) {
      videos[0].timestampMarkers
        .map(getTimestampMark)
        .forEach((m) => marks.push(m));
    }

    return marks;
  };

  /**
   * Return all the active video markers given the current video and config.
   */
  const getActiveMarkers = () => {
    const activeMarkers: VideoMarker[] = [];

    if (isMythicPlusUtil(videos[0]) && config.encounterMarkers) {
      getEncounterMarkers(videos[0]).forEach((m) => activeMarkers.push(m));
    }

    if (isSoloShuffleUtil(videos[0]) && config.roundMarkers) {
      getRoundMarkers(videos[0]).forEach((m) => activeMarkers.push(m));
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
    fillerColor: string,
  ) => {
    if (!progressSlider.current || duration === 0 || isClip(videos[0])) {
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
      ', 0.4)',
    );
  };

  /**
   * Conveince method to get an appropriate sx prop for the regular
   * progress slider.
   */
  const getProgressSliderSx = () => {
    return {
      ...sliderBaseSx,
      m: 2,
      width: '100%',
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
        height: '4px',
      },
      '& .MuiSlider-track': {
        background: getTrackGradient(),
        border: 'none',
        height: '4px',
      },
    };
  };

  /**
   * Conveince method to get an appropriate sx prop for the clip mode
   * progress slider.
   */
  const getProgressClipSliderSx = () => {
    return {
      ...sliderBaseSx,
      m: 2,
      width: '100%',
      '& .MuiSlider-thumb': {
        "&[data-index='0']": {
          backgroundColor: 'white',
          width: '5px',
          height: '20px',
          borderRadius: 0,
          '& .MuiSlider-valueLabel': {
            fontSize: '0.75rem',
            transform: 'translate(-43%, -100%)', // This moves the whole label.
            '&::before': {
              transform: 'translate(460%, 40%) rotate(45deg)', // This moves the notch.
            },
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
            transform: 'translate(43%, -100%)', // This moves the whole label.
            '&::before': {
              transform: 'translate(-525%, 40%) rotate(45deg)', // This moves the notch.
            },
          },
          '&:hover': {
            backgroundColor: '#bb4220',
            boxShadow: 'none',
          },
        },
      },
    };
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
    const [primary] = players;

    if (!primary.current) {
      return;
    }

    const internalPlayer = primary.current.getInternalPlayer();
    const { paused, currentTime, ended } = internalPlayer;

    if (currentTime > 0 && !paused && !ended) {
      setPlaying(false);
    } else {
      setPlaying(true);
    }
  };

  // By default the window hijacks media keys even when
  // the window isn't focused or it is minimized
  // so we override the action handlers
  useEffect(() => {
    ipc.on('window-focus-status', (arg: unknown) => {
      const focused = arg as boolean;
      if (focused) {
        // unset action handlers when focused, making them work like initially
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
      } else {
        navigator.mediaSession.setActionHandler('play', () => {});
        navigator.mediaSession.setActionHandler('pause', () => {});
      }
      // note that this kind of solution doesn't work for the stop key for some reason.
      // it seems to behave differently and it clears the entire session
    });
    return () => {
      ipc.removeAllListeners('window-focus-status');
    };
  }, []);

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

    if (!isDragging) {
      setProgress(event.playedSeconds);
    }
  };

  /**
   * Handle a click from the user on the progress slider by seeking to that
   * position.
   */
  const handleProgressSliderChange = (
    _event: Event,
    value: number | number[],
    index: number,
  ) => {
    if (Array.isArray(value)) {
      setClipStartValue(value[0]);
      setClipStopValue(value[2]);

      if (index === 1) {
        setProgress(value[1]);
      }
    }

    if (typeof value === 'number') {
      setProgress(value);
    }
  };

  const handleChangeCommitted = (
    _event: React.SyntheticEvent | Event,
    value: number | number[],
  ) => {
    setIsDragging(false);

    if (Array.isArray(value) && typeof value[1] == 'number') {
      players.forEach((player) => player.current?.seekTo(value[1], 'seconds'));
    }

    if (typeof value === 'number') {
      players.forEach((player) => player.current?.seekTo(value, 'seconds'));
    }
  };

  /**
   * Handle a mouse down event for the slider.
   */
  const onSliderMouseDown = () => {
    setIsDragging(true);

    if (multiPlayerMode) {
      // Force a pause in multi player mode to avoid any risk of video
      // desync or weird slider behaviour.
      numReady.current = 0;
      setSpinner(true);
      setPlaying(false);
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
   * Handle the onReady event. This is fired by each player when it is ready
   * to play, shortly after initial mount and also on completion of a seek.
   */
  const onReady = () => {
    numReady.current++;

    if (numReady.current < videos.length) {
      // Don't react until all the players have emitted a ready event.
      return;
    }

    setSpinner(false);

    if (duration === 0) {
      // We don't have a duration on the slider yet but the players
      // are ready so each must know. Apply it to the component state.
      const durations = players
        .map((p) => p.current)
        .filter((r): r is ReactPlayer => r !== null)
        .map((r) => r.getDuration());

      // Take the max duration of all videos, if we're in multiplayer
      // mode some might have an overrun longer than others so we want
      // the slider to represent the longest.
      const max = Math.max(...durations);
      setDuration(max);
    }
  };

  /**
   * A video player error. Maybe should pass this through to the actual
   * log file for debug sake? Occasionally see R2 give a 503 when loading
   * videos. Don't know why, and goes away on retry. Maybe can make that
   * retry happen automatically?
   */
  const onError = (e: unknown) => {
    console.log(e);
  };

  /**
   * Format the clip mode labels.
   */
  const getClipLabelFormat = (value: number, index: number) => {
    if (clipMode) {
      if (index === 0)
        return `${getLocalePhrase(language, Phrase.Start)} (${secToMmSs(value)})`;
      if (index === 1) return secToMmSs(value);
      if (index === 2)
        return `${getLocalePhrase(language, Phrase.End)} (${secToMmSs(value)})`;
    }

    return secToMmSs(value);
  };

  /**
   * Returns the progress slider for the video controls.
   */
  const renderProgressSlider = () => {
    const sx = clipMode ? getProgressClipSliderSx() : getProgressSliderSx();

    const value = clipMode
      ? [clipStartValue, progress, clipStopValue]
      : progress;

    const valueLabelFormat = clipMode ? getClipLabelFormat : secToMmSs;
    const valueLabelDisplay = clipMode ? 'on' : 'off';
    const marks = clipMode ? undefined : getMarks();

    return (
      <Slider
        ref={progressSlider}
        sx={sx}
        value={value}
        valueLabelFormat={valueLabelFormat}
        valueLabelDisplay={valueLabelDisplay}
        onChange={handleProgressSliderChange}
        onChangeCommitted={handleChangeCommitted}
        onMouseDown={onSliderMouseDown}
        max={duration}
        marks={marks}
        step={0.01}
      />
    );
  };

  /**
   * Returns the video player itself, passing through all necessary callbacks
   * and props for it to function and be controlled.
   */
  const renderPlayer = (src: MutableRefObject<string>, index: number) => {
    const primary = index === 0;
    const player = players[index];

    if (!player) {
      // Protect against stupid programmer errors.
      throw new Error('No player reference');
    }

    return (
      <ReactPlayer
        id="react-player"
        ref={player}
        height="100%"
        width="100%"
        key={src.current}
        url={src.current}
        style={style}
        playing={playing}
        volume={volume}
        muted={primary ? muted : true}
        playbackRate={playbackRate}
        progressInterval={progressInterval}
        onProgress={primary ? onProgress : undefined}
        onClick={togglePlaying}
        onDoubleClick={toggleFullscreen}
        onPlay={primary ? () => setPlaying(true) : undefined}
        onPause={primary ? () => setPlaying(false) : undefined}
        onReady={onReady}
        onError={onError}
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
    const max = duration;

    return (
      <div className="mx-1 flex">
        <span className="whitespace-nowrap text-foreground-lighter text-[11px] font-semibold font-mono">
          {secToMmSs(progress)} / {secToMmSs(max)}
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
      <Tooltip content={getLocalePhrase(language, Phrase.PlaybackSpeedTooltip)}>
        <Button
          variant="ghost"
          size="xs"
          onClick={handleRateChange}
          className="whitespace-nowrap text-foreground-lighter text-[11px] font-semibold font-mono"
        >
          {playbackRateText}
        </Button>
      </Tooltip>
    );
  };

  /**
   * Returns the playback rate button for the video controls.
   */
  const renderClipButton = () => {
    const color = clippable ? 'white' : 'rgba(239, 239, 240, 0.25)';
    const tooltip = clippable
      ? getLocalePhrase(language, Phrase.ClipTooltip)
      : getLocalePhrase(language, Phrase.ClipUnavailableTooltip);

    return (
      <Tooltip content={tooltip}>
        <div>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              setClipStartValue(Math.max(0, progress - 15));
              setClipStopValue(Math.min(duration, progress + 15));
              setClipMode(true);
            }}
            disabled={!clippable}
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
    const clipSource = videos[0].videoSource;

    ipc.sendMessage('clip', [clipSource, clipOffset, clipDuration]);
    setClipMode(false);
  };

  /**
   * Render the button to end the clipping session.
   */
  const renderClipFinishedButton = () => {
    return (
      <Tooltip content={getLocalePhrase(language, Phrase.ConfirmTooltip)}>
        <Button variant="ghost" size="xs" onClick={doClip}>
          <DoneIcon sx={{ color: 'white' }} />
        </Button>
      </Tooltip>
    );
  };

  const renderClipCancelButton = () => {
    return (
      <Tooltip content={getLocalePhrase(language, Phrase.CancelTooltip)}>
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
      <Tooltip content={getLocalePhrase(language, Phrase.FullScreenTooltip)}>
        <Button variant="ghost" size="xs" onClick={toggleFullscreen}>
          <FullscreenIcon sx={{ color: 'white' }} />
        </Button>
      </Tooltip>
    );
  };

  /**
   * Returns the timestamp marker navigation buttons
   */
  const renderTimestampMarkerButtons = () => {
    const hasMarkers = videos[0].timestampMarkers && videos[0].timestampMarkers.length > 0;
    const color = hasMarkers ? 'white' : 'rgba(239, 239, 240, 0.25)';
    const tooltip = hasMarkers
      ? getLocalePhrase(language, Phrase.TimestampMarkerNavigateTooltip)
      : getLocalePhrase(language, Phrase.NoTimestampMarkers);

    return (
      <div className="flex">
        <Tooltip content={tooltip}>
          <div>
            <Button
              variant="ghost"
              size="xs"
              onClick={navigateToPrevMarker}
              disabled={!hasMarkers}
            >
              <NavigateBeforeIcon sx={{ color, fontSize: '22px' }} />
            </Button>
          </div>
        </Tooltip>
        <Tooltip content={tooltip}>
          <div>
            <Button
              variant="ghost"
              size="xs"
              onClick={navigateToNextMarker}
              disabled={!hasMarkers}
            >
              <NavigateNextIcon sx={{ color, fontSize: '22px' }} />
            </Button>
          </div>
        </Tooltip>
      </div>
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
        sx={{ m: 1, width: '75px', ...sliderBaseSx }}
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
        {!clipMode && !isClip(videos[0]) && renderClipButton()}
        {!clipMode && renderPlaybackRateButton()}
        {!clipMode && renderTimestampMarkerButtons()}
        {!clipMode && renderFullscreenButton()}
        {clipMode && renderClipFinishedButton()}
        {clipMode && renderClipCancelButton()}
      </div>
    );
  };

  /**
   * Navigate to the next timestamp marker
   */
  const navigateToNextMarker = () => {
    if (!videos[0].timestampMarkers || videos[0].timestampMarkers.length === 0) {
      return;
    }

    const markers = [...videos[0].timestampMarkers].sort((a, b) => a.time - b.time);
    let nextIndex = currentMarkerIndex + 1;

    // If we're at the end, loop back to the beginning
    if (nextIndex >= markers.length) {
      nextIndex = 0;
    }

    setCurrentMarkerIndex(nextIndex);
    const nextMarker = markers[nextIndex];

    players.forEach((player) =>
      player.current?.seekTo(nextMarker.time, 'seconds'),
    );
  };

  /**
   * Navigate to the previous timestamp marker
   */
  const navigateToPrevMarker = () => {
    if (!videos[0].timestampMarkers || videos[0].timestampMarkers.length === 0) {
      return;
    }

    const markers = [...videos[0].timestampMarkers].sort((a, b) => a.time - b.time);
    let prevIndex = currentMarkerIndex - 1;

    // If we're at the beginning, loop to the end
    if (prevIndex < 0) {
      prevIndex = markers.length - 1;
    }

    setCurrentMarkerIndex(prevIndex);
    const prevMarker = markers[prevIndex];

    players.forEach((player) =>
      player.current?.seekTo(prevMarker.time, 'seconds'),
    );
  };

  /**
   * Handle a key down event. It would be nice to pass a "onKeyDown" react
   * callback to the player / controls box, but the player seems to swallow
   * such events, so instead we do this.
   */
  const handleKeyDown = (e: KeyboardEvent) => {
    const [primary] = players;

    if (!primary.current) {
      return;
    }

    if (e.key === 'k' || e.key === ' ') {
      togglePlaying();
      e.preventDefault();
    }

    if (e.key === 'j' || e.key === 'ArrowLeft') {
      const current = primary.current.getCurrentTime();

      players.forEach((player) =>
        player.current?.seekTo(current - 5, 'seconds'),
      );
    }

    if (e.key === 'l' || e.key === 'ArrowRight') {
      const current = primary.current.getCurrentTime();

      players.forEach((player) =>
        player.current?.seekTo(current + 5, 'seconds'),
      );
    }

    if (e.key === '.') {
      const current = primary.current.getCurrentTime();
      const frame = 1 / 30; // Assume 30fps, not the end of the world if we skip 2 frames.

      players.forEach((player) =>
        player.current?.seekTo(current + frame, 'seconds'),
      );
    }

    if (e.key === ',') {
      const current = primary.current.getCurrentTime();
      const frame = 1 / 30; // Assume 30fps, not the end of the world if we skip 2 frames.

      players.forEach((player) =>
        player.current?.seekTo(current - frame, 'seconds'),
      );
    }

    // Navigate between timestamp markers with [ and ]
    if (e.key === '[') {
      navigateToPrevMarker();
    }

    if (e.key === ']') {
      navigateToNextMarker();
    }
  };

  // Listener for keydown events when the player is open.
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  let playerDivClass = 'w-full ';

  if (srcs.length === 2) {
    playerDivClass += 'grid grid-cols-2 grid-rows-1';
  } else if (srcs.length === 3) {
    playerDivClass += 'grid grid-cols-2 grid-rows-2';
  } else if (srcs.length === 4) {
    playerDivClass += 'grid grid-cols-2 grid-rows-2';
  }

  return (
    <>
      <Box
        id="player-and-controls"
        sx={{
          width: '100%',
          height: '100%',
        }}
      >
        <div className={playerDivClass} style={{ height: 'calc(100% - 40px)' }}>
          {srcs.map(renderPlayer)}
          <Backdrop
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: '40px',
              zIndex: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
            }}
            open={spinner}
          >
            <CircularProgress color="inherit" />
          </Backdrop>
        </div>

        {renderControls()}
      </Box>
    </>
  );
};

export default VideoPlayer;
