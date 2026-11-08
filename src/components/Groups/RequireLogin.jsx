import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { loginWithNext } from '../../utils/safeNext';

// Pagine dei gruppi solo per utenti autenticati: gli altri vanno al login e poi tornano qui
const RequireLogin = ({ children }) => {
  const { isLoggedIn, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!isLoggedIn) {
    return <Navigate to={loginWithNext(location)} replace />;
  }
  return children;
};

export default RequireLogin;
