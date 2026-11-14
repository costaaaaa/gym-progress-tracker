// PROTOTIPO USA E GETTA (A15): schede finte, stessa forma di read_plans.php. Nessun fetch.
const ws = (n) => Array.from({ length: n }, () => ({ kind: 'warmup', reps_min: null, reps_max: null, to_failure: false, intensity_technique: null }));
const work = (n, min, max, technique = null) => Array.from({ length: n }, (_, i) => ({
  kind: 'working', reps_min: min, reps_max: max, to_failure: false,
  intensity_technique: i === n - 1 ? technique : null,
}));
const fail = (n) => Array.from({ length: n }, () => ({ kind: 'working', reps_min: null, reps_max: null, to_failure: true, intensity_technique: null }));
const numbered = (sets) => sets.map((s, i) => ({ set_number: i + 1, ...s }));

let id = 0;
const ex = (name, muscle, sets, rest = 90) => ({
  id: ++id, exercise_name: name, muscle_group: muscle, rest, notes: '', planned_sets: numbered(sets),
});

export const PLANS = [
  {
    id: 1, name: 'Push Pull Legs', description: 'Tre giorni a settimana', is_active: 1,
    days: [
      {
        id: 11, name: 'Push',
        exercises: [
          ex('Panca piana', 'petto', [...ws(2), ...work(3, 6, 8)], 120),
          ex('Distensioni con manubri su panca inclinata a 30°', 'petto', work(3, 8, 10)),
          ex('Lento avanti', 'spalle', work(3, 8, 10)),
          ex('Alzate laterali', 'spalle', [...work(2, 12, 15), ...fail(1)], 60),
          ex('Push down ai cavi', 'tricipiti', [...work(2, 8, 10), ...work(1, 12, 15)], 60),
          ex('French press', 'tricipiti', work(3, 10, 12, 'Drop set (stripping)'), 60),
        ],
      },
      {
        id: 12, name: 'Pull',
        exercises: [
          ex('Trazioni alla sbarra', 'schiena', [...ws(1), ...work(4, 6, 8)], 120),
          ex('Rematore con bilanciere', 'schiena', work(3, 8, 10)),
          ex('Lat machine presa stretta', 'schiena', work(3, 10, 12)),
          ex('Curl con manubri', 'bicipiti', work(3, 10, 12), 60),
        ],
      },
      { id: 13, name: 'Gambe', exercises: [ex('Squat', 'gambe', [...ws(3), ...work(4, 5, 5)], 150)] },
      { id: 14, name: 'Giorno 4', exercises: [] },
    ],
  },
  {
    id: 2, name: 'Full body', description: '', is_active: 0,
    days: [
      {
        id: 21, name: 'Giorno A',
        exercises: [
          ex('Stacco da terra', 'schiena', [...ws(2), ...work(3, 5, 5)], 150),
          ex('Military press', 'spalle', work(3, 8, 10)),
        ],
      },
    ],
  },
];
