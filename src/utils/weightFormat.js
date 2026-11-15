// Come si scrive un peso e una serie. File puro (nessun import da i18n o React): la lingua arriva
// come argomento, così lo stesso file si può copiare identico in un altro client.

const NBSP = ' ';

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// 79.30 → "79,3 kg" (it) / "79.3 kg" (en): al massimo due decimali, niente zeri finali, spazio non separabile.
// Senza un valore valido: "—". Opzioni: signed (segno anche per i positivi), unit: false (solo il numero).
export function formatWeight(value, locale, { signed = false, unit = true } = {}) {
  const n = toNumber(value);
  if (n === null) return '—';
  const text = n.toLocaleString(locale, { maximumFractionDigits: 2, ...(signed && { signDisplay: 'exceptZero' }) });
  return unit ? `${text}${NBSP}kg` : text;
}

// "80 kg × 8". Peso assente = 0, come mostravano le schermate prima di questo file.
export function formatSet(weight, reps, locale) {
  return `${formatWeight(toNumber(weight) ?? 0, locale)}${NBSP}×${NBSP}${reps}`;
}
