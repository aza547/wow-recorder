import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import Recorder from './Recorder';

const Application = () => {
  return (
    <div className="App">
      <Recorder />
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


