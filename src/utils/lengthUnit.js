// Unità di lunghezza dell'utente (cm o pollici), legata alla stessa scelta dei pesi: kg → cm, lb → pollici (in). I dati
// restano sempre in cm (colonne decimal(5,2)): qui si converte solo per mostrare una circonferenza e per leggere quella
// che l'utente scrive. File puro come weightUnit.js (la lingua arriva come argomento). Pollici mostrati a un decimale;
// i cm scritti dall'utente si arrotondano a 0,01. Una misura salvata non si modifica mai (se ne aggiunge una nuova),
// quindi non c'è riconversione di un valore esistente.

import { formatWeight } from './weightFormat';
import { parseDecimalText, roundCents } from './weightUnit';

const NBSP = ' ';

export const CM_PER_IN = 2.54;

// 'cm' o 'in'; l'unità è quella dei pesi (kg | lb), un valore non valido vale kg
export const lengthUnitLabel = (unit) => (unit === 'lb' ? 'in' : 'cm');

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// Decimi di pollice da centesimi di cm, in interi: cm / 0,254 = centesimi × 5 / 127. 127 è dispari, quindi un cm a 0,01
// non cade mai esattamente a metà di un decimo di pollice e l'arrotondamento non dipende dalla virgola mobile.
const tenthsOfInchFromCm = (cm) => Math.round((Math.round(cm * 100) * 5) / 127);

// cm → numero da mostrare: cm come sono, pollici a un decimale. null se il valore manca.
export function cmToDisplay(cm, unit) {
  const n = toNumber(cm);
  if (n === null) return null;
  return unit === 'lb' ? tenthsOfInchFromCm(n) / 10 : n;
}

// "83,25 cm" / "32,8 in": numero nella lingua dell'utente, senza zeri inutili, spazio non separabile prima dell'unità.
// Senza un valore valido: "—". Opzioni: unit: false = solo il numero.
export function formatLengthInUnit(cm, unit, locale, { unit: withUnit = true } = {}) {
  const shown = cmToDisplay(cm, unit);
  if (shown === null) return '—';
  const digits = formatWeight(shown, locale, { unit: false, maxDecimals: unit === 'lb' ? 1 : 2 });
  return withUnit ? `${digits}${NBSP}${lengthUnitLabel(unit)}` : digits;
}

// Testo scritto dall'utente nella sua unità → cm arrotondati a 0,01 (ai mezzi per eccesso, con la tecnica dei pesi). Stesse
// regole di forma di inputToKg: tutto ciò che non è un decimale semplice è null. Nessun tetto: lo mette chi valida.
export function lengthInputToCm(text, unit) {
  const n = parseDecimalText(text);
  if (n === null) return null;
  const cm = roundCents(unit === 'lb' ? n * CM_PER_IN : n);
  return Number.isFinite(cm) ? cm : null;
}

// Testo di un campo lunghezza nell'unità dell'utente → cm come testo, per le regole che lavorano in cm (e per il payload):
// in cm il testo com'è (lo giudicano le regole di sempre), vuoto resta vuoto, in pollici i cm a 0,01. Un testo non valido in
// pollici dà null: chi chiama lo segnala come errore, mai riletto come cm.
export const fieldTextToCmText = (text, unit) => {
  if (unit !== 'lb' || text === '') return text;
  const cm = lengthInputToCm(text, 'lb');
  return cm === null ? null : String(cm);
};

// Limite di un campo lunghezza nell'unità dell'utente: in cm `maxCm`, in pollici il decimo più alto sotto di esso
// (300 cm → 118,1 in), così il massimo scrivibile è sempre accettato dal server.
export const maxLengthInUnit = (maxCm, unit) =>
  (unit === 'lb' ? Math.floor((Math.round(maxCm * 100) * 5) / 127) / 10 : maxCm);
