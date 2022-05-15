import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import TitleBar from './TitleBar';
import './App.css';


const Application = () => {
  return (
    <div className="App">
      <TitleBar />
      <Layout />
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


