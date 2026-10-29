import { dayNumber } from './calendarDay';

// Giorni di calendario da oggi al momento in cui il muscolo torna pronto (0 = oggi, 1 = domani).
// ready_at arriva dal backend in ISO con l'offset del dispositivo: il giorno è quello scritto, la precisione sta al giorno, mai all'ora.
export function readyInDays(readyAt, now = new Date()) {
  const day = /^\d{4}-\d{2}-\d{2}(?:[ T]|$)/.test(String(readyAt ?? '')) ? String(readyAt).slice(0, 10) : null;
  if (!day) return null;
  return Math.max(0, dayNumber(day) - dayNumber(now));
}
