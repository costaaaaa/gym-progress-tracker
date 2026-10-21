// Giorni di calendario da oggi al momento in cui il muscolo torna pronto (0 = oggi, 1 = domani).
// ready_at arriva dal backend come "Y-m-d H:i:s": la precisione sta al giorno, mai all'ora.
export function readyInDays(readyAt, now = new Date()) {
  if (!readyAt) return null;
  const ready = new Date(String(readyAt).replace(' ', 'T'));
  if (Number.isNaN(ready.getTime())) return null;
  const day = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.max(0, Math.round((day(ready) - day(now)) / 86400000));
}
