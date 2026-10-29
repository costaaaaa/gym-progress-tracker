import { dayNumber, clockDay, isClockString } from './calendarDay';

// Giorni di calendario da oggi al momento in cui il muscolo torna pronto (0 = oggi, 1 = domani).
// ready_at arriva dal backend in ISO con offset: è un istante, e il giorno è quello nel fuso del browser (come "oggi").
// Senza fuso (la demo) il giorno è quello scritto. La precisione sta al giorno, mai all'ora.
export function readyInDays(readyAt, now = new Date()) {
  if (!readyAt) return null;
  const ready = isClockString(readyAt) ? clockDay(readyAt) : new Date(readyAt);
  if (ready instanceof Date && Number.isNaN(ready.getTime())) return null;
  return Math.max(0, dayNumber(ready) - dayNumber(now));
}
