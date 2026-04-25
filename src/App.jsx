import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

// Import Layout
import Layout from './components/Layout';

// Import Pages
import Home from './pages/Home';
import WorkoutPlans from './pages/WorkoutPlans';
import Progress from './pages/Progress';
import Login from './pages/Login';
import Register from './pages/Register';
import WorkoutHistory from './pages/WorkoutHistory';
import Account from './pages/Account';
import FocusWorkout from './pages/FocusWorkout';

// Import Auth Provider
import { AuthProvider } from './context/AuthContext';

// With homepage set to '/gym-progress-tracker-v2/' in package.json, we need to set the basename
// This ensures all routes work correctly when hosted in the subfolder

function App() {
  return (
    <AuthProvider>
      <Router basename="/gym-progress-tracker-v2">
        <Routes>
          {/* Focus mode — full-screen senza Navbar */}
          <Route path="/focus" element={<FocusWorkout />} />
          
          {/* Tutte le altre pagine con Layout (Navbar + Container) */}
          <Route path="*" element={
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/workout-plans" element={<WorkoutPlans />} />
                <Route path="/progress" element={<Progress />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/workout-history" element={<WorkoutHistory />} />
                <Route path="/account" element={<Account />} />
              </Routes>
            </Layout>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
