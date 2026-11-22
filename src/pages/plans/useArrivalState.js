import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Lo stato di navigazione con cui si arriva su una schermata (state.edit, state.notice) vale una volta: mostra
// l'avviso di riuscita, poi si toglie dall'indirizzo corrente, perché altrimenti sopravvive a ricarica e tasto indietro.
// Restituisce ciò che ha trovato all'ingresso ({ edit }), letto una volta al primo render.
export default function useArrivalState(notify) {
  const location = useLocation();
  const navigate = useNavigate();
  const arrival = useRef(null);
  if (arrival.current === null) arrival.current = { edit: !!location.state?.edit };
  useEffect(() => {
    const { edit, notice } = location.state ?? {};
    if (!edit && !notice) return;
    if (notice) notify(notice, 'success');
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
  }, [location.state, location.pathname, location.search, navigate, notify]);
  return arrival.current;
}
