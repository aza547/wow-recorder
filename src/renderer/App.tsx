import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  CrashData,
  Crashes,
  MicStatus,
  Pages,
  RecStatus,
  SaveStatus,
  AppState,
  UpgradeStatus,
  RendererVideo,
  CloudStatus,
  DiskStatus,
} from 'main/types';
import Box from '@mui/material/Box';
import { ArrowBigDownDash } from 'lucide-react';
import { getLocalePhrase, Language, Phrase } from 'localisation/translations';
import Layout from './Layout';
import RendererTitleBar from './RendererTitleBar';
import './App.css';
import { useSettings } from './useSettings';
import { getCategoryFromConfig } from './rendererutils';
import StateManager from './StateManager';
import { TooltipProvider } from './components/Tooltip/Tooltip';
import Toaster from './components/Toast/Toaster';
import { useToast } from './components/Toast/useToast';
import { ToastAction } from './components/Toast/Toast';
import SideMenu from './SideMenu';

const ipc = window.electron.ipcRenderer;

const WarcraftRecorder = () => {
  const [config, setConfig] = useSettings();
  const [error, setError] = useState<string>('');
  const [micStatus, setMicStatus] = useState<MicStatus>(MicStatus.NONE);
  const [crashes, setCrashes] = useState<Crashes>([]);
  const upgradeNotified = useRef(false);
  const { toast } = useToast();

  const [recorderStatus, setRecorderStatus] = useState<RecStatus>(
    RecStatus.WaitingForWoW,
  );

  const [upgradeStatus, setUpgradeStatus] = useState<UpgradeStatus>({
    available: false,
    link: undefined,
  });

  const [savingStatus, setSavingStatus] = useState<SaveStatus>(
    SaveStatus.NotSaving,
  );

  const [appState, setAppState] = useState<AppState>({
    // Navigation.
    page: Pages.None,
    category: getCategoryFromConfig(config),
    playingVideo: undefined,

    // Any text applied in the filter bar gets translated into a filter here.
    videoFilterQuery: '',

    // We use this to conditionally hide the recording preview.
    videoFullScreen: false,

    // This allows us to retain the playing state of the video when switching viewpoints.
    playing: false,

    // The language the client is in.
    language: config.language as Language,

    // The cloud storage usage and limit.
    cloudStatus: { usage: 0, limit: 0, guilds: [] },
    diskStatus: { usage: 0, limit: 0 },
  });

  useEffect(() => {
    if (upgradeNotified.current) return;

    const title = getLocalePhrase(
      appState.language,
      Phrase.UpdateAvailableTitle,
    );

    const description = getLocalePhrase(
      appState.language,
      Phrase.UpdateAvailableText,
    );

    const buttonText = getLocalePhrase(
      appState.language,
      Phrase.UpdateAvailableDownloadButtonText,
    );

    if (upgradeStatus.available) {
      toast({
        title,
        description,
        action: (
          <ToastAction
            altText={buttonText}
            onClick={() => ipc.sendMessage('openURL', [upgradeStatus.link])}
          >
            <ArrowBigDownDash /> {buttonText}
          </ToastAction>
        ),
        duration: 60000, // stay up for a minute I guess
      });
      upgradeNotified.current = true;
    }
  }, [upgradeStatus, upgradeNotified, toast, appState.language]);

  // The video state contains most of the frontend state, it's complex so
  // frontend triggered modifications go through the StateManager class, which
  // calls the React set function appropriately.
  const [videoState, setVideoState] = useState<RendererVideo[]>([]);

  const stateManager = useRef<StateManager>(
    StateManager.getInstance(setVideoState, appState, setAppState),
  );

  // Used to allow for hot switching of video players when moving between POVs.
  const persistentProgress = useRef(0);

  // Used to remember the player height when switching categories.
  const playerHeight = useRef(500);

  const doRefresh = async () => {
    ipc.sendMessage('refreshFrontend', []);
    stateManager.current.refresh();

    setAppState((prevState) => {
      return {
        ...prevState,
        // Fixes issue 410 which caused the preview not to re-appear if
        // refreshState triggered when full screen.
        videoFullScreen: false,
      };
    });
  };

  const updateRecStatus = (status: unknown, err: unknown) => {
    setRecorderStatus(status as RecStatus);

    if (status === RecStatus.InvalidConfig || status === RecStatus.FatalError) {
      setError(err as string);
    }
  };

  const updateSaveStatus = (status: unknown) => {
    setSavingStatus(status as SaveStatus);
  };

  const updateUpgradeStatus = (available: unknown, link: unknown) => {
    setUpgradeStatus({
      available: available as boolean,
      link: link as string,
    });
  };

  const updateMicStatus = (status: unknown) => {
    setMicStatus(status as MicStatus);
  };

  const updateCrashes = (crash: unknown) => {
    setCrashes((prevArray) => [...prevArray, crash as CrashData]);
  };

  const updateDiskStatus = (status: unknown) => {
    setAppState((prevState) => {
      return {
        ...prevState,
        diskStatus: status as DiskStatus,
      };
    });
  };

  const updateCloudStatus = (status: unknown) => {
    setAppState((prevState) => {
      return {
        ...prevState,
        cloudStatus: status as CloudStatus,
      };
    });
  };

  useEffect(() => {
    doRefresh();
    ipc.on('refreshState', doRefresh);
    ipc.on('updateRecStatus', updateRecStatus);
    ipc.on('updateSaveStatus', updateSaveStatus);
    ipc.on('updateUpgradeStatus', updateUpgradeStatus);
    ipc.on('updateMicStatus', updateMicStatus);
    ipc.on('updateCrashes', updateCrashes);
    ipc.on('updateDiskStatus', updateDiskStatus);
    ipc.on('updateCloudStatus', updateCloudStatus);
  }, []);

  // Debugging why we needed this hurt. I think it's because when we call setAppState, it sets
  // appState to undefined and reassigns it in this component. However that leaves the StateManager
  // singleton with a reference pointing to undefined which breaks the frontend. So here we reapply
  // the appState to the StateManager every time it updates. This is almost certainly massively
  // overengineered but for now it works.
  useEffect(() => {
    stateManager.current.updateAppState(appState);
  }, [appState]);

  return (
    <Box
      id="main-box"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
      }}
    >
      <Toaster />
      <TooltipProvider>
        <RendererTitleBar />
        <div className="flex flex-row items-center h-full w-full font-sans">
          <SideMenu
            recorderStatus={recorderStatus}
            videoState={videoState}
            appState={appState}
            setAppState={setAppState}
            persistentProgress={persistentProgress}
            error={error}
            micStatus={micStatus}
            crashes={crashes}
            upgradeStatus={upgradeStatus}
            savingStatus={savingStatus}
            config={config}
          />
          <Layout
            recorderStatus={recorderStatus}
            stateManager={stateManager}
            videoState={videoState}
            appState={appState}
            setAppState={setAppState}
            persistentProgress={persistentProgress}
            playerHeight={playerHeight}
            config={config}
            setConfig={setConfig}
          />
        </div>
      </TooltipProvider>
    </Box>
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WarcraftRecorder />} />
      </Routes>
    </Router>
  );
}
