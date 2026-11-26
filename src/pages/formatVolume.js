import { formatNumber } from '../i18n/format';
import { kgToTotal, weightUnitLabel } from '../utils/weightUnit';

const NBSP = '\u00a0';

// Un volume (in kg) come testo, nell'unità dell'utente: «4.820,5 kg», «10.627 lb». Il totale è quello di
// formatTotalInUnit (kg com'è, lb convertiti e arrotondati all'intero).
export const formatVolume = (kg, unit) => (
  `${formatNumber(kgToTotal(kg ?? 0, unit), { maximumFractionDigits: 2 })}${NBSP}${weightUnitLabel(unit)}`
);
