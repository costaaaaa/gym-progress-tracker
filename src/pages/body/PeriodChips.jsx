import { Box, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { PERIODS, PERIOD_UI } from '../../utils/bodyStatsPeriod';
import { radius } from '../../theme/radius';

// Pillole: piena in inchiostro se selezionata, con il contorno le altre (il rosso resta sull'azione principale).
const PeriodChips = ({ value, onChange }) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }} role="group" aria-label={t('body.period_label')}>
      {PERIODS.map((period) => {
        const selected = period === value;
        return (
          <Chip
            key={period}
            label={t(PERIOD_UI[period].label)}
            clickable
            variant={selected ? 'filled' : 'outlined'}
            onClick={() => onChange(period)}
            aria-pressed={selected}
            sx={{
              fontSize: 13, height: 32, borderRadius: radius.pill, px: 0.5,
              ...(selected
                ? { bgcolor: 'text.primary', color: 'background.paper', '&:hover, &.Mui-focusVisible': { bgcolor: 'text.primary' } }
                : { borderColor: 'divider', color: 'text.primary' }),
            }}
          />
        );
      })}
    </Box>
  );
};

export default PeriodChips;
