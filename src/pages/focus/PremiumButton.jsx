import { Box, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useFocusColors } from './useFocusColors';
import { radius } from '../../theme/radius';

// Bottone outlined di Focus per le funzioni Premium. Se `locked`, sul bordo in alto a sinistra c'è l'etichetta
// "Premium" (con lo sfondo della pagina a coprire la linea) e il nome accessibile la ripete. L'etichetta sta
// accanto al bottone, non dentro: l'opacità di `faded` non la tocca.
const PremiumButton = ({ locked, label, startIcon, onClick, faded, wrapperSx }) => {
  const { t } = useTranslation();
  const { colors } = useFocusColors();
  return (
    <Box sx={{ position: 'relative', display: 'flex', ...wrapperSx }}>
      <Button variant="outlined" fullWidth startIcon={startIcon} onClick={onClick}
        aria-label={locked ? t('focus.premium_aria', { label }) : undefined}
        sx={{ py: 1.25, color: colors.textSecondary, borderColor: colors.border, borderRadius: radius.lg,
          '&:hover': { borderColor: colors.text, color: colors.text }, ...(faded && { opacity: 0.45 }) }}>
        {label}
      </Button>
      {locked && (
        <Box component="span" aria-hidden="true" sx={{
          position: 'absolute', top: 0, left: 12, transform: 'translateY(-50%)', px: 0.5,
          bgcolor: colors.bg, color: colors.textSecondary,
          fontSize: 12, fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          {t('common.premium')}
        </Box>
      )}
    </Box>
  );
};

export default PremiumButton;
