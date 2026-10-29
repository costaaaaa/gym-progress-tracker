import { it as dfIt, enUS, enGB } from 'date-fns/locale';
import i18n from './index';
import { clockDate, isClockString } from '../utils/calendarDay';

// Per l'inglese si usa la variante del browser (en-GB → giorno/mese), di default en-US.
export const intlLocale = () => {
  if (i18n.language !== 'en') return 'it-IT';
  return (navigator.languages || []).find((l) => /^en-/i.test(l)) || 'en-US';
};

export const dateFnsLocale = () => {
  if (i18n.language !== 'en') return dfIt;
  return intlLocale().toLowerCase() === 'en-gb' ? enGB : enUS;
};

// Date e date-ore senza fuso ("2026-10-20", "2026-10-20 18:30:00") sono il giorno scritto: new Date() le
// leggerebbe come mezzanotte UTC e a ovest di UTC mostrerebbero il giorno prima. Un istante (ISO con offset,
// Date) si mostra nel fuso del browser.
export const formatDate = (value, options) => (isClockString(value)
  ? clockDate(value).toLocaleDateString(intlLocale(), { ...options, timeZone: 'UTC' })
  : new Date(value).toLocaleDateString(intlLocale(), options));

// L'ora scritta in una data-ora senza fuso ("2026-10-20 18:30:00" → "18:30"), senza convertirla nel fuso del browser.
export const formatClockTime = (value) => clockDate(value).toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

export const formatNumber = (value, options) => Number(value || 0).toLocaleString(intlLocale(), options);
