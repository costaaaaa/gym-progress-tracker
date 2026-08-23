import React, { useState, useEffect } from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Avatar, useMediaQuery, IconButton, useTheme, Tooltip, CircularProgress } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useAuth } from '../../context/AuthContext';
import { useThemeMode } from '../../context/ThemeModeContext';

// Voci del centro nav desktop: Home / Allenamenti / Dashboard.
// Su mobile la navigazione vive in BottomNav.jsx (Home/Allenamenti/Focus/Dashboard/Profilo);
// qui restano solo logo, toggle tema e avatar — "Profilo" non ha un link testuale,
// l'avatar è l'unico ingresso, sia su desktop che su mobile.
const navItems = [
  { label: 'Home', path: '/' },
  { label: 'Allenamenti', path: '/workouts' },
  { label: 'Dashboard', path: '/dashboard' },
];

const Navbar = () => {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { mode, toggleThemeMode } = useThemeMode();

  // Utilizziamo il context invece della logica locale
  const { isLoggedIn, user, loading } = useAuth();

  // Stato locale per tracciare se l'autenticazione è stata verificata
  const [authVerified, setAuthVerified] = useState(false);

  // Aggiorniamo lo stato locale quando cambia lo stato di loading
  useEffect(() => {
    if (!loading) {
      setAuthVerified(true);
    }
  }, [loading]);

  const isActive = (path) => {
    return location.pathname === path;
  };

  const onProfilePage = location.pathname === '/profilo';
  const initials = user?.username ? user.username.charAt(0).toUpperCase() : '?';

  return (
    <AppBar position="sticky" elevation={0} sx={{ overflowX: 'hidden' }}>
      <Toolbar
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr auto', md: '1fr auto 1fr' },
          alignItems: 'center',
          minHeight: '64px !important',
          maxWidth: '1180px',
          mx: 'auto',
          width: '100%',
          px: { xs: 2, md: '32px' },
        }}
      >
        {/* Sinistra: logo */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.2,
            justifySelf: 'start',
            cursor: 'pointer',
            textDecoration: 'none',
            color: 'text.primary',
          }}
          component={RouterLink}
          to="/"
        >
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: '9px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <FitnessCenterIcon sx={{ fontSize: 18, color: '#fff' }} />
          </Box>
          <Typography
            sx={{
              fontFamily: '"Lexend", sans-serif',
              fontWeight: 700,
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            Gym Progress
          </Typography>
        </Box>

        {/* Centro: nav desktop, nascosta su mobile (su mobile la navigazione è in BottomNav) */}
        {!isMobile && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, justifySelf: 'center' }}>
            {authVerified && isLoggedIn && navItems.map((item) => (
              <Button
                key={item.path}
                component={RouterLink}
                to={item.path}
                disableRipple
                sx={{
                  minWidth: 0,
                  px: 0,
                  py: 1,
                  fontSize: 14,
                  fontWeight: isActive(item.path) ? 600 : 500,
                  color: isActive(item.path) ? 'primary.main' : 'text.secondary',
                  borderRadius: 0,
                  borderBottom: '2px solid',
                  borderColor: isActive(item.path) ? 'primary.main' : 'transparent',
                  '&:hover': {
                    backgroundColor: 'transparent',
                    color: 'primary.main',
                  },
                }}
              >
                {item.label}
              </Button>
            ))}
          </Box>
        )}

        {/* Destra: toggle tema, avatar / auth — stessa struttura su mobile e desktop */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, justifySelf: 'end' }}>
          <Tooltip title={mode === 'light' ? 'Modalità Scura' : 'Modalità Chiara'}>
            <IconButton
              onClick={toggleThemeMode}
              size="small"
              sx={{
                color: 'text.secondary',
                bgcolor: mode === 'light' ? '#f7f6f5' : 'rgba(255,255,255,0.06)',
                '&:hover': { bgcolor: mode === 'light' ? '#ececea' : 'rgba(255,255,255,0.12)' },
              }}
            >
              {mode === 'light' ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          {authVerified && isLoggedIn && (
            <Tooltip title="Profilo">
              <IconButton
                component={RouterLink}
                to="/profilo"
                sx={{
                  p: 0,
                  boxShadow: onProfilePage ? '0 0 0 2px #fff, 0 0 0 4px #d50000' : 'none',
                }}
              >
                <Avatar
                  sx={{
                    width: 34,
                    height: 34,
                    bgcolor: '#1a1816',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: '"Lexend", sans-serif',
                  }}
                >
                  {initials}
                </Avatar>
              </IconButton>
            </Tooltip>
          )}

          {!isLoggedIn && loading && (
            <CircularProgress size={22} sx={{ color: 'text.secondary' }} />
          )}

          {authVerified && !isLoggedIn && (
            <>
              <Button
                component={RouterLink}
                to="/login"
                sx={{ color: 'text.secondary', fontWeight: 500, fontSize: 14 }}
              >
                Accedi
              </Button>
              <Button
                variant="contained"
                component={RouterLink}
                to="/register"
                sx={{ fontSize: 14 }}
              >
                Registrati
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
