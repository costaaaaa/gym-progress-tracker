import { createContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { moveBlock, setHidden, setLarge } from '../../../utils/homeLayout';

// In «Modifica Home» ogni blocco riceve da HomeBlocks i suoi comandi (un nodo): il guscio non è più un link e li disegna
// in fondo. Fuori dalla modifica vale null.
export const BlockEditContext = createContext(null);

// Il titolo di ogni blocco (nomi dei comandi, annunci e segnaposto dei blocchi nascosti)
export const TITLE_KEYS = { last: 'home.last.title', levels: 'home.block.levels_title', groups: 'groups.title', recovery: 'home.block.recovery_title', body: 'home.block.body_title' };

const entryOf = (layout, key) => layout.find((entry) => entry.key === key);

// Le azioni della modifica, in un posto solo: la mossa sul layout, il nome accessibile del comando (`aria`), l'etichetta
// visibile dei comandi a testo (`label`) e l'annuncio dell'esito (`announce`); `aria`, `label` e `announce` leggono la
// voce del blocco (prima della mossa i primi due, dopo la mossa il terzo).
export const EDIT_ACTIONS = {
  up: {
    move: (layout, key, isListed) => moveBlock(layout, key, -1, isListed),
    aria: () => 'home.edit.move_up',
    announce: () => 'home.edit.moved',
  },
  down: {
    move: (layout, key, isListed) => moveBlock(layout, key, 1, isListed),
    aria: () => 'home.edit.move_down',
    announce: () => 'home.edit.moved',
  },
  hide: {
    move: (layout, key) => setHidden(layout, key, !entryOf(layout, key).hidden),
    aria: (entry) => (entry.hidden ? 'home.edit.show_aria' : 'home.edit.hide_aria'),
    label: (entry) => (entry.hidden ? 'home.edit.show' : 'home.edit.hide'),
    announce: (entry) => (entry.hidden ? 'home.edit.now_hidden' : 'home.edit.now_shown'),
  },
  large: {
    move: (layout, key) => setLarge(layout, key, !entryOf(layout, key).large),
    aria: (entry) => (entry.large ? 'home.edit.small_aria' : 'home.edit.large_aria'),
    label: (entry) => (entry.large ? 'home.edit.small' : 'home.edit.large'),
    announce: (entry) => (entry.large ? 'home.edit.now_large' : 'home.edit.now_small'),
  },
};

// Le mosse della modifica per HomeBlocks: `applyAction(key, action)` applica l'azione con `onChange(mossa)` (restituisce il
// layout risultante, o null se non è cambiato nulla) e annuncia l'esito. `isListed(key)`: il blocco compare in modifica
// (conta per la posizione annunciata).
export const useBlockEditing = ({ isListed, onChange }) => {
  const { t } = useTranslation();
  const [announcement, setAnnouncement] = useState('');
  // Il comando della modifica che ha il fuoco prima del ridisegno (qui il documento è ancora quello di prima). Se il
  // ridisegno lo toglie dal documento (il blocco diventa segnaposto o torna blocco, anche per il ritorno indietro di un
  // salvataggio fallito) il fuoco va sullo stesso comando dello stesso blocco, o sul primo del blocco se non c'è più.
  // Uno spostamento non serve trattarlo: il bottone resta lo stesso e React gli rimette il fuoco. Un fuoco che l'utente
  // ha portato altrove non si tocca.
  const { editKey, editAction } = document.activeElement?.dataset ?? {};
  useEffect(() => {
    if (!editKey) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const control = document.querySelector(`[data-edit-key="${editKey}"][data-edit-action="${editAction}"]`)
      ?? document.querySelector(`[data-edit-key="${editKey}"]`);
    control?.focus();
  });

  const applyAction = (key, action) => {
    const spec = EDIT_ACTIONS[action];
    const next = onChange((current) => spec.move(current, key, isListed));
    if (!next) return;
    const listed = next.filter((entry) => isListed(entry.key)).map((entry) => entry.key);
    setAnnouncement(t(spec.announce(entryOf(next, key)), { title: t(TITLE_KEYS[key]), position: listed.indexOf(key) + 1, count: listed.length }));
  };

  return { announcement, applyAction };
};
