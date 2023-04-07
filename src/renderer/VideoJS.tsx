import { VideoPlayerSettings } from 'main/types';
import React from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import 'videojs-markers/dist/videojs-markers';
import 'videojs-markers/dist/videojs.markers.css';
import Player from 'video.js/dist/types/player';
import { addVideoMarkers } from './rendererutils';

interface IProps {
  // eslint-disable-next-line react/no-unused-prop-types
  id: string;
  // eslint-disable-next-line react/no-unused-prop-types
  key: string;
  video: any;
}

const ipc = window.electron.ipcRenderer;

export const VideoJS = (props: IProps) => {
  const videoRef: any = React.useRef(null);
  const playerRef: any = React.useRef(null);
  const { video } = props;

  /**
   * Get video player settings initially when the component is loaded. We store
   * as a variable in main rather than in config It's fine if this is lost when
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

  /**
   * Add the markers when the video player is ready.
   */
  const onVideoPlayerReady = (player: Player) => {
    addVideoMarkers(video, player);
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
        onVideoPlayerReady(playerRef.current);
      });

      playerRef.current.on('volumechange', () => {
        handleVideoPlayerVolumeChange(
          playerRef.current.volume(),
          playerRef.current.muted()
        );
      });
    }
  }, []);

  React.useEffect(() => {
    return () => {
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [playerRef]);

  return (
    <div data-vjs-player className="video-container">
      <div ref={videoRef} className="video" />
    </div>
  );
};

export default VideoJS;
