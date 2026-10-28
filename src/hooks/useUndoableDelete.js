import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';

export const UNDO_DELAY_MS = 10000;

// Eliminazione con «Annulla»: schedule(id) nasconde l'elemento subito e chiama commit(id) solo allo scadere.
// Un solo elemento in attesa alla volta: eliminarne un secondo fa partire subito la richiesta del primo.
// Se commit fallisce l'elemento torna visibile e onError(errore, id) lo segnala (non più se la pagina è già smontata).
const useUndoableDelete = ({ commit, onError }) => {
  const [hiddenIds, setHiddenIds] = useState([]);
  const [pendingId, setPendingId] = useState(null);
  const pending = useRef(null); // { id, timer }
  const latest = useRef({ commit, onError });
  const mounted = useRef(true);
  useLayoutEffect(() => { latest.current = { commit, onError }; });

  const run = useCallback(async (id) => {
    try {
      await latest.current.commit(id);
    } catch (error) {
      if (!mounted.current) return;
      setHiddenIds((ids) => ids.filter((x) => x !== id));
      latest.current.onError?.(error, id);
    }
  }, []);

  // Toglie l'eliminazione in attesa (timer e stato) e la restituisce, o null se non ce n'è
  const takePending = useCallback(() => {
    const current = pending.current;
    if (!current) return null;
    clearTimeout(current.timer);
    pending.current = null;
    setPendingId(null);
    return current;
  }, []);

  const flush = useCallback(() => {
    const current = takePending();
    if (current) run(current.id);
  }, [takePending, run]);

  const schedule = useCallback((id) => {
    flush();
    setHiddenIds((ids) => [...ids, id]);
    setPendingId(id);
    pending.current = { id, timer: setTimeout(flush, UNDO_DELAY_MS) };
  }, [flush]);

  const undo = useCallback(() => {
    const current = takePending();
    if (current) setHiddenIds((ids) => ids.filter((x) => x !== current.id));
  }, [takePending]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      flush();
    };
  }, [flush]);

  return { hiddenIds, pendingId, schedule, undo };
};

export default useUndoableDelete;
