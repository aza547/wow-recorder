import * as React from 'react';
import Box from '@mui/material/Box';
import { AppState, RendererVideo } from 'main/types';
import {
  Button,
  List,
  ListItem,
  ListItemButton,
  Typography,
} from '@mui/material';
import { scrollBarSx } from 'main/constants';
import { MutableRefObject, useState } from 'react';
import { VideoPlayer } from './VideoPlayer';
import { VideoCategory } from '../types/VideoCategory';
import SearchBar from './SearchBar';
import VideoMarkerToggles from './VideoMarkerToggles';
import { useSettings } from './useSettings';
import {
  getFirstInCategory,
  getVideoCategoryFilter,
  povNameSort,
} from './rendererutils';
import VideoFilter from './VideoFilter';
import VideoButton from './VideoButton';
import StateManager from './StateManager';

interface IProps {
  category: VideoCategory;
  stateManager: MutableRefObject<StateManager>;
  videoState: RendererVideo[];
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  persistentProgress: MutableRefObject<number>;
  playerHeight: MutableRefObject<number>;
}

/**
 * A page representing a video category.
 */
const CategoryPage = (props: IProps) => {
  const {
    category,
    stateManager,
    videoState,
    appState,
    setAppState,
    persistentProgress,
    playerHeight,
  } = props;
  const { numVideosDisplayed, videoFilterQuery } = appState;
  const [config, setConfig] = useSettings();
  const categoryFilter = getVideoCategoryFilter(category);
  const categoryState = videoState.filter(categoryFilter);
  const haveVideos = categoryState.length > 0;
  const isClips = category === VideoCategory.Clips;

  const filteredState = categoryState.filter((video) =>
    new VideoFilter(videoFilterQuery, video).filter()
  );

  const slicedState = filteredState.slice(0, numVideosDisplayed);
  const moreVideosRemain = slicedState.length !== filteredState.length;

  const getVideoPlayer = () => {
    const { playingVideo } = appState;
    let videoToPlay: RendererVideo;

    if (playingVideo !== undefined) {
      videoToPlay = playingVideo;
    } else {
      const firstInCategory = getFirstInCategory(videoState, category);

      if (firstInCategory === undefined) {
        // This should never happen, we only load the player if we
        // have atleast one video to show.
        throw new Error('firstInCategory was undefined');
      }

      const povs = [firstInCategory, ...firstInCategory.multiPov].sort(
        povNameSort
      );

      [videoToPlay] = povs;
    }

    return (
      <VideoPlayer
        key={videoToPlay.videoSource}
        video={videoToPlay}
        persistentProgress={persistentProgress}
        config={config}
        playerHeight={playerHeight}
      />
    );
  };

  const handleChangeVideo = (index: number) => {
    const video = videoState[index];
    const povs = [video, ...video.multiPov].sort(povNameSort);
    persistentProgress.current = 0;

    setAppState((prevState) => {
      return {
        ...prevState,
        selectedVideoName: video.videoName,
        playingVideo: povs[0],
      };
    });
  };

  const mapActivityToListItem = (video: RendererVideo) => {
    const povs = [video, ...video.multiPov].sort(povNameSort);
    const names = povs.map((v) => v.videoName);
    const selected = appState.selectedVideoName
      ? names.includes(appState.selectedVideoName)
      : categoryState.indexOf(video) === 0;

    const backgroundColor = selected
      ? 'rgba(255, 255, 255, 0.1)'
      : 'transparent';

    return (
      <ListItem disablePadding key={video.videoSource} sx={{ width: '100%' }}>
        <ListItemButton
          selected={selected}
          sx={{
            '&.Mui-selected, &.Mui-selected:hover': {
              backgroundColor,
            },
          }}
          onClick={() => handleChangeVideo(videoState.indexOf(video))}
        >
          <VideoButton
            key={video.videoSource}
            video={video}
            stateManager={stateManager}
            videoState={videoState}
            setAppState={setAppState}
            selected={selected}
            persistentProgress={persistentProgress}
          />
        </ListItemButton>
      </ListItem>
    );
  };

  const loadMoreVideos = () => {
    setAppState((prevState) => {
      return {
        ...prevState,
        numVideosDisplayed: prevState.numVideosDisplayed + 10,
      };
    });
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
          key="show-more-button"
          variant="outlined"
          onClick={loadMoreVideos}
          sx={{
            mb: 1,
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
    return (
      <>
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-evenly',
            borderTop: '1px solid black',
            borderBottom: '1px solid black',
          }}
        >
          {!isClips && (
            <Box sx={{ ml: 1, my: 1 }}>
              <VideoMarkerToggles
                category={category}
                config={config}
                setConfig={setConfig}
              />
            </Box>
          )}
          <Box sx={{ flex: 1, m: 1, my: 1 }}>
            <SearchBar appState={appState} setAppState={setAppState} />
          </Box>
        </Box>
        <Box
          sx={{
            height: '100%',
            width: '100%',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignContent: 'center',
            ...scrollBarSx,
            '&::-webkit-scrollbar': {
              width: '1em',
            },
          }}
        >
          <List sx={{ width: '100%', p: 0 }}>
            {slicedState.map(mapActivityToListItem)}
            {moreVideosRemain && getShowMoreButton()}
          </List>
        </Box>
      </>
    );
  };

  const openSetupInstructions = () => {
    window.electron.ipcRenderer.sendMessage('openURL', [
      'https://github.com/aza547/wow-recorder#readme',
    ]);
  };

  const renderFirstTimeUserPrompt = () => {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          width: '50%',
          height: '50%',
        }}
      >
        <Typography
          align="center"
          variant="h6"
          sx={{
            color: 'white',
            fontFamily: '"Arial",sans-serif',
            textShadow:
              '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
          }}
        >
          You have no videos saved for this category. If it is your first time
          here, setup instructions can be found at the link below. If you have
          problems, please use the Discord #help channel to get support.
        </Typography>
        <Button
          key="setup-button"
          variant="outlined"
          onClick={openSetupInstructions}
          sx={{
            color: 'white',
            borderColor: 'white',
            m: 2,
            ':hover': {
              color: '#bb4420',
              borderColor: '#bb4420',
            },
          }}
        >
          Setup Instructions
        </Button>
      </Box>
    );
  };

  const renderFirstTimeClipPrompt = () => {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          width: '50%',
          height: '50%',
        }}
      >
        <Typography
          align="center"
          variant="h6"
          sx={{
            color: 'white',
            fontFamily: '"Arial",sans-serif',
            textShadow:
              '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
          }}
        >
          You have no clips saved. Videos you clip will display here.
        </Typography>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
      }}
    >
      {haveVideos && getVideoPlayer()}
      {haveVideos && getVideoSelection()}
      {!haveVideos && !isClips && renderFirstTimeUserPrompt()}
      {!haveVideos && isClips && renderFirstTimeClipPrompt()}
    </Box>
  );
};

export default CategoryPage;
