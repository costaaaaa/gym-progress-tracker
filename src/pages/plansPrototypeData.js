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
  {
    id: 3, name: 'Upper Lower', description: 'Quattro giorni, parte alta e parte bassa', is_active: 0,
    days: [
      {
        id: 31, name: 'Upper',
        exercises: [
          ex('Panca piana', 'petto', [...ws(2), ...work(4, 6, 8)], 120),
          ex('Rematore con manubrio', 'schiena', work(3, 8, 10)),
          ex('Lento avanti con manubri', 'spalle', work(3, 8, 10)),
          ex('Curl con bilanciere EZ', 'bicipiti', work(3, 10, 12), 60),
          ex('Estensioni sopra la testa', 'tricipiti', work(3, 10, 12), 60),
        ],
      },
      {
        id: 32, name: 'Lower',
        exercises: [
          ex('Squat', 'gambe', [...ws(3), ...work(4, 5, 5)], 150),
          ex('Stacco rumeno', 'gambe', [...ws(1), ...work(3, 8, 10)], 120),
          ex('Leg press', 'gambe', work(3, 10, 12)),
          ex('Calf in piedi', 'polpacci', work(4, 12, 15), 60),
        ],
      },
    ],
  },
  {
    id: 5, name: 'Upper Lower B', description: '', is_active: 0,
    days: [
      {
        id: 51, name: 'Giorno A',
        exercises: [
          ex('Panca inclinata con manubri', 'petto', [...ws(2), ...work(3, 8, 10)], 120),
          ex('Lat machine', 'schiena', work(3, 10, 12)),
          ex('Alzate laterali', 'spalle', work(3, 12, 15), 60),
        ],
      },
      {
        id: 52, name: 'Giorno B',
        exercises: [
          ex('Pressa orizzontale', 'gambe', [...ws(1), ...work(4, 10, 12)], 120),
          ex('Leg curl da seduto', 'gambe', work(3, 10, 12), 60),
          ex('Crunch ai cavi', 'addome', work(3, 12, 15), 60),
        ],
      },
    ],
  },
  {
    id: 6, name: 'PPL x2', description: 'Sei giorni, ogni gruppo due volte', is_active: 0,
    days: [
      {
        id: 61, name: 'Push A',
        exercises: [
          ex('Panca piana', 'petto', [...ws(2), ...work(4, 6, 8)], 120),
          ex('Lento avanti', 'spalle', work(3, 8, 10)),
          ex('Alzate laterali', 'spalle', work(3, 12, 15), 60),
          ex('Push down ai cavi', 'tricipiti', work(3, 10, 12), 60),
        ],
      },
      {
        id: 62, name: 'Pull A',
        exercises: [
          ex('Trazioni alla sbarra', 'schiena', [...ws(1), ...work(4, 6, 8)], 120),
          ex('Rematore con bilanciere', 'schiena', work(3, 8, 10)),
          ex('Curl con bilanciere', 'bicipiti', work(3, 10, 12), 60),
        ],
      },
      {
        id: 63, name: 'Gambe A',
        exercises: [
          ex('Squat', 'gambe', [...ws(3), ...work(4, 5, 5)], 150),
          ex('Leg press', 'gambe', work(3, 10, 12)),
          ex('Leg curl', 'gambe', work(3, 10, 12), 60),
          ex('Calf in piedi', 'polpacci', work(4, 12, 15), 60),
        ],
      },
      {
        id: 64, name: 'Push B',
        exercises: [
          ex('Panca inclinata con manubri', 'petto', [...ws(1), ...work(4, 8, 10)]),
          ex('Military press', 'spalle', work(3, 6, 8), 120),
          ex('Croci ai cavi', 'petto', work(3, 12, 15), 60),
          ex('French press', 'tricipiti', work(3, 10, 12), 60),
          ex('Dip alle parallele', 'tricipiti', work(3, 8, 10)),
        ],
      },
      {
        id: 65, name: 'Pull B',
        exercises: [
          ex('Lat machine presa stretta', 'schiena', work(4, 10, 12)),
          ex('Rematore al cavo basso', 'schiena', work(3, 10, 12)),
          ex('Curl a martello', 'bicipiti', work(3, 10, 12), 60),
        ],
      },
      {
        id: 66, name: 'Gambe B',
        exercises: [
          ex('Stacco rumeno', 'gambe', [...ws(2), ...work(4, 8, 10)], 120),
          ex('Affondi camminati', 'gambe', work(3, 10, 12)),
          ex('Hip thrust', 'gambe', work(3, 8, 10), 120),
        ],
      },
    ],
  },
  {
    id: 7, name: 'Bro split', description: '', is_active: 0,
    days: [
      {
        id: 71, name: 'Petto e tricipiti',
        exercises: [
          ex('Panca piana', 'petto', [...ws(2), ...work(4, 6, 8)], 120),
          ex('Panca inclinata con manubri', 'petto', work(3, 8, 10)),
          ex('Croci ai cavi', 'petto', work(3, 12, 15), 60),
          ex('Push down ai cavi', 'tricipiti', work(3, 10, 12), 60),
        ],
      },
      {
        id: 72, name: 'Schiena e bicipiti',
        exercises: [
          ex('Stacco da terra', 'schiena', [...ws(2), ...work(3, 5, 5)], 150),
          ex('Trazioni alla sbarra', 'schiena', work(4, 6, 8), 120),
          ex('Curl con bilanciere', 'bicipiti', work(3, 10, 12), 60),
        ],
      },
      {
        id: 73, name: 'Gambe e glutei',
        exercises: [
          ex('Squat', 'gambe', [...ws(3), ...work(4, 6, 8)], 150),
          ex('Hip thrust', 'gambe', work(3, 8, 10), 120),
          ex('Leg curl', 'gambe', work(3, 10, 12), 60),
        ],
      },
      {
        id: 74, name: 'Spalle e trapezi',
        exercises: [
          ex('Lento avanti', 'spalle', work(4, 6, 8), 120),
          ex('Alzate laterali', 'spalle', work(4, 12, 15), 60),
          ex('Shrug con manubri', 'spalle', work(3, 10, 12), 60),
        ],
      },
      {
        id: 75, name: 'Braccia e addome',
        exercises: [
          ex('Curl a martello', 'bicipiti', work(3, 10, 12), 60),
          ex('French press', 'tricipiti', work(3, 10, 12), 60),
          ex('Crunch ai cavi', 'addome', work(3, 12, 15), 60),
          ex('Plank con zavorra', 'addome', work(3, 10, 12), 60),
        ],
      },
    ],
  },
  { id: 4, name: 'Nuova scheda', description: '', is_active: 0, days: [] },
];
