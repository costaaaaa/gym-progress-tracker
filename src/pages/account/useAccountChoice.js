import { useAuth } from '../../context/AuthContext';
import { saveSettings } from './saveSettings';
import useSettingSave from './useSettingSave';

// Un campo dell'account a scelta tra pochi valori (lingua, unità di misura): `field` è il nome nel corpo di
// update_settings.php e nell'account, `stored` il valore che l'account ha adesso. `value` è lo stesso per la riga e per
// la finestra: quello dell'account e, solo mentre si salva, la scelta in corso. `change(next)` salva, poi avvisa
// AuthContext (`updateUser`) e `patchAccount` della cornice, e torna true se è riuscito; se il server rifiuta resta il
// valore di prima e `error` ha il testo.
export default function useAccountChoice({ field, stored, errorText, patchAccount }) {
  const { updateUser } = useAuth();
  const { pending, error, save, clearOutcome } = useSettingSave({ errorText });

  const change = (next) => save(next, async () => {
    await saveSettings({ [field]: next });
    updateUser({ [field]: next });
    patchAccount({ [field]: next });
  });

  return { value: pending ?? stored, saving: pending !== null, error, change, clearOutcome };
}
