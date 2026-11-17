import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tierName } from '../utils/tiers';

// Codice di registrazione della pagina di registrazione: il campo si apre dalla riga «Hai un codice?» o da
// /register?code=…; il codice si controlla al passaggio al secondo passo (accept / fail con la risposta del server).
// Richiudere il campo lo svuota, così quello che l'utente vede è quello che parte (`toSend`, vuoto = registrazione normale).
// `focusField` è quello di useFocusField (il campo si chiama «signupCode»).
export default function useSignupCode({ search, focusField }) {
  const { t } = useTranslation();
  const [initial] = useState(() => new URLSearchParams(search).get('code')?.trim() ?? '');
  const [open, setOpen] = useState(initial !== '');
  const [value, setValue] = useState(initial);
  const [error, setError] = useState('');
  // Esito del controllo anticipato, valido solo per il codice controllato: {code, tier, days (null = senza scadenza)}
  const [info, setInfo] = useState(null);

  const toSend = value.trim();
  // Il codice di adesso, anche per chi ha una chiusura vecchia (un controllo in volo)
  const latest = useRef(toSend);
  latest.current = toSend;
  const note = info && info.code === toSend
    ? (info.days === null
      ? t('register.code_ok_forever', { tier: info.tier })
      : t('register.code_ok_days', { tier: info.tier, count: info.days }))
    : '';

  return {
    open,
    value,
    error,
    note,
    toSend,
    toggle: () => {
      if (open) {
        setOpen(false);
        setValue('');
        setInfo(null);
        setError('');
      } else {
        setOpen(true);
        focusField('signupCode');
      }
    },
    change: (event) => {
      setValue(event.target.value);
      setError('');
    },
    clearError: () => setError(''),
    // Una risposta vale solo se il codice scritto è ancora quello spedito
    isCurrent: (sent) => latest.current === sent,
    // Risposta del controllo anticipato per `code`: la nota solo se il codice è utilizzabile
    accept: (code, signupCode) => {
      setInfo(code && signupCode?.usable ? { code, tier: tierName(signupCode.tier), days: signupCode.duration_days ?? null } : null);
    },
    // Errore del server sul codice: sul campo, con il focus lì (anche tornando dal secondo passo)
    fail: (message) => {
      setOpen(true);
      setInfo(null);
      setError(message || t('register.error.generic'));
      focusField('signupCode');
    },
  };
}
