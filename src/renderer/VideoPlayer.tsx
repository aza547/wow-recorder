import { RendererVideo, VideoPlayerSettings } from 'main/types';
import { useEffect, useRef, useState } from 'react';
import { ConfigurationSchema } from 'main/configSchema';
import { Box, Button, Slider, Typography } from '@mui/material';
import { Resizable } from 're-resizable';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeDownIcon from '@mui/icons-material/VolumeDown';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeMuteIcon from '@mui/icons-material/VolumeMute';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import { OnProgressProps } from 'react-player/base';
import FilePlayer from 'react-player/file';
import screenfull from 'screenfull';
import { secToMmSs } from './rendererutils';

interface IProps {
  video: RendererVideo;
  config: ConfigurationSchema;
}

const ipc = window.electron.ipcRenderer;
const playbackRates = [0.25, 0.5, 1, 2];
const style = { backgroundColor: 'black' };
const progressInterval = 10;

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

  // const markerDivs: React.MutableRefObject<HTMLDivElement[]> = React.useRef([]);

  // /**
  //  * Remove any existing timeline markers, then collate a list of all the
  //  * markers based on the category and current config.
  //  *
  //  * Finally, add the markers to the timelime. This code is not very reacty, I
  //  * blame VideoJS.
  //  *
  //  * We pass cfg in here as an argument to prevent remembering old state. I
  //  * don't really understand why that is required.
  //  */
  // const processMarkers = () => {
  //   markerDivs.current.forEach(removeMarkerDiv);
  //   markerDivs.current = [];

  //   const progressBar = document.querySelector('.vjs-progress-holder');

  //   if (
  //     !playerRef.current ||
  //     !progressBar ||
  //     Number.isNaN(playerRef.current.duration())
  //   ) {
  //     return;
  //   }

  //   const duration = playerRef.current.duration();
  //   const { width } = progressBar.getBoundingClientRect();
  //   const deathMarkerConfig = convertNumToDeathMarkers(config.deathMarkers);

  //   if (deathMarkerConfig === DeathMarkers.ALL) {
  //     getAllDeathMarkers(video)
  //       .map((m) => getMarkerDiv(m, duration, width))
  //       .forEach((m) => markerDivs.current.push(m));
  //   } else if (deathMarkerConfig === DeathMarkers.OWN) {
  //     getOwnDeathMarkers(video)
  //       .map((m) => getMarkerDiv(m, duration, width))
  //       .forEach((m) => markerDivs.current.push(m));
  //   }

  //   const isMythicPlus = video.category === VideoCategory.MythicPlus;

  //   if (isMythicPlus && config.encounterMarkers) {
  //     getEncounterMarkers(video)
  //       .map((m) => getMarkerDiv(m, duration, width))
  //       .forEach((m) => markerDivs.current.push(m));
  //   }

  //   const isSoloShuffle = video.category === VideoCategory.SoloShuffle;

  //   if (isSoloShuffle && config.roundMarkers) {
  //     getRoundMarkers(video)
  //       .map((m) => getMarkerDiv(m, duration, width))
  //       .forEach((m) => markerDivs.current.push(m));
  //   }

  //   markerDivs.current.forEach((m) => addMarkerDiv(m));
  // };

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
  const handleProgressBarClick = (_event: Event, value: number | number[]) => {
    if (typeof value === 'number' && player.current) {
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
   * Handle the onReady event, this is fired when the video player is ready
   * to play. It's used to update the total duration which we won't know
   * before.
   */
  const onReady = () => {
    if (!player.current) {
      return;
    }

    const durationSec = player.current.getDuration();
    setDuration(durationSec);
  };

  /**
   * Returns the progress slider for the video controls.
   */
  const renderProgressSlider = () => {
    return (
      <Slider
        sx={{ m: 2, width: '100%', ...sliderSx }}
        valueLabelDisplay="auto"
        valueLabelFormat={secToMmSs}
        value={progress * duration}
        onChange={handleProgressBarClick}
        max={duration}
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
        height="calc(100% - 36.5px)"
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
      <Button sx={{ color: 'white' }} onClick={handleRateChange}>
        {playbackRateText}
      </Button>
    );
  };

  /**
   * Returns the fullscreen button for the video controls.
   */
  const renderFullscreenButton = () => {
    return (
      <Button sx={{ color: 'white' }} onClick={toggleFullscreen}>
        <FullscreenIcon sx={{ color: 'white' }} />
      </Button>
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
          height: '36.5px',
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
        {renderPlaybackRateButton()}
        {renderFullscreenButton()}
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
