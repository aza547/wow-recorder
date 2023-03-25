import * as React from 'react';
import Box from '@mui/material/Box';
import { TNavigatorState, VideoPlayerSettings } from 'main/types';
import { getConfigValue, setConfigValue } from 'settings/useSettings';

import {
  DialogContentText,
  List,
  ListItem,
  ListItemButton,
} from '@mui/material';

import { CopyBlock, dracula } from 'react-code-blocks';
import Player from 'video.js/dist/types/player';
import { VideoJS } from './VideoJS';
import { VideoCategory } from '../types/VideoCategory';
import VideoButton from './VideoButton';
import InformationDialog from './InformationDialog';
import LogButton from './LogButton';
import DiscordButton from './DiscordButton';
import { addVideoMarkers } from './rendererutils';
import HomePage from './HomePage';

interface IProps {
  navigation: TNavigatorState;
  setNavigationState: React.Dispatch<React.SetStateAction<TNavigatorState>>;
}

/**
 * For shorthand referencing.
 */
const ipc = window.electron.ipcRenderer;

/**
 * Get video player settings initially when the component is loaded. We store
 * as a variable in main rather than in config It's fine if this is lost when
 * the app is restarted.
 */
const videoPlayerSettings = ipc.sendSync('videoPlayerSettings', [
  'get',
]) as VideoPlayerSettings;

const selectedCategory = getConfigValue<number>('selectedCategory');
let videoState: { [key: string]: any } = {};

/**
 * The GUI itself.
 */
const Layout: React.FC<IProps> = (props: IProps) => {
  const { navigation, setNavigationState } = props;
  const { categoryIndex, videoIndex } = navigation;

  const videoPlayerRef: any = React.useRef(null);

  const [state, setState] = React.useState({
    autoPlay: false,
    videoState,
    videoMuted: videoPlayerSettings.muted,
    videoVolume: videoPlayerSettings.volume, // (Double) 0.00 - 1.00
    videoSeek: 0,
    fatalError: false,
    fatalErrorText: '',
  });

  const categories = Object.values(VideoCategory);
  const category = categories[categoryIndex];

  /**
   * Used so we can have a handle to the player for things like seeking.
   */
  const onVideoPlayerReady = (player: Player) => {
    videoPlayerRef.current = player;

    // Don't want to try call addVideoMarkers before we've loaded the
    // video state.
    if (state.videoState[category]) {
      const video = state.videoState[category][videoIndex];
      addVideoMarkers(video, player);
    }
  };

  /**
   * Read and store the video player state of 'volume' and 'muted' so that we may
   * restore it when selecting a different video.
   */
  const handleVideoPlayerVolumeChange = (volume: number, muted: boolean) => {
    state.videoVolume = volume;
    state.videoMuted = muted;
    const soundSettings: VideoPlayerSettings = { volume, muted };
    ipc.sendMessage('videoPlayerSettings', ['set', soundSettings]);
  };

  /**
   * Seek to a point in the video.
   */
  const videoSeek = (sec: number) => {
    if (videoPlayerRef.current) {
      videoPlayerRef.current.currentTime(sec);
    }
  };

  /**
   * Update the state variable following a change of selected video.
   */
  const handleChangeVideo = (index: number) => {
    setNavigationState((prevState) => {
      return {
        ...prevState,
        videoIndex: index,
      };
    });
  };

  // This is effectively equivalent to componentDidMount() in
  // React Component classes
  React.useEffect(
    () => {
      /**
       * Refresh handler.
       */
      ipc.on('refreshState', async () => {
        videoState = await ipc.invoke('getVideoState', []);

        setState((prevState) => {
          return {
            ...prevState,
            autoPlay: false,
            videoState,
          };
        });
      });

      ipc.on('fatalError', async (stack) => {
        setState((prevState) => {
          return {
            ...prevState,
            fatalError: true,
            fatalErrorText: stack as string,
          };
        });
      });

      /**
       * Attach listener for seeking in the video on load/unload
       */
      ipc.on('seekVideo', (vIndex, vSeekTime) => {
        // @@@ TODO fix this
      });
    },
    // From React documentation:
    //
    // > It's important to note the empty array as second argument for the
    // > Effect Hook which makes sure to trigger the effect only on component
    // > load (mount) and component unload (unmount).
    []
  );

  React.useEffect(() => {
    videoSeek(state.videoSeek);
  }, [state.videoSeek]);

  /**
   * Returns a video panel with videos.
   */
  const getVideoPanel = () => {
    const { autoPlay } = state;
    const video = state.videoState[category][videoIndex];
    const videoFullPath = video.fullPath;

    const videoJsOptions = {
      autoplay: autoPlay,
      controls: true,
      responsive: true,
      preload: 'auto',
      fill: true,
      inactivityTimeout: 0,
      playbackRates: [0.25, 0.5, 1, 1.5, 2],
      sources: [
        {
          src: videoFullPath,
          type: 'video/mp4',
        },
      ],
    };

    return (
      <>
        <Box sx={{ display: 'flex', height: 'calc(100% - 70px)' }}>
          <VideoJS
            id="video-player"
            key={videoFullPath}
            options={videoJsOptions}
            onVolumeChange={handleVideoPlayerVolumeChange}
            volume={state.videoVolume}
            muted={state.videoMuted}
            onReady={onVideoPlayerReady}
          />
        </Box>
      </>
    );
  };

  const getVideoSelection = () => {
    const categoryState = state.videoState[category];

    return (
      <>
        <Box
          sx={{
            display: 'flex',
            height: 'calc(100% - 70px)',
            overflowY: 'scroll',
          }}
        >
          <List>
            {categoryState &&
              categoryState.map((video: any) => {
                return (
                  <ListItem disablePadding key={video.fullPath}>
                    <ListItemButton
                      onClick={() => handleChangeVideo(video.index)}
                    >
                      <VideoButton
                        key={video.fullPath}
                        state={state}
                        navigation={navigation}
                        index={video.index}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
          </List>
        </Box>
      </>
    );
  };

  const quitApplication = () => ipc.sendMessage('mainWindow', ['quit']);

  // @@@ TODO fix up error prompt I deleted here
  if (categoryIndex < 0) {
    return <HomePage setNavigationState={setNavigationState} />;
  }

  if (videoIndex < 0) {
    return getVideoSelection();
  }

  return getVideoPanel();
};

export default Layout;
