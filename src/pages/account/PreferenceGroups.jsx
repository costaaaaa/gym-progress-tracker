import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
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

// I gruppi «Allenamento» (obiettivo settimanale, unità di misura, strumenti della serie) e «App» (lingua) della pagina
// Profilo e preferenze: una riga col valore di adesso per impostazione e, cliccandola, la finestra col controllo. Una
// sola finestra è aperta alla volta. Il valore di ogni impostazione viene da `account` (la cornice lo aggiorna con
// `patchAccount` dopo un salvataggio): la riga e la finestra leggono lo stesso. Gli esiti che chiudono la finestra vanno a
// notify(messaggio, gravità) della cornice, dopo la chiusura; gli altri stanno dentro la finestra.
const PreferenceGroups = ({ account, patchAccount, notify }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [openKey, setOpenKey] = useState(null);
  const lastRow = useRef(null);

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

  // Alla chiusura il fuoco torna sulla riga che ha aperto la finestra (non tutti i browser danno il fuoco al clic su un
  // pulsante: quello che ricorda la finestra non basta)
  useEffect(() => {
    if (openKey === null) lastRow.current?.focus();
  }, [openKey]);

  const openDialog = (key, setting) => (event) => {
    lastRow.current = event.currentTarget;
    setting?.clearOutcome();
    setOpenKey(key);
  };
  const close = () => setOpenKey(null);

  // Scelta di un'impostazione che chiude la finestra: se il salvataggio riesce, chiude e avvisa dalla pagina
  const choose = (setting, saved) => async (next) => {
    if (await setting.change(next)) {
      close();
      notify(saved(next), 'success');
    }
  };

  return (
    <>
      <SettingsGroup title={t('account.profile.group.training')}>
        <ValueRow title={t('account.weekly_goal.title')} value={goal.label} onClick={openDialog('goal', goal)} />
        <ValueRow title={t('account.weight_unit')} value={t(unit.value === 'lb' ? 'units.imperial_short' : 'units.metric_short')} onClick={openDialog('unit', unit)} />
        <ValueRow title={t('focus.tools.title')} value={focusToolsSummary(t, user)} onClick={openDialog('tools')} />
      </SettingsGroup>
      <SettingsGroup title={t('account.profile.group.app')}>
        <ValueRow title={t('account.language')} value={LANGUAGES.find((l) => l.value === language.value).label} onClick={openDialog('language', language)} />
      </SettingsGroup>

      <SettingDialog open={openKey === 'goal'} title={t('account.weekly_goal.title')} onClose={close} saving={goal.saving}>
        <WeeklyGoalBody setting={goal} />
      </SettingDialog>
      <SettingDialog open={openKey === 'unit'} title={t('account.weight_unit')} onClose={close} saving={unit.saving}>
        <ChoiceSettingBody
          label={t('account.weight_unit')}
          options={[{ value: 'kg', label: t('units.metric') }, { value: 'lb', label: t('units.imperial') }]}
          value={unit.value}
          onChange={choose(unit, () => t('account.weight_unit_saved'))}
          saving={unit.saving}
          help={t('account.weight_unit_help')}
          example={t('account.weight_unit_example')}
          error={unit.error}
        />
      </SettingDialog>
      <SettingDialog open={openKey === 'tools'} title={t('focus.tools.title')} onClose={close}>
        <FocusToolsOptions idPrefix="account-focus-tools" />
      </SettingDialog>
      <SettingDialog open={openKey === 'language'} title={t('account.language')} onClose={close} saving={language.saving}>
        <ChoiceSettingBody
          label={t('account.language')}
          options={LANGUAGES}
          value={language.value}
          onChange={choose(language, (next) => t('account.language_saved', { lng: next }))}
          saving={language.saving}
          help={t('account.language_help')}
          error={language.error}
        />
      </SettingDialog>
    </>
  );
};

export default PreferenceGroups;
