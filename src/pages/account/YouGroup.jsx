import { useState } from 'react';
import { format, parseISO, startOfToday } from 'date-fns';
import { useTranslation } from 'react-i18next';
import ChangeEmailDialog from '../../components/EmailVerification/ChangeEmailDialog';
import { useAuth } from '../../context/AuthContext';
import { dateFnsLocale } from '../../i18n/format';
import { oldestBirthDate, youngestBirthDate } from '../../utils/birthDate';
import ChoiceSettingBody from './ChoiceSettingBody';
import DateSettingBody from './DateSettingBody';
import EmailSettingBody from './EmailSettingBody';
import SettingDialog from './SettingDialog';
import SettingsGroup from './SettingsGroup';
import ValueRow from './ValueRow';
import useEmailChangeCancel from './useEmailChangeCancel';
import useProfileFields from './useProfileFields';

// I valori del sesso nell'account e il testo di ognuno
const GENDER_KEYS = { M: 'account.gender_m', F: 'account.gender_f', O: 'account.gender_o' };

// Il gruppo «Tu» della pagina Profilo e preferenze: email, data di nascita, sesso e inizio degli allenamenti, una riga
// col valore di adesso per campo e, cliccandola, la finestra con il suo controllo e il suo salvataggio; sotto la card
// «Membro da». Il valore viene da `account` (l'email dallo stato dell'email di AuthContext): la riga e la finestra
// leggono lo stesso, la cornice aggiorna `account` con `patchAccount` dopo un salvataggio. `dialog` è useRowDialog della
// pagina. Un salvataggio riuscito chiude la finestra e avvisa dalla pagina; gli altri esiti stanno dentro la finestra.
// «Scrivi il codice» e «Cambia indirizzo» aprono un'altra finestra: la finestra «Email» si chiude prima, così le due non
// si sovrappongono e «Cambia indirizzo», chiudendosi, riporta il fuoco sulla riga «Email». La finestra «Cambia
// indirizzo» (ChangeEmailDialog) è disegnata qui, non dentro la finestra che si chiude.
const YouGroup = ({ account, joinDate, patchAccount, notify, dialog }) => {
  const { t } = useTranslation();
  const { emailState, openEmailDialog } = useAuth();
  const fields = useProfileFields(account, patchAccount);
  const emailChange = useEmailChangeCancel();
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const { openKey } = dialog;
  const openDialog = (key, onOpen = fields.reset) => dialog.open(key, onOpen);
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
  // Da confermare anche con un cambio di indirizzo in attesa
  const emailUnconfirmed = emailState && (!emailState.verified || Boolean(emailState.pendingEmail));
  const emailStatus = emailState ? t(emailUnconfirmed ? 'emailstatus.unconfirmed' : 'emailstatus.confirmed') : undefined;

  return (
    <>
      <SettingsGroup
        title={t('account.profile.group.you')}
        footer={t('account.member_since', { date: joinDate ? format(joinDate, 'MMMM yyyy', { locale: dateFnsLocale() }) : t('account.date_unavailable') })}
      >
        <ValueRow
          title={t('register.email')}
          detail={emailState?.email || account?.email}
          value={emailStatus}
          valueColor={emailUnconfirmed ? 'warning.text' : undefined}
          onClick={openDialog('email', emailChange.clearOutcome)}
        />
        <ValueRow title={t('account.profile.birth_date')} value={birthDate} onClick={openDialog('birth')} />
        <ValueRow title={t('account.gender')} value={genderKey ? t(genderKey) : notSet} onClick={openDialog('gender')} />
        <ValueRow title={t('account.profile.training_start')} value={trainingStart} onClick={openDialog('start')} />
      </SettingsGroup>

      <SettingDialog open={openKey === 'email'} title={t('register.email')} onClose={dialog.close} saving={emailChange.saving}>
        <EmailSettingBody
          account={account}
          cancel={emailChange}
          onEnterCode={() => dialog.closeThen(openEmailDialog)}
          onChangeAddress={() => dialog.closeThen(() => setChangeEmailOpen(true))}
        />
      </SettingDialog>
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

      <ChangeEmailDialog open={changeEmailOpen} onClose={() => setChangeEmailOpen(false)} onChanged={() => openEmailDialog()} />
    </>
  );
};

export default YouGroup;
