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
import {
  AppState,
  Crashes,
  MicStatus,
  Pages,
  RecStatus,
  RendererVideo,
  SaveStatus,
  UpgradeStatus,
} from 'main/types';
import { MutableRefObject, useEffect, useState } from 'react';
import { ConfigurationSchema } from 'config/configSchema';
import {
  getLocaleCategoryLabel,
  getLocalePhrase,
  Phrase,
} from 'localisation/translations';
import { VideoCategory } from '../types/VideoCategory';
import { setConfigValue } from './useSettings';
import {
  getCategoryIndex,
  getFirstInCategory,
  getVideoCategoryFilter,
  povDiskFirstNameSort,
} from './rendererutils';
import Menu from './components/Menu';
import Separator from './components/Separator/Separator';
import LogsButton from './LogButton';
import TestButton from './TestButton';
import DiscordButton from './DiscordButton';
import ApplicationStatusCard from './containers/ApplicationStatusCard/ApplicationStatusCard';
import UpgradeNotifier from './containers/UpgradeNotifier/UpgradeNotifier';
import { ScrollArea } from './components/ScrollArea/ScrollArea';

interface IProps {
  recorderStatus: RecStatus;
  videoState: RendererVideo[];
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  persistentProgress: MutableRefObject<number>;
  error: string;
  micStatus: MicStatus;
  crashes: Crashes;
  upgradeStatus: UpgradeStatus;
  savingStatus: SaveStatus;
  config: ConfigurationSchema;
}

const SideMenu = (props: IProps) => {
  const {
    recorderStatus,
    videoState,
    appState,
    setAppState,
    persistentProgress,
    error,
    micStatus,
    crashes,
    upgradeStatus,
    savingStatus,
    config,
  } = props;

  const [appVersion, setAppVersion] = useState<string>();
  const { category } = appState;

  useEffect(() => {
    window.electron.ipcRenderer.on('updateVersionDisplay', (t: unknown) => {
      if (typeof t === 'string') {
        setAppVersion(t.split('v')[1] as string);
      }
    });
  }, []);

  const renderCategoryTab = (
    tabCategory: VideoCategory,
    tabIcon: string | React.ReactNode,
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
        {getLocaleCategoryLabel(appState.language, tabCategory)}
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
        {getLocalePhrase(appState.language, Phrase.GeneralButtonText)}
      </Menu.Item>
    );
  };

  const renderSceneTab = () => {
    return (
      <Menu.Item value={Pages.SceneEditor}>
        <Menu.Item.Icon>
          <MonitorCog />
        </Menu.Item.Icon>
        {getLocalePhrase(appState.language, Phrase.SceneButtonText)}
      </Menu.Item>
    );
  };

  const handleChangeCategory = (newCategory: VideoCategory) => {
    const index = getCategoryIndex(newCategory);
    setConfigValue('selectedCategory', index);

    let first: RendererVideo | undefined;
    const firstInCategory = getFirstInCategory(videoState, newCategory);

    if (firstInCategory) {
      const povs = [firstInCategory, ...firstInCategory.multiPov].sort(
        povDiskFirstNameSort,
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
        playingVideo: first,
        playing: false,
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

  return (
    <div className="flex flex-col h-full bg-background w-1/6 min-w-60 max-w-80 px-4 items-center pt-4 pb-2">
      <ApplicationStatusCard
        recorderStatus={recorderStatus}
        error={error}
        micStatus={micStatus}
        crashes={crashes}
        savingStatus={savingStatus}
        config={config}
        appState={appState}
      />
      <ScrollArea
        className="w-full h-[calc(100%-80px)]"
        withScrollIndicators={false}
      >
        <Menu
          initialValue={appState.page === Pages.None ? category : false}
          onChange={handleChangeCategory}
        >
          <Menu.Label>
            {getLocalePhrase(appState.language, Phrase.RecordingsHeading)}
          </Menu.Label>
          {renderCategoryTab(VideoCategory.TwoVTwo, <Dice2 />)}
          {renderCategoryTab(VideoCategory.ThreeVThree, <Dice3 />)}
          {renderCategoryTab(VideoCategory.FiveVFive, <Dice5 />)}
          {renderCategoryTab(VideoCategory.Skirmish, <Sword />)}
          {renderCategoryTab(VideoCategory.SoloShuffle, <Swords />)}
          {renderCategoryTab(
            VideoCategory.MythicPlus,
            <FontAwesomeIcon icon={faDungeon} size="xl" />,
          )}
          {renderCategoryTab(
            VideoCategory.Raids,
            <FontAwesomeIcon icon={faDragon} size="lg" />,
          )}
          {renderCategoryTab(VideoCategory.Battlegrounds, <Goal />)}
          {renderCategoryTab(VideoCategory.Clips, <Clapperboard />)}
        </Menu>
        <Separator className="my-5" />
        <Menu
          initialValue={appState.page !== Pages.None ? appState.page : false}
          onChange={handleChangePage}
        >
          <Menu.Label>
            {getLocalePhrase(appState.language, Phrase.SettingsHeading)}
          </Menu.Label>
          {renderSettingsTab()}
          {renderSceneTab()}
        </Menu>
      </ScrollArea>
      <div className="mt-auto w-full">
        <Separator className="mb-4" />
        <div className="flex items-center justify-center gap-x-4">
          <UpgradeNotifier upgradeStatus={upgradeStatus} appState={appState} />
          <LogsButton appState={appState} />
          <TestButton recorderStatus={recorderStatus} appState={appState} />
          <DiscordButton appState={appState} />
        </div>
        {!!appVersion && (
          <div className="w-full mt-1 text-foreground font-sans text-[11px] font-bold text-center opacity-75">
            {getLocalePhrase(appState.language, Phrase.Version)} {appVersion}
          </div>
        )}
      </div>
    </div>
  );
};

export default SideMenu;
