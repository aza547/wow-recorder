import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import Settings from './Settings';
import TitleBar from './TitleBar';
import './TitleBar.css';
import './Settings.css';


const Application = () => {
  return (
    <div className="App">
      <TitleBar />
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


