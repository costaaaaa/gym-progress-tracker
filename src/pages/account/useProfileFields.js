import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import useFocusField from '../../hooks/useFocusField';
import { isInvalidBirthDate } from '../../utils/birthDate';
import { saveSettings } from './saveSettings';
import useSettingSave from './useSettingSave';

const toDate = (iso) => (iso ? parseISO(iso) : null);

// Dati calcolati dal server che cambiano con un salvataggio: l'età con la data di nascita, gli anni di esperienza con
// l'inizio degli allenamenti
const recalculated = (data) => Object.fromEntries(['age', 'experience_years'].filter((key) => data[key] !== undefined).map((key) => [key, data[key]]));

// I campi del profilo dell'account (data di nascita, sesso, inizio degli allenamenti), uno per finestra e un
// salvataggio per campo: la richiesta porta solo il campo salvato e, se va a buon fine, `patchAccount` mette nell'account
// della cornice quel campo e i dati ricalcolati dal server. Tornano `true` se il salvataggio è riuscito (la pagina
// chiude la finestra e avvisa), `false` se no: un rifiuto del server è in `error` (dentro la finestra), una validazione
// fallita sta sul campo. `reset()` va chiamata all'apertura di una finestra: azzera gli esiti e riporta le date scritte
// al valore dell'account. `saving` è vero mentre una richiesta è in corso (un'altra è ignorata).
export default function useProfileFields(account, patchAccount) {
  const { t } = useTranslation();
  const { fieldRef, focusField } = useFocusField();
  const { pending, error, save, clearOutcome } = useSettingSave({ errorText: t('account.profile.error') });
  const [birthDate, setBirthDate] = useState(null);
  const [birthDateError, setBirthDateError] = useState('');
  const [trainingStart, setTrainingStart] = useState(null);

  const reset = () => {
    clearOutcome();
    setBirthDateError('');
    setBirthDate(toDate(account?.birth_date));
    setTrainingStart(toDate(account?.training_start_date));
  };

  // `field` dice cosa si sta salvando e `makeBody` scrive il corpo della richiesta; `value` è la scelta da mostrare subito (il sesso)
  const change = (field, makeBody, value) => save({ field, value }, async () => {
    const body = makeBody();
    const data = await saveSettings(body);
    patchAccount({ ...body, ...recalculated(data) });
  });

  const failBirthDate = async (message) => {
    setBirthDateError(message);
    focusField('birthDate');
    return false;
  };
  const saveBirthDate = async () => {
    if (!birthDate) return failBirthDate(t('register.error.birth_date_required'));
    if (isInvalidBirthDate(birthDate)) return failBirthDate(t('birth_date.error_invalid'));
    return change('birth_date', () => ({ birth_date: format(birthDate, 'yyyy-MM-dd') }));
  };

  return {
    saving: pending !== null,
    error,
    reset,
    birthDate: {
      value: birthDate,
      error: birthDateError,
      inputRef: fieldRef('birthDate'),
      onChange: (next) => { setBirthDate(next); setBirthDateError(''); },
      save: saveBirthDate,
    },
    gender: {
      value: pending?.field === 'gender' ? pending.value : account?.gender ?? '',
      change: (next) => change('gender', () => ({ gender: next }), next),
    },
    trainingStart: {
      value: trainingStart,
      onChange: setTrainingStart,
      save: () => change('training_start_date', () => ({ training_start_date: trainingStart ? format(trainingStart, 'yyyy-MM-01') : null })),
    },
  };
}
