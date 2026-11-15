import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useFocusColors } from './useFocusColors';

// Etichetta "Premium" sul bordo in alto a sinistra di un bottone riservato a Premium, come quella di un campo
// outlined: lo sfondo della pagina copre la linea del bordo. Va dentro un contenitore `position: relative`,
// fuori dal bottone (così non segue la sua opacità) e non occupa spazio. Per i lettori di schermo il nome
// "Premium" è nell'aria-label del bottone.
const PremiumBadge = () => {
  const { t } = useTranslation();
  const { colors } = useFocusColors();
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        position: 'absolute', top: 0, left: 12, transform: 'translateY(-50%)', px: 0.5,
        bgcolor: colors.bg, color: colors.textSecondary,
        fontSize: 12, fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', pointerEvents: 'none',
      }}
    >
      {t('common.premium')}
    </Box>
  );
};

export default PremiumBadge;
