import {
  Box,
  Button,
  List,
  ListItem,
  ListItemButton,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { VideoCategory } from 'types/VideoCategory';
import React from 'react';
import {
  Pages,
  RendererVideo,
  RendererVideoState,
  TAppState,
  TNavigatorState,
} from 'main/types';
import { getNumVideos, getSortedVideos } from './rendererutils';
import VideoButton from './VideoButton';
import { VideoJS } from './VideoJS';
import RecorderPreview from './RecorderPreview';

interface IProps {
  videoState: RendererVideoState;
  appState: TAppState;
  setAppState: React.Dispatch<React.SetStateAction<TAppState>>;
  setNavigation: React.Dispatch<React.SetStateAction<TNavigatorState>>;
}

enum TDisplay {
  PLAYER,
  PREVIEW,
}

const categories = Object.values(VideoCategory);

const HomePage: React.FC<IProps> = (props: IProps) => {
  const { videoState, setNavigation, appState, setAppState } = props;
  const [selectedIndex, setSelectedIndex] = React.useState<number>(0);
  const [display, setDisplay] = React.useState<TDisplay>(TDisplay.PLAYER);
  const { numVideosDisplayed } = appState;
  const numVideos = getNumVideos(videoState);
  const haveVideos = numVideos > 0;
  const recentVideos = getSortedVideos(videoState);
  const raidCategoryState = videoState[VideoCategory.Raids];
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

  const handleSelectVideo = (video: RendererVideo, doubleClick: boolean) => {
    if (doubleClick) {
      const { category } = video;
      const categoryIndex = categories.indexOf(category);
      const videoIndex = videoState[category].indexOf(video);

      setNavigation({
        categoryIndex,
        videoIndex,
        page: Pages.None,
      });
    } else {
      setSelectedIndex(slicedVideos.indexOf(video));
      setDisplay(TDisplay.PLAYER);
    }
  };

  const renderVideoCountText = () => {
    return (
      <Box sx={{ height: '5%', width: '100%' }}>
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
          You have {numVideos} videos saved, select from the most recent below
          or choose a category.
        </Typography>
        <Typography
          variant="h6"
          align="center"
          sx={{
            color: 'white',
            fontSize: '0.75rem',
            fontFamily: '"Arial",sans-serif',
            fontStyle: 'italic',
            textShadow:
              '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
          }}
        >
          Hint: double click to go full screen.
        </Typography>
      </Box>
    );
  };

  const renderRecentVideoList = () => {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          overflowY: 'scroll',
          display: 'flex',
          alignContent: 'center',
          justifyContent: 'center',
          mt: 2,
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
        <List sx={{ width: '90%' }}>
          {slicedVideos.map((video) => {
            return (
              <ListItem
                disablePadding
                key={video.fullPath}
                sx={{ width: '100%' }}
              >
                <ListItemButton
                  selected={selectedIndex === slicedVideos.indexOf(video)}
                  onClick={() => handleSelectVideo(video, false)}
                  onDoubleClick={() => handleSelectVideo(video, true)}
                  sx={{ width: '100%' }}
                >
                  <VideoButton
                    key={video.fullPath}
                    video={video}
                    categoryState={raidCategoryState}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
          <ListItem>{moreVideosRemain && getShowMoreButton()}</ListItem>
        </List>
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

  const getVideoPanel = () => {
    return (
      <Box
        sx={{
          display: 'flex',
          height: '150%',
          width: '90%',
          border: '2px solid black',
          boxSizing: 'border-box',
          m: 2,
        }}
      >
        <VideoJS
          id="video-player"
          key={slicedVideos[selectedIndex].fullPath}
          video={slicedVideos[selectedIndex]}
          setAppState={setAppState}
        />
      </Box>
    );
  };

  const getPreviewPanel = () => {
    return (
      <Box
        sx={{
          display: 'flex',
          height: '150%',
          width: '90%',
          border: '2px solid black',
          boxSizing: 'border-box',
          m: 2,
        }}
      >
        <RecorderPreview />
      </Box>
    );
  };

  const getToggleButton = (value: TDisplay, text: string) => {
    return (
      <ToggleButton
        value={value}
        key={value}
        sx={{
          color: 'white',
          height: '30px',
          '&.Mui-selected, &.Mui-selected:hover': {
            color: 'white',
            backgroundColor: '#bb4420',
          },
        }}
      >
        {text}
      </ToggleButton>
    );
  };

  const setHomepageDisplay = (
    _event: React.MouseEvent<HTMLElement>,
    mode: TDisplay
  ) => {
    if (mode !== null) {
      setDisplay(mode);
    }
  };

  const getDisplayToggle = () => {
    return (
      <ToggleButtonGroup
        value={display}
        exclusive
        onChange={setHomepageDisplay}
        sx={{ border: '1px solid white', height: '40px' }}
      >
        {getToggleButton(TDisplay.PLAYER, 'Player')}
        {getToggleButton(TDisplay.PREVIEW, 'Preview')}
      </ToggleButtonGroup>
    );
  };

  return (
    <>
      {haveVideos && display === TDisplay.PLAYER && getVideoPanel()}
      {haveVideos && display === TDisplay.PREVIEW && getPreviewPanel()}
      {haveVideos && getDisplayToggle()}
      {haveVideos && renderVideoCountText()}
      {haveVideos && renderRecentVideoList()}
      {!haveVideos && renderFirstTimeUserPrompt()}
    </>
  );
};

export default HomePage;
