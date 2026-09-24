import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import './App.css';

// Import Layout
import Layout from './components/Layout';

// Import Auth Provider
import { AuthProvider } from './context/AuthContext';

// Lazy load Pages
const Home = lazy(() => import('./pages/Home'));
const Workouts = lazy(() => import('./pages/Workouts'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const FocusWorkout = lazy(() => import('./pages/FocusWorkout'));
const Profile = lazy(() => import('./pages/Profile'));
const Groups = lazy(() => import('./pages/Groups'));
const GroupDetail = lazy(() => import('./pages/GroupDetail'));
const JoinGroup = lazy(() => import('./pages/JoinGroup'));

// Fallback component while loading chunks
const PageLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <CircularProgress color="primary" />
  </Box>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
              {/* Focus mode — full-screen senza Navbar */}
              <Route path="/focus" element={<FocusWorkout />} />
              
              {/* Tutte le altre pagine con Layout (Navbar + Container) */}
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/workouts" element={<Workouts />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/profilo" element={<Profile />} />
                <Route path="/gruppi" element={<Groups />} />
                <Route path="/gruppi/:id" element={<GroupDetail />} />
                <Route path="/entra" element={<JoinGroup />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                
                {/* Redirect per retrocompatibilità */}
                <Route path="/account" element={<Navigate to="/profilo?tab=settings" replace />} />
                <Route path="/workout-plans" element={<Navigate to="/workouts?tab=plans" replace />} />
                <Route path="/workout-history" element={<Navigate to="/workouts?tab=history" replace />} />
                <Route path="/progress" element={<Navigate to="/dashboard?tab=progress" replace />} />
                <Route path="/body-stats" element={<Navigate to="/dashboard?tab=body" replace />} />
                
                {/* Fallback a Home per rotte non trovate */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
