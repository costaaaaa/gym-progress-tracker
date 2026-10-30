import { describe, it, expect } from 'vitest';
import { daysSince, buildExerciseSeries, analyzeExercise } from './progressOverview';

const rec = (id, date, extra = {}) => ({
  id, date, ...extra, exercises: [{ exercise_id: 1, name: 'Panca', sets: [{ weight: 80, reps: 5 }] }],
});

describe('daysSince: i giorni fra istanti, non fra orologi di fusi diversi', () => {
  it('conta dall\'istante vero di started_at, qualunque sia il fuso del browser', () => {
    // 02:00 a New York = 06:00 UTC; dopo 3 giorni esatti sono passati 3 giorni
    const workout = { date: '2026-10-18 02:00:00', started_at: '2026-10-18T02:00:00-04:00' };
    expect(daysSince(workout, Date.UTC(2026, 9, 21, 6, 0, 0))).toBe(3);
    expect(daysSince(workout, Date.UTC(2026, 9, 21, 5, 59, 0))).toBe(2);
  });
});

describe('buildExerciseSeries: il riscaldamento non è allenante (#66)', () => {
  it('esclude le serie is_warmup da volume, ripetizioni e 1RM della sessione', () => {
    const series = buildExerciseSeries([{
      id: 1,
      date: '2026-10-18 02:00:00',
      exercises: [{
        exercise_id: 1,
        name: 'Panca',
        sets: [
          { weight: 20, reps: 10, is_warmup: true },
          { weight: 80, reps: 5 },
        ],
      }],
    }]);
    expect(series['1'].sessions[0]).toMatchObject({ totalReps: 5, volume: 400 });
  });

  it('una sessione con solo riscaldamento non entra nella serie', () => {
    const series = buildExerciseSeries([{
      id: 1,
      date: '2026-10-18 02:00:00',
      exercises: [{ exercise_id: 1, name: 'Panca', sets: [{ weight: 20, reps: 10, is_warmup: true }] }],
    }]);
    expect(series['1']).toBeUndefined();
  });
});

describe('buildExerciseSeries: le sessioni portano fuso e istante', () => {
  it('ogni sessione ha time_zone e started_at dell\'allenamento, per il badge e per i conti', () => {
    const series = buildExerciseSeries([
      rec(1, '2026-10-18 02:00:00', { time_zone: 'America/New_York', started_at: '2026-10-18T02:00:00-04:00' }),
    ]);
    expect(series['1'].sessions[0]).toMatchObject({ time_zone: 'America/New_York', started_at: '2026-10-18T02:00:00-04:00' });
  });
  it('l\'ordine segue l\'orologio scritto (date), a prescindere dal fuso del browser', () => {
    const series = buildExerciseSeries([
      rec(2, '2026-10-18 23:30:00'),
      rec(1, '2026-10-18 00:30:00'),
      rec(3, '2026-03-29 02:30:00'),
    ]);
    expect(series['1'].sessions.map((s) => s.id)).toEqual([3, 1, 2]);
  });
});

// Un allenamento con un esercizio per voce di `groups`: ogni voce è [exercise_id, [secondi delle serie]]
// (undefined = serie senza orario)
const timedWorkout = (id, date, groups) => ({
  id,
  date,
  started_at: `${date.slice(0, 10)}T10:00:00Z`,
  exercises: groups.map(([exerciseId, seconds]) => ({
    exercise_id: exerciseId,
    name: `Esercizio ${exerciseId}`,
    sets: seconds.map((sec) => ({ weight: 80, reps: 5, ...(sec === undefined ? {} : { seconds_from_start: sec }) })),
  })),
});
const positions = (series, exerciseId) => series[String(exerciseId)].sessions.map((s) => s.position);

