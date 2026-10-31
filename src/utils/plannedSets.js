// Serie pianificate di un esercizio in scheda (#77): funzioni pure. Le regole rispecchiano
// planned_sets_error() di backend/lib/plan_sets_rules.php.
import i18n from '../i18n';
import { techniqueLabel } from '../i18n/labels';

const REPS_MAX = 250;

const toReps = (text) => {
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= 1 && n <= REPS_MAX ? n : null;
};

// "8" o "8-10" -> { reps_min, reps_max }; null se il testo non è un target valido.
export const parseTarget = (text) => {
  if (typeof text !== 'string') return null;
  const parts = text.split('-').map((part) => part.trim());
  if (parts.length > 2) return null;
  const min = toReps(parts[0]);
  const max = parts.length === 2 ? toReps(parts[1]) : min;
  if (min === null || max === null || min > max) return null;
  return { reps_min: min, reps_max: max };
};

// Target di una riga dell'editor: a cedimento il testo è il solo minimo (facoltativo).
export const parseRowTarget = (text, toFailure) => {
  if (!toFailure) {
    const target = parseTarget(text);
    return target && { ...target, to_failure: false };
  }
  const trimmed = String(text ?? '').trim();
  if (trimmed === '') return { reps_min: null, reps_max: null, to_failure: true };
  const min = toReps(trimmed);
  return min === null ? null : { reps_min: min, reps_max: null, to_failure: true };
};

// Il target di una serie a parole: "8", "8-10", "a cedimento", "a cedimento (min. 8)".
export const targetLabel = (set) => {
  if (set.to_failure) {
    return set.reps_min === null
      ? i18n.t('plans.target_failure')
      : i18n.t('plans.target_failure_min', { min: set.reps_min });
  }
  return set.reps_min === set.reps_max ? String(set.reps_min) : `${set.reps_min}-${set.reps_max}`;
};

const NO_TECHNIQUE = 'Nessuna (Normale)';

// Tecnica come si salva: vuota o "Nessuna (Normale)" vale null.
const normalizeTechnique = (value) => {
  const trimmed = String(value ?? '').trim();
  return trimmed === '' || trimmed === NO_TECHNIQUE ? null : trimmed;
};

const targetOf = (set) => ({ reps_min: set.reps_min, reps_max: set.reps_max, to_failure: set.to_failure });
const sameTarget = (a, b) => a.reps_min === b.reps_min && a.reps_max === b.reps_max && a.to_failure === b.to_failure;
const workingOf = (plannedSets) => plannedSets.filter((set) => set.kind === 'working');

// Serie nella forma compatta { warmups, sets, target, technique }, o null se non si possono
// scrivere così: servono target tutti uguali e al massimo l'ultima allenante con una tecnica.
export const compactForm = (plannedSets) => {
  const working = workingOf(plannedSets);
  if (working.length === 0) return null;
  const target = targetOf(working[0]);
  if (!working.every((set) => sameTarget(targetOf(set), target))) return null;
  const last = working.length - 1;
  if (working.some((set, i) => i < last && normalizeTechnique(set.intensity_technique) !== null)) return null;
  return {
    warmups: plannedSets.length - working.length,
    sets: working.length,
    target,
    technique: normalizeTechnique(working[last].intensity_technique),
  };
};

// Da riscaldamenti e righe allenanti { reps_min, reps_max, to_failure, technique } a planned_sets.
export const buildPlannedSets = (warmups, rows) => [
  ...Array.from({ length: warmups }, () => ({
    kind: 'warmup', reps_min: null, reps_max: null, to_failure: false, intensity_technique: null,
  })),
  ...rows.map((row) => ({
    kind: 'working',
    reps_min: row.reps_min,
    reps_max: row.reps_max,
    to_failure: row.to_failure,
    intensity_technique: normalizeTechnique(row.technique),
  })),
].map((set, i) => ({ set_number: i + 1, ...set }));

export const fromCompact = ({ warmups, sets, target, technique }) =>
  buildPlannedSets(warmups, Array.from({ length: sets }, (_, i) => ({
    ...target,
    technique: i === sets - 1 ? technique : null,
  })));

