import {
  Clapperboard,
  Cog,
  Dice2,
  Dice3,
  Dice5,
  Goal,
  HardHat,
  MonitorCog,
  Play,
  Square,
  Sword,
  Swords,
} from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDungeon, faDragon } from '@fortawesome/free-solid-svg-icons';
import {
  ActivityStatus,
  AppState,
  ErrorReport,
  MicStatus,
  Pages,
  RecStatus,
  SaveStatus,
} from 'main/types';
import { MutableRefObject, useEffect, useRef, useState } from 'react';
import { ConfigurationSchema } from 'config/configSchema';
import {
  getLocaleCategoryLabel,
  getLocalePhrase,
} from 'localisation/translations';
import { VideoCategory } from '../types/VideoCategory';
import { setConfigValue } from './useSettings';
import { getCategoryIndex } from './rendererutils';
import Menu from './components/Menu';
import Separator from './components/Separator/Separator';
import LogsButton from './LogButton';
import TestButton from './TestButton';
import DiscordButton from './DiscordButton';
import ApplicationStatusCard from './containers/ApplicationStatusCard/ApplicationStatusCard';
import { ScrollArea } from './components/ScrollArea/ScrollArea';
import UpdateNotifier from './containers/UpdateNotifier/UpdateNotifier';
import CloudStatusCard from './containers/ApplicationStatusCard/CloudStatusCard';
import { Phrase } from 'localisation/phrases';
import PatreonButton from './PatreonButton';
import { Button } from './components/Button/Button';
import { Tooltip } from './components/Tooltip/Tooltip';

const ipc = window.electron.ipcRenderer;

interface IProps {
  recorderStatus: RecStatus;
  videoCounters: Record<VideoCategory, number>;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  persistentProgress: MutableRefObject<number>;
  error: string;
  micStatus: MicStatus;
  errorReports: ErrorReport[];
  savingStatus: SaveStatus;
  config: ConfigurationSchema;
  updateAvailable: boolean;
  recorderCategory: VideoCategory | undefined;
  activityStatus: ActivityStatus | null;
}

