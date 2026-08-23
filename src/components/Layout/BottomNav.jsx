import React from 'react';
import { Box, ButtonBase, useMediaQuery, useTheme } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EqualizerIcon from '@mui/icons-material/Equalizer';
import { useAuth } from '../../context/AuthContext';

// Voce di navigazione standard (icona + etichetta), come link/bottone accessibile
// (component=RouterLink su ButtonBase: focus da tastiera, aria-current sulla voce attiva).
const NavItem = ({ path, label, Icon, active }) => (
  <ButtonBase
    component={RouterLink}
    to={path}
    disableRipple
    aria-current={active ? 'page' : undefined}
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '3px',
      height: '100%',
      borderRadius: 0,
    }}
  >
    <Icon sx={{ fontSize: 21, color: active ? 'primary.main' : 'text.secondary' }} />
    <Box
      component="span"
      sx={{ fontSize: '10.5px', fontWeight: active ? 700 : 500, color: active ? 'primary.main' : 'text.secondary' }}
    >
      {label}
    </Box>
  </ButtonBase>
);

// Barra di navigazione mobile fissa in basso: Home / Allenamenti / Focus (FAB rialzato) /
// Dashboard / Profilo. Sostituisce il menu hamburger di Navbar.jsx su mobile, che restava
// l'unico accesso a queste destinazioni: qui è sempre visibile durante l'uso dell'app.
const BottomNav = () => {
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { isLoggedIn, user } = useAuth();

  if (!isMobile || !isLoggedIn) return null;

  // La modalità Focus vive fuori dal Layout (full screen, senza Navbar): niente barra lì.
  if (location.pathname === '/focus') return null;

  const isActive = (path) => location.pathname === path;
  const initials = user?.username ? user.username.charAt(0).toUpperCase() : '?';
  const profileActive = isActive('/profilo');

  return (
    <Box
      component="nav"
      aria-label="Navigazione principale"
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        display: { xs: 'grid', md: 'none' },
        gridTemplateColumns: '1fr 1fr 68px 1fr 1fr',
        height: '64px',
        bgcolor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
        pb: 'env(safe-area-inset-bottom)',
      }}
    >
      <NavItem path="/" label="Home" Icon={HomeOutlinedIcon} active={isActive('/')} />
      <NavItem path="/workouts" label="Allenamenti" Icon={CalendarTodayOutlinedIcon} active={isActive('/workouts')} />

      <ButtonBase
        component={RouterLink}
        to="/focus"
        disableRipple
        aria-label="Focus, inizia allenamento"
        sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', borderRadius: 0 }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: 'translateY(-14px)',
            boxShadow: '0 8px 18px rgba(213,0,0,0.4)',
            border: '4px solid',
            borderColor: 'background.default',
          }}
        >
          <PlayArrowIcon sx={{ color: '#fff', fontSize: 22 }} />
        </Box>
        <Box component="span" sx={{ fontSize: '10.5px', fontWeight: 700, color: 'primary.main', transform: 'translateY(-10px)' }}>
          Focus
        </Box>
      </ButtonBase>

      <NavItem path="/dashboard" label="Dashboard" Icon={EqualizerIcon} active={isActive('/dashboard')} />

      <ButtonBase
        component={RouterLink}
        to="/profilo"
        disableRipple
        aria-current={profileActive ? 'page' : undefined}
        sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', height: '100%', borderRadius: 0 }}
      >
        <Box
          sx={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            bgcolor: profileActive ? 'primary.main' : 'text.primary',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: '"Lexend", sans-serif',
            fontSize: '9.5px',
            fontWeight: 700,
          }}
        >
          {initials}
        </Box>
        <Box component="span" sx={{ fontSize: '10.5px', fontWeight: profileActive ? 700 : 500, color: profileActive ? 'primary.main' : 'text.secondary' }}>
          Profilo
        </Box>
      </ButtonBase>
    </Box>
  );
};

export default BottomNav;
