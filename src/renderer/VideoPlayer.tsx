import {
  AppState,
  DeathMarkers,
  RendererVideo,
  SliderMark,
  StorageFilter,
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
import { OnProgressProps } from 'react-player/base';
import ReactPlayer from 'react-player';
import screenfull from 'screenfull';
import { ConfigurationSchema } from 'config/configSchema';
import { getLocalePhrase } from 'localisation/translations';
import DeathIcon from '../../assets/icon/death.png';
import { ExcalidrawElement } from '@excalidraw/excalidraw/dist/types/excalidraw/element/types';
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
import { DrawingOverlay } from './components/DrawingOverlay/DrawingOverlay';
import {
  CloudDownload,
  CloudUpload,
  FolderOpen,
  Link,
  Pencil,
} from 'lucide-react';
import CloudIcon from '@mui/icons-material/Cloud';
import SaveIcon from '@mui/icons-material/Save';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import Separator from './components/Separator/Separator';
import { toast } from './components/Toast/useToast';
import { Phrase } from 'localisation/phrases';

interface IProps {
  videos: RendererVideo[];
  categoryState: RendererVideo[];
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
  const {
    videos,
    persistentProgress,
    config,
    appState,
    setAppState,
    categoryState,
  } = props;

  const { playing, multiPlayerMode, language, selectedVideos, storageFilter } =
    appState;

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
  const local = !videos[0].cloud;
  const clippable = !multiPlayerMode && local;

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

  const [isDrawingEnabled, setIsDrawingEnabled] = useState(false);
  const [, setDrawingElements] = useState<readonly ExcalidrawElement[]>([]);

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
    console.error('Video Player Error', e);
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
    const valueLabelDisplay = clipMode ? 'on' : 'auto';
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
        onKeyDown={(e) => {
          // Don't have keys interact with the slider directly. This lets
          // arrow keys seek as if the video player is in focus.
          e.preventDefault();
        }}
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

    const safe = src.current.startsWith('https://')
      ? src.current
      : `vod://wcr/${src.current}`;

    return (
      <ReactPlayer
        id="react-player"
        ref={player}
        height="100%"
        width="100%"
        key={src.current}
        url={safe}
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
   * Message the backend to download a video.
   */
  const downloadVideo = async () => {
    if (!cloudVideo) return;
    ipc.sendMessage('videoButton', ['download', cloudVideo]);
  };

  /**
   * Message the backend to upload a video.
   */
  const uploadVideo = async () => {
    if (!diskVideo) return;
    ipc.sendMessage('videoButton', ['upload', diskVideo.videoSource]);
  };

  /**
   * Render the download button.
   */
  const renderDownloadButton = () => {
    const disabled = storageFilter !== StorageFilter.BOTH;
    const tooltip = disabled
      ? getLocalePhrase(language, Phrase.DownloadUploadDisabledDueToFilter)
      : getLocalePhrase(language, Phrase.DownloadButtonTooltip);

    return (
      <Tooltip content={tooltip}>
        <div>
          <Button
            onClick={downloadVideo}
            variant="ghost"
            size="xs"
            disabled={disabled}
          >
            <CloudDownload size={20} />
          </Button>
        </div>
      </Tooltip>
    );
  };

  /**
   * Render the upload button.
   */
  const renderUploadButton = () => {
    const disabled = storageFilter !== StorageFilter.BOTH;
    const tooltip = disabled
      ? getLocalePhrase(language, Phrase.DownloadUploadDisabledDueToFilter)
      : getLocalePhrase(language, Phrase.UploadButtonTooltip);

    return (
      <Tooltip content={tooltip}>
        <div>
          <Button
            onClick={uploadVideo}
            variant="ghost"
            size="xs"
            disabled={disabled}
          >
            <CloudUpload size={20} />
          </Button>
        </div>
      </Tooltip>
    );
  };

  /**
   * Return the no cloud icon.
   */
  const getNoCloudIcon = () => {
    return (
      <Button disabled variant="ghost" size="xs">
        <CloudOffIcon sx={{ height: '20px', width: '20px' }} />
      </Button>
    );
  };

  const n = videos[0].videoName;
  const nameMatches = categoryState
    .flatMap((v) => [v, ...v.multiPov])
    .filter((v) => v.videoName === n);

  const cloudVideo = nameMatches.find((v) => v.cloud);
  const diskVideo = nameMatches.find((v) => !v.cloud);

  /**
   * Set the selected videos.
   */
  const setSelectedVideos = (v: RendererVideo | undefined) => {
    if (!v) {
      return;
    }

    const sameActivity = selectedVideos[0]?.uniqueHash === v.uniqueHash;

    if (!sameActivity) {
      persistentProgress.current = 0;
    }

    setAppState((prevState) => {
      const playing = sameActivity ? prevState.playing : false;

      return {
        ...prevState,
        selectedVideos: [v],
        multiPlayerMode: false,
        playing,
      };
    });
  };

  /**
   * Return the cloud icon.
   */
  const getCloudIcon = () => {
    const isSelected = cloudVideo?.uniqueId === videos[0].uniqueId;
    const color = cloudVideo ? 'white' : 'gray';
    const opacity = isSelected ? 1 : 0.3;

    if (!cloudVideo && !config.cloudUpload) {
      return getNoCloudIcon();
    }

    if (!cloudVideo && config.cloudUpload) {
      return renderUploadButton();
    }

    return (
      <Tooltip content={getLocalePhrase(language, Phrase.CloudButtonTooltip)}>
        <Button
          disabled={!cloudVideo}
          onClick={() => setSelectedVideos(cloudVideo)}
          variant="ghost"
          size="xs"
        >
          <CloudIcon sx={{ height: '20px', width: '20px', color, opacity }} />
        </Button>
      </Tooltip>
    );
  };

  /**
   * Return the disk icon.
   */
  const getDiskIcon = () => {
    const isSelected = diskVideo?.uniqueId === videos[0].uniqueId;
    const color = diskVideo ? 'white' : 'gray';
    const opacity = isSelected ? 1 : 0.3;

    if (!diskVideo && cloudVideo) {
      return renderDownloadButton();
    }

    return (
      <Tooltip content={getLocalePhrase(language, Phrase.DiskButtonTooltip)}>
        <Button
          value="disk"
          disabled={!diskVideo}
          onClick={() => setSelectedVideos(diskVideo)}
          variant="ghost"
          size="xs"
        >
          <SaveIcon sx={{ height: '20px', width: '20px', color, opacity }} />
        </Button>
      </Tooltip>
    );
  };

  const renderVideoSourceToggle = () => {
    return (
      <div className="flex flex-row items-center">
        {getCloudIcon()}
        {getDiskIcon()}
      </div>
    );
  };

  /**
   * Open the folder containing the video.
   */
  const openLocation = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    if (!diskVideo) return;

    window.electron.ipcRenderer.sendMessage('videoButton', [
      'open',
      diskVideo.videoSource,
      false,
    ]);
  };

  /**
   * Render the open folder button.
   */
  const renderOpenFolderButton = () => {
    return (
      <Tooltip
        content={getLocalePhrase(language, Phrase.OpenFolderButtonTooltip)}
      >
        <div>
          <Button
            variant="ghost"
            size="xs"
            onClick={openLocation}
            disabled={!clippable}
          >
            <FolderOpen size={20} color="white" />
          </Button>
        </div>
      </Tooltip>
    );
  };

  /**
   * Get a shareable URL for the video.
   */
  const getShareableLink = async (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();
    if (!cloudVideo) return;

    try {
      await ipc.invoke('getShareableLink', [cloudVideo.videoName]);
      toast({
        title: getLocalePhrase(appState.language, Phrase.ShareableLinkTitle),
        description: getLocalePhrase(
          appState.language,
          Phrase.ShareableLinkText,
        ),
        duration: 5000,
      });
    } catch {
      toast({
        title: getLocalePhrase(
          appState.language,
          Phrase.ShareableLinkFailedTitle,
        ),
        description: getLocalePhrase(
          appState.language,
          Phrase.ShareableLinkFailedText,
        ),
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  /**
   * Render the get link button.
   */
  const renderGetLinkButton = () => {
    return (
      <Tooltip
        content={getLocalePhrase(language, Phrase.ShareLinkButtonTooltip)}
      >
        <div>
          <Button variant="ghost" size="xs" onClick={getShareableLink}>
            <Link size={20} color="white" />
          </Button>
        </div>
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

  /**
   * Render the cancel clipping mode button.
   */
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
        valueLabelDisplay="auto"
        onKeyDown={(e) => {
          e.preventDefault();
        }}
      />
    );
  };

  /**
   * Returns the drawing button for the video controls.
   */
  const renderDrawingButton = () => (
    <Tooltip content={getLocalePhrase(language, Phrase.ToggleDrawingMode)}>
      <Button
        variant="ghost"
        size="xs"
        onClick={() => setIsDrawingEnabled(!isDrawingEnabled)}
      >
        <Pencil size={20} color="white" opacity={isDrawingEnabled ? 1 : 0.2} />
      </Button>
    </Tooltip>
  );

  /**
   * Returns the entire video control component.
   */
  const renderControls = () => {
    return (
      <div className="w-full h-10 flex flex-row justify-center items-center bg-background-dark-gradient-to border border-background-dark-gradient-to px-1 py-2 rounded-br-sm">
        {renderPlayPause()}
        {renderVolumeButton()}
        {renderVolumeSlider()}
        {renderProgressSlider()}
        {renderProgressText()}
        {!multiPlayerMode && !clipMode && (
          <Separator className="mx-2" orientation="vertical" />
        )}
        {!multiPlayerMode && !clipMode && renderVideoSourceToggle()}
        {!multiPlayerMode && !clipMode && (
          <Separator className="mx-2" orientation="vertical" />
        )}
        {renderDrawingButton()}
        {!multiPlayerMode && !clipMode && local && renderOpenFolderButton()}
        {!multiPlayerMode && !clipMode && !local && renderGetLinkButton()}
        {!clipMode && !isClip(videos[0]) && renderClipButton()}
        {!multiPlayerMode && !clipMode && (
          <Separator className="mx-2" orientation="vertical" />
        )}
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
    ipc.on('pausePlayer', () => setPlaying(false));

    return () => {
      ipc.removeAllListeners('pausePlayer');
    };
  }, [setPlaying]);

  let playerDivClass = 'w-full h-full ';

  if (srcs.length === 2) {
    playerDivClass += 'grid grid-cols-2 grid-rows-1';
  } else if (srcs.length === 3) {
    playerDivClass += 'grid grid-cols-2 grid-rows-2';
  } else if (srcs.length === 4) {
    playerDivClass += 'grid grid-cols-2 grid-rows-2';
  }

  const renderDrawingOverlay = () => {
    return (
      <div className="absolute top-0 left-0 w-full h-full">
        <DrawingOverlay
          isDrawingEnabled={isDrawingEnabled}
          onDrawingChange={setDrawingElements}
          appState={appState}
        />
      </div>
    );
  };

  return (
    <div id="player-and-controls" className="w-full h-full">
      <div style={{ height: 'calc(100% - 40px)' }}>
        <div className="w-full h-full relative">
          <div className={playerDivClass}>{srcs.map(renderPlayer)}</div>
          {isDrawingEnabled && renderDrawingOverlay()}
        </div>
      </div>

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

      {renderControls()}
    </div>
  );
};

export default VideoPlayer;
