// ============================================================================
// Logica pura della panoramica "Progressi Workout": serie storica per esercizio,
// stato (in crescita / fermo / in calo / nuovo / inattivo) e raggruppamento per muscolo.
// Metrica principale: 1RM stimato (Epley); per gli esercizi a corpo libero
// (sempre peso 0) si usa il massimo di ripetizioni in una serie.
// ============================================================================
import { extractReps, estimateOneRepMax } from './workoutMetrics';

export const RECENT_DAYS = 60;
export const IMPROVING_PCT = 2;
export const DECLINING_PCT = 5;
export const MAX_PR_CHIPS = 4;
const DAY_MS = 86400000;

export const daysSince = (date, now = Date.now()) =>
  Math.max(0, Math.floor((now - new Date(date).getTime()) / DAY_MS));

/**
 * Da record di api/workout_history/read.php a mappa exercise_id -> serie.
 * Ogni sessione: { id, date, value, bestSet:{weight,reps}, volume, totalReps, isPR }.
 * Le sessioni sono in ordine cronologico crescente.
 */
export const buildExerciseSeries = (records) => {
  const raw = {};
  (Array.isArray(records) ? records : []).forEach((workout) => {
    (workout.exercises || []).forEach((ex) => {
      if (ex.exercise_id === undefined || ex.exercise_id === null) return;
      let bestOneRM = 0, bestReps = 0, volume = 0, totalReps = 0;
      let bestSet = null, bestRepSet = null;
      (ex.sets || []).forEach((set) => {
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
        oneRM: bestOneRM,
        reps: bestReps,
        bestSet: bestSet || bestRepSet,
        volume: parseFloat(volume.toFixed(1)),
        totalReps,
      });
    });
  });

  const series = {};
  Object.entries(raw).forEach(([id, { name, sessions }]) => {
    const mode = sessions.some((s) => s.oneRM > 0) ? 'oneRM' : 'reps';
    const sorted = sessions
      .map((s) => ({ ...s, value: mode === 'oneRM' ? s.oneRM : s.reps }))
      .filter((s) => s.value > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    if (sorted.length === 0) return;
    let max = 0;
    sorted.forEach((s, i) => {
      s.isPR = i > 0 && s.value > max;
      if (s.value > max) max = s.value;
    });
    series[id] = { id, name, mode, sessions: sorted };
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
 */
export const analyzeExercise = (serie, now = Date.now()) => {
  const { sessions } = serie;
  const last = sessions[sessions.length - 1];
  const lastDays = daysSince(last.date, now);
  const recent = sessions.filter((s) => daysSince(s.date, now) <= RECENT_DAYS);
  const best = Math.max(...sessions.map((s) => s.value));

  let deltaPct = null;
  if (recent.length >= 2) {
    const half = Math.floor(recent.length / 2);
    const baseline = Math.max(...recent.slice(0, half).map((s) => s.value));
    const current = Math.max(...recent.slice(half).map((s) => s.value));
    if (baseline > 0) deltaPct = ((current - baseline) / baseline) * 100;
  }

  let status;
  if (lastDays > RECENT_DAYS) status = 'inactive';
  else if (recent.length < 2) status = 'new';
  else if (deltaPct !== null && deltaPct >= IMPROVING_PCT) status = 'improving';
  else if (deltaPct !== null && deltaPct <= -DECLINING_PCT) status = 'declining';
  else status = 'stalled';
  return { ...serie, last, lastDays, deltaPct, status, best, recentPR: last.isPR && lastDays <= RECENT_DAYS };
};

/** Come leggere ogni stato: i client traducono il tono nei propri colori. */
export const STATUS_TONE = { improving: 'positive', declining: 'negative', stalled: 'neutral', new: 'neutral', inactive: 'muted' };

/** La variazione (▲/▼ %) si mostra solo per gli stati che nascono da un confronto. */
export const showsDelta = (a) => (a.status === 'improving' || a.status === 'declining') && a.deltaPct !== null;

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
        const ai = a.status === 'inactive' ? 1 : 0;
        const bi = b.status === 'inactive' ? 1 : 0;
        return ai - bi || byRecency(a, b);
      });
      return {
        muscle,
        items: sorted,
        lastDays: Math.min(...items.map((i) => i.lastDays)),
        improving: items.filter((i) => i.status === 'improving').length,
      };
    })
    .sort(byRecency);
};

export const summarize = (analyzed) => ({
  improving: analyzed.filter((a) => a.status === 'improving').length,
  stalled: analyzed.filter((a) => a.status === 'stalled').length,
  declining: analyzed.filter((a) => a.status === 'declining').length,
  prs: analyzed.filter((a) => a.recentPR),
});
