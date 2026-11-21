// Quali blocchi dei moduli ha la Home e in che ordine, misura e visibilità. Funzioni pure, copiate uguali nell'app:
// niente import non relativi e niente window/document/localStorage/navigator.

// Ordine predefinito. «last» (ultimo allenamento) non ha un modulo e non ha la misura grande.
export const HOME_BLOCKS = ['last', 'levels', 'groups', 'recovery', 'body'];

// Elenco completo `[{ key, hidden, large }]` dal layout salvato sull'account (null = mai personalizzato): le voci
// valide nell'ordine salvato (chiavi ignote e doppioni scartati), poi in coda le chiavi che mancano, visibili e piccole.
export const effectiveLayout = (saved) => {
  const result = [];
  const seen = new Set();
  if (Array.isArray(saved)) {
    for (const entry of saved) {
      const key = entry && typeof entry === 'object' ? entry.key : null;
      if (typeof key !== 'string' || !HOME_BLOCKS.includes(key) || seen.has(key)) continue;
      seen.add(key);
      result.push({ key, hidden: entry.hidden === true, large: entry.large === true && key !== 'last' });
    }
  }
  for (const key of HOME_BLOCKS) {
    if (!seen.has(key)) result.push({ key, hidden: false, large: false });
  }
  return result;
};
