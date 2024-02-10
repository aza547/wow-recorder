import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import React from 'react';
import {
  CrashData,
  Crashes,
  MicStatus,
  Pages,
  RecStatus,
  RendererVideoState,
  SaveStatus,
  TAppState,
  TNavigatorState,
  UpgradeStatus,
} from 'main/types';
import Box from '@mui/material/Box';
import Layout from './Layout';
import RendererTitleBar from './RendererTitleBar';
import BottomStatusBar from './BottomStatusBar';
import './App.css';
import { getEmptyState } from './rendererutils';
import { useSettings } from './useSettings';

const ipc = window.electron.ipcRenderer;

const Application = () => {
  const [config] = useSettings();

  const [recorderStatus, setRecorderStatus] = React.useState<RecStatus>(
    RecStatus.WaitingForWoW
  );

  const [error, setError] = React.useState<string>('');

  const [upgradeStatus, setUpgradeStatus] = React.useState<UpgradeStatus>({
    available: false,
    link: undefined,
  });

  const [savingStatus, setSavingStatus] = React.useState<SaveStatus>(
    SaveStatus.NotSaving
  );

  const [videoState, setVideoState] = React.useState<RendererVideoState>(
    getEmptyState()
  );

  const [navigation, setNavigation] = React.useState<TNavigatorState>({
    categoryIndex: config.selectedCategory,
    videoIndex: 0,
    page: Pages.None,
  });

  const [appState, setAppState] = React.useState<TAppState>({
    // If the app hits a fatal error, we set this to true and provide a reason.
    fatalError: false,
    fatalErrorText: '',

    // Limit the number of videos displayed for performance. User can load more
    // by clicking the button, but mainline case will be to watch back recent
    // videos.
    numVideosDisplayed: 10,

    // Any text applied in the filter bar gets translated into a filter here.
    videoFilterQuery: '',

    // We use this to conditionally hide the recording preview.
    videoFullScreen: false,
  });

  const [micStatus, setMicStatus] = React.useState<MicStatus>(MicStatus.NONE);

  const [crashes, setCrashes] = React.useState<Crashes>([]);

  React.useEffect(() => {
    ipc.on('refreshState', async () => {
      setVideoState(
        (await ipc.invoke('getVideoState', [])) as RendererVideoState
      );

      // Fixes issue 410 which caused the preview not to re-appear if
      // refreshState triggered when full screen.
      setAppState((prevState) => {
        return {
          ...prevState,
          videoFullScreen: false,
        };
      });
    });

    ipc.on('updateRecStatus', (status, err) => {
      setRecorderStatus(status as RecStatus);

      if (
        status === RecStatus.InvalidConfig ||
        status === RecStatus.FatalError
      ) {
        setError(err as string);
      }
    });

    ipc.on('updateSaveStatus', (status) => {
      setSavingStatus(status as SaveStatus);
    });

    ipc.on('updateUpgradeStatus', (available, link) => {
      setUpgradeStatus({
        available: available as boolean,
        link: link as string,
      });
    });

    ipc.on('updateMicStatus', (status) => {
      setMicStatus(status as MicStatus);
    });

    ipc.on('updateCrashes', (crash) => {
      setCrashes((prevArray) => [...prevArray, crash as CrashData]);
    });
  });

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
      <RendererTitleBar />
      <Layout
        navigation={navigation}
        setNavigation={setNavigation}
        recorderStatus={recorderStatus}
        videoState={videoState}
        setVideoState={setVideoState}
        appState={appState}
        setAppState={setAppState}
      />
      <BottomStatusBar
        recorderStatus={recorderStatus}
        error={error}
        upgradeStatus={upgradeStatus}
        savingStatus={savingStatus}
        micStatus={micStatus}
        crashes={crashes}
      />
    </Box>
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Application />} />
      </Routes>
    </Router>
  );
}
