import i18n from './index';
import { achievementCatalog } from '../utils/gamificationLevels';
import { kgToTotal, weightUnitLabel } from '../utils/weightUnit';

export const NO_TECHNIQUE = 'Nessuna (Normale)';

// muscle_group è una chiave del catalogo (es. 'petto'); se manca la traduzione resta il valore.
// intensity_technique è salvato in italiano (valore dei dati): qui si traduce solo l'etichetta.
const TECHNIQUE_KEYS = {
  [NO_TECHNIQUE]: 'none',
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

// Etichetta tradotta di uno slug di attrezzo (es. 'corpo_libero'). equipmentLabel in utils/exerciseCatalog.js resta la mappa
// italiana fissa, perché quel file è condiviso byte per byte con un altro client. Uno slug sconosciuto si mostra com'è.
export const equipmentName = (slug) => (slug ? i18n.t(`equipment.${slug}`, { defaultValue: slug }) : '');

// Nome di un traguardo nella lingua dell'app. Il label del server segue la lingua dell'account, che può
// essere diversa: serve solo come ripiego per una chiave che il client non conosce (senza ripiego, la chiave).
// I traguardi di forza hanno la soglia in kg ({{value}} {{unit}} nel testo): si mostra nell'unità dell'utente, all'intero più
// vicino (100 kg → 220 lb); lo sblocco resta calcolato in kg.
export const achievementLabel = (key, fallback, weightUnit) => {
  const threshold = achievementCatalog.find((a) => a.key === key && a.category === 'strength')?.threshold;
  return i18n.t(`achievement.${key}`, {
    defaultValue: fallback ?? key,
    value: threshold === undefined ? undefined : kgToTotal(threshold, weightUnit),
    unit: weightUnitLabel(weightUnit),
  });
};
