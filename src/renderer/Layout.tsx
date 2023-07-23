import * as React from 'react';
import Box from '@mui/material/Box';
import {
  Pages,
  RecStatus,
  RendererVideoState,
  TAppState,
  TNavigatorState,
} from 'main/types';
import {
  Button,
  List,
  ListItem,
  ListItemButton,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import TvIcon from '@mui/icons-material/Tv';
import { VideoJS } from './VideoJS';
import 'videojs-hotkeys';
import { VideoCategory } from '../types/VideoCategory';
import VideoButton from './VideoButton';
import VideoFilter from './VideoFilter';
import SceneEditor from './SceneEditor';
import SettingsPage from './SettingsPage';
import RaidIcon from '../../assets/icon/dragon.png';
import TwoPeopleIcon from '../../assets/icon/two-people.png';
import ThreePeopleIcon from '../../assets/icon/three-people.png';
import FivePeopleIcon from '../../assets/icon/five-people.png';
import SwordIcon from '../../assets/icon/swords.png';
import DaggerIcon from '../../assets/icon/dagger.png';
import DungeonIcon from '../../assets/icon/dungeon.png';
import FlagIcon from '../../assets/icon/flag.png';

interface IProps {
  navigation: TNavigatorState;
  setNavigation: React.Dispatch<React.SetStateAction<TNavigatorState>>;
  recorderStatus: RecStatus;
  videoState: RendererVideoState;
  appState: TAppState;
  setAppState: React.Dispatch<React.SetStateAction<TAppState>>;
}

const ipc = window.electron.ipcRenderer;
let debounceSearchTimer: NodeJS.Timer;

/**
 * The GUI itself.
 */
const Layout: React.FC<IProps> = (props: IProps) => {
  const {
    navigation,
    setNavigation,
    recorderStatus,
    videoState,
    appState,
    setAppState,
  } = props;

  const { page, categoryIndex, videoIndex } = navigation;
  const { numVideosDisplayed, videoFilterQuery } = appState;
  const categories = Object.values(VideoCategory);
  const category = categories[categoryIndex];

  const categoryState = videoState[category];

  const filteredCategoryState = categoryState.filter((video) =>
    new VideoFilter(videoFilterQuery, video).filter()
  );

  const slicedCategoryState = filteredCategoryState.slice(
    0,
    numVideosDisplayed
  );

  const moreVideosRemain =
    slicedCategoryState.length !== filteredCategoryState.length;

  /**
   * Update state variables following a change of selected video.
   */
  const handleChangeVideo = (index: number) => {
    setNavigation((prevState) => {
      return {
        ...prevState,
        videoIndex: index,
      };
    });

    // Forget the query, the text field will reset on its own.
    setAppState((prevState) => {
      return {
        ...prevState,
        videoFilterQuery: '',
      };
    });
  };

  const loadMoreVideos = () => {
    setAppState((prevState) => {
      return {
        ...prevState,
        numVideosDisplayed: prevState.numVideosDisplayed + 10,
      };
    });
  };

  // This is effectively equivalent to componentDidMount() in
  // React Component classes
  React.useEffect(() => {
    ipc.on('fatalError', async (stack) => {
      setAppState((prevState) => {
        return {
          ...prevState,
          fatalError: true,
          fatalErrorText: stack as string,
        };
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const debouncedFilter = (event: React.BaseSyntheticEvent) => {
    const filterText = event.target.value;

    if (debounceSearchTimer) {
      clearTimeout(debounceSearchTimer);
    }

    debounceSearchTimer = setTimeout(() => {
      setAppState((prevState) => {
        return {
          ...prevState,
          videoFilterQuery: filterText,
        };
      });
    }, 750);
  };

  const getVideoPanel = () => {
    return (
      <Box
        sx={{
          display: 'flex',
          height: '60%',
          width: '100%',
        }}
      >
        <VideoJS
          id="video-player"
          key={categoryState[videoIndex].fullPath}
          video={categoryState[videoIndex]}
          setAppState={setAppState}
        />
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
            height: '50%',
            overflowY: 'scroll',
            display: 'flex',
            alignContent: 'center',
            justifyContent: 'center',
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
            <ListItem disablePadding key="search-bar" sx={{ width: '100%' }}>
              <TextField
                fullWidth
                size="small"
                placeholder={VideoFilter.getSuggestions(category)}
                id="search-bar"
                onChange={debouncedFilter}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&.Mui-focused fieldset': { borderColor: '#bb4220' },
                    '& > fieldset': { borderColor: 'white' },
                    '&:hover fieldset': {
                      borderColor: '#bb4220',
                    },
                  },
                  '& label.Mui-focused': { color: '#bb4220' },
                  ml: 2,
                  mr: 2,
                  input: { color: 'white' },
                }}
                inputProps={{ style: { color: 'white' } }}
              />
            </ListItem>
            {slicedCategoryState.map((video) => {
              return (
                <ListItem
                  disablePadding
                  key={video.fullPath}
                  sx={{ width: '100%' }}
                >
                  <ListItemButton
                    selected={
                      navigation.videoIndex === categoryState.indexOf(video)
                    }
                    onClick={() =>
                      handleChangeVideo(categoryState.indexOf(video))
                    }
                  >
                    <VideoButton
                      key={video.fullPath}
                      video={video}
                      categoryState={categoryState}
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

  const handleChangeCategory = (
    _event: React.SyntheticEvent,
    newCategory: VideoCategory
  ) => {
    setNavigation({
      page: Pages.None,
      categoryIndex: categories.indexOf(newCategory),
      videoIndex: 0,
    });
  };

  const handleChangePage = (_event: React.SyntheticEvent, newPage: Pages) => {
    setNavigation({
      page: newPage,
      categoryIndex: 0,
      videoIndex: 0,
    });
  };

  const renderCategoryTab = (tabCategory: VideoCategory, tabIcon: string) => {
    return (
      <Tab
        value={tabCategory}
        icon={<img src={tabIcon} alt="raid" width="30" height="30" />}
        sx={{
          color: 'white',
        }}
        label={tabCategory}
      />
    );
  };

  const renderMiscTab = (tabPage: Pages) => {
    if (tabPage === Pages.Settings) {
      return (
        <Tab
          value={tabPage}
          icon={<SettingsIcon width="30" height="30" />}
          sx={{
            color: 'white',
          }}
          label="Settings"
        />
      );
    }

    if (tabPage === Pages.SceneEditor) {
      return (
        <Tab
          value={tabPage}
          icon={<TvIcon width="30" height="30" />}
          sx={{
            color: 'white',
          }}
          label="Scene"
        />
      );
    }

    return <></>;
  };

  const getTabs = () => {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          borderRight: '1px solid black',
        }}
      >
        <Box
          sx={{
            justifyContent: 'flex-start',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            alignItems: 'center',
            backgroundColor: '#182035',
          }}
        >
          <Tabs
            value={navigation.page === Pages.None ? category : false}
            orientation="vertical"
            onChange={handleChangeCategory}
            sx={{
              height: '100%',
              width: '100%',
              backgroundColor: '#182035',
              boxSizing: 'border-box',
              color: 'white',
              '& .MuiTab-root.Mui-selected': {
                color: '#bb4220',
              },
            }}
            TabIndicatorProps={{ style: { background: '#bb4220' } }}
          >
            {renderCategoryTab(VideoCategory.TwoVTwo, TwoPeopleIcon)}
            {renderCategoryTab(VideoCategory.ThreeVThree, ThreePeopleIcon)}
            {renderCategoryTab(VideoCategory.FiveVFive, FivePeopleIcon)}
            {renderCategoryTab(VideoCategory.Skirmish, DaggerIcon)}
            {renderCategoryTab(VideoCategory.SoloShuffle, SwordIcon)}
            {renderCategoryTab(VideoCategory.MythicPlus, DungeonIcon)}
            {renderCategoryTab(VideoCategory.Raids, RaidIcon)}
            {renderCategoryTab(VideoCategory.Battlegrounds, FlagIcon)}
          </Tabs>
        </Box>

        <Box
          sx={{
            justifyContent: 'flex-end',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            alignItems: 'center',
            backgroundColor: '#182035',
          }}
        >
          <Tabs
            value={navigation.page !== Pages.None ? navigation.page : false}
            orientation="vertical"
            onChange={handleChangePage}
            sx={{
              width: '100%',
              backgroundColor: '#182035',
              borderRight: '1px solid black',
              boxSizing: 'border-box',
              color: 'white',
              '& .MuiTab-root.Mui-selected': {
                color: '#bb4220',
              },
            }}
            TabIndicatorProps={{ style: { background: '#bb4220' } }}
          >
            {renderMiscTab(Pages.Settings)}
            {renderMiscTab(Pages.SceneEditor)}
          </Tabs>
        </Box>
      </Box>
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

  const renderCategoryPage = () => {
    const haveVideos = slicedCategoryState.length > 0;

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          width: '100%',
        }}
      >
        {haveVideos && getVideoPanel()}
        {haveVideos && getVideoSelection()}
        {!haveVideos && renderFirstTimeUserPrompt()}
      </Box>
    );
  };

  const renderSettingsPage = () => {
    return <SettingsPage recorderStatus={recorderStatus} />;
  };

  const renderSceneEditor = () => {
    return <SceneEditor recorderStatus={recorderStatus} />;
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        height: 'calc(100% - 70px)',
        width: '100%',
      }}
    >
      {getTabs()}
      {page === Pages.Settings && renderSettingsPage()}
      {page === Pages.SceneEditor && renderSceneEditor()}
      {page === Pages.None && renderCategoryPage()}
    </Box>
  );
};

export default Layout;
