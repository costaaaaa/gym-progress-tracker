import { summarizeSets } from '../../utils/workoutMetrics';
import { kgToTotal, weightUnitLabel } from '../../utils/weightUnit';
import { formatThousands, formatDuration } from '../../utils/shareCard';
import { shareCardStrings } from '../../i18n/shareCardStrings';

// «58 min · 9.420 kg di volume»: la durata solo se c'è, il volume delle serie allenanti (come la card di
// condivisione, kg interi) nell'unità dell'account. Vuoto se non c'è nessuno dei due.
export const workoutLine = (record, unit, t) => {
  const parts = [];
  // Il formato è quello dello Storico (la card di condivisione): «1h 05m», «4.775 kg»
  const strings = shareCardStrings();
  const duration = formatDuration(record?.duration_seconds, strings);
  if (duration) parts.push(duration);
  const volumeKg = Math.round((record?.exercises || []).reduce((sum, ex) => sum + summarizeSets(ex.sets).sessionVolume, 0));
  if (volumeKg > 0) {
    parts.push(t('home.last.volume', { value: `${formatThousands(kgToTotal(volumeKg, unit), strings)} ${weightUnitLabel(unit)}` }));
  }
  return parts.join(' · ');
};
