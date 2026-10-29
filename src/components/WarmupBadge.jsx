import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';

// Etichetta "Risc." delle serie di riscaldamento; `color` è un percorso del tema o un colore (default warning.main)
export default function WarmupBadge({ color = 'warning.main', sx }) {
  const { t } = useTranslation();
  return (
    <Box component="span" sx={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase',
      color, border: '1px solid', borderColor: color, borderRadius: '6px', px: 0.5, lineHeight: 1.6, ...sx,
    }}>
      {t('common.warmup_badge')}
    </Box>
  );
}
