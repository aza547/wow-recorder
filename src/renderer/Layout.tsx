import * as React from 'react';
import Box from '@mui/material/Box';
import { TNavigatorState, VideoPlayerSettings } from 'main/types';
import { Button, List, ListItem, ListItemButton } from '@mui/material';
import Player from 'video.js/dist/types/player';
import { VideoJS } from './VideoJS';
import { VideoCategory } from '../types/VideoCategory';
import VideoButton from './VideoButton';
import { addVideoMarkers } from './rendererutils';
import HomePage from './HomePage';

interface IProps {
  navigation: TNavigatorState;
  setNavigation: React.Dispatch<React.SetStateAction<TNavigatorState>>;
  videoState: any;
  setVideoState: React.Dispatch<React.SetStateAction<any>>;
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

/**
 * The GUI itself.
 */
const Layout: React.FC<IProps> = (props: IProps) => {
  const { navigation, setNavigation, videoState, setVideoState } = props;
  const { categoryIndex, videoIndex } = navigation;

  const videoPlayerRef: any = React.useRef(null);

  const [state, setState] = React.useState({
    autoPlay: false,
    videoMuted: videoPlayerSettings.muted,
    videoVolume: videoPlayerSettings.volume, // (Double) 0.00 - 1.00
    fatalError: false,
    fatalErrorText: '',
  });

  // Limit the number of videos displayed for performance. User can load more
  // by clicking the button, but mainline case will be to watch back recent
  // videos.
  const [numVideosDisplayed, setNumVideosDisplayed] = React.useState(10);

  const categories = Object.values(VideoCategory);
  const category = categories[categoryIndex];

  /**
   * Used so we can have a handle to the player for things like seeking.
   */
  const onVideoPlayerReady = (player: Player) => {
    videoPlayerRef.current = player;

    // Don't want to try call addVideoMarkers before we've loaded the
    // video state.
    if (videoState[category]) {
      const video = videoState[category][videoIndex];
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
   * Update the state variable following a change of selected video.
   */
  const handleChangeVideo = (index: number) => {
    setNavigation((prevState) => {
      return {
        ...prevState,
        videoIndex: index,
      };
    });
  };

  const loadMoreVideos = () => {
    setNumVideosDisplayed(numVideosDisplayed + 10);
  };

  // This is effectively equivalent to componentDidMount() in
  // React Component classes
  React.useEffect(() => {
    ipc.on('fatalError', async (stack) => {
      setState((prevState) => {
        return {
          ...prevState,
          fatalError: true,
          fatalErrorText: stack as string,
        };
      });
    });
  }, []);

  /**
   * Returns a video panel with videos.
   */
  const getVideoPanel = () => {
    const { autoPlay } = state;
    const video = videoState[category][videoIndex];
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
        <Box sx={{ display: 'flex', height: '100%' }}>
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

  const getHomePage = () => {
    return (
      <Box
        sx={{
          display: 'flex',
          flexGrow: 1,
          alignItems: 'center',
          justifyContet: 'center',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
        }}
      >
        <HomePage videoState={videoState} setNavigation={setNavigation} />
      </Box>
    );
  };

  const getShowMoreButton = () => {
    return (
      <Box
        key="show-more-button-box"
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          height: '50px',
        }}
      >
        <Button
          key="show-more-button-box"
          variant="outlined"
          onClick={loadMoreVideos}
          sx={{
            color: 'white',
            borderColor: 'white',
            ':hover': {
              color: '#bb4420',
              borderColor: '#bb4420',
            },
          }}
        >
          Load More
        </Button>
      </Box>
    );
  };

  const getVideoSelection = () => {
    const categoryState = videoState[category];
    if (!categoryState) return <></>;
    const slicedCategoryState = categoryState.slice(0, numVideosDisplayed);

    const moreVideosRemain =
      slicedCategoryState.length !== categoryState.length;

    return (
      <>
        <Box
          sx={{
            display: 'flex',
            overflowY: 'scroll',
            height: '100%',
            width: '100%',
            scrollbarWidth: 'thin',
            '&::-webkit-scrollbar': {
              width: '1em',
            },
            '&::-webkit-scrollbar-track': {
              background: '#f1f1f1',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: '#888',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: '#555',
            },
          }}
        >
          <List sx={{ width: '100%' }}>
            {slicedCategoryState.map((video: any) => {
              return (
                <ListItem
                  disablePadding
                  key={video.fullPath}
                  sx={{ width: '100%' }}
                >
                  <ListItemButton
                    onClick={() => handleChangeVideo(video.index)}
                  >
                    <VideoButton
                      key={video.fullPath}
                      navigation={navigation}
                      videostate={videoState}
                      index={video.index}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
            {moreVideosRemain && getShowMoreButton()}
          </List>
        </Box>
      </>
    );
  };

  if (categoryIndex < 0) {
    return getHomePage();
  }

  if (videoIndex < 0) {
    return getVideoSelection();
  }

  return getVideoPanel();
};

export default Layout;
