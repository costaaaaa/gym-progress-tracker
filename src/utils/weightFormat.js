// Come si scrive un peso e una serie. File puro (nessun import da i18n o React): la lingua arriva
// come argomento, così lo stesso file si può copiare identico in un altro client.

const NBSP = '\u00a0';

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// 79.30 → "79,3 kg" (it) / "79.3 kg" (en): niente zeri finali e spazio non separabile prima di kg.
// Senza un valore valido: "—". Opzioni: maxDecimals (default 2), signed (segno anche per i positivi),
// unit: false (solo il numero). Il segno è scritto a mano (non con signDisplay, che alcuni motori
// JavaScript ignorano) e si decide sul numero arrotondato (non sul testo, che può avere cifre non latine): ciò che si arrotonda a 0 non ha segno.
export function formatWeight(value, locale, { signed = false, unit = true, maxDecimals = 2 } = {}) {
  const n = toNumber(value);
  if (n === null) return '—';
  const digits = Math.abs(n).toLocaleString(locale, { maximumFractionDigits: maxDecimals });
  const isZero = Number(Math.abs(n).toFixed(maxDecimals)) === 0;
  const sign = isZero ? '' : n < 0 ? '-' : signed ? '+' : '';
  return `${sign}${digits}${unit ? `${NBSP}kg` : ''}`;
}

// "80 kg × 8". Peso assente = 0, come mostravano le schermate prima di questo file.
export function formatSet(weight, reps, locale) {
  return `${formatWeight(toNumber(weight) ?? 0, locale)}${NBSP}×${NBSP}${reps}`;
}
