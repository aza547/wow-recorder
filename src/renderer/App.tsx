import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import RendererTitleBar from './RendererTitleBar';
import SettingsButton from './SettingsButton';
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
      <SettingsButton />
      <LogButton />
      <DiscordButton />
      <TestButton />
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


