import { useEffect, useState } from 'react';

// Carica i dati di un blocco per conto suo, una volta. `load` (una funzione stabile, fuori dal componente) ritorna i
// dati o null se la risposta non è buona; un errore di rete vale null. Una risposta che arriva dopo l'uscita non scrive lo stato.
// Ritorna { status: 'loading' | 'ok' | 'error', data }.
export const useBlockData = (load) => {
  const [state, setState] = useState({ status: 'loading', data: null });
  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(load)
      .then((data) => (data ? { status: 'ok', data } : { status: 'error', data: null }), () => ({ status: 'error', data: null }))
      .then((next) => { if (active) setState(next); });
    return () => { active = false; };
  }, [load]);
  return state;
};
