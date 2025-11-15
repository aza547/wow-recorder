import { useEffect, useState } from 'react';
import ReactPlayer from 'react-player';

const ipc = window.electron.ipcRenderer;

export default function LivePlayer() {
  const [video, setVideo] = useState<string>('');

  useEffect(() => {
    const getVideo = async () => {
      const videoName = await ipc.invoke('getLiveVideoName', []);
      setVideo(videoName);
    };

    getVideo();
  }, []);

  const safe = `vod://wcr/${video}`;

  return (
    <video src={safe} controls></video>
    // <ReactPlayer
    //   id="react-player"
    //   // ref={player}
    //   height="100%"
    //   width="100%"
    //   key={safe}
    //   url={safe}
    //   // style={style}
    //   // playing={playing}
    //   // volume={volume}
    //   // muted={primary ? muted : true}
    //   // playbackRate={playbackRate}
    //   // progressInterval={progressInterval}
    //   // onProgress={primary ? onProgress : undefined}
    //   // onClick={togglePlaying}
    //   // onDoubleClick={toggleFullscreen}
    //   // onPlay={primary ? () => setPlaying(true) : undefined}
    //   // onPause={primary ? () => setPlaying(false) : undefined}
    //   // onReady={onReady}
    //   // onError={onError}
    // />
  );
}
