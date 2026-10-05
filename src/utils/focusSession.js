// Funzioni pure del Focus Mode per la sessione in corso: riferimento "ultima
// volta" con le tecniche, serie saltate e lista esercizi modificabile (cambio e
// aggiunta valgono solo per questa sessione, la scheda non cambia).
// Stessa logica di src/screens/Focus/focusHelpers.js nell'app mobile.

// Funzione premium che sblocca cambio e aggiunta (vedi user_features() nel backend)
export const FEATURE_SESSION_EDIT = 'focus_session_edit';

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
    sets: Math.max(1, parseInt(sets, 10) || 1),
    reps: reps === undefined || reps === null ? '' : String(reps),
    rest: Math.max(0, parseInt(rest, 10) || 0),
    intensity_technique: '',
    notes: '',
    ...extra,
  };
};

// Cambia l'esercizio in posizione `index` con `catalogEx`. `doneCount` = serie
// già passate (fatte o saltate). Se è 0 la voce viene sostituita; altrimenti
// (es. cavi occupati a metà) la voce attuale si chiude con le serie passate e
// subito dopo arriva il sostituto con le serie rimanenti.
// Ritorna { exercises, index } con l'indice da cui riprendere.
//
// Si va solo avanti, quindi gli indici degli esercizi saltati sono tutti
// < index: inserire dopo `index` non li sposta.
export const swapExercise = (exercises, index, catalogEx, doneCount) => {
  const current = exercises[index];
  const total = parseInt(current.sets, 10) || 0;
  const entry = buildSessionEntry(
    catalogEx,
    { sets: Math.max(1, total - doneCount), reps: current.reps, rest: current.rest },
    { replaces: doneCount > 0 ? current.exercise_name : (current.replaces || current.exercise_name) }
  );
  const next = [...exercises];
  if (doneCount <= 0) {
    next[index] = entry;
    return { exercises: next, index };
  }
  next[index] = { ...current, sets: doneCount };
  next.splice(index + 1, 0, entry);
  return { exercises: next, index: index + 1 };
};

// Inserisce una voce in `position` (oltre la fine = in coda)
export const insertExercise = (exercises, position, entry) => {
  const next = [...exercises];
  next.splice(Math.min(Math.max(0, position), next.length), 0, entry);
  return next;
};
