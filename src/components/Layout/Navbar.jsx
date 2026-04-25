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
import { useAuth } from '../../context/AuthContext';

const Navbar = () => {
  const location = useLocation();
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [anchorEl, setAnchorEl] = useState(null);
  
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

  const handleLogout = async () => {
    try {
      // Use process.env.PUBLIC_URL to ensure the API path is correct for the prova-gym subfolder
      const apiUrl = `${process.env.PUBLIC_URL || ''}/backend/api/user/logout.php`;
      await fetch(apiUrl, {
        method: 'POST',
        credentials: 'include'
      });
      
      // Utilizziamo la funzione di logout dal context
      logout();
      
      // Redirect to home
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  const navItems = [
    ...(authVerified && isLoggedIn ? [
      { label: 'Focus', path: '/focus' },
      { label: 'Schede', path: '/workout-plans' },
      { label: 'Progressi', path: '/progress' },
      { label: 'Misure', path: '/body-stats' },
      { label: 'Cronologia', path: '/workout-history' }
    ] : [])
  ];

  return (
    <AppBar position="static" sx={{ 
      boxShadow: 3,
      overflowX: 'hidden',
      backgroundColor: '#d50000 !important',
      '& .MuiToolbar-root': {
        minHeight: '64px!important'
      }
    }}>
      <Toolbar sx={{ 
        py: 1,
        maxWidth: '100%',
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
              opacity: 0.9
            },
            textDecoration: 'none'
          }}
          component={RouterLink}
          to="/"
        >
          <FitnessCenterIcon sx={{ mr: 1, fontSize: 28, transform: 'rotate(-20deg)', color: '#ffffff' }} />
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              fontWeight: 'bold',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              background: isMobile ? 'none' : 'linear-gradient(45deg, #ffffff 30%, #e0e0e0 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: isMobile ? 'white' : 'transparent'
            }}
          >
            GYM PROGRESS TRACKER
          </Typography>
        </Box>
        
        {isMobile ? (
          <>
            <IconButton
              edge="end"
              color="inherit"
              aria-label="menu"
              onClick={handleMenu}
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
                  backgroundColor: '#d50000 !important',
                  color: 'white !important'
                }
              }}
              PaperProps={{
                sx:{
                  backgroundColor: '#d50000 !important',
                  color: 'white !important',
                  '& .MuiMenuItem-root': {
                    color: 'white !important',
                    '& svg': {
                      color: 'white !important',
                      mr: 1
                    }
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'white !important'
                  },
                  boxShadow: '0px 5px 15px rgba(0, 0, 0, 0.2)'
                }
              }}
            >
              {navItems.map((item) => (
                <MenuItem 
                  key={item.path} 
                  component={RouterLink} 
                  to={item.path}
                  onClick={handleClose}
                  sx={{
                    backgroundColor: isActive(item.path) ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    borderRadius: '4px',
                    my: 0.5,
                    transition: 'all 0.2s',
                    color: 'white!important',
                    fontWeight: '500'
                  }}
                >
                  {item.path === '/focus' && <PlayArrowIcon sx={{ mr: 1, color: 'white!important' }} />}
                  {item.path === '/workout-plans' && <FitnessCenterIcon sx={{ mr: 1, color: 'white!important' }} />}
                  {item.path === '/progress' && <DirectionsRunIcon sx={{ mr: 1, color: 'white!important' }} />}
                  {item.path === '/body-stats' && <StraightenIcon sx={{ mr: 1, color: 'white!important' }} />}
                  {item.path === '/workout-history' && <CalendarTodayIcon sx={{ mr: 1, color: 'white!important' }} />}
                  {item.label}
                </MenuItem>
              ))}
              
              {authVerified && isLoggedIn && (
                <MenuItem 
                  component={RouterLink} 
                  to="/account"
                  onClick={handleClose}
                  sx={{
                    minWidth: 40,
                    justifyContent: 'center',
                    backgroundColor: isActive('/account') ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    color: 'white'
                  }}
                >
                  <PersonIcon fontSize="small" sx={{ color: 'white' }} />
                </MenuItem>
              )}

              {authVerified && isLoggedIn && (
                <MenuItem 
                  onClick={() => { handleClose(); handleLogout(); }}
                  sx={{
                    minWidth: 40,
                    justifyContent: 'center',
                    '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
                    color: 'white'
                  }}
                >
                  <LogoutIcon fontSize="small" sx={{ color: 'white' }} />
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
              minWidth: 0,
              overflowX: 'auto',
              '& > *': {
                flexShrink: 0,
                mx: theme.spacing(0.5),
                [theme.breakpoints.between('sm', 'md')]: {
                  padding: '6px 12px',
                  fontSize: '0.875rem',
                  minWidth: 'auto'
                }
              },
              [theme.breakpoints.between('sm', 'md')]: {
                maxWidth: '85vw',
                margin: '0 auto',
                scrollSnapType: 'x mandatory',
                '&::-webkit-scrollbar': {
                  display: 'none'
                }
              }
            }}
          >
            {navItems.map((item) => (
              <Button 
                key={item.path}
                color="inherit" 
                component={RouterLink} 
                to={item.path}
                startIcon={
                  item.path === '/focus' ? <PlayArrowIcon sx={{ color: 'white' }} /> :
                  item.path === '/workout-plans' ? <FitnessCenterIcon sx={{ color: 'white' }} /> : 
                  item.path === '/progress' ? <DirectionsRunIcon sx={{ color: 'white' }} /> : 
                  item.path === '/body-stats' ? <StraightenIcon sx={{ color: 'white' }} /> : 
                  item.path === '/workout-history' ? <CalendarTodayIcon sx={{ color: 'white' }} /> : null
                }
                sx={{
                  mx: 0.5,
                  px: 2,
                  borderRadius: '8px',
                  position: 'relative',
                  fontWeight: 'bold',
                  transition: 'all 0.3s',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.15)'
                  },
                  '&::after': isActive(item.path) ? {
                    content: '""',
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: '3px',
                    backgroundColor: 'white',
                    borderRadius: '3px 3px 0 0',
                  } : {}
                }}
              >
                {item.label}
              </Button>
            ))}
            
            {isLoggedIn && (
              <Tooltip title="Account">
                <Button 
                  color="inherit" 
                  component={RouterLink} 
                  to="/account"
                  sx={{
                    mx: 0.5,
                    width: '40px',
                    height: '40px',
                    minWidth: '40px',
                    padding: 0,
                    borderRadius: '8px',
                    position: 'relative',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    transition: 'all 0.3s',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.15)'
                    },
                    '&::after': isActive('/account') ? {
                      content: '""',
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      width: '100%',
                      height: '3px',
                      backgroundColor: 'white',
                      borderRadius: '3px 3px 0 0',
                    } : {}
                  }}
                >
                  <PersonIcon sx={{ color: 'white' }} />
                </Button>
              </Tooltip>
              )}
              
              {isLoggedIn ? (
                <Tooltip title="Logout">
                  <Button
                    color="inherit"
                    onClick={handleLogout}
                    sx={{
                      mx: 0.5,
                      width: '40px',
                      height: '40px',
                      minWidth: '40px',
                      padding: 0,
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      transition: 'all 0.3s',
                      color: 'white',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.15)'
                      }
                    }}
                  >
                    <LogoutIcon sx={{ color: 'white' }} />
                  </Button>
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
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;