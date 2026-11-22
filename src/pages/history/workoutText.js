import i18n from '../../i18n';
import { intlLocale, formatDate } from '../../i18n/format';
import { formatDuration } from '../../utils/shareCard';
import { shareCardStrings } from '../../i18n/shareCardStrings';
import { formatTotalInUnit } from '../../utils/weightUnit';

// Il giorno scritto per esteso: titolo di un allenamento senza giorno della scheda («domenica 18 ottobre»)
const LONG_DAY = { weekday: 'long', day: 'numeric', month: 'long' };

/** Il nome di un allenamento: il giorno della scheda, o la data se manca. */
export const workoutTitle = (workout) => workout.day_name || formatDate(workout.date, LONG_DAY);

// I testi della card da condividere servono qui solo per «62 min» / «1h 02m»; si rifanno solo se cambia la lingua
let strings = { language: null, value: null };
const durationStrings = () => {
  if (strings.language !== i18n.language) strings = { language: i18n.language, value: shareCardStrings() };
  return strings.value;
};

/** «1h 02m» come sulla card da condividere, o null se la durata non c'è. */
export const durationText = (seconds) => formatDuration(seconds, durationStrings());

/** Il volume (in kg) nell'unità dell'utente, con i separatori della lingua: «1440 kg» o «3175 lb». */
export const volumeText = (volumeKg, weightUnit) => formatTotalInUnit(volumeKg, weightUnit, intlLocale());
