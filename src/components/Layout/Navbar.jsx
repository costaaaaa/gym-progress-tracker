import React, { useState, useEffect } from 'react';
import { AppBar, Toolbar, Typography, Button, Box, useMediaQuery, IconButton, Menu, MenuItem, useTheme, Tooltip, CircularProgress } from '@mui/material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import MenuIcon from '@mui/icons-material/Menu';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StraightenIcon from '@mui/icons-material/Straighten';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import { useAuth } from '../../context/AuthContext';
import { useThemeMode } from '../../context/ThemeModeContext';

const Navbar = () => {
  const location = useLocation();
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [anchorEl, setAnchorEl] = useState(null);
  const { mode, toggleThemeMode } = useThemeMode();
  
  // Utilizziamo il context invece della logica locale
  const { isLoggedIn, logout, loading } = useAuth();
  
  // Stato locale per tracciare se l'autenticazione è stata verificata
  const [authVerified, setAuthVerified] = useState(false);
  
  // Aggiorniamo lo stato locale quando cambia lo stato di loading
  useEffect(() => {
    if (!loading) {
      setAuthVerified(true);
    }
  }, [loading]);
  
  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    // Utilizziamo la funzione di logout dal context che gestisce tutto
    logout();
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const navItems = [
    ...(authVerified && isLoggedIn ? [
      { label: 'Focus', path: '/focus', variant: 'contained', icon: <PlayArrowIcon /> },
      { label: 'Allenamenti', path: '/workouts', icon: <FitnessCenterIcon /> },
      { label: 'Statistiche', path: '/dashboard', icon: <StraightenIcon /> }
    ] : [])
  ];

  return (
    <AppBar position="sticky" elevation={0} sx={{ 
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      overflowX: 'hidden',
      backgroundColor: mode === 'light' ? '#d50000 !important' : '#141416 !important',
      borderBottom: mode === 'light' ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
      '& .MuiToolbar-root': {
        minHeight: '72px!important'
      }
    }}>
      <Toolbar sx={{ 
        py: 0.5,
        maxWidth: '1200px',
        mx: 'auto',
        width: '100%',
        px: { xs: 2, md: 3 },
        overflowX: 'hidden',
        '.MuiBox-root': { flexWrap: 'nowrap' }
      }}>
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            flexGrow: 1, 
            cursor: 'pointer',
            '&:hover': {
              opacity: 0.95
            },
            textDecoration: 'none',
            color: 'white',
            gap: 1.5
          }}
          component={RouterLink}
          to="/"
        >
          <Box sx={{ bgcolor: 'white', p: 0.8, borderRadius: 2, display: 'flex' }}>
            <FitnessCenterIcon sx={{ fontSize: 24, transform: 'rotate(-20deg)', color: '#d50000' }} />
          </Box>
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <Typography 
              variant="h6" 
              component="div" 
              sx={{ 
                fontWeight: 800,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                fontSize: { xs: '1rem', md: '1.25rem' }
              }}
            >
              GYM TRACKER
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title={mode === 'light' ? 'Modalità Scura' : 'Modalità Chiara'}>
            <IconButton color="inherit" onClick={toggleThemeMode} sx={{ bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
              {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
            </IconButton>
          </Tooltip>

          {isMobile ? (
            <>
              <IconButton
                edge="end"
                color="inherit"
                aria-label="menu"
                onClick={handleMenu}
                sx={{ ml: 1, bgcolor: 'rgba(255,255,255,0.1)' }}
              >
                <MenuIcon sx={{ color: 'white' }} />
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                sx={{ 
                  '& .MuiPaper-root': {
                    backgroundColor: mode === 'light' ? '#d50000 !important' : '#141416 !important',
                    color: 'white !important',
                    borderRadius: 3,
                    mt: 1.5,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                    minWidth: '200px'
                  }
                }}
                PaperProps={{
                  sx:{
                    backgroundColor: mode === 'light' ? '#d50000 !important' : '#141416 !important',
                    color: 'white !important',
                    '& .MuiMenuItem-root': {
                      color: 'white !important',
                      py: 1.5,
                      fontWeight: 600,
                      '& svg': {
                        color: 'white !important',
                        mr: 1.5
                      }
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'white !important'
                    },
                    boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.2)'
                  }
                }}
              >
                {authVerified && isLoggedIn && (
                  <MenuItem 
                    component={RouterLink} 
                    to="/account"
                    onClick={handleClose}
                    sx={{
                      backgroundColor: isActive('/account') ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                      color: 'white'
                    }}
                  >
                    <PersonIcon fontSize="small" sx={{ mr: 1, color: 'white' }} />
                    Account
                  </MenuItem>
                )}

                {authVerified && isLoggedIn && (
                  <MenuItem 
                    onClick={() => { handleClose(); handleLogout(); }}
                    sx={{
                      '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
                      color: 'white'
                    }}
                  >
                    <LogoutIcon fontSize="small" sx={{ mr: 1, color: 'white' }} />
                    Esci
                  </MenuItem>
                )}
                 
                  {loading && (
                   <MenuItem disabled sx={{ color: 'white' }}>
                     <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
                     Verifica sessione...
                   </MenuItem>
                 )}
                 
                 {authVerified && !isLoggedIn && (
                   <>
                    <MenuItem 
                      component={RouterLink} 
                      to="/login"
                      onClick={handleClose}
                      sx={{
                        backgroundColor: isActive('/login') ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                        color: 'white'
                      }}
                    >
                      <PersonIcon fontSize="small" sx={{ mr: 1, color: 'white' }} />
                      Accedi
                    </MenuItem>
                    <MenuItem 
                      component={RouterLink} 
                      to="/register"
                      onClick={handleClose}
                      sx={{
                        backgroundColor: isActive('/register') ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                        color: 'white'
                      }}
                    >
                      Registrati
                    </MenuItem>
                   </>
                 )}
              </Menu>
            </>
          ) : (
            <Box 
              sx={{ 
                display: 'flex',
                alignItems: 'center',
                flexShrink: 1,
                gap: 1.5
              }}
            >
              {navItems.map((item) => (
                <Button 
                  key={item.path}
                  color={item.variant === 'contained' ? 'inherit' : 'inherit'}
                  variant={item.variant || 'text'}
                  component={RouterLink} 
                  to={item.path}
                  startIcon={item.icon}
                  sx={{
                    px: 2,
                    fontWeight: 'bold',
                    transition: 'all 0.3s',
                    color: item.variant === 'contained' ? (mode === 'light' ? '#d50000' : 'white') : 'white',
                    backgroundColor: item.variant === 'contained' ? (mode === 'light' ? 'white' : '#d50000') : 'transparent',
                    '&:hover': {
                      backgroundColor: item.variant === 'contained' ? (mode === 'light' ? 'rgba(255,255,255,0.9)' : 'rgba(213, 0, 0, 0.8)') : 'rgba(255, 255, 255, 0.15)'
                    },
                    borderBottom: !item.variant && isActive(item.path) ? '3px solid white' : 'none',
                    borderRadius: item.variant ? '8px' : '0'
                  }}
                >
                  {item.label}
                </Button>
              ))}
              
              {isLoggedIn && (
                <Tooltip title="Account">
                  <IconButton 
                    color="inherit" 
                    component={RouterLink} 
                    to="/account"
                    sx={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      backgroundColor: isActive('/account') ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.15)'
                      }
                    }}
                  >
                    <PersonIcon sx={{ color: 'white' }} />
                  </IconButton>
                </Tooltip>
                )}
                
                {isLoggedIn ? (
                  <Tooltip title="Logout">
                    <IconButton
                      color="inherit"
                      onClick={handleLogout}
                      sx={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        '&:hover': {
                          backgroundColor: 'rgba(255, 255, 255, 0.15)'
                        }
                      }}
                    >
                      <LogoutIcon sx={{ color: 'white' }} />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <>
                    {loading && (
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <CircularProgress size={24} color="inherit" sx={{ mx: 2, color: 'white' }} />
                      </Box>
                    )}
                    
                    {authVerified && !isLoggedIn && (
                      <>
                        <Button 
                          color="inherit"
                          component={RouterLink} 
                          to="/login"
                          sx={{
                            backgroundColor: isActive('/login') ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                            color: 'white'
                          }}
                        >
                          Accedi
                        </Button>
                        <Button 
                          color="inherit"
                          component={RouterLink} 
                          to="/register"
                          sx={{
                            backgroundColor: isActive('/register') ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                            color: 'white'
                          }}
                        >
                          Registrati
                        </Button>
                      </>
                    )}
                  </>
                )}
              </Box>
            )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;