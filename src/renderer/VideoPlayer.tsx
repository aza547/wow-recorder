import {
  DeathMarkers,
  RendererVideo,
  SliderMark,
  VideoMarker,
  VideoPlayerSettings,
} from 'main/types';
import { useEffect, useRef, useState } from 'react';
import { ConfigurationSchema } from 'main/configSchema';
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
import FilePlayer from 'react-player/file';
import screenfull from 'screenfull';
import { VideoCategory } from 'types/VideoCategory';
import DeathIcon from '../../assets/icon/death.png';
import {
  convertNumToDeathMarkers,
  getAllDeathMarkers,
  getEncounterMarkers,
  getOwnDeathMarkers,
  getRoundMarkers,
  isClipUtil,
  isMythicPlusUtil,
  isSoloShuffleUtil,
  secToMmSs,
} from './rendererutils';

interface IProps {
  video: RendererVideo;
  config: ConfigurationSchema;
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
  const { video, config } = props;
  const url = video.fullPath;

  const player = useRef<FilePlayer>(null);

  const [playing, setPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [duration, setDuration] = useState<number>(0);
  const [clipMode, setClipMode] = useState<boolean>(false);
  const [clipStartValue, setClipStartValue] = useState<number>(0);
  const [clipStopValue, setClipStopValue] = useState<number>(100);

  // Read and store the video player state of 'volume' and 'muted' so that we may
  // restore it when selecting a different video. This config gets stored as a
  // variable in the main process that we update and retrieve, but is not written
  // to config so is lost on app restart.
  const videoPlayerSettings = ipc.sendSync('videoPlayerSettings', [
    'get',
  ]) as VideoPlayerSettings;

  const [volume, setVolume] = useState<number>(videoPlayerSettings.volume);
  const [muted, setMuted] = useState<boolean>(videoPlayerSettings.muted);

  // Inform the main process of a volume or muted state change.
  useEffect(() => {
    const soundSettings: VideoPlayerSettings = { volume, muted };
    ipc.sendMessage('videoPlayerSettings', ['set', soundSettings]);
  }, [volume, muted]);

  //         hotkeys: {
  //           seekStep: 10,
  //           enableModifiersForNumbers: false,
  //           forwardKey(event: { code: string }) {
  //             return event.code === 'KeyL' || event.code === 'ArrowRight';
  //           },
  //           rewindKey(event: { code: string }) {
  //             return event.code === 'KeyJ' || event.code === 'ArrowLeft';
  //           },
  //           playPauseKey(event: { code: string }) {
  //             return event.code === 'KeyK' || event.code === 'Space';
  //           },
  //         },
  //       },

  const getDeathMark = (marker: VideoMarker): SliderMark => {
    return {
      value: marker.time,
      label: (
        <Tooltip title={marker.text}>
          <Box
            component="img"
            src={DeathIcon}
            sx={{
              p: '2px',
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

    if (!player.current || duration === 0 || isClipUtil(video)) {
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

    // if (isMythicPlusUtil(video) && config.encounterMarkers) {
    //   getEncounterMarkers(video);
    // }

    // if (isSoloShuffleUtil(video) && config.roundMarkers) {
    //   getRoundMarkers(video);
    // }

    return marks;
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
    setProgress(event.played);
  };

  /**
   * Handle a click from the user on the progress slider by seeking to that
   * position.
   */
  const handleProgressBarChange = (
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
              },
              "&[data-index='1']": {
                backgroundColor: 'white',
              },
              "&[data-index='2']": {
                backgroundColor: 'white',
                width: '5px',
                height: '20px',
                borderRadius: 0,
              },
            },
          }}
          valueLabelDisplay="on"
          valueLabelFormat={getLabel}
          value={thumbValues}
          onChange={handleProgressBarChange}
          max={duration}
          disableSwap
        />
      );
    }

    return (
      <Slider
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
            height: '10px',
          },
        }}
        valueLabelDisplay="auto"
        valueLabelFormat={secToMmSs}
        value={current}
        onChange={handleProgressBarChange}
        max={duration}
        marks={getMarks()}
      />
    );
  };

  /**
   * Returns the video player itself, passing through all necessary callbacks
   * and props for it to function and be controlled.
   */
  const renderFilePlayer = () => {
    return (
      <FilePlayer
        id="file-player"
        ref={player}
        height="calc(100% - 45px)"
        width="100%"
        url={url}
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
    return (
      <Tooltip title="Clip">
        <Button sx={{ color: 'white' }} onClick={() => setClipMode(true)}>
          <MovieIcon sx={{ color: 'white', height: '20px' }} />
        </Button>
      </Tooltip>
    );
  };

  /**
   * Make a request to the main process to clip a video.
   */
  const doClip = () => {
    const clipDuration = clipStopValue - clipStartValue;
    const clipOffset = clipStartValue;
    const clipSource = video.fullPath;

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
    const isClips = video.category === VideoCategory.Clips;

    return (
      <Box
        sx={{
          width: '100%',
          height: '45px',
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
        {!clipMode && !isClips && renderClipButton()}
        {!clipMode && renderPlaybackRateButton()}
        {!clipMode && renderFullscreenButton()}
        {clipMode && renderClipFinishedButton()}
        {clipMode && renderClipCancelButton()}
      </Box>
    );
  };

  return (
    <>
      <Resizable
        defaultSize={{
          height: '50%',
          width: '100%',
        }}
        enable={{ bottom: true }}
        bounds="parent"
      >
        <Box
          id="player-and-controls"
          sx={{
            width: '100%',
            height: '100%',
          }}
        >
          {renderFilePlayer()}
          {renderControls()}
        </Box>
      </Resizable>
    </>
  );
};

export default VideoPlayer;
