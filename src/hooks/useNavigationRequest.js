import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Una pagina a cui si arriva con uno stato di navigazione `{ [key]: true }` (es. «Registra allenamento passato»
 * dal ventaglio) deve aprire la sua finestra una volta sola. Qui lo stato si consuma subito (la voce di cronologia
 * viene sostituita senza di esso, gli altri campi restano): tornando indietro o ricaricando non si riapre.
 * Torna `null` finché nessuno ha chiesto, poi un numero che cresce a ogni richiesta (anche con la pagina già aperta).
 * Chi lo riceve apre la finestra se può, una volta per numero, e se non può (nessuna scheda attiva, niente consenso) non fa nulla.
 */
export const useNavigationRequest = (key) => {
  const { pathname, search, hash, state } = useLocation();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const asked = state?.[key] === true;

  useEffect(() => {
    if (!asked) return;
    setRequest((current) => (current ?? 0) + 1);
    const rest = { ...state };
    delete rest[key];
    navigate({ pathname, search, hash }, { replace: true, state: Object.keys(rest).length > 0 ? rest : null });
  }, [asked, key, pathname, search, hash, state, navigate]);

  return request;
};

/**
 * Chiama `handle` una volta per ogni numero di richiesta, appena `ready` (i dati che servono a decidere sono arrivati).
 * `handle` vede sempre lo stato dell'ultimo render; se non può aprire nulla, lo dice o sta zitta, ma la richiesta è comunque
 * spesa: non si ripresenta quando cambia altro.
 */
export const useOncePerRequest = (request, ready, handle) => {
  const handled = useRef(null);
  const latest = useRef(handle);
  // Il layout effect gira prima dell'effetto qui sotto: `handle` è quello dell'ultimo render
  useLayoutEffect(() => { latest.current = handle; });
  useEffect(() => {
    if (!request || !ready || handled.current === request) return;
    handled.current = request;
    latest.current();
  }, [request, ready]);
};

export default useNavigationRequest;
