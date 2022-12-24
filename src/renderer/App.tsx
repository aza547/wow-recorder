import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import RendererTitleBar from './RendererTitleBar';
import SettingsButton from './SettingsButton';
import VersionUpdateWidget from './VersionUpdateWidget';
import SavingStatus from './SavingStatus';
import RecorderStatus from './RecorderStatus';
import LogButton from './LogButton';
import DiscordButton from './DiscordButton';
import TestButton from './TestButton';
import './App.css';

const Application = () => {
  return (
    <div className="App">
      <RendererTitleBar />
      <Layout />
      <div className="app-buttons">
        <SettingsButton />
        <LogButton />
        <DiscordButton />
        <TestButton />
      </div>
      <VersionUpdateWidget />
      <SavingStatus />
      <RecorderStatus />
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
