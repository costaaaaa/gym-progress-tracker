// Funzioni pure del Focus Mode per la sessione in corso: riferimento "ultima
// volta" con le tecniche, serie saltate e lista esercizi modificabile (cambio e
// aggiunta valgono solo per questa sessione, la scheda non cambia).
// Stessa logica di src/screens/Focus/focusHelpers.js nell'app mobile.

import { isWorkingSet } from './workoutMetrics';
import { MAX_WORKING, fromCompact, parseRowTarget, plannedTarget, plannedTechnique, toInt, workingOf, plannedOf } from './plannedSets';

// Funzione premium che sblocca cambio e aggiunta (vedi user_features() nel backend)
export const FEATURE_SESSION_EDIT = 'focus_session_edit';

// Peso massimo accettato dal backend (colonna decimal(5,2))
export const MAX_WEIGHT = 999.99;

// Peso valido per una serie: 0 compreso (corpo libero, macchinari senza carico)
export const isValidWeight = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 && n <= MAX_WEIGHT;
};

// Ripetizioni massime accettate dal backend (record_workout.php)
export const MAX_REPS = 250;

// Ripetizioni valide per una serie: intero da 1 a MAX_REPS, scritto dall'utente
export const isValidReps = (value) => {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s)) return false;
  const n = parseInt(s, 10);
  return n >= 1 && n <= MAX_REPS;
};

// Oltre questa soglia si chiede conferma, salvo che la scheda preveda di più
export const REPS_CONFIRM_MIN = 30;

// Conferma per ripetizioni insolite: contro i numeri scritti accanto a un altro (9 + 10 = 910).
// Il massimo della scheda è reps_max; a cedimento il minimo; senza numeri 0.
export const repsNeedConfirm = (reps, plannedSet) => {
  const n = parseInt(reps, 10);
  const planned = plannedSet?.to_failure ? plannedSet.reps_min : plannedSet?.reps_max;
  return n > REPS_CONFIRM_MIN && n > (planned ?? 0);
};

export const isBodyweight = (exercise) => exercise?.equipment === 'corpo_libero';

// Serie di riscaldamento della scheda: si sommano alle allenanti (2 risc. + 3 serie = 5 posizioni)
const warmupCount = (exercise) => plannedOf(exercise).length - workingCount(exercise);

// Serie allenanti della scheda
const workingCount = (exercise) => workingOf(plannedOf(exercise)).length;

// Serie pianificata della posizione `slotIndex`: i riscaldamenti vengono prima, come in planned_sets
export const plannedSetAt = (exercise, slotIndex) => plannedOf(exercise)[slotIndex] ?? null;

// Obiettivo in grigio nel campo ripetizioni della posizione: vuoto in riscaldamento
export const slotTarget = (exercise, slotIndex) => plannedTarget(plannedSetAt(exercise, slotIndex));

// Tecnica con cui parte la posizione: quella della sua serie in scheda, vuota in riscaldamento
export const slotTechnique = (exercise, slotIndex) => plannedTechnique(plannedSetAt(exercise, slotIndex));

// Serie di un esercizio aggiunto in sessione: `sets` serie uguali con lo stesso obiettivo, senza
// riscaldamento né tecnica. null se il numero di serie o l'obiettivo non sono validi.
export const addedPlannedSets = (sets, repsText) => {
  const count = toInt(sets, 1, MAX_WORKING);
  const target = parseRowTarget(repsText, false);
  return count === null || target === null ? null : fromCompact({ warmups: 0, sets: count, target, technique: null });
};

// Posizioni di un esercizio nella sessione: prima il riscaldamento, poi le serie allenanti.
// currentSetIndex, le serie saltate e i pallini ragionano su queste posizioni.
export const totalSlots = (exercise) => warmupCount(exercise) + workingCount(exercise);

// Che serie è la posizione `slotIndex`: riscaldamento o allenante, il suo numero (da 1) e il totale
// del suo tipo. workingIndex è l'indice fra le sole allenanti (-1 in riscaldamento): serve alle
// chip "Ultima volta" e al peso iniziale, che parlano solo delle serie allenanti.
export const setSlot = (exercise, slotIndex) => {
  const warmups = warmupCount(exercise);
  if (slotIndex < warmups) return { isWarmup: true, number: slotIndex + 1, total: warmups, workingIndex: -1 };
  return { isWarmup: false, number: slotIndex - warmups + 1, total: workingCount(exercise), workingIndex: slotIndex - warmups };
};

// Peso con cui parte il campo: l'ultimo usato; per i corpo libero, senza storico, 0
export const initialWeight = (exercise, suggested = '') =>
  suggested !== '' ? suggested : (isBodyweight(exercise) ? '0' : '');

// Peso della serie successiva: i corpo libero mantengono quello appena usato (0 o zavorra)
const nextSetWeight = (exercise, currentWeight) => (isBodyweight(exercise) ? currentWeight : '');

// Peso con cui parte la serie in posizione `slotIndex`: il riscaldamento parte vuoto (niente
// suggerimento dell'ultima volta), la prima allenante prende il peso suggerito, le altre
// seguono nextSetWeight. `current` è il peso appena usato nella serie precedente.
export const slotWeight = (exercise, slotIndex, { suggested = '', current = '' } = {}) => {
  const { isWarmup, workingIndex } = setSlot(exercise, slotIndex);
  if (workingIndex === 0) return initialWeight(exercise, suggested);
  if (isWarmup && slotIndex === 0) return initialWeight(exercise);
  return nextSetWeight(exercise, current);
};