// Allenanti consecutive con lo stesso target -> [{ count, label }].
const groupWorking = (working) => working.reduce((groups, set) => {
  const label = targetLabel(set);
  const last = groups[groups.length - 1];
  if (last && last.label === label) last.count += 1;
  else groups.push({ count: 1, label });
  return groups;
}, []);

// Tecniche nell'ordine di prima comparsa, con i numeri (da 1, solo allenanti) delle loro serie.
const techniqueParts = (plannedSets, working) => {
  const bySet = new Map();
  working.forEach((set, i) => {
    const technique = normalizeTechnique(set.intensity_technique);
    if (technique !== null) bySet.set(technique, [...(bySet.get(technique) || []), i + 1]);
  });
  const onLast = working.length > 1 && compactForm(plannedSets) !== null;
  return [...bySet].map(([technique, numbers]) => {
    const label = techniqueLabel(technique);
    if (working.length === 1) return label;
    if (onLast) return i18n.t('plans.summary_technique_last', { technique: label });
    return i18n.t('plans.summary_technique_sets', { technique: label, sets: numbers.join(', '), count: numbers.length });
  });
};

// Riga riassuntiva: "2 risc. + 2 × 8-10 + 1 × 12-15 · Drop set (stripping) (serie 3)".
export const planSummary = (plannedSets) => {
  if (!plannedSets || plannedSets.length === 0) return '';
  const working = workingOf(plannedSets);
  const warmups = plannedSets.length - working.length;
  const groups = groupWorking(working).map(({ count, label }) => `${count} × ${label}`).join(' + ');
  const prefix = warmups > 0 ? i18n.t('plans.warmup_prefix', { n: warmups }) : '';
  return [prefix + groups, ...techniqueParts(plannedSets, working)].join(' · ');
};

const MAX_WARMUP = 10;
const MAX_WORKING = 20;
const TECHNIQUE_MAX_LENGTH = 100;
const isRepsOk = (n) => Number.isInteger(n) && n >= 1 && n <= REPS_MAX;

const targetIsValid = (set) => {
  const { reps_min: min, reps_max: max } = set;
  if (set.kind === 'warmup') {
    return min === null && max === null && !set.to_failure && normalizeTechnique(set.intensity_technique) === null;
  }
  if (set.to_failure) return max === null && (min === null || isRepsOk(min));
  return isRepsOk(min) && isRepsOk(max) && min <= max;
};

// Chiave i18n del primo errore di `planned_sets` (stesse regole e ordine di planned_sets_error()
// in backend/lib/plan_sets_rules.php), o null se sono valide.
export const plannedSetsError = (plannedSets) => {
  if (!plannedSets.every((set, i) => set.set_number === i + 1 && ['warmup', 'working'].includes(set.kind))) {
    return 'plan_editor.error_invalid';
  }
  const techniques = plannedSets.map((set) => set.intensity_technique ?? null);
  if (techniques.some((value) => value !== null && (typeof value !== 'string' || value.trim().length > TECHNIQUE_MAX_LENGTH))) {
    return 'plan_editor.error_technique';
  }
  const working = workingOf(plannedSets).length;
  const warmups = plannedSets.length - working;
  if (warmups > MAX_WARMUP || working < 1 || working > MAX_WORKING) return 'plan_editor.error_count';
  if (plannedSets.some((set, i) => (i < warmups) !== (set.kind === 'warmup'))) return 'plan_editor.error_order';
  return plannedSets.every(targetIsValid) ? null : 'plan_editor.error_target';
};

const comparable = (set) => JSON.stringify([
  Number(set.set_number),
  set.kind,
  set.reps_min === null || set.reps_min === undefined ? null : Number(set.reps_min),
  set.reps_max === null || set.reps_max === undefined ? null : Number(set.reps_max),
  Boolean(Number(set.to_failure)),
  normalizeTechnique(set.intensity_technique),
]);

// Le serie inviate coincidono con quelle restituite dal server (tipi e tecnica vuota normalizzati)?
export const samePlannedSets = (sent, received) => (
  Array.isArray(received) && received.length > 0 && received.length === sent.length
  && sent.every((set, i) => comparable(set) === comparable(received[i]))
);
