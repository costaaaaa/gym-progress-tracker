// Bozza dell'editor delle serie pianificate (#77): i testi come li scrive l'utente, prima che
// diventino planned_sets. Funzioni pure.
//
// bozza = { warmups: '2', list: false, sets: '3', row: riga, rows: [riga, ...] }
// riga  = { target: '8-10', to_failure: false, technique: '' }
// Forma compatta (list false): usa `sets` e `row`. Forma lista (list true): usa `rows`.
import {
  MAX_WARMUP, MAX_WORKING, buildPlannedSets, compactForm, fromCompact, parseRowTarget, plannedSetsValid, targetLabel, toInt,
} from './plannedSets';

const emptyRow = () => ({ target: '', to_failure: false, technique: '' });

// A cedimento il testo è il solo minimo (facoltativo).
const targetText = (set) => {
  if (!set.to_failure) return targetLabel(set);
  return set.reps_min === null ? '' : String(set.reps_min);
};

const warmupCount = (draft) => (String(draft.warmups).trim() === '' ? 0 : toInt(draft.warmups, 0, MAX_WARMUP));

const rowFromSet = (set) => ({
  target: targetText(set),
  to_failure: set.to_failure,
  technique: set.intensity_technique ?? '',
});

export const draftFromPlannedSets = (plannedSets) => {
  if (!plannedSets) return { warmups: '0', list: false, sets: '', row: emptyRow(), rows: [] };
  const compact = compactForm(plannedSets);
  if (compact) {
    return {
      warmups: String(compact.warmups),
      list: false,
      sets: String(compact.sets),
      row: rowFromSet({ ...compact.target, intensity_technique: compact.technique }),
      rows: [],
    };
  }
  const working = plannedSets.filter((set) => set.kind === 'working');
  return {
    warmups: String(plannedSets.length - working.length),
    list: true,
    sets: '',
    row: emptyRow(),
    rows: working.map(rowFromSet),
  };
};

const rowError = (row) => {
  if (parseRowTarget(row.target, row.to_failure)) return null;
  return row.to_failure ? 'plan_editor.error_min' : 'plan_editor.error_target';
};

// Una chiave i18n (o null) per campo: warmups, sets, target (compatta), rows (lista, una per riga).
export const draftErrors = (draft) => {
  const count = draft.list ? draft.rows.length : toInt(draft.sets, 1, MAX_WORKING);
  const setsOk = draft.list ? count >= 1 && count <= MAX_WORKING : count !== null;
  return {
    warmups: warmupCount(draft) === null ? 'plan_editor.error_warmups' : null,
    sets: setsOk ? null : 'plan_editor.error_sets',
    target: draft.list ? null : rowError(draft.row),
    rows: draft.list ? draft.rows.map(rowError) : [],
  };
};

const hasErrors = (errors) => Object.values(errors).flat().some(Boolean);

// planned_sets della bozza, o null se un campo non è valido.
export const plannedSetsFromDraft = (draft) => {
  if (hasErrors(draftErrors(draft))) return null;
  const warmups = warmupCount(draft);
  const plannedSets = draft.list
    ? buildPlannedSets(warmups, draft.rows.map((row) => ({
      ...parseRowTarget(row.target, row.to_failure),
      technique: row.technique,
    })))
    : fromCompact({
      warmups,
      sets: toInt(draft.sets, 1, MAX_WORKING),
      target: parseRowTarget(draft.row.target, draft.row.to_failure),
      technique: draft.row.technique,
    });
  return plannedSetsValid(plannedSets) ? plannedSets : null;
};

// Dalla forma compatta alla lista: una riga per serie, la tecnica sull'ultima.
export const draftToList = (draft) => {
  const count = toInt(draft.sets, 1, MAX_WORKING) ?? 1;
  return {
    ...draft,
    list: true,
    rows: Array.from({ length: count }, (_, i) => ({
      ...draft.row,
      technique: i === count - 1 ? draft.row.technique : '',
    })),
  };
};

// Dalla lista alla forma compatta; null se le serie non sono valide o compattabili.
export const draftToCompact = (draft) => {
  const plannedSets = plannedSetsFromDraft(draft);
  const compact = plannedSets && compactForm(plannedSets);
  return compact && draftFromPlannedSets(plannedSets);
};

export const addRow = (draft) => {
  if (draft.rows.length >= MAX_WORKING) return draft;
  const last = draft.rows[draft.rows.length - 1] ?? emptyRow();
  return { ...draft, rows: [...draft.rows, { ...last, technique: '' }] };
};

export const removeRow = (draft, index) => (
  draft.rows.length <= 1 ? draft : { ...draft, rows: draft.rows.filter((_, i) => i !== index) }
);
