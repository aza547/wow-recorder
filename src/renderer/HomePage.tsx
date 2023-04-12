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
import { getNumVideos, getRecentVideos } from './rendererutils';
import VideoButton from './VideoButton';

interface IProps {
  videoState: RendererVideoState;
  setNavigation: React.Dispatch<React.SetStateAction<TNavigatorState>>;
}

const categories = Object.values(VideoCategory);

const HomePage: React.FC<IProps> = (props: IProps) => {
  const { videoState, setNavigation } = props;
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

  const renderRecentVideoList = () => {
    return (
      <List sx={{ width: '100%' }}>
        {recentVideos.map((video) => {
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

      {haveVideos && renderRecentVideoList()}
      {!haveVideos && renderFirstTimeUserPrompt()}
    </>
  );
};

export default HomePage;
