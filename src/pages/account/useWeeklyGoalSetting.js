import { useTranslation } from 'react-i18next';
import { saveSettings } from './saveSettings';
import useSettingSave from './useSettingSave';

// I tre campi dell'obiettivo settimanale, dall'account o dalla risposta del server
const goalFields = (data) => ({
  weekly_goal: data.weekly_goal ?? null,
  weekly_goal_default: data.weekly_goal_default ?? 3,
  weekly_goal_pending: data.weekly_goal_pending ?? null,
});

// L'obiettivo mostrato è quello scelto per ultimo: il cambio in attesa, se c'è, altrimenti quello in vigore
const shownChoice = (goal) => {
  const shown = goal.weekly_goal_pending ? goal.weekly_goal_pending.goal : goal.weekly_goal;
  return shown ?? 'default';
};

// L'obiettivo settimanale dell'account. `goal` sono i suoi tre campi; `value` la scelta mostrata (un numero da 1 a 7 o
// 'default'), la stessa per la riga e per la finestra: quella dell'account e, solo mentre si salva, la scelta in corso;
// `label` è il testo della riga. `change(next)` salva, mette i tre campi della risposta nell'account della cornice
// (`patchAccount`) e torna true se è riuscito: la finestra resta aperta e l'esito sta in `status` o in `error`.
export default function useWeeklyGoalSetting(account, patchAccount) {
  const { t } = useTranslation();
  const { pending, error, status, save, clearOutcome } = useSettingSave({
    errorText: t('account.weekly_goal.error'),
    savedText: t('account.weekly_goal.saved'),
  });
  const goal = goalFields(account ?? {});
  const value = pending ?? shownChoice(goal);
  const label = value === 'default'
    ? t('account.weekly_goal.default', { n: goal.weekly_goal_default })
    : t('account.weekly_goal.value', { count: value });

  const change = (next) => save(next, async () => {
    const data = await saveSettings({ weekly_goal: next === 'default' ? null : next });
    patchAccount(goalFields(data));
  });

  return { goal, value, label, saving: pending !== null, error, status, change, clearOutcome };
}
