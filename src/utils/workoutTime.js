import { intlLocale } from '../i18n/format';
import { clockDate } from './calendarDay';

// La `date` di un allenamento è l'ora locale del luogo in cui è stato fatto ("YYYY-MM-DD HH:MM:SS"), non un
// istante: si mostra come sta scritta, a prescindere dal fuso del browser. Per i conti fra istanti (giorni
// da allora, recupero) c'è `started_at`, ISO con offset.

export const formatClockTime = (value) => clockDate(value).toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

/** Istante dell'allenamento in ms: `started_at` lo manda sempre read.php, unica sorgente degli allenamenti che arrivano qui. */
export const workoutInstant = (workout) => Date.parse(workout.started_at);

/** L'orologio di un ISO con offset ("2026-10-18T02:00:00-04:00" → "2026-10-18 02:00:00"), senza convertirlo nel fuso del browser. */
export const isoClock = (iso) => {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/.exec(String(iso ?? ''));
  return m ? `${m[1]} ${m[2]}` : null;
};

export const currentTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** "UTC−4", "UTC+5:30", "UTC" dall'offset di un ISO (meno tipografico). */
const offsetLabel = (iso) => {
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

/** `zone` è un fuso diverso da quello del dispositivo; false se manca o non si riconosce. */
export const differentZone = (zone) => {
  if (!zone) return false;
  const here = canonicalZone(currentTimeZone());
  const there = canonicalZone(zone);
  return Boolean(here && there && here !== there);
};

/** Testo del badge "New York · UTC−4", solo se l'allenamento è stato fatto in un fuso diverso da quello del dispositivo. */
export const workoutZoneBadge = (workout) => {
  const offset = offsetLabel(workout.started_at);
  if (!offset || !differentZone(workout.time_zone)) return null;
  return `${zoneCity(workout.time_zone)} · ${offset}`;
};

const clockParts = (zone) => new Intl.DateTimeFormat('en-US', {
  timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** L'orologio ("YYYY-MM-DD HH:MM:SS") che segna `instant` (ms o Date) in `zone`, a prescindere dal fuso del browser. */
export const zoneClock = (instant, zone) => {
  const p = Object.fromEntries(clockParts(zone).formatToParts(new Date(instant)).map(({ type, value }) => [type, value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
};

/** Stesso orario che `instant` ha in `zone`, ma sul giorno `day` ('YYYY-MM-DD') di quel luogo; ritorna ms. */
export const moveToZoneDay = (instant, day, zone) => {
  const wanted = clockDate(`${day} ${zoneClock(instant, zone).slice(11)}`).getTime();
  // L'offset del fuso può cambiare fra i due giorni (ora legale): si corregge finché l'orologio torna.
  let result = wanted - (clockDate(zoneClock(wanted, zone)).getTime() - wanted);
  result = wanted - (clockDate(zoneClock(result, zone)).getTime() - result);
  return result;
};
