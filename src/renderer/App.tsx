import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import RendererTitleBar from './RendererTitleBar';
import VersionUpdateWidget from './VersionUpdateWidget';
import SavingStatus from './SavingStatus';
import RecorderStatus from './RecorderStatus';

import './App.css';
import BottomStatusBar from './BottomStatusBar';

const Application = () => {
  return (
    <div className="App">
      <RendererTitleBar />
      <Layout />
      <BottomStatusBar />
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
