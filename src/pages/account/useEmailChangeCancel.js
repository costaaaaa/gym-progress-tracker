import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { cancelEmailChange } from '../../api/emailVerification';
import useSettingSave from './useSettingSave';

// L'annullamento del cambio di indirizzo in attesa, fatto dentro la finestra «Email»: `run()` chiede al server di
// toglierlo, rilegge lo stato dell'email (la riga mostra quello nuovo) e lascia l'esito nella finestra: `status`
// («Cambio di indirizzo annullato.») o `error` (rete assente, messaggio del server o testo generico). Torna true se è
// riuscito. `saving` è vero mentre la richiesta è in corso (la finestra non si chiude e una seconda richiesta è
// ignorata); `clearOutcome()` svuota l'esito alla riapertura.
export default function useEmailChangeCancel() {
  const { t } = useTranslation();
  const { refreshEmailState } = useAuth();
  const { pending, error, status, save, clearOutcome } = useSettingSave({
    errorText: (err) => err.message,
    savedText: t('emailstatus.cancelled'),
  });

  const run = () => save(true, async () => {
    const res = await cancelEmailChange();
    if (!res.ok) throw new Error(res.status === 0 ? t('emailconfirm.error_network') : (res.data?.message || t('emailconfirm.error_generic')));
    await refreshEmailState();
  });

  return { saving: pending !== null, error, status, run, clearOutcome };
}
