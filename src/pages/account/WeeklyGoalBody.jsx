import { Box, Typography, ToggleButton } from '@mui/material';
import { format, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { CHIP_FONT } from '../../utils/fonts';
import { radius } from '../../theme/radius';
import SettingOutcome from './SettingOutcome';

// Una scelta: da 44 px, in Lexend come i chip che si premono; ognuna ha il suo bordo (stanno in una griglia, non attaccate)
const CHOICE = { minHeight: 44, fontSize: 16, borderRadius: radius.md, ...CHIP_FONT };

// Corpo della finestra dell'obiettivo settimanale: l'aiuto, i pulsanti da 1 a 7 (quattro colonne uguali sotto sm, sette da
// sm) e «Default» su una riga sua, da che lunedì vale la scelta e l'esito. Salva al clic e la finestra resta aperta. Mentre
// si salva i pulsanti restano attivi (un controllo disabilitato perde il fuoco) e il gruppo è «occupato». Uno solo è
// premuto (`selected`). `setting` è useWeeklyGoalSetting.
const WeeklyGoalBody = ({ setting }) => {
  const { t } = useTranslation();
  const { fields, value, saving, error, status, change } = setting;
  // Premere la scelta già attiva non salva di nuovo
  const pick = (next) => { if (next !== value) change(next); };

  return (
    <>
      <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>{t('account.weekly_goal.help')}</Typography>
      <Box
        role="group"
        aria-label={t('account.weekly_goal.title')}
        aria-busy={saving}
        sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(4, minmax(0, 1fr))', sm: 'repeat(7, minmax(0, 1fr))' }, gap: 1, mt: 1.5 }}
      >
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <ToggleButton key={n} value={n} selected={value === n} onChange={() => pick(n)} sx={CHOICE}>{n}</ToggleButton>
        ))}
        <ToggleButton value="default" selected={value === 'default'} onChange={() => pick('default')} sx={{ ...CHOICE, gridColumn: '1 / -1' }}>
          {t('account.weekly_goal.default', { n: fields.weekly_goal_default })}
        </ToggleButton>
      </Box>
      <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 1.5 }}>
        {fields.weekly_goal_pending
          ? t('account.weekly_goal.from_date', { date: format(parseISO(fields.weekly_goal_pending.from), 'dd/MM') })
          : t('account.weekly_goal.now')}
      </Typography>
      <SettingOutcome status={status} error={error} />
    </>
  );
};

export default WeeklyGoalBody;
