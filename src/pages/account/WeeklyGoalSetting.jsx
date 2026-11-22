import { useState } from 'react';
import { Box, Typography, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { format, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { CHIP_FONT } from '../../utils/fonts';
import { saveSettings } from './saveSettings';

const goalSettings = (data) => ({
  weekly_goal: data.weekly_goal ?? null,
  weekly_goal_default: data.weekly_goal_default ?? 3,
  weekly_goal_pending: data.weekly_goal_pending ?? null,
});

// L'obiettivo mostrato è quello scelto per ultimo: il cambio in attesa, se c'è, altrimenti quello in vigore
const shownChoice = (settings) => {
  const shown = settings.weekly_goal_pending ? settings.weekly_goal_pending.goal : settings.weekly_goal;
  return shown ?? 'default';
};

// Obiettivo settimanale: parte dai valori di `account` e si salva appena si sceglie; se il salvataggio fallisce torna
// alla scelta di prima.
const WeeklyGoalSetting = ({ account, notify }) => {
  const { t } = useTranslation();
  const [weeklyGoal, setWeeklyGoal] = useState(() => goalSettings(account ?? {}));
  const [weeklyGoalChoice, setWeeklyGoalChoice] = useState(() => shownChoice(goalSettings(account ?? {})));
  const [saving, setSaving] = useState(false);

  const applyWeeklyGoalSettings = (data) => {
    const settings = goalSettings(data);
    setWeeklyGoal(settings);
    setWeeklyGoalChoice(shownChoice(settings));
  };

  const handleWeeklyGoalChange = async (_event, next) => {
    if (next === null || next === weeklyGoalChoice) return;
    const previousSettings = weeklyGoal;
    const previousChoice = weeklyGoalChoice;
    setWeeklyGoalChoice(next);
    setSaving(true);
    try {
      const data = await saveSettings({ weekly_goal: next === 'default' ? null : next });
      applyWeeklyGoalSettings(data);
      notify(t('account.weekly_goal.saved'), 'success');
    } catch (error) {
      console.error('Errore aggiornamento obiettivo settimanale:', error);
      setWeeklyGoal(previousSettings);
      setWeeklyGoalChoice(previousChoice);
      notify(t('account.weekly_goal.error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
      <Box>
        <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{t('account.weekly_goal.title')}</Typography>
        <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 0.5 }}>
          {t('account.weekly_goal.help')}
        </Typography>
      </Box>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={weeklyGoalChoice}
        onChange={handleWeeklyGoalChange}
        disabled={saving}
        aria-label={t('account.weekly_goal.title')}
        sx={{ flexWrap: 'wrap', alignSelf: 'flex-start' }}
      >
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <ToggleButton key={n} value={n} sx={{ minWidth: 40, fontSize: 16, ...CHIP_FONT }}>{n}</ToggleButton>
        ))}
        <ToggleButton value="default" sx={{ fontSize: 16, ...CHIP_FONT }}>
          {t('account.weekly_goal.default', { n: weeklyGoal.weekly_goal_default })}
        </ToggleButton>
      </ToggleButtonGroup>
      <Typography sx={{ fontSize: 16, color: 'text.secondary' }}>
        {weeklyGoal.weekly_goal_pending
          ? t('account.weekly_goal.from_date', { date: format(parseISO(weeklyGoal.weekly_goal_pending.from), 'dd/MM') })
          : t('account.weekly_goal.now')}
      </Typography>
    </Box>
  );
};

export default WeeklyGoalSetting;
