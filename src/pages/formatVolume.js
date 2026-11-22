import { formatNumber } from '../i18n/format';
import { kgToTotal, weightUnitLabel } from '../utils/weightUnit';

const NBSP = '\u00a0';

// Un volume (in kg) come testo, nell'unità dell'utente: «4.820,5 kg», «10.627 lb». Usato dalle pagine di Storico e Progressi. Il totale è quello di
// formatTotalInUnit (kg com'è, lb convertiti e arrotondati all'intero), ma con le migliaia sempre separate: in italiano
// da quattro cifre il separatore normalmente non c'è, e un numero grande così si legge male.
export const formatVolume = (kg, unit) => (
  `${formatNumber(kgToTotal(kg ?? 0, unit), { maximumFractionDigits: 2, useGrouping: 'always' })}${NBSP}${weightUnitLabel(unit)}`
);