const SideMenu = (props: IProps) => {
  const {
    recorderStatus,
    recorderCategory,
    videoCounters,
    appState,
    setAppState,
    persistentProgress,
    error,
    micStatus,
    errorReports,
    savingStatus,
    config,
    updateAvailable,
    activityStatus,
  } = props;

  const [appVersion, setAppVersion] = useState<string>();
  const { category, language } = appState;
  const lastManualStartStopClickRef = useRef(0);

  useEffect(() => {
    window.electron.ipcRenderer.on('updateVersionDisplay', (t: unknown) => {
      if (typeof t === 'string') {
        setAppVersion(t.split('v')[1] as string);
      }
    });
  }, []);

  useEffect(() => {
    // If the recording status changes, reset the last manual start/stop click time.
    lastManualStartStopClickRef.current = 0;
  }, [recorderStatus]);

  const renderManualStopStartButton = () => {
    const recordingOrReady =
      recorderStatus !== RecStatus.Recording &&
      recorderStatus !== RecStatus.ReadyToRecord;

    const recordingNonManual =
      recorderCategory && recorderCategory !== VideoCategory.Manual;

    const disabled =
      !config.manualRecord || // Disable the buttons if manual recording is disabled.
      recordingOrReady || // Disable if not recording or ready to record.
      recordingNonManual; // If recording something else don't show the stop button.

    if (disabled) {
      return <></>;
    }

    let icon = <Play size={14} fill="currentColor" />;
    let tooltip = getLocalePhrase(language, Phrase.StartManualRecordingTooltip);

    if (recorderStatus === RecStatus.Recording) {
      icon = <Square size={14} fill="currentColor" />;
      tooltip = getLocalePhrase(language, Phrase.StopManualRecordingTooltip);
    }

    return (
      <Tooltip content={tooltip}>
        <Button
          size="sm"
          variant="ghost"
          className="mx-2 p-1 h-6 w-6 hover:bg-secondary"
          onClick={() => {
            // Drops spam clicks, only let one click per second.
            // Gets reset on recorder status change.
            const now = Date.now();
            if (now - lastManualStartStopClickRef.current < 1000) return;
            lastManualStartStopClickRef.current = now;
            ipc.toggleManualRecording();
          }}
        >
          {icon}
        </Button>
      </Tooltip>
    );
  };

  const renderCategoryTab = (
    tabCategory: VideoCategory,
    tabIcon: string | React.ReactNode,
  ) => {
    const numTotalVideos = Object.values(videoCounters).reduce((t, v) => t + v);
    const numCategoryVideos = videoCounters[tabCategory];

    const forceShowManual =
      tabCategory === VideoCategory.Manual && config.manualRecord;

    if (
      config.hideEmptyCategories && // Hide empty categories is enabled.
      numTotalVideos > 0 && // Only hide categories if there are atleast some videos.
      !forceShowManual && // Always show manual if manual recording is enabled, it has buttons on it.
      numCategoryVideos < 1 // If this category has no videos, so hide it.
    ) {
      return <></>;
    }

    return (
      <Menu.Item value={tabCategory} className="py-1.5">
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
        {getLocaleCategoryLabel(language, tabCategory)}
        {tabCategory === VideoCategory.Manual && renderManualStopStartButton()}
        <Menu.Item.Badge value={numCategoryVideos} />
      </Menu.Item>
    );
  };

  const renderSettingsTab = () => {
    return (
      <Menu.Item value={Pages.Settings} className="py-1.5">
        <Menu.Item.Icon>
          <Cog />
        </Menu.Item.Icon>
        {getLocalePhrase(language, Phrase.GeneralButtonText)}
      </Menu.Item>
    );
  };

  const renderSceneTab = () => {
    return (
      <Menu.Item value={Pages.SceneEditor} className="py-1.5">
        <Menu.Item.Icon>
          <MonitorCog />
        </Menu.Item.Icon>
        {getLocalePhrase(language, Phrase.SceneButtonText)}
      </Menu.Item>
    );
  };

  const handleChangeCategory = (newCategory: VideoCategory) => {
    const index = getCategoryIndex(newCategory);
    setConfigValue('selectedCategory', index);
    persistentProgress.current = 0;

    setAppState((prevState) => {
      return {
        ...prevState,
        videoFilterTags: [],
        page: Pages.None,
        category: newCategory,
        selectedVideos: [],
        multiPlayerMode: false,
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

  const mythicPlusIcon = <FontAwesomeIcon icon={faDungeon} size="xl" />;
  const raidsIcon = <FontAwesomeIcon icon={faDragon} size="lg" />;

  return (
    <div className="flex flex-col h-full bg-background w-80 px-4 items-center pt-4 pb-2">
      <ApplicationStatusCard
        recorderStatus={recorderStatus}
        activityStatus={activityStatus}
        error={error}
        micStatus={micStatus}
        errorReports={errorReports}
        savingStatus={savingStatus}
        config={config}
        appState={appState}
      />
      <CloudStatusCard appState={appState} />
      <Separator className="mb-4" />
      <ScrollArea
        className="w-full h-[calc(100%-80px)]"
        withScrollIndicators={false}
      >
        <Menu
          initialValue={appState.page === Pages.None ? category : false}
          onChange={handleChangeCategory}
        >
          <Menu.Label>
            {getLocalePhrase(language, Phrase.RecordingsHeading)}
          </Menu.Label>
          {renderCategoryTab(VideoCategory.TwoVTwo, <Dice2 />)}
          {renderCategoryTab(VideoCategory.ThreeVThree, <Dice3 />)}
          {renderCategoryTab(VideoCategory.FiveVFive, <Dice5 />)}
          {renderCategoryTab(VideoCategory.Skirmish, <Sword />)}
          {renderCategoryTab(VideoCategory.SoloShuffle, <Swords />)}
          {renderCategoryTab(VideoCategory.MythicPlus, mythicPlusIcon)}
          {renderCategoryTab(VideoCategory.Raids, raidsIcon)}
          {renderCategoryTab(VideoCategory.Battlegrounds, <Goal />)}
          {renderCategoryTab(VideoCategory.Manual, <HardHat />)}
          {renderCategoryTab(VideoCategory.Clips, <Clapperboard />)}
        </Menu>
        <Separator className="my-5" />
        <Menu
          initialValue={appState.page !== Pages.None ? appState.page : false}
          onChange={handleChangePage}
        >
          <Menu.Label>
            {getLocalePhrase(language, Phrase.SettingsHeading)}
          </Menu.Label>
          {renderSettingsTab()}
          {renderSceneTab()}
        </Menu>
      </ScrollArea>
      <div className="mt-auto w-full">
        <Separator className="mb-4" />
        <div className="flex items-center justify-center gap-x-4">
          <UpdateNotifier
            updateAvailable={updateAvailable}
            appState={appState}
          />
          <LogsButton appState={appState} />
          <TestButton recorderStatus={recorderStatus} appState={appState} />
          <DiscordButton appState={appState} />
          <PatreonButton appState={appState} />
        </div>
        {!!appVersion && (
          <div className="w-full mt-1 text-foreground font-sans text-[11px] font-bold text-center opacity-75">
            {getLocalePhrase(language, Phrase.Version)} {appVersion}
          </div>
        )}
      </div>
    </div>
  );
};

export default SideMenu;
