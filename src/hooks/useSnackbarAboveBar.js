import { useContext } from 'react';
import { BottomBarContext } from './useBottomBarVisible';
import { BAR_HEIGHT } from '../components/Layout/barMetrics';

// Aria tra la barra e l'avviso, e distanza di un secondo avviso dal primo (un avviso con pulsante da 44 px più lo stacco)
const ABOVE_BAR_GAP = 16;
const STACK_GAP = 64;
// Distanza dal fondo che MUI dà agli avvisi da sm in su
const DEFAULT_BOTTOM = 24;

// sx di un Snackbar: sopra la barra (con l'area sicura) dove la barra c'è, altrimenti nessuno stile in più.
// stacked: un altro avviso è già a schermo e questo sta sopra di lui.
export const useSnackbarAboveBar = (stacked = false) => {
  const barVisible = useContext(BottomBarContext);
  if (barVisible) {
    return { bottom: `calc(${BAR_HEIGHT + ABOVE_BAR_GAP + (stacked ? STACK_GAP : 0)}px + env(safe-area-inset-bottom))` };
  }
  return stacked ? { bottom: DEFAULT_BOTTOM + STACK_GAP } : undefined;
};
