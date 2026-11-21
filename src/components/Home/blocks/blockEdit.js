import { createContext, useEffect, useRef, useState } from 'react';
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
// layout risultante), annuncia l'esito e riporta il fuoco su un comando del blocco mosso. `isListed(key)`: il blocco
// compare in modifica (conta per la posizione annunciata).
export const useBlockEditing = ({ isListed, onChange }) => {
  const { t } = useTranslation();
  const [announcement, setAnnouncement] = useState('');
  // Il blocco mosso e il comando premuto. Resta finché il fuoco è perso (un salvataggio fallito rifà il disegno e
  // riporta il layout indietro) e cade quando il fuoco sta su un altro elemento.
  const focusAfter = useRef(null);
  useEffect(() => {
    const target = focusAfter.current;
    if (!target) return;
    const active = document.activeElement;
    if (active && active !== document.body) {
      focusAfter.current = null;
      return;
    }
    const controls = document.querySelector(`[data-edit-key="${target.key}"][data-edit-action="${target.action}"]`)
      ?? document.querySelector(`[data-edit-key="${target.key}"]`);
    if (controls) controls.focus();
    else focusAfter.current = null;
  });

  const applyAction = (key, action) => {
    const spec = EDIT_ACTIONS[action];
    let base;
    const next = onChange((current) => {
      base = current;
      return spec.move(current, key, isListed);
    });
    if (next === base) return;
    focusAfter.current = { key, action };
    const listed = next.filter((entry) => isListed(entry.key)).map((entry) => entry.key);
    setAnnouncement(t(spec.announce(entryOf(next, key)), { title: t(TITLE_KEYS[key]), position: listed.indexOf(key) + 1, count: listed.length }));
  };

  return { announcement, applyAction };
};
