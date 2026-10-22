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
