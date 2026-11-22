import { formatNumber, intlLocale } from '../../i18n/format';
import { muscleLabel } from '../../i18n/labels';
import { formatEstimateInUnit } from '../../utils/weightUnit';

// «1° esercizio»: solo se la sessione ha la posizione nella seduta; altrimenti non c'è nulla da mostrare
export const positionLabel = (t, position) => (Number.isInteger(position) ? t('progress.position', { count: position, ordinal: true }) : null);

export const formatDaysAgo = (t, days) => {
  if (days === 0) return t('progress.today');
  if (days === 1) return t('progress.yesterday');
  return t('progress.days_ago', { count: days });
};

export const formatValue = (t, mode, value, weightUnit) =>
  mode === 'oneRM'
    ? formatEstimateInUnit(value, weightUnit, intlLocale())
    : `${formatNumber(value)} ${t('progress.unit.reps')}`;

// Nome del gruppo muscolare; senza gruppo (null o «other») è «Altro»
export const groupLabel = (t, muscle) => (!muscle || muscle === 'other' ? t('progress.muscle_other') : muscleLabel(muscle));
