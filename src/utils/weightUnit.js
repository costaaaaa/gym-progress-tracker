// Unità di peso dell'utente (kg o lb). I dati restano sempre in kg (database, API, schede): qui si converte
// solo per mostrare un peso e per leggere quello che l'utente scrive nella sua unità. File puro (nessun import da
// i18n o React): la lingua arriva come argomento. Mostrato al quarto di libbra (0,25); i kg scritti dall'utente
// si arrotondano a 0,01 (colonne decimal(5,2)). Un valore non toccato non si riconverte mai: spetta a chi chiama
// salvare i kg originali.

import { formatWeight } from './weightFormat';

const NBSP = ' ';

export const LB_IN_KG = 0.45359237;
export const DEFAULT_WEIGHT_UNIT = 'kg';

export const isWeightUnit = (value) => value === 'kg' || value === 'lb';

// 'kg' o 'lb'; un valore non valido vale kg
export const weightUnitLabel = (unit) => (unit === 'lb' ? 'lb' : 'kg');

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// kg → numero da mostrare: kg come sono, lb al quarto di libbra. null se il valore manca.
export function kgToDisplay(kg, unit) {
  const n = toNumber(kg);
  if (n === null) return null;
  return unit === 'lb' ? Math.round((n / LB_IN_KG) * 4) / 4 : n;
}

// "220,5 lb" / "79,3 kg": numero nella lingua dell'utente, senza zeri inutili, spazio non separabile prima
// dell'unità. Senza un valore valido: "—". Opzioni di formatWeight (signed, maxDecimals), unit: false = solo il numero.
export function formatWeightInUnit(kg, unit, locale, { unit: withUnit = true, ...options } = {}) {
  const shown = kgToDisplay(kg, unit);
  if (shown === null) return '—';
  const digits = formatWeight(shown, locale, { ...options, unit: false });
  return withUnit ? `${digits}${NBSP}${weightUnitLabel(unit)}` : digits;
}

// Variante intera per totali (volume, tonnellaggio) e soglie dei traguardi: si converte il totale in kg,
// poi si arrotonda all'intero più vicino nell'unità dell'utente.
export function formatWeightRounded(kg, unit, locale) {
  const n = toNumber(kg);
  if (n === null) return '—';
  const whole = Math.round(unit === 'lb' ? n / LB_IN_KG : n);
  return `${formatWeight(whole, locale, { unit: false, maxDecimals: 0 })}${NBSP}${weightUnitLabel(unit)}`;
}

// Testo scritto dall'utente nella sua unità → kg arrotondati a 0,01. Virgola e punto come decimale (come la
// lettura del peso di oggi, parseFloat). null se vuoto, non numerico o negativo.
export function inputToKg(text, unit) {
  const n = parseFloat(String(text ?? '').trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  const kg = unit === 'lb' ? n * LB_IN_KG : n;
  return Math.round(kg * 100) / 100;
}
