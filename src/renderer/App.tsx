import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import RendererTitleBar from './RendererTitleBar';
import SettingsButton from './SettingsButton';
import VersionUpdateWidget from './VersionUpdateWidget';
import Status from './Status';
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
      <Status />
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


