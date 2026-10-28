import { useState, useRef, useCallback, useEffect } from 'react';

export const UNDO_DELAY_MS = 10000;

// Eliminazione con «Annulla»: schedule(id) nasconde l'elemento subito e chiama commit(id) solo allo scadere.
// Un solo elemento in attesa alla volta: eliminarne un secondo fa partire subito la richiesta del primo.
// Se commit fallisce l'elemento torna visibile e onError(errore, id) lo segnala.
const useUndoableDelete = ({ commit, onError }) => {
  const [hiddenIds, setHiddenIds] = useState([]);
  const [pendingId, setPendingId] = useState(null);
  const pending = useRef(null); // { id, timer }
  const latest = useRef({ commit, onError });
  latest.current = { commit, onError };

  const run = useCallback(async (id) => {
    try {
      await latest.current.commit(id);
    } catch (error) {
      setHiddenIds((ids) => ids.filter((x) => x !== id));
      latest.current.onError?.(error, id);
    }
  }, []);

  const flush = useCallback(() => {
    const current = pending.current;
    if (!current) return;
    clearTimeout(current.timer);
    pending.current = null;
    setPendingId(null);
    run(current.id);
  }, [run]);

  const schedule = useCallback((id) => {
    flush();
    setHiddenIds((ids) => [...ids, id]);
    setPendingId(id);
    pending.current = { id, timer: setTimeout(flush, UNDO_DELAY_MS) };
  }, [flush]);

  const undo = useCallback(() => {
    const current = pending.current;
    if (!current) return;
    clearTimeout(current.timer);
    pending.current = null;
    setPendingId(null);
    setHiddenIds((ids) => ids.filter((x) => x !== current.id));
  }, []);

  useEffect(() => flush, [flush]);

  return { hiddenIds, pendingId, schedule, undo };
};

export default useUndoableDelete;
