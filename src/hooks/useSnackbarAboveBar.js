import { createContext, useContext } from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BAR_HEIGHT } from '../components/Layout/barMetrics';

// Aria tra la barra e l'avviso, e distanza di un secondo avviso dal primo (un avviso con pulsante da 44 px più lo stacco)
const ABOVE_BAR_GAP = 16;
const STACK_GAP = 64;
// Distanza dal fondo che MUI dà agli avvisi da sm in su
const DEFAULT_BOTTOM = 24;

// La barra in basso c'è solo sotto md, con l'accesso fatto, a email non bloccata e fuori da /focus (full screen).
// La calcola il Layout, che la mostra e la passa agli avvisi delle pagine con BottomBarContext: così le pagine non
// hanno bisogno di router e accesso, e fuori dal Layout (Focus) vale «nessuna barra».
export const BottomBarContext = createContext(false);

export const useBottomBarVisible = () => {
  const { pathname } = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { isLoggedIn, emailState } = useAuth();
  return isMobile && Boolean(isLoggedIn) && emailState?.blocked !== true && pathname !== '/focus';
};

// sx di un Snackbar: sopra la barra (con l'area sicura) dove la barra c'è, altrimenti nessuno stile in più.
// stacked: un altro avviso è già a schermo e questo sta sopra di lui.
export const useSnackbarAboveBar = (stacked = false) => {
  const barVisible = useContext(BottomBarContext);
  if (barVisible) {
    return { bottom: `calc(${BAR_HEIGHT + ABOVE_BAR_GAP + (stacked ? STACK_GAP : 0)}px + env(safe-area-inset-bottom))` };
  }
  return stacked ? { bottom: DEFAULT_BOTTOM + STACK_GAP } : undefined;
};
