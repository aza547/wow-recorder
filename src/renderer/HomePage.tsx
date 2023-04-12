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
import { RendererVideo, RendererVideoState, TNavigatorState } from 'main/types';
import {
  getLatestCategory,
  getNumVideos,
  getRecentVideos,
} from './rendererutils';
import { VideoJS } from './VideoJS';
import VideoButton from './VideoButton';

interface IProps {
  videoState: RendererVideoState;
  setNavigation: React.Dispatch<React.SetStateAction<TNavigatorState>>;
}

const categories = Object.values(VideoCategory);

const HomePage: React.FC<IProps> = (props: IProps) => {
  const { videoState, setNavigation } = props;
  const latestCategory = getLatestCategory(videoState);
  const numVideos = getNumVideos(videoState);
  const haveVideos = numVideos > 0;
  const recentVideos = getRecentVideos(videoState);

  const openSetupInstructions = () => {
    window.electron.ipcRenderer.sendMessage('openURL', [
      'https://github.com/aza547/wow-recorder#readme',
    ]);
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

  const getLatestVideoPanel = () => {
    const video = videoState[latestCategory][0];
    const videoFullPath = video.fullPath;
    return <VideoJS id="video-player" key={videoFullPath} video={video} />;
  };

  const renderRecentVideoList = () => {
    return (
      <Box
        sx={{
          m: 2,
          width: '75%',
          height: '300px',
          overflowY: 'scroll',
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
        <List sx={{ width: '100%', p: 0 }}>
          {recentVideos.map((video) => {
            return (
              <ListItem
                disablePadding
                key={video.fullPath}
                sx={{ width: '100%' }}
              >
                <ListItemButton
                  onClick={() => handleSelectVideo(video)}
                  sx={{ width: '100%', pt: '2px', pb: '2px' }}
                >
                  <VideoButton key={video.fullPath} video={video} />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>
    );
  };

  const renderLatestVideo = () => {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <Box
          sx={{
            height: '100%',
            width: '75%',
            mt: 1,
            border: '1px solid black',
            borderRadius: '0%',
            boxShadow: '-3px -3px 5px 5px black',
          }}
        >
          {getLatestVideoPanel()}
        </Box>
        {renderRecentVideoList()}
      </Box>
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
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContet: 'center',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
      }}
    >
      <Typography
        variant="h6"
        align="center"
        sx={{
          color: 'white',
          fontFamily: '"Arial",sans-serif',
          m: 1,
          textShadow:
            '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
        }}
      >
        You have {numVideos} videos saved, view the most recent below or select
        a category.
      </Typography>

      {haveVideos && renderLatestVideo()}
      {!haveVideos && renderFirstTimeUserPrompt()}
    </Box>
  );
};

export default HomePage;
