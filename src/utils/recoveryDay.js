import { dayNumber, clockDay } from './calendarDay';

// Giorni di calendario da oggi al momento in cui il muscolo torna pronto (0 = oggi, 1 = domani).
// ready_at arriva dal backend in ISO con l'offset del dispositivo: il giorno è quello scritto (clockDay), la precisione sta al giorno, mai all'ora.
export function readyInDays(readyAt, now = new Date()) {
  const day = clockDay(readyAt);
  if (!day) return null;
  return Math.max(0, dayNumber(day) - dayNumber(now));
}
