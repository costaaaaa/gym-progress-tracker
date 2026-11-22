import i18n from '../../i18n';
import { formatDate } from '../../i18n/format';

// Il giorno scritto per esteso: titolo di un allenamento senza giorno della scheda («domenica 18 ottobre»)
const LONG_DAY = { weekday: 'long', day: 'numeric', month: 'long' };

/** Il nome di un allenamento: il giorno della scheda, o la data se manca. */
export const workoutTitle = (workout) => workout.day_name || formatDate(workout.date, LONG_DAY);

/** «62 min» (anche sopra l'ora: «95 min»; minimo «1 min»), o null se la durata non c'è. */
export const durationText = (seconds) => (seconds > 0 ? i18n.t('history.minutes', { count: Math.max(1, Math.round(seconds / 60)) }) : null);
