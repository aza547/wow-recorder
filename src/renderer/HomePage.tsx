import { Box, Button, Typography } from '@mui/material';
import { VideoCategory } from 'types/VideoCategory';
import { TNavigatorState } from 'main/types';
import React from 'react';
import icon from '../../assets/icon/large-icon.png';
import poster from '../../assets/poster/poster.png';
import { getLatestCategory, getNumVideos } from './rendererutils';

interface IProps {
  videoState: any;
  setNavigation: React.Dispatch<React.SetStateAction<TNavigatorState>>;
}

const HomePage: React.FC<IProps> = (props: IProps) => {
  const { videoState, setNavigation } = props;
  const latestCategory = getLatestCategory(videoState);
  const numVideos = getNumVideos(videoState);
  const haveVideos = numVideos > 0;

  let thumbnailPath: string | undefined;

  if (latestCategory !== undefined) {
    thumbnailPath = videoState[latestCategory][0].thumbnail;
  }

  const goToLatestVideo = () => {
    const categories = Object.values(VideoCategory);
    const categoryIndex = categories.indexOf(
      getLatestCategory(videoState) as VideoCategory
    );

    setNavigation({
      categoryIndex,
      videoIndex: 0,
    });
  };

  const openSetupInstructions = () => {
    window.electron.ipcRenderer.sendMessage('openURL', [
      'https://github.com/aza547/wow-recorder#readme',
    ]);
  };

  const setFallbackImage = (event: any) => {
    event.target.src = poster;
  };

  const renderLatestVideo = () => {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          width: '100%',
          height: '100%',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            width: '50%',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <Box
            component="img"
            src={thumbnailPath}
            onError={setFallbackImage}
            onClick={goToLatestVideo}
            sx={{
              border: '1px solid white',
              borderRadius: 0,
              boxSizing: 'border-box',
              display: 'flex',
              height: '100%',
              width: '100%',
              objectFit: 'cover',
              '&:hover': {
                border: '1px solid #bb4420',
                color: 'gray',
                backgroundColor: 'lightblue',
              },
            }}
          />
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
            Latest Video
          </Typography>
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
          It looks like it might be first time here! Setup instructions can be
          found at the link below. If you have problems, please use the Discord
          #help channel to get support.
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
      <Box
        component="img"
        src={icon}
        sx={{
          height: '100px',
          width: '100px',
          objectFit: 'cover',
        }}
      />
      <Typography
        variant="h1"
        sx={{
          color: '#bb4220',
          fontFamily: '"Arial",sans-serif',
          textShadow:
            '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
        }}
      >
        Warcraft Recorder
      </Typography>
      <Typography
        variant="h6"
        sx={{
          color: 'white',
          fontFamily: '"Arial",sans-serif',
          textShadow:
            '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
        }}
      >
        You have {numVideos} videos saved.
      </Typography>

      {haveVideos && renderLatestVideo()}
      {haveVideos || renderFirstTimeUserPrompt()}
    </Box>
  );
};

export default HomePage;
