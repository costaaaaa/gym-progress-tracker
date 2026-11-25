import { format, parseISO, startOfToday } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { oldestBirthDate, youngestBirthDate } from '../../utils/birthDate';
import ChoiceSettingBody from './ChoiceSettingBody';
import DateSettingBody from './DateSettingBody';
import SettingDialog from './SettingDialog';
import SettingsGroup from './SettingsGroup';
import ValueRow from './ValueRow';
import useProfileFields from './useProfileFields';

// I valori del sesso nell'account e il testo di ognuno
const GENDER_KEYS = { M: 'account.gender_m', F: 'account.gender_f', O: 'account.gender_o' };

// Il gruppo «Tu» della pagina Profilo e preferenze: data di nascita, sesso e inizio degli allenamenti, una riga col
// valore di adesso per campo e, cliccandola, la finestra con il suo controllo e il suo salvataggio. Il valore viene da
// `account`: la riga e la finestra leggono lo stesso (la cornice lo aggiorna con `patchAccount` dopo un salvataggio).
// `dialog` è useRowDialog della pagina. Un salvataggio riuscito chiude la finestra e avvisa dalla pagina; gli altri
// esiti stanno dentro la finestra.
const YouGroup = ({ account, patchAccount, notify, dialog }) => {
  const { t } = useTranslation();
  const fields = useProfileFields(account, patchAccount);
  const { openKey } = dialog;
  const openDialog = (key) => dialog.open(key, fields.reset);
  const notSet = t('account.profile.not_set');

  const finish = async (saved) => {
    if (await saved) {
      dialog.close();
      notify(t('account.profile.saved'), 'success');
    }
  };

  const birthDate = account?.birth_date ? format(parseISO(account.birth_date), 'dd/MM/yyyy') : notSet;
  const trainingStart = account?.training_start_date ? format(parseISO(account.training_start_date), 'MM/yyyy') : notSet;
  const genderKey = GENDER_KEYS[account?.gender];

  return (
    <>
      <SettingsGroup title={t('account.profile.group.you')}>
        <ValueRow title={t('account.profile.birth_date')} value={birthDate} onClick={openDialog('birth')} />
        <ValueRow title={t('account.gender')} value={genderKey ? t(genderKey) : notSet} onClick={openDialog('gender')} />
        <ValueRow title={t('account.profile.training_start')} value={trainingStart} onClick={openDialog('start')} />
      </SettingsGroup>

      <SettingDialog open={openKey === 'birth'} title={t('account.profile.birth_date')} onClose={dialog.close} onSave={() => finish(fields.birthDate.save())} saving={fields.saving}>
        <DateSettingBody
          label={t('account.profile.birth_date')}
          value={fields.birthDate.value}
          onChange={fields.birthDate.onChange}
          help={account?.age ? t('account.age_current', { age: account.age }) : t('account.age_auto')}
          error={fields.birthDate.error}
          outcomeError={fields.error}
          inputRef={fields.birthDate.inputRef}
          inputProps={{ autoComplete: 'bday' }}
          minDate={oldestBirthDate()}
          maxDate={youngestBirthDate()}
        />
      </SettingDialog>
      <SettingDialog open={openKey === 'gender'} title={t('account.gender')} onClose={dialog.close} saving={fields.saving}>
        <ChoiceSettingBody
          label={t('account.gender')}
          options={Object.entries(GENDER_KEYS).map(([value, key]) => ({ value, label: t(key) }))}
          value={fields.gender.value}
          onChange={(next) => finish(fields.gender.change(next))}
          saving={fields.saving}
          error={fields.error}
        />
      </SettingDialog>
      <SettingDialog open={openKey === 'start'} title={t('account.profile.training_start')} onClose={dialog.close} onSave={() => finish(fields.trainingStart.save())} saving={fields.saving}>
        <DateSettingBody
          label={t('account.profile.training_start')}
          value={fields.trainingStart.value}
          onChange={fields.trainingStart.onChange}
          help={account?.experience_years ? t('account.experience', { years: account.experience_years }) : t('account.training_start_hint')}
          outcomeError={fields.error}
          views={['year', 'month']}
          format="MM/yyyy"
          openTo="month"
          minDate={account?.birth_date ? parseISO(account.birth_date) : undefined}
          maxDate={startOfToday()}
        />
      </SettingDialog>
    </>
  );
};

export default YouGroup;
