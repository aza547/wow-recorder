import * as React from 'react';
import {
  Pages,
  RecStatus,
  AppState,
  RendererVideo,
  MicStatus,
  Crashes,
} from 'main/types';
import { MutableRefObject } from 'react';
import {
  Clapperboard,
  Cog,
  Dice2,
  Dice3,
  Dice5,
  Goal,
  MonitorCog,
  Sword,
  Swords,
} from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDungeon, faDragon } from '@fortawesome/free-solid-svg-icons';
import { VideoCategory } from '../types/VideoCategory';
import SceneEditor from './SceneEditor';
import SettingsPage from './SettingsPage';
import { setConfigValue } from './useSettings';
import {
  getCategoryIndex,
  getFirstInCategory,
  getVideoCategoryFilter,
  povNameSort,
} from './rendererutils';
import CategoryPage from './CategoryPage';
import StateManager from './StateManager';
import Menu from './components/Menu';
import Separator from './components/Separator/Separator';
import LogsButton from './LogButton';
import TestButton from './TestButton';
import DiscordButton from './DiscordButton';
import ApplicationStatusCard from './containers/ApplicationStatusCard/ApplicationStatusCard';

interface IProps {
  recorderStatus: RecStatus;
  stateManager: MutableRefObject<StateManager>;
  videoState: RendererVideo[];
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  persistentProgress: MutableRefObject<number>;
  playerHeight: MutableRefObject<number>;
  error: string;
  micStatus: MicStatus;
  crashes: Crashes;
}

/**
 * The main window, minus the top and bottom bars.
 */
const Layout = (props: IProps) => {
  const {
    recorderStatus,
    stateManager,
    videoState,
    appState,
    setAppState,
    persistentProgress,
    playerHeight,
    error,
    micStatus,
    crashes,
  } = props;
  const { page, category } = appState;

  const handleChangeCategory = (newCategory: VideoCategory) => {
    const index = getCategoryIndex(newCategory);
    setConfigValue('selectedCategory', index);

    let first: RendererVideo | undefined;
    const firstInCategory = getFirstInCategory(videoState, newCategory);

    if (firstInCategory) {
      const povs = [firstInCategory, ...firstInCategory.multiPov].sort(
        povNameSort
      );

      [first] = povs;
    }

    persistentProgress.current = 0;

    setAppState((prevState) => {
      return {
        ...prevState,
        videoFilterQuery: '',
        page: Pages.None,
        category: newCategory,
        selectedVideoName: first?.videoName,
        playingVideo: first,
        numVideosDisplayed: 10,
      };
    });
  };

  const handleChangePage = (newPage: Pages) => {
    setAppState((prevState) => {
      return {
        ...prevState,
        page: newPage,
      };
    });
  };

  const renderCategoryTab = (
    tabCategory: VideoCategory,
    tabIcon: string | React.ReactNode
  ) => {
    const categoryFilter = getVideoCategoryFilter(tabCategory);
    const categoryState = videoState.filter(categoryFilter);
    const numVideos = categoryState.length;

    return (
      <Menu.Item value={tabCategory}>
        <Menu.Item.Icon>
          {typeof tabIcon === 'string' ? (
            <img
              src={tabIcon}
              alt={tabCategory}
              width="25"
              height="25"
              style={{ transform: 'translate(-15px, 0px)' }}
            />
          ) : (
            tabIcon
          )}
        </Menu.Item.Icon>
        {tabCategory}
        <Menu.Item.Badge value={numVideos} />
      </Menu.Item>
    );
  };

  const renderSettingsTab = () => {
    return (
      <Menu.Item value={Pages.Settings}>
        <Menu.Item.Icon>
          <Cog />
        </Menu.Item.Icon>
        General
      </Menu.Item>
    );
  };

  const renderSceneTab = () => {
    return (
      <Menu.Item value={Pages.SceneEditor}>
        <Menu.Item.Icon>
          <MonitorCog />
        </Menu.Item.Icon>
        Scene
      </Menu.Item>
    );
  };

  const SideMenu = () => {
    return (
      <div className="flex flex-col h-full bg-background w-1/6 min-w-60 max-w-80 px-4 items-center pt-4 pb-2">
        <ApplicationStatusCard
          recorderStatus={recorderStatus}
          error={error}
          micStatus={micStatus}
          crashes={crashes}
        />
        <Menu
          initialValue={appState.page === Pages.None ? category : false}
          onChange={handleChangeCategory}
        >
          <Menu.Label>Recordings</Menu.Label>
          {renderCategoryTab(VideoCategory.TwoVTwo, <Dice2 />)}
          {renderCategoryTab(VideoCategory.ThreeVThree, <Dice3 />)}
          {renderCategoryTab(VideoCategory.FiveVFive, <Dice5 />)}
          {renderCategoryTab(VideoCategory.Skirmish, <Sword />)}
          {renderCategoryTab(VideoCategory.SoloShuffle, <Swords />)}
          {renderCategoryTab(
            VideoCategory.MythicPlus,
            <FontAwesomeIcon icon={faDungeon} size="xl" />
          )}
          {renderCategoryTab(
            VideoCategory.Raids,
            <FontAwesomeIcon icon={faDragon} size="lg" />
          )}
          {renderCategoryTab(VideoCategory.Battlegrounds, <Goal />)}
          {renderCategoryTab(VideoCategory.Clips, <Clapperboard />)}
        </Menu>
        <Separator className="my-5" />
        <Menu
          initialValue={appState.page !== Pages.None ? appState.page : false}
          onChange={handleChangePage}
        >
          <Menu.Label>Settings</Menu.Label>
          {renderSettingsTab()}
          {renderSceneTab()}
        </Menu>
        <div className="mt-auto w-full">
          <Separator className="mb-4" />
          <div className="flex items-center justify-center gap-x-4">
            <LogsButton />
            <TestButton recorderStatus={recorderStatus} />
            <DiscordButton />
          </div>
          <div className="w-full mt-1 text-foreground font-sans text-[11px] font-bold text-center opacity-75">
            Version 5.7.2
          </div>
        </div>
      </div>
    );
  };

  const renderCategoryPage = () => {
    return (
      <CategoryPage
        category={category}
        videoState={videoState}
        stateManager={stateManager}
        appState={appState}
        setAppState={setAppState}
        persistentProgress={persistentProgress}
        playerHeight={playerHeight}
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
    <div className="flex flex-row items-center h-full w-full font-sans">
      <SideMenu />
      {page === Pages.Settings && renderSettingsPage()}
      {page === Pages.SceneEditor && renderSceneEditor()}
      {page === Pages.None && renderCategoryPage()}
    </div>
  );
};

export default Layout;
