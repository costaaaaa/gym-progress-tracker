import { useRef, useState } from 'react';

// Il salvataggio di una scelta fatta dentro la finestra di un'impostazione. `save(next, request)` chiama `request()` e
// torna true se è riuscita; mentre si salva `pending` è la scelta in corso (altrimenti null) e un'altra scelta è
// ignorata (una sola richiesta alla volta). Gli esiti che lasciano la finestra aperta stanno qui: `error` (il testo di
// `errorText`) e `status` (il testo di `savedText`, se c'è); partono vuoti a ogni scelta, così un esito uguale al
// precedente viene riletto. `clearOutcome()` li svuota: alla riapertura della finestra non resta quello di prima.
export default function useSettingSave({ errorText, savedText }) {
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const savingRef = useRef(false);

  const save = async (next, request) => {
    if (savingRef.current) return false;
    savingRef.current = true;
    setPending(next);
    setError('');
    setStatus('');
    try {
      await request();
      if (savedText) setStatus(savedText);
      return true;
    } catch (err) {
      console.error('Errore nel salvataggio dell\'impostazione:', err);
      setError(errorText);
      return false;
    } finally {
      savingRef.current = false;
      setPending(null);
    }
  };

  const clearOutcome = () => {
    setError('');
    setStatus('');
  };

  return { pending, error, status, save, clearOutcome };
}
