import { alpha } from '@mui/material/styles';
import { CHIP_FONT } from '../../utils/fonts';

// Stile di una scelta che si preme (cella della tecnica, etichetta del giorno): carattere dei chip, bordo sempre da 1 px.
// La scelta si vede dal peso del testo, dal colore e dal bordo ispessito da un'ombra interna: l'ingombro non cambia.
export const choiceSx = (colors, selected) => ({
  ...CHIP_FONT,
  ...(selected && { fontWeight: 700 }),
  color: selected ? colors.primaryText : colors.textSecondary,
  border: `1px solid ${selected ? colors.primary : colors.fieldBorder}`,
  boxShadow: selected ? `inset 0 0 0 1px ${colors.primary}` : 'none',
  bgcolor: selected ? alpha(colors.primary, 0.12) : 'transparent',
});
