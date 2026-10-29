import { slotKey } from '../../utils/focusSession';

// Testo tradotto di una posizione (vedi slotKey); il pallino di una serie allenante mostra il solo numero
export const slotLabel = (t, slot, kind) => {
  const key = slotKey(slot, kind);
  return key ? t(key, { n: slot.number, total: slot.total }) : String(slot.number);
};
