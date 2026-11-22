import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import './App.css';

// Import Layout
import Layout from './components/Layout';

// Import Auth Provider
import { AuthProvider } from './context/AuthContext';
import LocaleSync from './i18n/LocaleSync';
import EmailBlockGuard from './components/EmailVerification/EmailBlockGuard';
import LegacyWorkoutsRedirect from './pages/LegacyWorkoutsRedirect';
import DashboardRedirect from './pages/progress/DashboardRedirect';

// Lazy load Pages
const Home = lazy(() => import('./pages/Home'));
const Plans = lazy(() => import('./pages/Plans'));
const PlanPage = lazy(() => import('./pages/plans/PlanPage'));
const ExercisesPage = lazy(() => import('./pages/plans/ExercisesPage'));
const History = lazy(() => import('./pages/History'));
const WorkoutPage = lazy(() => import('./pages/history/WorkoutPage'));
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
const Admin = lazy(() => import('./pages/Admin'));

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
        <LocaleSync />
        <Suspense fallback={<PageLoader />}>
          <Routes>
              {/* Focus mode — full-screen senza Navbar */}
              <Route path="/focus" element={<EmailBlockGuard><FocusWorkout /></EmailBlockGuard>} />
              
              {/* Tutte le altre pagine con Layout (Navbar + Container) */}
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/schede" element={<Plans />} />
                <Route path="/schede/esercizi" element={<ExercisesPage />} />
                <Route path="/schede/:id" element={<PlanPage />} />
                <Route path="/storico" element={<History />} />
                <Route path="/storico/:id" element={<WorkoutPage />} />
                <Route path="/progressi" element={<Dashboard />} />
                <Route path="/profilo" element={<Profile />} />
                <Route path="/gruppi" element={<Groups />} />
                <Route path="/gruppi/:id" element={<GroupDetail />} />
                <Route path="/entra" element={<JoinGroup />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* Pagine pubbliche in inglese: stessa UI, lingua dall'URL */}
                <Route path="/en">
                  <Route index element={<Home />} />
                  <Route path="login" element={<Login />} />
                  <Route path="register" element={<Register />} />
                  <Route path="forgot-password" element={<ForgotPassword />} />
                  <Route path="reset-password" element={<ResetPassword />} />
                  <Route path="*" element={<Navigate to="/en/" replace />} />
                </Route>
                
                {/* Redirect per retrocompatibilità */}
                <Route path="/account" element={<Navigate to="/profilo?tab=settings" replace />} />
                <Route path="/workouts" element={<LegacyWorkoutsRedirect />} />
                <Route path="/workout-plans" element={<LegacyWorkoutsRedirect to="/schede" />} />
                <Route path="/workout-history" element={<LegacyWorkoutsRedirect to="/storico" />} />
                <Route path="/dashboard" element={<DashboardRedirect />} />
                <Route path="/progress" element={<Navigate to="/progressi?tab=progress" replace />} />
                <Route path="/body-stats" element={<Navigate to="/progressi?tab=body" replace />} />
                
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
