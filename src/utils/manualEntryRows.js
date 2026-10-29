// Funzioni pure dell'inserimento manuale (RecordWorkoutDialog): righe di un esercizio con il
// riscaldamento attivabile riga per riga. Nessun React né window, solo import relativi.

import { initialWeight, isValidReps, planRepsForSet, setSlot, totalSlots } from './focusSession';

// Righe iniziali dell'inserimento manuale di un esercizio: prima il riscaldamento (vuoto, senza
// tecnica), poi le allenanti con ripetizioni e tecnica della scheda. Ripetizioni precompilate solo
// se la scheda ha un numero per quella serie; "8-10" o "Max" restano in grigio e vanno scritte.
export const initialSetRows = (exercise) => Array.from({ length: totalSlots(exercise) }, (_, slotIndex) => {
  const { isWarmup, workingIndex } = setSlot(exercise, slotIndex);
  if (isWarmup) return { is_warmup: true, weight: initialWeight(exercise), reps: '', intensity_technique: '' };
  const planReps = planRepsForSet(exercise.reps, workingIndex);
  return {
    is_warmup: false,
    weight: initialWeight(exercise),
    reps: isValidReps(planReps) ? planReps : '',
    intensity_technique: exercise.intensity_technique || '',
  };
});

// Indice fra le sole righe allenanti della riga `index` (-1 se è un riscaldamento): quante
// righe non-riscaldamento la precedono. Serve a obiettivo e ripetizioni precompilate.
const rowWorkingIndex = (rows, index) =>
  rows[index].is_warmup ? -1 : rows.slice(0, index).filter((r) => !r.is_warmup).length;

// Ripetizioni suggerite dalla scheda per la riga `index` (vuoto in riscaldamento): il grigio nel campo
export const rowPlanReps = (rows, index, planReps) =>
  rows[index].is_warmup ? '' : planRepsForSet(planReps, rowWorkingIndex(rows, index));

// Ripetizioni con cui la riga nasce: l'obiettivo della scheda se è un numero, altrimenti vuoto
const prefillReps = (rows, index, planReps) => {
  const target = rowPlanReps(rows, index, planReps);
  return isValidReps(target) ? target : '';
};

// Attiva o disattiva il riscaldamento della riga `index`. Le ripetizioni ancora quelle
// precompilate (uguali al vecchio obiettivo, o vuote) seguono la nuova posizione fra le allenanti;
// quelle scritte dall'utente restano. Oltre la lista "8/6/4" l'ultima riga ripete l'ultimo valore.
export const toggleWarmupRow = (rows, index, exercise) => {
  const toggled = rows.map((r, i) => (i === index ? { ...r, is_warmup: !r.is_warmup } : r));
  return toggled.map((row, i) => {
    const untouched = row.reps === '' || row.reps === prefillReps(rows, i, exercise.reps);
    const next = untouched ? { ...row, reps: prefillReps(toggled, i, exercise.reps) } : row;
    // Una riga che smette di essere riscaldamento prende la tecnica della scheda, se non ne ha una;
    // accendendolo la tecnica resta nella riga (il salvataggio la manda vuota per i riscaldamenti)
    return i === index && !next.is_warmup && !next.intensity_technique
      ? { ...next, intensity_technique: exercise.intensity_technique || '' }
      : next;
  });
};
