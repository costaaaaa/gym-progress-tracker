// Date di calendario come numeri, calcolati in UTC: fuso e ora legale non spostano nulla.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Giorno di calendario come numero intero: 'YYYY-MM-DD', 'YYYY-MM-DD HH:MM:SS' (l'ora non conta) o una Date (giorno locale). */
export const dayNumber = (date) => {
  const [y, m, d] = typeof date === 'string'
    ? date.slice(0, 10).split('-').map(Number)
    : [date.getFullYear(), date.getMonth() + 1, date.getDate()];
  return Date.UTC(y, m - 1, d) / DAY_MS;
};

/** Come dayNumber, ma l'ora di 'YYYY-MM-DD HH:MM:SS' diventa la frazione del giorno (le 18:00 sono .75). */
export const dayTime = (dateTime) => {
  const [h = 0, min = 0, s = 0] = dateTime.slice(11).split(':').filter(Boolean).map(Number);
  return dayNumber(dateTime) + (h * 3600 + min * 60 + s) / 86400;
};

/** Il giorno 'YYYY-MM-DD' scritto all'inizio di un orologio o di un ISO con offset (il giorno è quello scritto, non quello UTC); null se non c'è. */
export const clockDay = (value) => /^(\d{4}-\d{2}-\d{2})(?:[ T]|$)/.exec(String(value ?? ''))?.[1] ?? null;

const CLOCK_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/** Una stringa di calendario senza fuso: 'YYYY-MM-DD' o 'YYYY-MM-DD[ T]HH:MM[:SS]'. */
export const isClockString = (value) => typeof value === 'string' && CLOCK_RE.test(value);

/** L'orologio di una stringa di calendario come Date in UTC: i campi UTC sono quelli scritti, nessun fuso e nessuna ora legale di mezzo. */
export const clockDate = (value) => {
  const m = CLOCK_RE.exec(String(value ?? ''));
  if (!m) return new Date(NaN);
  const [y, mo, d, h, mi, s] = m.slice(1).map((n) => Number(n || 0));
  return new Date(Date.UTC(y, mo - 1, d, h, mi, s));
};
