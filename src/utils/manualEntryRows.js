// Funzioni pure dell'inserimento manuale (RecordWorkoutDialog): righe di un esercizio con il
// riscaldamento attivabile riga per riga. Nessun React né window, solo import relativi.

import { initialWeight, plannedSetAt, slotTechnique, totalSlots } from './focusSession';
import { targetLabel } from './plannedSets';

// Righe iniziali dell'inserimento manuale di un esercizio: una per serie pianificata. Il
// riscaldamento è vuoto e senza tecnica; l'allenante ha la tecnica della sua serie e le
// ripetizioni precompilate solo se il target è un numero singolo, altrimenti vuote con
// l'obiettivo in grigio ("8-10", "a cedimento") da scrivere.
export const initialSetRows = (exercise) => Array.from({ length: totalSlots(exercise) }, (_, slotIndex) => {
  const planned = plannedSetAt(exercise, slotIndex);
  const isWarmup = planned.kind === 'warmup';
  return {
    is_warmup: isWarmup,
    weight: initialWeight(exercise),
    reps: isWarmup || planned.to_failure || planned.reps_min !== planned.reps_max ? '' : String(planned.reps_min),
    intensity_technique: slotTechnique(exercise, slotIndex),
  };
});

// Serie allenante pianificata della riga `index`: la k-esima, contando solo le righe che non sono
// riscaldamento; oltre l'ultima vale l'ultima. null in una riga di riscaldamento.
export const rowPlannedSet = (rows, index, exercise) => {
  if (rows[index].is_warmup) return null;
  const working = (exercise.planned_sets ?? []).filter((set) => set.kind === 'working');
  const k = rows.slice(0, index).filter((r) => !r.is_warmup).length;
  return working[Math.min(k, working.length - 1)] ?? null;
};

// Obiettivo della scheda per la riga `index` (vuoto in riscaldamento): il grigio nel campo
export const rowPlanReps = (rows, index, exercise) => {
  const planned = rowPlannedSet(rows, index, exercise);
  return planned ? targetLabel(planned) : '';
};

// Ripetizioni con cui la riga nasce: il target della scheda se è un numero singolo, altrimenti vuoto
const prefillReps = (rows, index, exercise) => {
  const planned = rowPlannedSet(rows, index, exercise);
  return planned && !planned.to_failure && planned.reps_min === planned.reps_max ? String(planned.reps_min) : '';
};

// Attiva o disattiva il riscaldamento della riga `index`. Le ripetizioni ancora quelle
// precompilate (uguali al vecchio obiettivo, o vuote) seguono la nuova posizione fra le allenanti;
// quelle scritte dall'utente restano. Oltre l'ultima serie pianificata la riga ripete l'ultima.
export const toggleWarmupRow = (rows, index, exercise) => {
  const toggled = rows.map((r, i) => (i === index ? { ...r, is_warmup: !r.is_warmup } : r));
  return toggled.map((row, i) => {
    const untouched = row.reps === '' || row.reps === prefillReps(rows, i, exercise);
    const next = untouched ? { ...row, reps: prefillReps(toggled, i, exercise) } : row;
    // Una riga che smette di essere riscaldamento prende la tecnica della sua serie in scheda, se non ne ha una;
    // accendendolo la tecnica resta nella riga (il salvataggio la manda vuota per i riscaldamenti)
    return i === index && !next.is_warmup && !next.intensity_technique
      ? { ...next, intensity_technique: rowPlannedSet(toggled, i, exercise)?.intensity_technique || '' }
      : next;
  });
};
