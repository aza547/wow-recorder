import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import React from 'react';
import { TNavigatorState } from 'main/types';
import Layout from './Layout';
import RendererTitleBar from './RendererTitleBar';
import BottomStatusBar from './BottomStatusBar';
import './App.css';

const ipc = window.electron.ipcRenderer;

const Application = () => {
  const [navigation, setNavigation] = React.useState<TNavigatorState>({
    categoryIndex: -1,
    videoIndex: -1,
  });

  const [videoState, setVideoState] = React.useState<any>({});

  console.log(navigation);
  console.log(videoState);

  React.useEffect(() => {
    ipc.on('refreshState', async () => {
      setVideoState(await ipc.invoke('getVideoState', []));
    });
  }, []);

  return (
    <div className="App">
      <RendererTitleBar />
      <Layout
        navigation={navigation}
        setNavigation={setNavigation}
        videoState={videoState}
        setVideoState={setVideoState}
      />
      <BottomStatusBar
        navigation={navigation}
        setNavigation={setNavigation}
        videostate={videoState}
      />
    </div>
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
