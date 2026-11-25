import { useEffect, useRef, useState } from 'react';

// Le finestre delle righe della pagina «Profilo e preferenze»: una sola è aperta alla volta, `openKey` dice quale (null =
// nessuna). `open(key, onOpen)` dà il gestore del clic di una riga: ricorda la riga, esegue `onOpen` (che azzera
// l'esito di prima) e apre la finestra `key`. `close()` la chiude. Alla chiusura il fuoco torna sulla riga che ha aperto
// la finestra (non tutti i browser danno il fuoco al clic su un pulsante: quello che ricorda la finestra non basta).
// `closeThen(next)` la chiude e, a fuoco già tornato sulla riga, esegue `next`: serve ad aprire un'altra finestra senza
// che le due si sovrappongano e perché quella nuova, chiudendosi, riporti il fuoco sulla riga. Con nessuna finestra
// aperta (un secondo clic durante la dissolvenza) non fa nulla: `next` non resta in attesa della chiusura di un'altra.
// `saved(saving, message)` è per i salvataggi che chiudono la finestra: se `saving` (la promessa del salvataggio) riesce
// la chiude e avvisa con `message` dalla pagina (`notify`, della cornice); se no la lascia aperta con il suo errore.
export default function useRowDialog(notify) {
  const [openKey, setOpenKey] = useState(null);
  const lastRow = useRef(null);
  const afterClose = useRef(null);

  useEffect(() => {
    if (openKey !== null) return;
    lastRow.current?.focus();
    const next = afterClose.current;
    afterClose.current = null;
    next?.();
  }, [openKey]);

  const open = (key, onOpen) => (event) => {
    lastRow.current = event.currentTarget;
    onOpen?.();
    setOpenKey(key);
  };
  const close = () => setOpenKey(null);
  const closeThen = (next) => {
    if (openKey === null) return;
    afterClose.current = next;
    setOpenKey(null);
  };

  const saved = async (saving, message) => {
    if (await saving) {
      setOpenKey(null);
      notify(message, 'success');
    }
  };

  return { openKey, open, close, closeThen, saved };
}