// Serie dell'ultima sessione per le chip "Ultima volta": [{ label, technique }]
export const lastSessionSets = (lastSession) => {
  if (!lastSession || !Array.isArray(lastSession.sets)) return [];
  return lastSession.sets.filter(isWorkingSet).map((s) => {
    const w = parseFloat(s.weight) || 0;
    return {
      label: w > 0 ? `${w}kg×${s.reps}` : `${s.reps} rip`,
      technique: s.intensity_technique || '',
    };
  });
};

// Peso suggerito = il più alto tra le serie allenanti dell'ultima sessione, come stringa
// (sovraccarico progressivo); i riscaldamenti non contano. Vuoto se non c'è niente da suggerire.
export const suggestedWeight = (lastSession) => {
  if (!lastSession || !Array.isArray(lastSession.sets)) return '';
  const max = lastSession.sets.filter(isWorkingSet).reduce((m, s) => Math.max(m, parseFloat(s.weight) || 0), 0);
  return max > 0 ? String(max) : '';
};

// Stato del pallino di una serie: done | skipped | active | pending.
// skipped = indici (0-based) delle serie saltate dell'esercizio corrente.
export const setStatus = (idx, currentSetIndex, skipped = []) => {
  if (skipped.includes(idx)) return 'skipped';
  if (idx < currentSetIndex) return 'done';
  return idx === currentSetIndex ? 'active' : 'pending';
};

// "Salta riscaldamento" dalla posizione `slotIndex`: le serie di riscaldamento rimaste sono
// saltate e si riparte dalla prima serie allenante.
export const skipWarmup = (exercise, slotIndex) => {
  const first = warmupCount(exercise);
  return { skipped: Array.from({ length: first - slotIndex }, (_, i) => slotIndex + i), nextIndex: first };
};

// Chiave contro i doppi invii di record_workout.php: nasce con la sessione, resta nella bozza
// e torna uguale a ogni tentativo di salvataggio, così se la risposta si perde il secondo
// invio non duplica l'allenamento. Il backend accetta 8-64 caratteri [A-Za-z0-9_-].
// Copia identica in gym-progress-tracker-mobile/src/screens/Focus/focusHelpers.js.
export const newIdempotencyKey = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`;

// Chiave di una bozza ripresa: la sua, o una nuova per le bozze di prima della chiave
export const draftIdempotencyKey = (draft) => draft?.idempotencyKey || newIdempotencyKey();

// Regola di una serie registrata: is_warmup è sempre un booleano e il riscaldamento non ha tecnica.
// Vale per Focus (serie fatta e invio) e per l'inserimento manuale.
export const withWarmupRule = (set) => ({
  ...set,
  is_warmup: !!set.is_warmup,
  intensity_technique: set.is_warmup ? '' : set.intensity_technique,
});

// Set da inviare a record_workout.php per un esercizio: set_number consecutivi
// sulle serie fatte, così le serie saltate non lasciano buchi nel database.
export const numberedSets = (sets = []) => sets.map((set, i) => ({ ...withWarmupRule(set), set_number: i + 1 }));

// Gruppi di serie (uno per riga di scheda, [id riga, serie]) nell'ordine in cui sono stati iniziati:
// per orario della prima serie, serie del gruppo contigue. I gruppi la cui prima serie è senza orario
// (bozze vecchie, serie confermate nel salvataggio "già finito") vanno in fondo, nell'ordine di prima.
// Qui conta la prima serie perché è lì che l'esercizio è iniziato; la posizione nei Progressi
// (progressOverview.js) usa invece il minimo di tutte le serie e rinuncia se una manca.
export const groupsInExecutionOrder = (completedSets) => {
  const startOf = ([, sets]) => (Number.isFinite(sets[0]?.seconds_from_start) ? sets[0].seconds_from_start : undefined);
  const timed = Object.entries(completedSets).filter((group) => startOf(group) !== undefined);
  const untimed = Object.entries(completedSets).filter((group) => startOf(group) === undefined);
  return [...timed.sort((a, b) => startOf(a) - startOf(b)), ...untimed];
};

// Una bozza si riprende solo nel formato con le serie pianificate (#77): il segno lo scrive
// il salvataggio. Quelle di prima si scartano senza convertirle.
export const isCurrentDraft = (draft) => draft?.plannedSetsFormat === true;

let entrySeq = 0;

// Voce di sessione per un esercizio del catalogo (record di read_all.php).
// L'id è una stringa che non si confonde con gli id numerici di
// gym_workout_exercises: il salvataggio confronta già con String(e.id).
export const buildSessionEntry = (catalogEx, { planned_sets, rest }, extra = {}) => {
  entrySeq += 1;
  return {
    id: `x-${Date.now()}-${entrySeq}`,
    exercise_id: catalogEx.id,
    exercise_name: catalogEx.name,
    muscle_group: catalogEx.muscle_group,
    equipment: catalogEx.equipment || null,
    planned_sets,
    rest: Math.max(0, parseInt(rest, 10) || 0),
    notes: '',
    ...extra,
  };
};

// Cambia l'esercizio in posizione `index` con `catalogEx`: la voce viene sostituita
// (stesse serie pianificate, con tecniche e riscaldamento, e stesso recupero). Il cambio è consentito
// solo prima di iniziare l'esercizio, quindi nessuna serie fatta va persa o attribuita a quello sbagliato.
// In `replaces` resta il nome dell'esercizio di scheda, anche dopo più cambi.
export const swapExercise = (exercises, index, catalogEx) => {
  const current = exercises[index];
  const entry = buildSessionEntry(
    catalogEx,
    { planned_sets: current.planned_sets, rest: current.rest },
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
