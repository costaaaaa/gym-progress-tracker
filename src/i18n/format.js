import { it as dfIt, enUS, enGB } from 'date-fns/locale';
import i18n from './index';

// Per l'inglese si usa la variante del browser (en-GB → giorno/mese), di default en-US.
export const intlLocale = () => {
  if (i18n.language !== 'en') return 'it-IT';
  return (navigator.languages || []).find((l) => /^en-/i.test(l)) || 'en-US';
};

export const dateFnsLocale = () => {
  if (i18n.language !== 'en') return dfIt;
  return intlLocale().toLowerCase() === 'en-gb' ? enGB : enUS;
};

export const formatDate = (value, options) => new Date(value).toLocaleDateString(intlLocale(), options);

export const formatNumber = (value, options) => Number(value || 0).toLocaleString(intlLocale(), options);
