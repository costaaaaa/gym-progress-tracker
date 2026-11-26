import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { PERIODS, PERIOD_UI } from '../../utils/bodyStatsPeriod';
import { radius } from '../../theme/radius';
import ChoiceChip from '../../components/ChoiceChip';

// Pillole del periodo: lo stile del chip scelto è quello di ChoiceChip (il rosso resta sull'azione principale).
const PeriodChips = ({ value, onChange }) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }} role="group" aria-label={t('body.period_label')}>
      {PERIODS.map((period) => {
        const selected = period === value;
        return (
          <ChoiceChip
            key={period}
            label={t(PERIOD_UI[period].label)}
            selected={selected}
            onClick={() => onChange(period)}
            sx={{ fontSize: 13, height: 32, borderRadius: radius.pill, px: 0.5 }}
          />
        );
      })}
    </Box>
  );
};

export default PeriodChips;
