import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useUndoableDelete from '../../hooks/useUndoableDelete';
import { API_BASE_URL } from '../../config';

// L'eliminazione con «Annulla» di un allenamento tolto dalla sua pagina: la pagina porta all'elenco con `deleted` (l'id)
// nello stato di navigazione. La riga sparisce subito (`hiddenIds`); la richiesta al server parte solo allo scadere
// dei 10 secondi di «Annulla» (vedi useUndoableDelete), o subito se si lascia l'elenco. L'indicazione si legge una volta
// sola: si toglie dall'indirizzo (il resto dello stato resta), perché non sopravviva a ricarica e tasto indietro.
// `notify(messaggio, gravità)` dice l'errore se il server rifiuta.
export default function useDeletionOnArrival(notify) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { hiddenIds, pendingId, schedule, undo, holdProps } = useUndoableDelete({
    commit: async (id) => {
      const response = await fetch(`${API_BASE_URL}api/workout_history/delete.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
        credentials: 'include'
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || t('history.delete.error'));
      }
    },
    onError: (error) => notify(error.message, 'error'),
  });

  const deletedOnArrival = location.state?.deleted;
  useEffect(() => {
    if (deletedOnArrival === undefined) return undefined;
    const { deleted, ...rest } = location.state;
    // Rimandato e annullabile: in sviluppo (StrictMode) l'effetto gira due volte, e una pulizia che trovasse l'eliminazione
    // già in attesa la manderebbe subito al server
    const timer = setTimeout(() => {
      schedule(deleted);
      navigate({ pathname: location.pathname, search: location.search, hash: location.hash }, { replace: true, state: Object.keys(rest).length > 0 ? rest : null });
    });
    return () => clearTimeout(timer);
  }, [deletedOnArrival, location.state, location.pathname, location.search, location.hash, navigate, schedule]);

  return { hiddenIds, pendingId, undo, holdProps };
}
