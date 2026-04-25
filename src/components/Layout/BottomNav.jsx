import React from 'react';
import { BottomNavigation, BottomNavigationAction, Paper, useMediaQuery, useTheme } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import StraightenIcon from '@mui/icons-material/Straighten';
import { useAuth } from '../../context/AuthContext';

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { isLoggedIn } = useAuth();

  if (!isMobile || !isLoggedIn) return null;

  // Don't show in Focus mode if we are already there (though App.jsx excludes Layout for /focus)
  if (location.pathname === '/focus') return null;

  const handleChange = (event, newValue) => {
    navigate(newValue);
  };

  return (
    <Paper 
      sx={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        zIndex: 1000,
        borderRadius: '12px 12px 0 0',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        display: { xs: 'block', md: 'none' }
      }} 
      elevation={3}
    >
      <BottomNavigation
        value={location.pathname}
        onChange={handleChange}
        showLabels
        sx={{
          height: 65,
          '& .Mui-selected': {
            color: theme.palette.primary.main,
            '& .MuiSvgIcon-root': {
              transform: 'scale(1.2)',
              transition: 'transform 0.2s'
            }
          }
        }}
      >
        <BottomNavigationAction
          label="Focus"
          value="/focus"
          icon={<PlayArrowIcon />}
        />
        <BottomNavigationAction
          label="Schede"
          value="/workout-plans"
          icon={<FitnessCenterIcon />}
        />
        <BottomNavigationAction
          label="Progressi"
          value="/progress"
          icon={<DirectionsRunIcon />}
        />
        <BottomNavigationAction
          label="Misure"
          value="/body-stats"
          icon={<StraightenIcon />}
        />
        <BottomNavigationAction
          label="Storia"
          value="/workout-history"
          icon={<CalendarTodayIcon />}
        />
      </BottomNavigation>
    </Paper>
  );
};

export default BottomNav;
