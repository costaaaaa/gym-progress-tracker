import { createContext } from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// La barra in basso c'è solo sotto md, con l'accesso fatto, a email non bloccata e fuori da /focus (full screen).
// La regola serve alla barra, che decide se mostrarsi, e al Layout, che la dice agli avvisi delle pagine.
export const useBottomBarVisible = () => {
  const { pathname } = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { isLoggedIn, emailState } = useAuth();
  return isMobile && Boolean(isLoggedIn) && emailState?.blocked !== true && pathname !== '/focus';
};

// Il Layout passa la risposta alle pagine: così i loro avvisi non hanno bisogno di router e accesso, e fuori dal
// Layout (Focus) vale «nessuna barra».
export const BottomBarContext = createContext(false);
