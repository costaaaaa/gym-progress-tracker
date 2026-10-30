// Chiave i18n del testo di una posizione, per tipo: name (nome del pallino e della serie fatta),
// of (sottotitolo "N di M"), next (prossima serie nel recupero), dot (testo dentro il pallino).
const SLOT_KEYS = {
  name: { warmup: 'focus.warmup_n', working: 'focus.set_n' },
  of: { warmup: 'focus.warmup_of', working: 'focus.set_of' },
  next: { warmup: 'focus.next_warmup', working: 'focus.next_set' },
  dot: { warmup: 'focus.warmup_dot', working: null },
};

// Testo tradotto di una posizione (vedi setSlot); il pallino di una serie allenante mostra il solo numero
export const slotLabel = (t, slot, kind) => {
  const key = SLOT_KEYS[kind][slot.isWarmup ? 'warmup' : 'working'];
  return key ? t(key, { n: slot.number, total: slot.total }) : String(slot.number);
};
