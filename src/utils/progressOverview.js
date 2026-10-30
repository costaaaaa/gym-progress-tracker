// ============================================================================
// Logica pura della panoramica "Progressi Workout": serie storica per esercizio,
// stato (in crescita / fermo / in calo / nuovo / inattivo) e raggruppamento per muscolo.
// Metrica principale: 1RM stimato (Epley); per gli esercizi a corpo libero
// (sempre peso 0) si usa il massimo di ripetizioni in una serie.
// ============================================================================
import { extractReps, estimateOneRepMax, isWorkingSet } from './workoutMetrics';
import { clockDate } from './calendarDay';
import { workoutInstant } from './workoutTime';

export const RECENT_DAYS = 60;
export const IMPROVING_PCT = 2;
export const DECLINING_PCT = 5;
export const MAX_PR_CHIPS = 4;
const DAY_MS = 86400000;

export const STATUS = { IMPROVING: 'improving', STALLED: 'stalled', DECLINING: 'declining', NEW: 'new', INACTIVE: 'inactive' };

// I giorni fra istanti si contano da started_at: `date` è l'orologio del luogo, in fusi diversi non è confrontabile con adesso
export const daysSince = (workout, now = Date.now()) =>
  Math.max(0, Math.floor((now - workoutInstant(workout)) / DAY_MS));

// Posizione di ogni esercizio dell'allenamento (stesso ordine di workout.exercises): 1 + gli esercizi
// iniziati prima, dove l'inizio è l'orario più basso fra tutte le sue serie (riscaldamento compreso).
// Se una qualsiasi serie dell'allenamento non ha l'orario la seduta è senza posizione: tutti null.
const exercisePositions = (workout) => {
  const groups = workout.exercises || [];
  const hasTime = (set) => Number.isFinite(set.seconds_from_start);
  if (groups.some((ex) => (ex.sets || []).some((set) => !hasTime(set)))) return groups.map(() => null);
  const starts = groups.map((ex) => ((ex.sets || []).length ? Math.min(...ex.sets.map((set) => set.seconds_from_start)) : null));
  return starts.map((start) => (start === null ? null : 1 + starts.filter((other) => other !== null && other < start).length));
};

/**
 * Da record di api/workout_history/read.php a mappa exercise_id -> serie.
 * Ogni sessione: { id, date, value, bestSet:{weight,reps}, volume, totalReps, isPR, position }.
 * position: 1° esercizio della seduta, 2°, ...; null se la seduta non ha l'orario di tutte le serie.
 * Le sessioni sono in ordine cronologico crescente.
 * La metrica (mode) è quella dell'ultima sessione: con peso -> 1RM stimato, a corpo libero -> ripetizioni.
 * Le sessioni dell'altro tipo restano fuori dalla serie e sono contate in `skipped`.
 */
export const buildExerciseSeries = (records) => {
  const raw = {};
  (Array.isArray(records) ? records : []).forEach((workout) => {
    const positions = exercisePositions(workout);
    (workout.exercises || []).forEach((ex, exIndex) => {
      if (ex.exercise_id === undefined || ex.exercise_id === null) return;
      let bestOneRM = 0, bestReps = 0, volume = 0, totalReps = 0;
      let bestSet = null, bestRepSet = null;
      (ex.sets || []).forEach((set) => {
        if (!isWorkingSet(set)) return;
        const weight = parseFloat(set.weight) || 0;
        const reps = extractReps(set.reps);
        if (reps <= 0) return;
        volume += weight * reps;
        totalReps += reps;
        const oneRM = estimateOneRepMax(weight, reps);
        if (oneRM > bestOneRM) { bestOneRM = oneRM; bestSet = { weight, reps }; }
        if (weight === 0 && reps > bestReps) { bestReps = reps; bestRepSet = { weight: 0, reps }; }
      });
      if (totalReps === 0) return;
      const key = String(ex.exercise_id);
      if (!raw[key]) raw[key] = { name: ex.name, sessions: [] };
      raw[key].sessions.push({
        id: workout.id || `workout-${workout.date}`,
        date: workout.date,
        started_at: workout.started_at,
        time_zone: workout.time_zone,
        oneRM: bestOneRM,
        reps: bestReps,
        bestSet: bestSet || bestRepSet,
        volume: parseFloat(volume.toFixed(1)),
        totalReps,
        position: positions[exIndex],
      });
    });
  });

  const series = {};
  Object.entries(raw).forEach(([id, { name, sessions }]) => {
    const byDate = [...sessions].sort((a, b) => clockDate(a.date) - clockDate(b.date));
    const mode = byDate[byDate.length - 1].oneRM > 0 ? 'oneRM' : 'reps';
    const sorted = byDate
      .map((s) => ({ ...s, value: mode === 'oneRM' ? s.oneRM : s.reps }))
      .filter((s) => s.value > 0);
    if (sorted.length === 0) return;
    let max = 0;
    sorted.forEach((s, i) => {
      s.isPR = i > 0 && s.value > max;
      if (s.value > max) max = s.value;
    });
    series[id] = { id, name, mode, sessions: sorted, skipped: byDate.length - sorted.length };
  });
  return series;
};

