// Come si scrive un peso. File puro (nessun import da i18n o React): la lingua arriva
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
// JavaScript ignorano) e si decide sul numero arrotondato (non sul testo, che può avere cifre non
// latine): ciò che si arrotonda a 0 non ha segno. Le migliaia sono separate da quattro cifre in su (in italiano di
// norma partono da cinque).
export function formatWeight(value, locale, { signed = false, unit = true, maxDecimals = 2 } = {}) {
  const n = toNumber(value);
  if (n === null) return '—';
  const digits = Math.abs(n).toLocaleString(locale, { maximumFractionDigits: maxDecimals, useGrouping: 'always' });
  const isZero = Number(Math.abs(n).toFixed(maxDecimals)) === 0;
  const sign = isZero ? '' : n < 0 ? '-' : signed ? '+' : '';
  return `${sign}${digits}${unit ? `${NBSP}kg` : ''}`;
}
