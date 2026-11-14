import { useTheme } from '@mui/material/styles';
import { useThemeMode } from '../../context/ThemeModeContext';

// Colori di Focus Mode dal tema MUI, condivisi da pagina e fasi
export function useFocusColors() {
  const theme = useTheme();
  const { mode } = useThemeMode();
  const isDarkMode = mode === 'dark';
  const colors = {
    bg: theme.palette.background.default,
    bgCard: theme.palette.background.paper,
    bgElevated: theme.palette.action.hover,
    primary: theme.palette.primary.main,
    // Rosso quando è il colore di un testo; `primary` resta per gli sfondi
    primaryText: theme.palette.primary.text,
    primaryDark: theme.palette.primary.dark,
    primaryContrast: theme.palette.primary.contrastText,
    text: theme.palette.text.primary,
    textSecondary: theme.palette.text.secondary,
    success: theme.palette.success.main,
    warning: theme.palette.warning.main,
    border: theme.palette.divider,
    fieldBorder: theme.palette.fieldBorder,
    white: theme.palette.common.white,
  };
  return { colors, isDarkMode };
}
