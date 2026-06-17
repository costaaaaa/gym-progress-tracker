// ============================================================================
// Utility condivise per il calcolo delle metriche di allenamento.
// Funzioni pure (nessuna dipendenza da React) riusate da Progress.jsx e
// FocusWorkout.jsx per: parsing ripetizioni, 1RM stimato, record personali e
// indice dello storico per esercizio.
// ============================================================================

/**
 * Estrae il numero di ripetizioni da una stringa.
 * Gestisce formati come "10", "10-12" (prende il massimo), "10+2",
 * "1 rest pause a 20", "max". Ritorna 0 se non trova numeri.
 */
export const extractReps = (repsString) => {
  if (repsString === null || repsString === undefined) return 0;

  // Se è già un numero (o stringa numerica), lo ritorniamo
  if (!isNaN(repsString)) {
    return parseInt(repsString) || 0;
  }

  const str = repsString.toString();

  // Casi comuni: "8-10" prende il valore massimo (10)
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 2) {
      const max = parseInt(parts[1].trim());
      if (!isNaN(max)) return max;
    }
  }

  // Estrai i numeri presenti nella stringa e prendi il più grande come stima
  const matches = str.match(/\d+/g);
  if (matches && matches.length > 0) {
    return Math.max(...matches.map((m) => parseInt(m)));
  }

  return 0;
};

/**
 * Stima del massimale (1RM) con la formula di Epley: weight * (1 + reps/30).
 * Ritorna 0 se peso o ripetizioni non sono validi.
 */
export const estimateOneRepMax = (weight, reps) => {
  const w = parseFloat(weight) || 0;
  const r = typeof reps === 'number' ? reps : extractReps(reps);
  if (w <= 0 || r <= 0) return 0;
  return parseFloat((w * (1 + r / 30)).toFixed(1));
};

/**
 * Dato un array di set ({ weight, reps }), ritorna il 1RM stimato più alto.
 */
export const getBestSetOneRM = (sets) => {
  if (!Array.isArray(sets) || sets.length === 0) return 0;
  return sets.reduce((best, set) => {
    const oneRM = estimateOneRepMax(set.weight, set.reps);
    return oneRM > best ? oneRM : best;
  }, 0);
};

/**
 * Calcola le statistiche aggregate di un gruppo di set svolti in una sessione.
 * Ritorna { bestWeight, bestOneRM, sessionVolume }.
 */
export const summarizeSets = (sets) => {
  let bestWeight = 0;
  let bestOneRM = 0;
  let sessionVolume = 0;

  if (Array.isArray(sets)) {
    sets.forEach((set) => {
      const weight = parseFloat(set.weight) || 0;
      const reps = extractReps(set.reps);
      if (weight <= 0 || reps <= 0) return;
      if (weight > bestWeight) bestWeight = weight;
      const oneRM = estimateOneRepMax(weight, reps);
      if (oneRM > bestOneRM) bestOneRM = oneRM;
      sessionVolume += weight * reps;
    });
  }

  return { bestWeight, bestOneRM, sessionVolume };
};

/**
 * Costruisce un indice exercise_id -> statistiche storiche, a partire dai
 * record restituiti da api/workout_history/read.php.
 *
 * I record sono ordinati per data DESC (vedi WorkoutHistory::readAllByUser),
 * quindi il primo che incontriamo per ciascun esercizio è la sessione più
 * recente. Ogni record ha la forma:
 *   { id, date, notes, exercises: [{ exercise_id, name, sets: [...] }] }
 *
 * Ritorna una mappa con, per ogni exercise_id:
 *   { lastSession: { date, sets }, lastDate,
 *     bestWeight, bestOneRM, bestSessionVolume }
 * dove i "best" rappresentano i record personali considerando TUTTO lo storico.
 */
export const buildExerciseHistoryIndex = (records) => {
  const index = {};
  if (!Array.isArray(records)) return index;

  records.forEach((workout) => {
    const exercises = workout.exercises || [];
    exercises.forEach((ex) => {
      const key = ex.exercise_id;
      if (key === undefined || key === null) return;

      if (!index[key]) {
        index[key] = {
          lastSession: null,
          lastDate: null,
          bestWeight: 0,
          bestOneRM: 0,
          bestSessionVolume: 0,
        };
      }

      const entry = index[key];
      const { bestWeight, bestOneRM, sessionVolume } = summarizeSets(ex.sets);

      // La prima occorrenza (record più recente) definisce l'ultima sessione
      if (!entry.lastSession) {
        entry.lastSession = { date: workout.date, sets: ex.sets || [] };
        entry.lastDate = workout.date;
      }

      // I record personali considerano tutto lo storico
      if (bestWeight > entry.bestWeight) entry.bestWeight = bestWeight;
      if (bestOneRM > entry.bestOneRM) entry.bestOneRM = bestOneRM;
      if (sessionVolume > entry.bestSessionVolume) entry.bestSessionVolume = sessionVolume;
    });
  });

  return index;
};

/**
 * Confronta i set appena completati per un esercizio con lo storico (PRIMA di
 * questa sessione) e ritorna quali record sono stati battuti.
 * Ritorna { isPR, weight, oneRM, volume } con i valori battuti, oppure isPR=false.
 */
export const detectPersonalRecords = (completedSets, historyEntry) => {
  // Senza storico precedente non parliamo di "record" (è una baseline, non
  // qualcosa di battuto): evita di marcare tutto come PR alla prima sessione.
  if (!historyEntry) {
    return { isPR: false, weight: null, oneRM: null, volume: null };
  }

  const { bestWeight, bestOneRM, sessionVolume } = summarizeSets(completedSets);
  const prev = historyEntry;

  const result = {
    weight: bestWeight > prev.bestWeight ? bestWeight : null,
    oneRM: bestOneRM > prev.bestOneRM ? bestOneRM : null,
    volume: sessionVolume > prev.bestSessionVolume ? parseFloat(sessionVolume.toFixed(1)) : null,
  };
  result.isPR = !!(result.weight || result.oneRM || result.volume);
  return result;
};
