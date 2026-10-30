import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';

// Etichetta "Risc." delle serie di riscaldamento
export default function WarmupBadge({ sx }) {
  const { t } = useTranslation();
  return (
    <Box component="span" sx={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase',
      color: 'warning.main', border: '1px solid', borderColor: 'warning.main', borderRadius: '6px', px: 0.5, lineHeight: 1.6, ...sx,
    }}>
      {t('common.warmup_badge')}
    </Box>
  );
}