describe('buildExerciseSeries: posizione dell\'esercizio nella seduta (#26)', () => {
  it('è 1 + gli esercizi iniziati prima, a prescindere dall\'ordine in cui il server li elenca', () => {
    const series = buildExerciseSeries([
      timedWorkout(1, '2026-10-18 10:00:00', [[7, [900, 1100]], [5, [10, 200]], [6, [400]]]),
    ]);
    expect([positions(series, 5), positions(series, 6), positions(series, 7)]).toEqual([[1], [2], [3]]);
  });

  it('conta dalla prima serie, riscaldamento compreso', () => {
    const workout = timedWorkout(1, '2026-10-18 10:00:00', [[1, [300]], [2, [100, 500]]]);
    workout.exercises[1].sets[0].is_warmup = true;
    const series = buildExerciseSeries([workout]);
    expect([positions(series, 2), positions(series, 1)]).toEqual([[1], [2]]);
  });

  it('se anche una sola serie dell\'allenamento non ha l\'orario, nessun esercizio ha la posizione', () => {
    const series = buildExerciseSeries([
      timedWorkout(1, '2026-10-18 10:00:00', [[1, [10]], [2, [200, undefined]]]),
      timedWorkout(2, '2026-10-20 10:00:00', [[1, [10]], [2, [200]]]),
    ]);
    expect(positions(series, 1)).toEqual([null, 1]);
    expect(positions(series, 2)).toEqual([null, 2]);
  });

  it('i dati del server vecchio (senza il campo) o con null non hanno posizione', () => {
    const series = buildExerciseSeries([
      rec(1, '2026-10-18 10:00:00'),
      { ...rec(2, '2026-10-20 10:00:00'), exercises: [{ exercise_id: 1, name: 'Panca', sets: [{ weight: 80, reps: 5, seconds_from_start: null }] }] },
    ]);
    expect(positions(series, 1)).toEqual([null, null]);
  });
});

describe('analyzeExercise: laterInSession', () => {
  const NOW = Date.UTC(2026, 9, 30, 12, 0, 0);
  // Quattro sessioni dell'esercizio 1 (peso crescente = 1RM), ciascuna con la sua posizione:
  // [peso, orario dell'esercizio 1, orario di un altro esercizio]. Il peso decide stato e delta.
  const analyze = (sessions) => analyzeExercise(buildExerciseSeries(sessions.map(([weight, sec, other], i) => ({
    id: i + 1,
    date: `2026-10-${10 + i * 5} 10:00:00`,
    started_at: `2026-10-${10 + i * 5}T10:00:00Z`,
    exercises: [
      { exercise_id: 1, name: 'Panca', sets: [{ weight, reps: 5, seconds_from_start: sec }] },
      { exercise_id: 2, name: 'Altro', sets: [{ weight: 50, reps: 5, seconds_from_start: other }] },
    ],
  })))['1'], NOW);

  it('in calo e l\'esercizio migliore recente è fatto più tardi di quello di riferimento: true', () => {
    // prima metà: 100 kg da 1° (altro a 500); seconda metà: 90 kg da 2° (altro a 10)
    const a = analyze([[100, 10, 500], [95, 20, 500], [90, 600, 10], [85, 700, 10]]);
    expect(a.status).toBe('declining');
    expect(a.laterInSession).toBe(true);
  });

  it('in calo ma alla stessa posizione o prima: false, e stato e delta non cambiano', () => {
    const same = analyze([[100, 10, 500], [95, 20, 500], [90, 10, 500], [85, 20, 500]]);
    expect(same.laterInSession).toBe(false);
    expect(same.status).toBe('declining');
    expect(Math.round(same.deltaPct)).toBe(-10);
    expect(analyze([[100, 600, 10], [95, 600, 10], [90, 10, 500], [85, 10, 500]]).laterInSession).toBe(false);
  });

  it('senza posizione su una delle due sessioni: false', () => {
    expect(analyze([[100, 10, 500], [95, 20, 500], [90, 600, undefined], [85, 700, undefined]]).laterInSession).toBe(false);
  });

  it('se non è in calo (qui in crescita o fermo) non c\'è la nota, anche se fatto più tardi', () => {
    const improving = analyze([[80, 10, 500], [82, 20, 500], [100, 600, 10], [101, 700, 10]]);
    expect(improving.status).toBe('improving');
    expect(improving.laterInSession).toBe(false);
  });

  it('confronta le sessioni migliori delle due metà (il primo massimo vince a parità)', () => {
    // seconda metà: due sessioni da 90 kg, la prima (1° posto) vince; prima metà: 100 kg da 1° posto
    const a = analyze([[100, 10, 500], [70, 600, 10], [90, 10, 500], [90, 600, 10]]);
    expect(a.status).toBe('declining');
    expect(a.laterInSession).toBe(false);
  });
});
