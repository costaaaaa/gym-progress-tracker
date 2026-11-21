import { summarizeSets } from '../../utils/workoutMetrics';
import { kgToTotal, weightUnitLabel } from '../../utils/weightUnit';
import { formatNumber } from '../../i18n/format';

// «58 min · 9.420 kg di volume»: la durata solo se c'è, il volume delle serie allenanti (come la card di
// condivisione, kg interi) nell'unità dell'account. Vuoto se non c'è nessuno dei due.
export const workoutLine = (record, unit, t) => {
  const parts = [];
  const minutes = Math.round((record?.duration_seconds || 0) / 60);
  if (minutes > 0) {
    parts.push(minutes < 60
      ? t('home.last.minutes', { count: minutes })
      : t('home.last.hours', { hours: Math.floor(minutes / 60), minutes: minutes % 60 }));
  }
  const volumeKg = Math.round((record?.exercises || []).reduce((sum, ex) => sum + summarizeSets(ex.sets).sessionVolume, 0));
  if (volumeKg > 0) {
    parts.push(t('home.last.volume', { value: `${formatNumber(kgToTotal(volumeKg, unit))} ${weightUnitLabel(unit)}` }));
  }
  return parts.join(' · ');
};
