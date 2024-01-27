import * as React from 'react';
import Box from '@mui/material/Box';
import {
  Pages,
  RecStatus,
  RendererVideo,
  RendererVideoState,
  TAppState,
  TNavigatorState,
} from 'main/types';
import {
  Badge,
  Button,
  List,
  ListItem,
  ListItemButton,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import TvIcon from '@mui/icons-material/Tv';
import ClipIcon from '../../assets/icon/clip-icon.png';
import { VideoPlayer } from './VideoPlayer';
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
import SearchBar from './SearchBar';
import VideoMarkerToggles from './VideoMarkerToggles';
import { useSettings, setConfigValue } from './useSettings';

interface IProps {
  navigation: TNavigatorState;
  setNavigation: React.Dispatch<React.SetStateAction<TNavigatorState>>;
  recorderStatus: RecStatus;
  videoState: RendererVideoState;
  appState: TAppState;
  setAppState: React.Dispatch<React.SetStateAction<TAppState>>;
}

const ipc = window.electron.ipcRenderer;

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

  const [config, setConfig] = useSettings();
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

  const getVideoPlayer = () => {
    return (
      <VideoPlayer
        config={config}
        key={categoryState[videoIndex].fullPath}
        video={categoryState[videoIndex]}
      />
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

  const mapVideoToListItem = (video: RendererVideo) => {
    const selected = navigation.videoIndex === categoryState.indexOf(video);

    return (
      <ListItem disablePadding key={video.fullPath} sx={{ width: '100%' }}>
        <ListItemButton
          selected={selected}
          onClick={() => handleChangeVideo(categoryState.indexOf(video))}
        >
          <VideoButton
            key={video.fullPath}
            video={video}
            selected={selected}
            categoryState={categoryState}
            setNavigation={setNavigation}
          />
        </ListItemButton>
      </ListItem>
    );
  };

  const getVideoSelection = () => {
    const isClips = category === VideoCategory.Clips;

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
            <SearchBar navigation={navigation} setAppState={setAppState} />
          </Box>
        </Box>
        <Box
          sx={{
            height: '100%',
            width: '100%',
            overflowY: 'scroll',
            display: 'flex',
            flexDirection: 'column',
            alignContent: 'center',
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
            {slicedCategoryState.map(mapVideoToListItem)}
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
    const newIndex = categories.indexOf(newCategory);
    setConfigValue('selectedCategory', newIndex);

    setAppState((prevState) => {
      return {
        ...prevState,
        videoFilterQuery: '',
      };
    });

    setNavigation({
      page: Pages.None,
      categoryIndex: newIndex,
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
    const numVideos = videoState[tabCategory].length;

    return (
      <Tab
        value={tabCategory}
        icon={
          <Badge
            badgeContent={numVideos}
            style={{ transform: 'translate(10px, 5px)' }}
            sx={{
              '& .MuiBadge-badge': {
                color: 'white',
                backgroundColor: '#bb4420',
              },
            }}
          >
            <img
              src={tabIcon}
              alt={tabCategory}
              width="25"
              height="25"
              style={{ transform: 'translate(-10px, 0px)' }}
            />
          </Badge>
        }
        sx={{ color: 'white', minHeight: '60px', height: '60px' }}
        label={tabCategory}
      />
    );
  };

  const renderMiscTab = (tabPage: Pages) => {
    if (tabPage === Pages.Settings) {
      return (
        <Tab
          value={tabPage}
          icon={<SettingsIcon width="25" height="25" />}
          sx={{ color: 'white', minHeight: '60px', height: '60px' }}
          label="Settings"
        />
      );
    }

    if (tabPage === Pages.SceneEditor) {
      return (
        <Tab
          value={tabPage}
          icon={<TvIcon width="25" height="25" />}
          sx={{ color: 'white', minHeight: '60px', height: '60px' }}
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
            {renderCategoryTab(VideoCategory.Clips, ClipIcon)}
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

  const renderCategoryPage = () => {
    const haveVideos = categoryState.length > 0;
    const isClips = category === VideoCategory.Clips;

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
