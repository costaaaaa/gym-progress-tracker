import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { saveHomeLayout } from '../api/homeLayout';
import { effectiveLayout } from '../utils/homeLayout';

// Il layout della Home in modifica. `layout` è l'elenco effettivo da disegnare; `change(fn)` applica una mossa
// (`fn` prende il layout effettivo e ne restituisce uno nuovo; `change` restituisce quello risultante): lo schermo cambia subito e il layout intero va al
// server, una richiesta alla volta (se ne parte un'altra mentre una è in volo, vale l'ultima). Se il salvataggio
// fallisce si torna all'ultimo layout salvato e `error` diventa vero. A salvataggio riuscito l'account riceve il
// layout confermato dal server.
export const useHomeLayout = () => {
  const { user, updateUser } = useAuth();
  const latest = useRef({});
  latest.current = { user, updateUser };
  // Il layout mostrato mentre c'è una mossa non ancora confermata (null = quello dell'account)
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(false);
  // Il layout con tutte le mosse fatte finora, e quello che aspetta di partire
  const working = useRef(null);
  const queued = useRef(null);
  const busy = useRef(false);

  const flush = async () => {
    if (busy.current) return;
    busy.current = true;
    while (queued.current) {
      const layout = queued.current;
      queued.current = null;
      const res = await saveHomeLayout(layout);
      if (!res.ok) {
        queued.current = null;
        working.current = null;
        setDraft(null);
        setError(true);
        break;
      }
      latest.current.updateUser({ home_layout: res.layout });
      if (!queued.current) {
        working.current = null;
        setDraft(null);
      }
    }
    busy.current = false;
  };

  const change = (move) => {
    const base = working.current ?? effectiveLayout(latest.current.user?.home_layout);
    const next = move(base);
    if (next === base) return base;
    working.current = next;
    queued.current = next;
    setDraft(next);
    setError(false);
    flush();
    return next;
  };

  return { layout: draft ?? effectiveLayout(user?.home_layout), change, error, clearError: () => setError(false) };
};
