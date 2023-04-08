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
import { TNavigatorState } from 'main/types';
import icon from '../../assets/icon/large-icon.png';
import { getLatestCategory, getNumVideos } from './rendererutils';
import { VideoJS } from './VideoJS';
import VideoButton from './VideoButton';

interface IProps {
  videoState: any;
  setNavigation: React.Dispatch<React.SetStateAction<TNavigatorState>>;
}

const categories = Object.values(VideoCategory);

const HomePage: React.FC<IProps> = (props: IProps) => {
  const { videoState, setNavigation } = props;
  const latestCategory = getLatestCategory(videoState);
  const categoryIndex = categories.indexOf(latestCategory);
  const numVideos = getNumVideos(videoState);
  const haveVideos = numVideos > 0;

  const openSetupInstructions = () => {
    window.electron.ipcRenderer.sendMessage('openURL', [
      'https://github.com/aza547/wow-recorder#readme',
    ]);
  };

  const goToLatestVideo = () => {
    setNavigation({
      categoryIndex,
      videoIndex: 0,
    });
  };

  const getLatestVideoPanel = () => {
    const video = videoState[latestCategory][0];
    const videoFullPath = video.fullPath;
    return <VideoJS id="video-player" key={videoFullPath} video={video} />;
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
            margin: 2,
            border: '1px solid black',
            borderRadius: '0%',
            boxShadow: '5px 10px 8px 10px black',
          }}
        >
          {getLatestVideoPanel()}
        </Box>
        <Box
          sx={{
            width: '100%',
          }}
        >
          <List sx={{ width: '100%' }}>
            <ListItem
              disablePadding
              key={videoState[latestCategory][0].fullPath}
              sx={{ width: '100%' }}
            >
              <ListItemButton onClick={goToLatestVideo}>
                <VideoButton
                  key={videoState[latestCategory][0].fullPath}
                  videostate={videoState}
                  categoryIndex={categoryIndex}
                  videoIndex={videoState[latestCategory][0].index}
                />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
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
        variant="h2"
        align="center"
        sx={{
          color: '#bb4220',
          fontFamily: '"Arial",sans-serif',
          textShadow:
            '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
        }}
      >
        Welcome!
      </Typography>
      <Typography
        variant="h6"
        align="center"
        sx={{
          color: 'white',
          fontFamily: '"Arial",sans-serif',
          textShadow:
            '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
        }}
      >
        You have {numVideos} videos saved, view the latest below or select a
        category.
      </Typography>

      {haveVideos && renderLatestVideo()}
      {!haveVideos && renderFirstTimeUserPrompt()}
    </Box>
  );
};

export default HomePage;
