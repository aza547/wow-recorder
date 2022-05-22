import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import TitleBar from '../utils/TitleBar';
import SettingsButton from './SettingsButton';
import './App.css';

const Application = () => {
  return (
    <div className="App">
      <TitleBar />
      <Layout />
      <SettingsButton />
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


