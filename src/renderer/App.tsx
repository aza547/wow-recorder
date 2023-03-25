import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import React from 'react';
import { TNavigatorState } from 'main/types';
import Layout from './Layout';
import RendererTitleBar from './RendererTitleBar';
import BottomStatusBar from './BottomStatusBar';
import './App.css';

const Application = () => {
  const [navigation, setNavigationState] = React.useState<TNavigatorState>(
    {
      // @@@ TODO get selectedCategory config?
      categoryIndex: -1,
      videoIndex: -1,
    }
  );

  console.log(navigation);

  return (
    <div className="App">
      <RendererTitleBar />
      <Layout
        navigation={navigation}
        setNavigationState={setNavigationState}
      />
      <BottomStatusBar
        navigation={navigation}
        setNavigationState={setNavigationState}
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
