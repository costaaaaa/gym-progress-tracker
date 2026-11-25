import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useThemeMode } from '../../context/ThemeModeContext';
import FocusToolsOptions from '../../components/Focus/FocusToolsOptions';
import { DEFAULT_WEIGHT_UNIT, isWeightUnit } from '../../utils/weightUnit';
import { focusToolsSummary } from '../../utils/focusToolsSummary';
import ChoiceSettingBody from './ChoiceSettingBody';
import SettingDialog from './SettingDialog';
import SettingsGroup from './SettingsGroup';
import ValueRow from './ValueRow';
import WeeklyGoalBody from './WeeklyGoalBody';
import useAccountChoice from './useAccountChoice';
import useWeeklyGoalSetting from './useWeeklyGoalSetting';

// I nomi delle lingue non si traducono: ognuno è scritto nella sua
const LANGUAGES = [{ value: 'it', label: 'Italiano' }, { value: 'en', label: 'English' }];
const THEMES = ['system', 'light', 'dark'];

// I gruppi «Allenamento» (obiettivo settimanale, unità di misura, strumenti della serie) e «App» (lingua, tema) della pagina
// Profilo e preferenze: una riga col valore di adesso per impostazione e, cliccandola, la finestra col controllo. Una
// sola finestra è aperta alla volta: `dialog` è useRowDialog della pagina, che la divide con il gruppo «Tu». Il valore
// di ogni impostazione viene da `account` (la cornice lo aggiorna con `patchAccount` dopo un salvataggio): la riga e la
// finestra leggono lo stesso. Un salvataggio riuscito chiude la finestra e avvisa dalla pagina (`dialog.saved`); gli
// altri esiti stanno dentro la finestra. Il tema è di questo browser: la scelta vale al clic e chiude la finestra, senza
// richiesta al server né avviso.
const PreferenceGroups = ({ account, patchAccount, dialog }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { themePreference, setThemePreference } = useThemeMode();
  const { openKey, close } = dialog;
  // Gli interruttori degli strumenti salvano da soli (FocusToolsOptions): dicono qui se c'è un salvataggio in corso
  const [toolsSaving, setToolsSaving] = useState(false);

  const goal = useWeeklyGoalSetting(account, patchAccount);
  const unit = useAccountChoice({
    field: 'weight_unit',
    stored: isWeightUnit(account?.weight_unit) ? account.weight_unit : DEFAULT_WEIGHT_UNIT,
    errorText: t('account.weight_unit_error'),
    patchAccount,
  });
  const language = useAccountChoice({
    field: 'locale',
    stored: LANGUAGES.some((l) => l.value === account?.locale) ? account.locale : 'it',
    errorText: t('account.language_error'),
    patchAccount,
  });

  const openDialog = (key, setting) => dialog.open(key, setting?.clearOutcome);

  return (
    <>
      <SettingsGroup title={t('account.profile.group.training')}>
        <ValueRow title={t('account.weekly_goal.title')} value={goal.label} onClick={openDialog('goal', goal)} />
        <ValueRow title={t('account.weight_unit')} value={t(unit.value === 'lb' ? 'units.imperial_short' : 'units.metric_short')} onClick={openDialog('unit', unit)} />
        <ValueRow title={t('focus.tools.title')} value={focusToolsSummary(t, user)} onClick={openDialog('tools')} />
      </SettingsGroup>
      <SettingsGroup title={t('account.profile.group.app')}>
        <ValueRow title={t('account.language')} value={LANGUAGES.find((l) => l.value === language.value).label} onClick={openDialog('language', language)} />
        <ValueRow title={t('settings.theme')} value={t(`settings.theme_${themePreference}`)} onClick={openDialog('theme')} />
      </SettingsGroup>

      <SettingDialog open={openKey === 'goal'} title={t('account.weekly_goal.title')} onClose={close} saving={goal.saving}>
        <WeeklyGoalBody setting={goal} />
      </SettingDialog>
      <SettingDialog open={openKey === 'unit'} title={t('account.weight_unit')} onClose={close} saving={unit.saving}>
        <ChoiceSettingBody
          label={t('account.weight_unit')}
          options={[{ value: 'kg', label: t('units.metric') }, { value: 'lb', label: t('units.imperial') }]}
          value={unit.value}
          onChange={(next) => dialog.saved(unit.change(next), t('account.weight_unit_saved'))}
          saving={unit.saving}
          help={t('account.weight_unit_help')}
          example={t('account.weight_unit_example')}
          error={unit.error}
        />
      </SettingDialog>
      <SettingDialog open={openKey === 'tools'} title={t('focus.tools.title')} onClose={close} saving={toolsSaving}>
        <FocusToolsOptions idPrefix="account-focus-tools" onSavingChange={setToolsSaving} />
      </SettingDialog>
      <SettingDialog open={openKey === 'language'} title={t('account.language')} onClose={close} saving={language.saving}>
        <ChoiceSettingBody
          label={t('account.language')}
          options={LANGUAGES}
          value={language.value}
          onChange={(next) => dialog.saved(language.change(next), t('account.language_saved', { lng: next }))}
          saving={language.saving}
          help={t('account.language_help')}
          error={language.error}
        />
      </SettingDialog>
      <SettingDialog open={openKey === 'theme'} title={t('settings.theme')} onClose={close}>
        <ChoiceSettingBody
          label={t('settings.theme')}
          options={THEMES.map((value) => ({ value, label: t(`settings.theme_${value}`) }))}
          value={themePreference}
          onChange={(next) => { setThemePreference(next); close(); }}
          help={t('account.theme_help')}
        />
      </SettingDialog>
    </>
  );
};

export default PreferenceGroups;