/**
 * Stato di un esercizio:
 * - inactive: ultima sessione oltre RECENT_DAYS fa
 * - new: una sola sessione nel periodo recente (nessun confronto possibile)
 * - improving / declining: il meglio della seconda metà delle sessioni recenti è salito di almeno
 *   IMPROVING_PCT% o sceso di almeno DECLINING_PCT% rispetto al meglio della prima metà
 *   (si confrontano i migliori, non la prima e l'ultima sessione, per non dipendere da una giornata storta)
 * - stalled: tutto il resto (nessun progresso: un breve stallo non cambia lo stato)
 * laterInSession: true solo in calo, se la sessione migliore recente e quella di riferimento hanno la
 * posizione e la recente è più avanti nella seduta. Non cambia stato né variazione.
 */
export const analyzeExercise = (serie, now = Date.now()) => {
  const { sessions } = serie;
  const last = sessions[sessions.length - 1];
  const lastDays = daysSince(last, now);
  const recent = sessions.filter((s) => daysSince(s, now) <= RECENT_DAYS);
  const best = Math.max(...sessions.map((s) => s.value));

  // Sessione migliore di un gruppo: a parità vince la prima
  const bestOf = (group) => group.reduce((top, s) => (s.value > top.value ? s : top));
  let deltaPct = null;
  let baselineSession = null;
  let currentSession = null;
  if (recent.length >= 2) {
    const half = Math.floor(recent.length / 2);
    baselineSession = bestOf(recent.slice(0, half));
    currentSession = bestOf(recent.slice(half));
    if (baselineSession.value > 0) deltaPct = ((currentSession.value - baselineSession.value) / baselineSession.value) * 100;
  }

  let status;
  if (lastDays > RECENT_DAYS) status = STATUS.INACTIVE;
  else if (recent.length < 2) status = STATUS.NEW;
  else if (deltaPct !== null && deltaPct >= IMPROVING_PCT) status = STATUS.IMPROVING;
  else if (deltaPct !== null && deltaPct <= -DECLINING_PCT) status = STATUS.DECLINING;
  else status = STATUS.STALLED;
  // Calo che coincide con l'esercizio fatto più avanti nella seduta: serve entrambe le posizioni
  const laterInSession = status === STATUS.DECLINING
    && Number.isInteger(baselineSession?.position) && Number.isInteger(currentSession?.position)
    && currentSession.position > baselineSession.position;
  return { ...serie, last, lastDays, deltaPct, status, best, recentPR: last.isPR && lastDays <= RECENT_DAYS, laterInSession };
};

/** Come leggere ogni stato: i client traducono il tono nei propri colori. */
export const STATUS_TONE = {
  [STATUS.IMPROVING]: 'positive',
  [STATUS.DECLINING]: 'negative',
  [STATUS.STALLED]: 'neutral',
  [STATUS.NEW]: 'neutral',
  [STATUS.INACTIVE]: 'muted',
};

/** La variazione (▲/▼ %) si mostra solo per gli stati che nascono da un confronto. */
export const showsDelta = (a) => (a.status === STATUS.IMPROVING || a.status === STATUS.DECLINING) && a.deltaPct !== null;

/** Nome e muscolo dal catalogo esercizi (catalog: id -> record di api/exercise/read_all.php). */
export const withCatalog = (analyzed, catalog) =>
  analyzed.map((a) => ({
    ...a,
    name: catalog[a.id]?.name || a.name,
    muscle: catalog[a.id]?.muscle_group?.toLowerCase() || null,
  }));

export const byRecency = (a, b) => a.lastDays - b.lastDays;

/** Raggruppa per muscolo; sezioni e card ordinate per attività più recente. */
export const groupByMuscle = (analyzed) => {
  const groups = {};
  analyzed.forEach((a) => {
    const muscle = a.muscle || 'other';
    (groups[muscle] = groups[muscle] || []).push(a);
  });
  return Object.entries(groups)
    .map(([muscle, items]) => {
      const sorted = [...items].sort((a, b) => {
        const ai = a.status === STATUS.INACTIVE ? 1 : 0;
        const bi = b.status === STATUS.INACTIVE ? 1 : 0;
        return ai - bi || byRecency(a, b);
      });
      return {
        muscle,
        items: sorted,
        lastDays: Math.min(...items.map((i) => i.lastDays)),
        improving: items.filter((i) => i.status === STATUS.IMPROVING).length,
      };
    })
    .sort(byRecency);
};

export const summarize = (analyzed) => ({
  improving: analyzed.filter((a) => a.status === STATUS.IMPROVING).length,
  stalled: analyzed.filter((a) => a.status === STATUS.STALLED).length,
  declining: analyzed.filter((a) => a.status === STATUS.DECLINING).length,
  prs: analyzed.filter((a) => a.recentPR),
});
