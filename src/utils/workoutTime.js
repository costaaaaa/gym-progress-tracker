import { intlLocale } from '../i18n/format';
import { clockDate } from './calendarDay';

// La `date` di un allenamento è l'ora locale del luogo in cui è stato fatto ("YYYY-MM-DD HH:MM:SS"), non un
// istante: si mostra come sta scritta, a prescindere dal fuso del browser. Per i conti fra istanti (giorni
// da allora, recupero) c'è `started_at`, ISO con offset.

export { clockDate };

export const formatClockDate = (value, options) => clockDate(value).toLocaleDateString(intlLocale(), { ...options, timeZone: 'UTC' });

export const formatClockTime = (value) => clockDate(value).toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

/** Istante dell'allenamento in ms. Senza `started_at` (risposta di un backend vecchio) l'orologio si legge nel fuso del browser, come prima. */
export const workoutInstant = (workout) => {
  if (workout.started_at) return Date.parse(workout.started_at);
  const c = clockDate(workout.date);
  return Number.isNaN(c.getTime()) ? NaN : new Date(c.getUTCFullYear(), c.getUTCMonth(), c.getUTCDate(), c.getUTCHours(), c.getUTCMinutes(), c.getUTCSeconds()).getTime();
};

/** L'orologio di un ISO con offset ("2026-10-18T02:00:00-04:00" → "2026-10-18 02:00:00"), senza convertirlo nel fuso del browser. */
export const isoClock = (iso) => {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/.exec(String(iso ?? ''));
  return m ? `${m[1]} ${m[2]}` : null;
};

export const currentTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** "UTC−4", "UTC+5:30", "UTC" dall'offset di un ISO (meno tipografico). */
export const offsetLabel = (iso) => {
  const m = /(?:(Z)|([+-])(\d{2}):(\d{2}))$/.exec(String(iso ?? ''));
  if (!m) return null;
  if (m[1]) return 'UTC';
  const hours = Number(m[3]);
  const minutes = Number(m[4]);
  if (hours === 0 && minutes === 0) return 'UTC';
  return `UTC${m[2] === '-' ? '−' : '+'}${hours}${minutes ? `:${String(minutes).padStart(2, '0')}` : ''}`;
};

/** "America/New_York" → "New York". */
export const zoneCity = (zone) => zone.split('/').pop().replace(/_/g, ' ');

// Lo stesso fuso ha più nomi IANA (Europe/Kiev, Europe/Kyiv): si confrontano i nomi canonici.
const canonicalZone = (zone) => {
  try {
    return Intl.DateTimeFormat('en', { timeZone: zone }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
};

/** Testo del badge "New York · UTC−4", solo se l'allenamento è stato fatto in un fuso diverso da `browserZone`. */
export const workoutZoneBadge = (workout, browserZone = currentTimeZone()) => {
  const zone = workout.time_zone;
  const offset = offsetLabel(workout.started_at);
  if (!zone || !offset || !browserZone) return null;
  const here = canonicalZone(browserZone);
  const there = canonicalZone(zone);
  if (!here || !there || here === there) return null;
  return `${zoneCity(zone)} · ${offset}`;
};
