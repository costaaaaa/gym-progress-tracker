import i18n from './index';

// muscle_group è una chiave del catalogo (es. 'petto'); se manca la traduzione resta il valore.
// intensity_technique è salvato in italiano (valore dei dati): qui si traduce solo l'etichetta.
const TECHNIQUE_KEYS = {
  'Nessuna (Normale)': 'none',
  'Drop Set (Stripping)': 'drop_set',
  'Rest Pause': 'rest_pause',
  'Super Set': 'super_set',
  'Jump Set': 'jump_set',
  Negative: 'negative',
  'Ripetizioni Forzate': 'forced_reps',
  Isometria: 'isometric',
  'Peak Contraction': 'peak_contraction',
  'Myo-Reps': 'myo_reps',
};

export const NO_TECHNIQUE = 'Nessuna (Normale)';

// Le tecniche nell'ordine dei menu
export const INTENSITY_TECHNIQUES = Object.keys(TECHNIQUE_KEYS);

export const techniqueLabel = (value) => {
  const key = TECHNIQUE_KEYS[value];
  return key ? i18n.t(`technique.${key}`) : value || '';
};

export const muscleLabel = (group) => {
  if (!group) return '';
  const fallback = group.charAt(0).toUpperCase() + group.slice(1);
  return i18n.t(`muscle.${group.toLowerCase()}`, { defaultValue: fallback });
};
