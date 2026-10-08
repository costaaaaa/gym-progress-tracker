// Funzioni pure del Focus Mode per la sessione in corso: riferimento "ultima
// volta" con le tecniche, serie saltate e lista esercizi modificabile (cambio e
// aggiunta valgono solo per questa sessione, la scheda non cambia).
// Stessa logica di src/screens/Focus/focusHelpers.js nell'app mobile.

// Funzione premium che sblocca cambio e aggiunta (vedi user_features() nel backend)
export const FEATURE_SESSION_EDIT = 'focus_session_edit';

// Peso massimo accettato dal backend (colonna decimal(5,2))
export const MAX_WEIGHT = 999.99;

// Peso valido per una serie: 0 compreso (corpo libero, macchinari senza carico)
export const isValidWeight = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 && n <= MAX_WEIGHT;
};

export const isBodyweight = (exercise) => exercise?.equipment === 'corpo_libero';

// Peso con cui parte il campo: l'ultimo usato; per i corpo libero, senza storico, 0
export const initialWeight = (exercise, suggested = '') =>
  suggested !== '' ? suggested : (isBodyweight(exercise) ? '0' : '');

// Peso della serie successiva: i corpo libero mantengono quello appena usato (0 o zavorra)
export const nextSetWeight = (exercise, currentWeight) => (isBodyweight(exercise) ? currentWeight : '');

// Serie dell'ultima sessione per le chip "Ultima volta": [{ label, technique }]
export const lastSessionSets = (lastSession) => {
  if (!lastSession || !Array.isArray(lastSession.sets)) return [];
  return lastSession.sets.map((s) => {
    const w = parseFloat(s.weight) || 0;
    return {
      label: w > 0 ? `${w}kg×${s.reps}` : `${s.reps} rip`,
      technique: s.intensity_technique || '',
    };
  });
};

// Stato del pallino di una serie: done | skipped | active | pending.
// skipped = indici (0-based) delle serie saltate dell'esercizio corrente.
export const setStatus = (idx, currentSetIndex, skipped = []) => {
  if (skipped.includes(idx)) return 'skipped';
  if (idx < currentSetIndex) return 'done';
  return idx === currentSetIndex ? 'active' : 'pending';
};

// Set da inviare a record_workout.php per un esercizio: set_number consecutivi
// sulle serie fatte, così le serie saltate non lasciano buchi nel database.
export const numberedSets = (sets = []) => sets.map((set, i) => ({ ...set, set_number: i + 1 }));

let entrySeq = 0;

// Voce di sessione per un esercizio del catalogo (record di read_all.php).
// L'id è una stringa che non si confonde con gli id numerici di
// gym_workout_exercises: il salvataggio confronta già con String(e.id).
export const buildSessionEntry = (catalogEx, { sets, reps, rest }, extra = {}) => {
  entrySeq += 1;
  return {
    id: `x-${Date.now()}-${entrySeq}`,
    exercise_id: catalogEx.id,
    exercise_name: catalogEx.name,
    muscle_group: catalogEx.muscle_group,
    equipment: catalogEx.equipment || null,
    sets: Math.max(1, parseInt(sets, 10) || 1),
    reps: reps === undefined || reps === null ? '' : String(reps),
    rest: Math.max(0, parseInt(rest, 10) || 0),
    intensity_technique: '',
    notes: '',
    ...extra,
  };
};

// Cambia l'esercizio in posizione `index` con `catalogEx`: la voce viene sostituita
// (stessi serie/reps/recupero). Il cambio è consentito solo prima di iniziare
// l'esercizio, quindi nessuna serie fatta va persa o attribuita all'esercizio sbagliato.
// In `replaces` resta il nome dell'esercizio di scheda, anche dopo più cambi.
export const swapExercise = (exercises, index, catalogEx) => {
  const current = exercises[index];
  const entry = buildSessionEntry(
    catalogEx,
    { sets: current.sets, reps: current.reps, rest: current.rest },
    { replaces: current.replaces || current.exercise_name }
  );
  const next = [...exercises];
  next[index] = entry;
  return next;
};

// Inserisce una voce in `position` (oltre la fine = in coda). Si va solo avanti, quindi
// gli indici di skippedExercises sono < esercizio corrente: inserire dopo non li sposta.
export const insertExercise = (exercises, position, entry) => {
  const next = [...exercises];
  next.splice(Math.min(Math.max(0, position), next.length), 0, entry);
  return next;
};
