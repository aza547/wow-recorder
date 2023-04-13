import {
  Box,
  Button,
  List,
  ListItem,
  ListItemButton,
  Typography,
} from '@mui/material';
import { VideoCategory } from 'types/VideoCategory';
import React from 'react';
import {
  RendererVideo,
  RendererVideoState,
  TAppState,
  TNavigatorState,
} from 'main/types';
import { getNumVideos, getSortedVideos } from './rendererutils';
import VideoButton from './VideoButton';

interface IProps {
  videoState: RendererVideoState;
  appState: TAppState;
  setAppState: React.Dispatch<React.SetStateAction<TAppState>>;
  setNavigation: React.Dispatch<React.SetStateAction<TNavigatorState>>;
}

const categories = Object.values(VideoCategory);

const HomePage: React.FC<IProps> = (props: IProps) => {
  const { videoState, setNavigation, appState, setAppState } = props;
  const { numVideosDisplayed } = appState;
  const numVideos = getNumVideos(videoState);
  const haveVideos = numVideos > 0;
  const recentVideos = getSortedVideos(videoState);
  const slicedVideos = recentVideos.slice(0, numVideosDisplayed);
  const moreVideosRemain = slicedVideos.length !== recentVideos.length;

  const openSetupInstructions = () => {
    window.electron.ipcRenderer.sendMessage('openURL', [
      'https://github.com/aza547/wow-recorder#readme',
    ]);
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

  const handleSelectVideo = (video: RendererVideo) => {
    const { category } = video;
    const categoryIndex = categories.indexOf(category);
    const videoIndex = videoState[category].indexOf(video);

    setNavigation({
      categoryIndex,
      videoIndex,
    });
  };

  const renderVideoCountText = () => {
    return (
      <Typography
        variant="h6"
        align="center"
        sx={{
          color: 'white',
          fontFamily: '"Arial",sans-serif',
          mt: 1,
          textShadow:
            '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
        }}
      >
        You have {numVideos} videos saved, select from the most recent below or
        choose a category.
      </Typography>
    );
  };

  const renderRecentVideoList = () => {
    return (
      <List sx={{ width: '100%' }}>
        {slicedVideos.map((video) => {
          return (
            <ListItem
              disablePadding
              key={video.fullPath}
              sx={{ width: '100%' }}
            >
              <ListItemButton
                onClick={() => handleSelectVideo(video)}
                sx={{ width: '100%' }}
              >
                <VideoButton key={video.fullPath} video={video} />
              </ListItemButton>
            </ListItem>
          );
        })}
        {moreVideosRemain && getShowMoreButton()}
      </List>
    );
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
          It looks like it might be your first time here! Setup instructions can
          be found at the link below. If you have problems, please use the
          Discord #help channel to get support.
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

  return (
    <>
      {haveVideos && renderVideoCountText()}
      {haveVideos && renderRecentVideoList()}
      {!haveVideos && renderFirstTimeUserPrompt()}
    </>
  );
};

export default HomePage;
