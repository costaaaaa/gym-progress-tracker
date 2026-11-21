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

// Le mosse della modifica: prendono e restituiscono il layout effettivo completo, senza mutare l'ingresso.

// Sposta `key` di un posto (-1 su, 1 giù) tra i blocchi che l'utente vede in modifica: `isListed(key)` dice se un
// blocco compare (un modulo non attivo no). I blocchi non elencati restano al loro posto e non contano come vicino.
// Ai capi non fa nulla.
export const moveBlock = (layout, key, direction, isListed = () => true) => {
  const from = layout.findIndex((entry) => entry.key === key);
  if (from === -1) return layout;
  let to = from + direction;
  while (to >= 0 && to < layout.length && !isListed(layout[to].key)) to += direction;
  if (to < 0 || to >= layout.length) return layout;
  const next = [...layout];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
};

const change = (layout, key, patch) => layout.map((entry) => (entry.key === key ? { ...entry, ...patch } : entry));

export const setHidden = (layout, key, hidden) => change(layout, key, { hidden });

// «last» resta sempre piccolo
export const setLarge = (layout, key, large) => (key === 'last' ? layout : change(layout, key, { large }));
