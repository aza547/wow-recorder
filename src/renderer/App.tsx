import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import './App.css';

const Hello = () => {
  return (
    <div className="Hello">    
      <Layout/> 
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  );
}
