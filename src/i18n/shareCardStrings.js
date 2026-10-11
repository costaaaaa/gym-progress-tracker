import { STRINGS_IT } from '../utils/shareCard';
import i18n from './index';
import { intlLocale } from './format';
import { muscleLabel } from './labels';

const SPECIAL = ['days', 'months', 'thousands', 'decimal', 'date'];

// Testi della card di condivisione nella lingua attiva del sito.
export const shareCardStrings = () => {
  const locale = intlLocale();
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });
  const month = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' });
  // 12345.6 e non 1234: l'italiano non raggruppa i numeri a quattro cifre.
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  const part = (type, fallback) => parts.find((p) => p.type === type)?.value ?? fallback;

  const strings = {
    days: Array.from({ length: 7 }, (_, i) => weekday.format(new Date(Date.UTC(2024, 0, 7 + i)))),
    months: Array.from({ length: 12 }, (_, i) => month.format(new Date(Date.UTC(2024, i, 1)))),
    thousands: part('group', ','),
    decimal: part('decimal', '.'),
    date: i18n.t(locale.toLowerCase() === 'en-gb' ? 'share.card.date_dmy' : 'share.card.date'),
    muscleName: muscleLabel,
  };
  Object.keys(STRINGS_IT)
    .filter((key) => !SPECIAL.includes(key))
    .forEach((key) => { strings[key] = i18n.t(`share.card.${key}`); });
  return strings;
};
