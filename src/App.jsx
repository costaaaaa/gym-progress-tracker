import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import './App.css';

// Import Layout
import Layout from './components/Layout';

// Import Auth Provider
import { AuthProvider } from './context/AuthContext';

// Lazy load Pages
const Home = lazy(() => import('./pages/Home'));
const WorkoutPlans = lazy(() => import('./pages/WorkoutPlans'));
const Progress = lazy(() => import('./pages/Progress'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const WorkoutHistory = lazy(() => import('./pages/WorkoutHistory'));
const Account = lazy(() => import('./pages/Account'));
const FocusWorkout = lazy(() => import('./pages/FocusWorkout'));
const BodyStats = lazy(() => import('./pages/BodyStats'));

// Fallback component while loading chunks
const PageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <CircularProgress />
  </Box>
);

// With homepage set to '/gym-progress-tracker-v2/' in package.json, we need to set the basename
// This ensures all routes work correctly when hosted in the subfolder

function App() {
  return (
    <AuthProvider>
      <Router basename="/gym-progress-tracker-v2">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Focus mode — full-screen senza Navbar */}
            <Route path="/focus" element={<FocusWorkout />} />
            
            {/* Tutte le altre pagine con Layout (Navbar + Container) */}
            <Route path="*" element={
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/workout-plans" element={<WorkoutPlans />} />
                    <Route path="/progress" element={<Progress />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/workout-history" element={<WorkoutHistory />} />
                    <Route path="/body-stats" element={<BodyStats />} />
                    <Route path="/account" element={<Account />} />
                  </Routes>
                </Suspense>
              </Layout>
            } />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
