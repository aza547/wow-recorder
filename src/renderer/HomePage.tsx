import { Box, Typography } from '@mui/material';
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
            variant="h5"
            sx={{
              color: 'white',
              fontFamily: '"Arial",sans-serif',
            }}
          >
            Latest Video
          </Typography>
        </Box>
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
        }}
      >
        Warcraft Recorder
      </Typography>
      <Typography
        variant="h5"
        sx={{
          color: 'white',
          fontFamily: '"Arial",sans-serif',
        }}
      >
        You have {numVideos} videos saved.
      </Typography>

      {haveVideos && renderLatestVideo()}
    </Box>
  );
};

export default HomePage;
