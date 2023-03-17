import React from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

export const VideoJS = (props) => {
  const videoRef: any = React.useRef(null);
  const playerRef: any = React.useRef(null);
  const { options, onVolumeChange, onReady, volume, muted } = props;

  React.useEffect(() => {
    if (!playerRef.current) {
      const videoElement = document.createElement('video-js');
      videoElement.classList.add('vjs-big-play-centered');
      videoRef.current.appendChild(videoElement);

      playerRef.current = videojs(videoElement, options);

      playerRef.current.on('ready', () => {
        playerRef.current.muted(muted);
        playerRef.current.volume(volume);
        onReady(playerRef.current);
      });

      playerRef.current.on('volumechange', () => {
        onVolumeChange(playerRef.current.volume(), playerRef.current.muted());
      });
    }
  }, [muted, onReady, onVolumeChange, options, videoRef, volume]);

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
