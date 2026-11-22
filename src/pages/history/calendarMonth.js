// I conti del mese del calendario dello Storico, sui giorni scritti 'YYYY-MM-DD' (e i mesi 'YYYY-MM'): niente Date locali,
// così fuso e ora legale non spostano nessun giorno.
import { dayNumber, shiftDay } from '../../utils/calendarDay';

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export const isMonthKey = (value) => typeof value === 'string' && MONTH_RE.test(value);

export const monthOf = (day) => day.slice(0, 7);

/** Il mese `delta` mesi dopo (o prima, se negativo) quello dato. */
export const shiftMonth = (month, delta) => {
  const [year, number] = month.split('-').map(Number);
  const index = year * 12 + (number - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
};

/** Tutti i giorni del mese, dal primo all'ultimo. */
export const monthDays = (month) => {
  const first = `${month}-01`;
  const count = dayNumber(`${shiftMonth(month, 1)}-01`) - dayNumber(first);
  return Array.from({ length: count }, (_, i) => shiftDay(first, i));
};

/** Le celle della griglia con la settimana da lunedì: tante `null` quanti sono i giorni prima del primo, poi i giorni. */
export const monthCells = (month) => {
  // 1970-01-01 era un giovedì: con lunedì = 0 il giovedì è 3
  const leading = (dayNumber(`${month}-01`) + 3) % 7;
  return [...Array(leading).fill(null), ...monthDays(month)];
};
