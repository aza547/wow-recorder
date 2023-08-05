import {
  DeathMarkers,
  RendererVideo,
  TAppState,
  VideoPlayerSettings,
} from 'main/types';
import React from 'react';
import videojs from 'video.js';
import 'videojs-hotkeys';
import 'video.js/dist/video-js.css';
import { ConfigurationSchema } from 'main/configSchema';
import { VideoCategory } from 'types/VideoCategory';
import {
  addMarkerDiv,
  convertNumToDeathMarkers,
  getAllDeathMarkers,
  getEncounterMarkers,
  getMarkerDiv,
  getOwnDeathMarkers,
  getRoundMarkers,
  removeMarkerDiv,
} from './rendererutils';

interface IProps {
  // eslint-disable-next-line react/no-unused-prop-types
  id: string;
  // eslint-disable-next-line react/no-unused-prop-types
  key: string;
  video: RendererVideo;
  setAppState: React.Dispatch<React.SetStateAction<TAppState>>;
  config: ConfigurationSchema;
}

const ipc = window.electron.ipcRenderer;

export const VideoJS = (props: IProps) => {
  const { video, setAppState, config } = props;
  const videoRef: any = React.useRef(null);
  const playerRef: any = React.useRef(null);
  const markerDivs: React.MutableRefObject<HTMLDivElement[]> = React.useRef([]);

  // This is a bit sneaky, but we create a dummy state variable to give us a
  // mechanism to force react to re-render on demand, which we use to apply
  // marker config changes.
  const [, forceReRender] = React.useState<number>(0);

  /**
   * Remove any existing timeline markers, then collate a list of all the
   * markers based on the category and current config.
   *
   * Finally, add the markers to the timelime. This code is not very reacty, I
   * blame VideoJS.
   *
   * We pass cfg in here as an argument to prevent remembering old state. I
   * don't really understand why that is required.
   */
  const processMarkers = () => {
    markerDivs.current.forEach(removeMarkerDiv);
    markerDivs.current = [];

    const progressBar = document.querySelector('.vjs-progress-holder');

    if (
      !playerRef.current ||
      !progressBar ||
      Number.isNaN(playerRef.current.duration())
    ) {
      return;
    }

    const duration = playerRef.current.duration();
    const { width } = progressBar.getBoundingClientRect();
    const deathMarkerConfig = convertNumToDeathMarkers(config.deathMarkers);

    if (deathMarkerConfig === DeathMarkers.ALL) {
      getAllDeathMarkers(video)
        .map((m) => getMarkerDiv(m, duration, width))
        .forEach((m) => markerDivs.current.push(m));
    } else if (deathMarkerConfig === DeathMarkers.OWN) {
      getOwnDeathMarkers(video)
        .map((m) => getMarkerDiv(m, duration, width))
        .forEach((m) => markerDivs.current.push(m));
    }

    const isMythicPlus = video.category === VideoCategory.MythicPlus;

    if (isMythicPlus && config.encounterMarkers) {
      getEncounterMarkers(video)
        .map((m) => getMarkerDiv(m, duration, width))
        .forEach((m) => markerDivs.current.push(m));
    }

    const isSoloShuffle = video.category === VideoCategory.SoloShuffle;

    if (isSoloShuffle && config.roundMarkers) {
      getRoundMarkers(video)
        .map((m) => getMarkerDiv(m, duration, width))
        .forEach((m) => markerDivs.current.push(m));
    }

    markerDivs.current.forEach((m) => addMarkerDiv(m));
  };

  /**
   * Get video player settings initially when the component is loaded. We store
   * as a variable in main rather than in config. It's fine if this is lost when
   * the app is restarted.
   */
  const videoPlayerSettings = ipc.sendSync('videoPlayerSettings', [
    'get',
  ]) as VideoPlayerSettings;

  /**
   * Read and store the video player state of 'volume' and 'muted' so that we may
   * restore it when selecting a different video.
   */
  const handleVideoPlayerVolumeChange = (volume: number, muted: boolean) => {
    const soundSettings: VideoPlayerSettings = { volume, muted };
    ipc.sendMessage('videoPlayerSettings', ['set', soundSettings]);
  };

  React.useEffect(() => {
    if (!playerRef.current) {
      const videoElement = document.createElement('video-js');
      videoElement.classList.add('vjs-big-play-centered');
      videoRef.current.appendChild(videoElement);

      const options = {
        controls: true,
        responsive: true,
        preload: 'auto',
        fill: true,
        inactivityTimeout: 0,
        playbackRates: [0.25, 0.5, 1, 1.5, 2],
        plugins: {
          hotkeys: {
            seekStep: 10,
            enableModifiersForNumbers: false,
            forwardKey(event: { code: string }) {
              return event.code === 'KeyL' || event.code === 'ArrowRight';
            },
            rewindKey(event: { code: string }) {
              return event.code === 'KeyJ' || event.code === 'ArrowLeft';
            },
            playPauseKey(event: { code: string }) {
              return event.code === 'KeyK' || event.code === 'Space';
            },
          },
        },
        sources: [
          {
            src: video.fullPath,
            type: 'video/mp4',
          },
        ],
      };

      playerRef.current = videojs(videoElement, options);

      playerRef.current.on('ready', () => {
        playerRef.current.muted(videoPlayerSettings.muted);
        playerRef.current.volume(videoPlayerSettings.volume);
      });

      playerRef.current.on('volumechange', () => {
        handleVideoPlayerVolumeChange(
          playerRef.current.volume(),
          playerRef.current.muted()
        );
      });

      playerRef.current.on('play', () => {
        forceReRender((n) => n + 1);
      });

      playerRef.current.on('playerresize', () => {
        forceReRender((n) => n + 1);
      });

      playerRef.current.on('fullscreenchange', () => {
        setAppState((prevState) => {
          return {
            ...prevState,
            videoFullScreen: playerRef.current.isFullscreen(),
          };
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    return () => {
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [playerRef]);

  processMarkers();

  return (
    <div data-vjs-player className="video-container">
      <div ref={videoRef} className="video" />
    </div>
  );
};

export default VideoJS;
