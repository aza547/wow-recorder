import * as React from 'react';
import Box from '@mui/material/Box';
import { Pages, RecStatus, AppState, RendererVideo } from 'main/types';
import { Badge, Tab, Tabs } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import TvIcon from '@mui/icons-material/Tv';
import { MutableRefObject } from 'react';
import ClipIcon from '../../assets/icon/clip-icon.png';
import { VideoCategory } from '../types/VideoCategory';
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
import { setConfigValue } from './useSettings';
import { getCategoryIndex, getFirstInCategory } from './rendererutils';
import CategoryPage from './CategoryPage';
import StateManager from './StateManager';

interface IProps {
  recorderStatus: RecStatus;
  stateManager: MutableRefObject<StateManager>;
  videoState: RendererVideo[];
  setVideoState: React.Dispatch<React.SetStateAction<RendererVideo[]>>;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  persistentProgress: MutableRefObject<number>;
  playerHeight: MutableRefObject<number>;
  categoryCounters: Record<string, number>;
  moreAvailable: boolean;
}

/**
 * The main window, minus the top and bottom bars.
 */
const Layout = (props: IProps) => {
  const {
    recorderStatus,
    stateManager,
    videoState,
    setVideoState,
    appState,
    setAppState,
    persistentProgress,
    playerHeight,
    categoryCounters,
    moreAvailable,
  } = props;
  const { page, category } = appState;

  const handleChangeCategory = (
    _: React.SyntheticEvent,
    newCategory: VideoCategory
  ) => {
    const index = getCategoryIndex(newCategory);
    setConfigValue('selectedCategory', index);
    const first = getFirstInCategory(videoState, newCategory);
    persistentProgress.current = 0;

    // state manager action
    // numVideosDisplayed: 10,
    setAppState((prevState) => {
      return {
        ...prevState,
        videoFilterQuery: '',
        page: Pages.None,
        category: newCategory,
        selectedVideoName: first?.name,
        playingVideo: first,
      };
    });

    stateManager.current.changeCategory(newCategory);
  };

  const handleChangePage = (_: React.SyntheticEvent, newPage: Pages) => {
    setAppState((prevState) => {
      return {
        ...prevState,
        page: newPage,
      };
    });
  };

  const renderCategoryTab = (tabCategory: VideoCategory, tabIcon: string) => {
    const numVideos = categoryCounters[tabCategory];

    return (
      <Tab
        value={tabCategory}
        icon={
          <Badge
            badgeContent={numVideos}
            max={999}
            style={{ transform: 'translate(15px, 5px)' }}
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
              style={{ transform: 'translate(-15px, 0px)' }}
            />
          </Badge>
        }
        sx={{ color: 'white', minHeight: '60px', height: '60px' }}
        label={tabCategory}
      />
    );
  };

  const renderSettingsTab = () => {
    return (
      <Tab
        value={Pages.Settings}
        icon={<SettingsIcon width="25" height="25" />}
        sx={{ color: 'white', minHeight: '60px', height: '60px' }}
        label="Settings"
      />
    );
  };

  const renderSceneTab = () => {
    return (
      <Tab
        value={Pages.SceneEditor}
        icon={<TvIcon width="25" height="25" />}
        sx={{ color: 'white', minHeight: '60px', height: '60px' }}
        label="Scene"
      />
    );
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
            value={appState.page === Pages.None ? category : false}
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
            value={appState.page !== Pages.None ? appState.page : false}
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
            {renderSettingsTab()}
            {renderSceneTab()}
          </Tabs>
        </Box>
      </Box>
    );
  };

  const renderCategoryPage = () => {
    return (
      <CategoryPage
        category={category}
        videoState={videoState}
        stateManager={stateManager}
        setVideoState={setVideoState}
        appState={appState}
        setAppState={setAppState}
        persistentProgress={persistentProgress}
        playerHeight={playerHeight}
        moreAvailable={moreAvailable}
      />
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
