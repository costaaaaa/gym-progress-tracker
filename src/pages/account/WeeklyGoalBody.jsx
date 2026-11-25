import { Typography, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { format, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { CHIP_FONT } from '../../utils/fonts';
import SettingOutcome from './SettingOutcome';

// Corpo della finestra dell'obiettivo settimanale: l'aiuto, i pulsanti da 1 a 7 e «Default», da che lunedì vale la scelta
// e l'esito. Salva al clic e la finestra resta aperta. Mentre si salva i pulsanti restano attivi (un controllo
// disabilitato perde il fuoco) e il gruppo è «occupato». `setting` è useWeeklyGoalSetting.
const WeeklyGoalBody = ({ setting }) => {
  const { t } = useTranslation();
  const { fields, value, saving, error, status, change } = setting;

  return (
    <>
      <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>{t('account.weekly_goal.help')}</Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={value}
        onChange={(_event, next) => { if (next !== null) change(next); }}
        aria-label={t('account.weekly_goal.title')}
        aria-busy={saving}
        sx={{ flexWrap: 'wrap', mt: 1.5 }}
      >
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <ToggleButton key={n} value={n} sx={{ minWidth: 44, minHeight: 44, fontSize: 16, ...CHIP_FONT }}>{n}</ToggleButton>
        ))}
        <ToggleButton value="default" sx={{ minHeight: 44, fontSize: 16, ...CHIP_FONT }}>
          {t('account.weekly_goal.default', { n: fields.weekly_goal_default })}
        </ToggleButton>
      </ToggleButtonGroup>
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
