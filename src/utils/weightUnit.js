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

// "80 kg × 8" / "220,5 lb × 5": una serie nell'unità dell'utente. Peso assente = 0.
export function formatSetInUnit(weight, reps, unit, locale) {
  return `${formatWeightInUnit(toNumber(weight) ?? 0, unit, locale)}${NBSP}×${NBSP}${reps}`;
}

// A 0,01 con i mezzi per eccesso: lo spostamento è sul testo decimale (1.005 → 1.01), non su kg * 100, che in
// virgola mobile dà 100.49999… e sbaglia.
const roundCents = (n) => Number(`${Math.round(Number(`${n.toFixed(10)}e2`))}e-2`);

// Testo scritto dall'utente nella sua unità → kg arrotondati a 0,01. Dopo il trim solo cifre con al più un
// separatore decimale (virgola o punto) seguito da cifre: tutto il resto (12abc, 1e3, 0x10, 1.000,5, -0, .5, 5.)
// è null. Un numero finito e non negativo passa. Nessun tetto: il limite (999,99 kg) lo mette chi valida.
export function inputToKg(text, unit) {
  let n;
  if (typeof text === 'number') {
    n = text;
    if (!Number.isFinite(n) || n < 0 || Object.is(n, -0)) return null;
  } else {
    const s = String(text ?? '').trim();
    if (!/^\d+(?:[.,]\d+)?$/.test(s)) return null;
    n = Number(s.replace(',', '.'));
  }
  const kg = roundCents(unit === 'lb' ? n * LB_IN_KG : n);
  return Number.isFinite(kg) ? kg : null; // oltre 1e21 l'arrotondamento non è più un numero
}

// Limite di un campo peso nell'unità dell'utente: in kg `maxKg`, in lb il quarto di libbra più alto sotto di esso
// (999,99 kg → 2204,5 lb).
export const maxWeightInUnit = (maxKg, unit) => (unit === 'lb' ? Math.floor((maxKg / LB_IN_KG) * 4) / 4 : maxKg);

// Passo delle frecce di un campo peso: 0,5 kg, 2,5 lb (il passo in kg è sotto 1,25)
export const weightStepInUnit = (unit) => (unit === 'lb' ? 2.5 : 0.5);

// Un campo peso mostra e legge l'unità dell'utente, i dati restano in kg. `kg` è una stringa in kg (come il peso
// suggerito): il testo da mettere nel campo. In kg com'è, scritto dall'utente; in lb al quarto di libbra, vuoto
// se non è un peso.
export const weightToField = (kg, unit) => {
  if (unit !== 'lb') return kg;
  const shown = kgToDisplay(kg, unit);
  return shown === null ? '' : String(shown);
};

// kg (numero) di ciò che sta nel campo, o null se non è un peso valido (0 - maxKg). Un campo precompilato e non
// toccato (`origin` = { text, kg }: il testo con cui è stato riempito e i kg da cui viene) dà i kg originali: si
// passa da inputToKg solo ciò che l'utente ha scritto. In kg la lettura è quella permissiva di sempre (parseFloat).
export const fieldToKg = (text, unit, maxKg, origin = null) => {
  if (origin && text === origin.text) return parseFloat(origin.kg);
  if (unit !== 'lb') {
    const n = parseFloat(text);
    return Number.isFinite(n) && n >= 0 && n <= maxKg ? n : null;
  }
  const kg = inputToKg(text, 'lb');
  return kg !== null && kg <= maxKg ? kg : null;
};

// Come fieldToKg ma come stringa in kg, per riportare il peso alla serie dopo (corpo libero, serie saltata).
// In kg il testo com'è; in lb un peso non valido diventa vuoto.
export const fieldToKgText = (text, unit, maxKg, origin = null) => {
  if (unit !== 'lb') return text;
  const kg = fieldToKg(text, unit, maxKg, origin);
  return kg === null ? '' : String(kg);
};
