import { buildShareStats, sessionRecords, toDate } from '../../utils/shareCard';
import { summarizeSets } from '../../utils/workoutMetrics';

// Aggiunge gli esercizi di un allenamento ai migliori di sempre per esercizio: gli stessi numeri e lo stesso confronto
// di buildExerciseHistoryIndex, ma un allenamento alla volta invece di rifare l'indice da capo per ogni allenamento
const addToBests = (bests, exercises) => {
  (exercises || []).forEach((exercise) => {
    const key = exercise.exercise_id;
    if (key === undefined || key === null) return;
    if (!bests[key]) bests[key] = { bestWeight: 0, bestOneRM: 0, bestSessionVolume: 0, bestBodyweightReps: 0 };
    const entry = bests[key];
    const { bestWeight, bestOneRM, sessionVolume, bestBodyweightReps } = summarizeSets(exercise.sets);
    if (bestWeight > entry.bestWeight) entry.bestWeight = bestWeight;
    if (bestOneRM > entry.bestOneRM) entry.bestOneRM = bestOneRM;
    if (sessionVolume > entry.bestSessionVolume) entry.bestSessionVolume = sessionVolume;
    if (bestBodyweightReps > entry.bestBodyweightReps) entry.bestBodyweightReps = bestBodyweightReps;
  });
};

// Per ogni allenamento (chiave = id): volume in kg, serie allenanti e record veri (non quelli di solo volume). I numeri
// sono quelli della card da condividere (historyRecords: contano gli allenamenti precedenti, a parità di istante quelli
// con l'id più piccolo), calcolati con un solo passaggio dal più vecchio al più recente: con 500 allenamenti rifare
// l'indice per ognuno costava circa un secondo. Si calcola una volta per lettura dell'elenco, non a ogni disegno.
export default function workoutSummaries(workouts) {
  const summaries = {};
  const summarize = (workout, bests) => {
    const records = sessionRecords(workout.exercises, bests);
    const { volumeKg, sets } = buildShareStats({ exercises: workout.exercises, date: workout.date, records });
    summaries[workout.id] = { volumeKg, sets, records: records.filter((record) => record.type !== 'volume') };
  };

  const timed = workouts.map((workout) => ({ workout, time: toDate(workout.date).getTime() }));
  // Una data illeggibile non è né prima né dopo nessuna: l'allenamento non ha storico e non ne fa per gli altri
  timed.filter(({ time }) => isNaN(time)).forEach(({ workout }) => summarize(workout, {}));
  const bests = {};
  timed
    .filter(({ time }) => !isNaN(time))
    .sort((a, b) => a.time - b.time || Number(a.workout.id) - Number(b.workout.id))
    .forEach(({ workout }) => {
      summarize(workout, bests);
      addToBests(bests, workout.exercises);
    });
  return summaries;
}
