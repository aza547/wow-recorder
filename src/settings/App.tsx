import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import Settings from './Settings';
import SettingsTitleBar from './SettingsTitleBar';
import './SettingsTitleBar.css';
import './Settings.css';


const Application = () => {
  return (
    <div className="App">
      <SettingsTitleBar />
      <Settings />
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


