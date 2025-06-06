import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CrashData,
  Crashes,
  MicStatus,
  Pages,
  RecStatus,
  SaveStatus,
  AppState,
  RendererVideo,
  CloudStatus,
  DiskStatus,
  StorageFilter,
} from 'main/types';
import Box from '@mui/material/Box';
import { getLocalePhrase, Language, Phrase } from 'localisation/translations';
import Layout from './Layout';
import RendererTitleBar from './RendererTitleBar';
import './App.css';
import { useSettings } from './useSettings';
import { getCategoryFromConfig } from './rendererutils';
import { TooltipProvider } from './components/Tooltip/Tooltip';
import Toaster from './components/Toast/Toaster';
import SideMenu from './SideMenu';
import { useToast } from './components/Toast/useToast';
import { Button } from './components/Button/Button';
import { ErrorBoundary } from 'react-error-boundary';
import { RefreshCcw } from 'lucide-react';
import { VideoCategory } from 'types/VideoCategory';

const ipc = window.electron.ipcRenderer;

const WarcraftRecorder = () => {
  const [config, setConfig] = useSettings();
  const [error, setError] = useState<string>('');
  const [micStatus, setMicStatus] = useState<MicStatus>(MicStatus.NONE);
  const [crashes, setCrashes] = useState<Crashes>([]);
  const updateNotified = useRef(false);
  const { toast } = useToast();

  const [recorderStatus, setRecorderStatus] = useState<RecStatus>(
    RecStatus.WaitingForWoW,
  );

  const [savingStatus, setSavingStatus] = useState<SaveStatus>(
    SaveStatus.NotSaving,
  );

  const [updateAvailable, setUpdateAvailable] = useState(false);

  const [appState, setAppState] = useState<AppState>({
    // Navigation.
    page: Pages.None,
    category: getCategoryFromConfig(config),
    selectedVideos: [],
    multiPlayerMode: false,
    viewpointSelectionOpen: false,

    // Any text applied in the filter bar gets translated into a filter here.
    videoFilterTags: [],

    // Date range filter.
    dateRangeFilter: {
      startDate: null,
      endDate: null,
    },

    // The storage filter.
    storageFilter: StorageFilter.BOTH,

    // We use this to conditionally hide the recording preview.
    videoFullScreen: false,

    // This allows us to retain the playing state of the video when switching viewpoints.
    playing: false,

    // The language the client is in.
    language: config.language as Language,

    // The cloud storage status.
    cloudStatus: {
      guild: '',
      available: [],
      read: false,
      write: false,
      del: false,
      usage: 0,
      limit: 0,
    },

    // The disk storage status.
    diskStatus: { usage: 0, limit: 0 },
  });

  // The video state contains most of the frontend state.
  const [videoState, setVideoState] = useState<RendererVideo[]>([]);

  // The counters for display on the side menu. It's convient to keep these
  // seperate to the video state so we can apply filtering without changing the
  // counters.
  const videoCounters = useMemo<Record<VideoCategory, number>>(() => {
    const counts = {
      [VideoCategory.TwoVTwo]: 0,
      [VideoCategory.ThreeVThree]: 0,
      [VideoCategory.FiveVFive]: 0,
      [VideoCategory.Skirmish]: 0,
      [VideoCategory.SoloShuffle]: 0,
      [VideoCategory.MythicPlus]: 0,
      [VideoCategory.Raids]: 0,
      [VideoCategory.Battlegrounds]: 0,
      [VideoCategory.Clips]: 0,
    };

    // Don't count the same video with different storage types twice. Still
    // count different points of view of the same activity multiple times.
    const seen: string[] = [];

    videoState.forEach((rv) => {
      if (seen.includes(rv.videoName)) return;
      counts[rv.category]++;
      seen.push(rv.videoName);
    });

    return counts;
  }, [videoState]);

  // Used to allow for hot switching of video players when moving between POVs.
  const persistentProgress = useRef(0);

  // Used to remember the player height when switching categories.
  const playerHeight = useRef(500);

  const doRefresh = async () => {
    ipc.sendMessage('refreshFrontend', []);
    const state = (await ipc.invoke('getVideoState', [])) as RendererVideo[];
    setVideoState(state);

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

  const onUpdateAvailable = () => {
    setUpdateAvailable(true);

    if (updateNotified.current) {
      // We already told the user. Don't bother them again.
      return;
    }

    const title = getLocalePhrase(
      appState.language,
      Phrase.UpdateAvailableTitle,
    );

    const description = getLocalePhrase(
      appState.language,
      Phrase.UpdateAvailableText,
    );

    const installButtonText = getLocalePhrase(
      appState.language,
      Phrase.UpdateAvailableInstallButtonText,
    );

    const remindButtonText = getLocalePhrase(
      appState.language,
      Phrase.UpdateAvailableRemindButtonText,
    );

    const updateToast = toast({
      title,
      description,
      duration: 60000,
      action: (
        <div className="flex gap-2">
          <Button
            onClick={() => {
              updateToast.dismiss();
              ipc.sendMessage('doAppUpdate', []);
            }}
          >
            {installButtonText}
          </Button>
          <Button variant="secondary" onClick={() => updateToast.dismiss()}>
            {remindButtonText}
          </Button>
        </div>
      ),
    });

    // Don't show this prompt again.
    updateNotified.current = true;
  };

  useEffect(() => {
    doRefresh();
    ipc.on('refreshState', doRefresh);
    ipc.on('updateRecStatus', updateRecStatus);
    ipc.on('updateSaveStatus', updateSaveStatus);
    ipc.on('updateMicStatus', updateMicStatus);
    ipc.on('updateCrashes', updateCrashes);
    ipc.on('updateDiskStatus', updateDiskStatus);
    ipc.on('updateCloudStatus', updateCloudStatus);
    ipc.on('updateAvailable', onUpdateAvailable);

    return () => {
      ipc.removeAllListeners('refreshState');
      ipc.removeAllListeners('updateRecStatus');
      ipc.removeAllListeners('updateSaveStatus');
      ipc.removeAllListeners('updateMicStatus');
      ipc.removeAllListeners('updateCrashes');
      ipc.removeAllListeners('updateDiskStatus');
      ipc.removeAllListeners('updateCloudStatus');
      ipc.removeAllListeners('updateAvailable');
    };
  }, []);

  return (
    <ErrorBoundary fallbackRender={renderErrorPage}>
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
              videoCounters={videoCounters}
              appState={appState}
              setAppState={setAppState}
              persistentProgress={persistentProgress}
              error={error}
              micStatus={micStatus}
              crashes={crashes}
              savingStatus={savingStatus}
              config={config}
              updateAvailable={updateAvailable}
            />
            <Layout
              recorderStatus={recorderStatus}
              videoState={videoState}
              setVideoState={setVideoState}
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
    </ErrorBoundary>
  );
};

const renderErrorPage = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background">
      <h1 className="text-2xl font-bold text-secondary-foreground">
        It&apos;s a wipe, blame the <s>healer</s> programmer.
      </h1>
      <h2 className="text-md font-semibold text-foreground">
        You hit a bug in the code. Please try refreshing.
      </h2>
      <Button className="m-2" onClick={() => window.location.reload()}>
        <RefreshCcw />
      </Button>
    </div>
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
