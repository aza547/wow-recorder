import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import React from 'react';
import {
  RecStatus,
  SaveStatus,
  TNavigatorState,
  UpgradeStatus,
} from 'main/types';
import Box from '@mui/material/Box';
import Layout from './Layout';
import RendererTitleBar from './RendererTitleBar';
import BottomStatusBar from './BottomStatusBar';
import './App.css';
import { getEmptyState } from './rendererutils';

const ipc = window.electron.ipcRenderer;

const Application = () => {
  const [recorderStatus, setRecorderStatus] = React.useState<RecStatus>(
    RecStatus.InvalidConfig
  );

  const [error, setError] = React.useState<string>('');

  const [upgradeStatus, setUpgradeStatus] = React.useState<UpgradeStatus>({
    available: false,
    link: undefined,
  });

  const [savingStatus, setSavingStatus] = React.useState<SaveStatus>(
    SaveStatus.NotSaving
  );

  const [videoState, setVideoState] = React.useState<any>(getEmptyState());
  const [navigation, setNavigation] = React.useState<TNavigatorState>({
    categoryIndex: -1,
    videoIndex: -1,
  });

  // Limit the number of videos displayed for performance. User can load more
  // by clicking the button, but mainline case will be to watch back recent
  // videos.
  const [numVideosDisplayed, setNumVideosDisplayed] = React.useState(10);

  React.useEffect(() => {
    ipc.on('refreshState', async () => {
      setVideoState(await ipc.invoke('getVideoState', []));
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
  }, []);

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
        videoState={videoState}
        numVideosDisplayed={numVideosDisplayed}
        setNumVideosDisplayed={setNumVideosDisplayed}
      />
      <BottomStatusBar
        navigation={navigation}
        setNavigation={setNavigation}
        recorderStatus={recorderStatus}
        error={error}
        upgradeStatus={upgradeStatus}
        savingStatus={savingStatus}
        setNumVideosDisplayed={setNumVideosDisplayed}
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
