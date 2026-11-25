// Screenshot full page di tutte le pagine principali con API finte e orologio fisso.
// Uso: node shots.mjs <cartella-output> [porta]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , outName = 'before', port = '4181', onlyArg] = process.argv;
// Terzo parametro facoltativo: elenco di nomi (separati da virgola) delle sole schermate da scattare
const only = onlyArg ? new Set(onlyArg.split(',')) : null;
const want = (...names) => !only || names.some((name) => only.has(name));
// Nomi delle schermate di ogni flusso: una sola lista, usata sia da want(...) sia da snap(...)
const FOCUS_SHOTS = {
  scelta: 'focus-scelta-giorno',
  recupero: 'focus-recupero',
  allenamento: 'focus-allenamento',
  riscaldamento: 'focus-riscaldamento',
  riepilogo: 'focus-riepilogo',
};
// `giorni` è la pagina di una scheda in modifica (tutti i comandi); gli altri sono i dialog aperti da lì
const PLAN_EDITOR_SHOTS = {
  giorni: 'allenamenti-piani-giorni',
  aggiungiCompatto: 'allenamenti-piani-aggiungi-compatto',
  aggiungiLista: 'allenamenti-piani-aggiungi-lista',
  modificaLista: 'allenamenti-piani-modifica-lista',
};
// Pagina di una scheda ricca in modifica: giorni con più di 4 esercizi, giorno vuoto, nome lungo
const PLANS_OPEN_SHOT = 'allenamenti-piani-pagina-ricche-modifica';
const base = `http://localhost:${port}`;
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), outName);
mkdirSync(outDir, { recursive: true });

const NOW = Date.parse('2026-10-23T10:00:00+02:00');
// Giorno locale (Europe/Rome) dell'orologio fisso, yyyy-MM-dd
const TODAY = new Date(NOW).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
const DAY = 86400000;
const isoDay = (offset) => new Date(NOW + offset * DAY).toISOString().slice(0, 10);
// Istante ISO con Z, come lo manda il server (deadline di email_verification)
const isoInstant = (offset, time) => `${isoDay(offset)}T${time}Z`;
const stamp = (offset, time) => `${isoDay(offset)} ${time}`;
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

// Serie pianificate: `warmups` di riscaldamento, poi una serie allenante per riga { min, max, failure, technique }
const planned = (warmups, rows) => [
  ...Array.from({ length: warmups }, () => ({ kind: 'warmup', reps_min: null, reps_max: null, to_failure: false, intensity_technique: null })),
  ...rows.map(({ min = null, max = null, failure = false, technique = null }) => ({
    kind: 'working', reps_min: min, reps_max: failure ? null : max, to_failure: failure, intensity_technique: technique,
  })),
].map((set, i) => ({ set_number: i + 1, ...set }));
const times = (n, row) => Array.from({ length: n }, () => row);
const exercise = (id, exercise_id, exercise_name, planned_sets, muscle_group) =>
  ({ id, exercise_id, exercise_name, planned_sets, rest: 90, muscle_group });
const plan = {
  id: 5, name: 'Push Pull', description: 'Spinta e trazione, tre allenamenti a settimana', is_active: true,
  days: [
    { id: 1, name: 'Spinta', exercises: [exercise(9, 3, 'Panca piana', planned(1, [...times(2, { min: 8, max: 10 }), { min: 8, max: 10, technique: 'Drop Set (Stripping)' }]), 'petto'), exercise(10, 4, 'Croci', planned(0, times(3, { min: 12, max: 12 })), 'petto')] },
    { id: 2, name: 'Trazione', exercises: [exercise(11, 5, 'Trazioni', planned(0, [{ min: 12, max: 12 }, { min: 10, max: 10 }, { min: 6, failure: true, technique: 'Rest Pause' }]), 'schiena'), exercise(12, 6, 'Rematore con bilanciere', planned(2, times(4, { min: 8, max: 10 })), 'schiena')] },
  ],
};
const planInactive = {
  id: 6, name: 'Gambe e core', description: 'Blocco di forza sulle gambe', is_active: false,
  days: [{ id: 3, name: 'Gambe', exercises: [exercise(13, 7, 'Squat', planned(0, times(5, { min: 5, max: 5 })), 'quadricipiti'), exercise(14, 8, 'Stacco da terra', planned(0, [{ failure: true }]), 'femorali')] }],
};

// Schede più ricche per i controlli sull'elenco e sulla pagina (scelta `plans: 'ricche'`) e per il Focus con un giorno solo
const day = (id, name, exercises) => ({ id, name, exercises });
let nextExerciseId = 100;
const ex = (name, sets, group = 'petto') => {
  const id = nextExerciseId;
  nextExerciseId += 1;
  return exercise(id, id, name, sets, group);
};
const std = planned(0, times(3, { min: 8, max: 10 }));
const richPlans = [
  {
    id: 5, name: 'Push Pull Legs', description: 'Tre giorni a settimana', is_active: true,
    days: [
      day(1, 'Push', [
        ex('Panca piana', planned(2, times(3, { min: 6, max: 8 }))),
        ex('Distensioni con manubri su panca inclinata a 30°', std),
        ex('Lento avanti', std, 'spalle'),
        ex('Alzate laterali', planned(0, [...times(2, { min: 12, max: 15 }), { failure: true }]), 'spalle'),
        ex('Croci ai cavi', std),
        ex('French press', std, 'tricipiti'),
      ]),
      day(2, 'Pull', [
        ex('Trazioni alla sbarra', planned(1, times(4, { min: 6, max: 8 })), 'schiena'),
        ex('Rematore con bilanciere', std, 'schiena'),
        ex('Lat machine presa stretta', planned(0, times(3, { min: 10, max: 12 })), 'schiena'),
        ex('Curl con manubri', planned(0, times(3, { min: 10, max: 12 })), 'bicipiti'),
      ]),
      day(3, 'Gambe', [ex('Squat', planned(3, times(4, { min: 5, max: 5 })), 'quadricipiti')]),
      day(4, 'Giorno 4', []),
    ],
  },
  { id: 6, name: 'Full body', description: '', is_active: false, days: [day(11, 'Giorno 1', [ex('Squat', std, 'quadricipiti'), ex('Panca piana', std)])] },
  {
    id: 7, name: 'Upper Lower', description: 'Quattro giorni, parte alta e parte bassa', is_active: false,
    days: [day(21, 'Upper', [ex('Panca piana', std), ex('Rematore con bilanciere', std, 'schiena')]), day(22, 'Lower', [ex('Squat', std, 'quadricipiti')])],
  },
  {
    id: 8, name: 'PPL x2', description: 'Sei giorni, ogni gruppo due volte', is_active: false,
    days: Array.from({ length: 6 }, (_, i) => day(30 + i, `Giorno ${i + 1}`, [ex('Panca piana', std), ex('Squat', std, 'quadricipiti'), ex('Curl con manubri', std, 'bicipiti')])),
  },
  { id: 9, name: 'Nuova scheda', description: '', is_active: false, days: [] },
];
// Scheda attiva con un giorno solo: con esercizi (preselezionato) o ancora vuoto (appena creata)
const oneDayPlan = (exercises) => [{ id: 5, name: 'La mia scheda', description: '', is_active: true, days: [day(1, 'Giorno 1', exercises)] }];
// Schede del piano Gratis (limiti: 2 schede, 4 giorni per scheda). `read_only` come lo manda read_plans.php
const gratisPlan = (id, name, days, extra = {}) => ({ id, name, description: '', is_active: id === 1, days, read_only: false, ...extra });
const gratisDays = (base, n) => Array.from({ length: n }, (_, i) => day(base + i, `Giorno ${i + 1}`, [ex('Panca piana', std), ex('Squat', std, 'quadricipiti')]));
const PLAN_SETS_GRATIS = {
  schede: [
    // come le manda il server: con troppe schede sono tutte in sola lettura
    gratisPlan(1, 'Push Pull', gratisDays(10, 2), { read_only: true, read_only_reason: 'plans_over_limit' }),
    gratisPlan(2, 'Full body', gratisDays(20, 1), { read_only: true, read_only_reason: 'plans_over_limit' }),
    gratisPlan(3, 'Upper Lower', gratisDays(30, 2), { read_only: true, read_only_reason: 'plans_over_limit' }),
  ],
  giorni: [gratisPlan(1, 'PPL x2', gratisDays(10, 6), { read_only: true, read_only_reason: 'days_over_limit' })],
  limite: [gratisPlan(1, 'Push Pull', gratisDays(10, 2)), gratisPlan(2, 'Full body', gratisDays(20, 1))],
  nuova: [gratisPlan(1, 'Push Pull', gratisDays(10, 2))],
  elimina: [gratisPlan(1, 'Push Pull', gratisDays(10, 3))],
};
const PLAN_SETS = {
  ricche: richPlans,
  'un-giorno': oneDayPlan([ex('Panca piana', std), ex('Squat', std, 'quadricipiti')]),
  'un-giorno-vuoto': oneDayPlan([]),
  ...Object.fromEntries(Object.entries(PLAN_SETS_GRATIS).map(([k, v]) => [`gratis-${k}`, v])),
};

const CATALOG = [
  { id: 3, name: 'Panca piana', name_it: 'Panca piana', name_en: 'Bench press', muscle_group: 'petto' },
  { id: 4, name: 'Croci', name_it: 'Croci', name_en: 'Dumbbell fly', muscle_group: 'petto' },
  { id: 5, name: 'Trazioni', name_it: 'Trazioni', name_en: 'Pull-up', muscle_group: 'schiena' },
  { id: 6, name: 'Rematore con bilanciere', name_it: 'Rematore con bilanciere', name_en: 'Barbell row', muscle_group: 'schiena' },
  { id: 7, name: 'Squat', name_it: 'Squat', name_en: 'Squat', muscle_group: 'quadricipiti' },
  { id: 8, name: 'Stacco da terra', name_it: 'Stacco da terra', name_en: 'Deadlift', muscle_group: 'femorali' },
];

// Catalogo per «Tutti gli esercizi» (scelta `catalog: 'completo'`): con gli attrezzi e un esercizio personale in revisione.
// A parte, perché gli attrezzi cambierebbero anche i dialog degli altri flussi.
const EQUIPMENT_BY_ID = { 3: 'bilanciere', 4: 'manubri', 5: 'corpo_libero', 6: 'bilanciere', 7: 'bilanciere', 8: 'bilanciere' };
const CATALOG_COMPLETO = [
  ...CATALOG.map((e) => ({ ...e, equipment: EQUIPMENT_BY_ID[e.id], is_mine: false, status: 'approved' })),
  { id: 9, name: 'Distensioni con manubri', name_it: 'Distensioni con manubri', name_en: 'Dumbbell press', muscle_group: 'petto', equipment: 'manubri', is_mine: false, status: 'approved' },
  { id: 10, name: 'Croci ai cavi', name_it: 'Croci ai cavi', name_en: 'Cable fly', muscle_group: 'petto', equipment: 'cavi', is_mine: false, status: 'approved' },
  { id: 11, name: 'Lat machine', name_it: 'Lat machine', name_en: 'Lat pulldown', muscle_group: 'schiena', equipment: 'cavi', is_mine: false, status: 'approved' },
  { id: 12, name: 'Pressa orizzontale', name_it: 'Pressa orizzontale', name_en: 'Leg press', muscle_group: 'quadricipiti', equipment: 'macchina', is_mine: false, status: 'approved' },
  { id: 13, name: 'Squat bulgaro', name_it: 'Squat bulgaro', name_en: 'Bulgarian split squat', muscle_group: 'quadricipiti', equipment: 'manubri', is_mine: false, status: 'approved' },
  { id: 14, name: 'Alzate laterali', name_it: 'Alzate laterali', name_en: 'Lateral raise', muscle_group: 'spalle', equipment: 'manubri', is_mine: false, status: 'approved' },
  { id: 15, name: 'Squat con pausa', name_it: 'Squat con pausa', name_en: 'Pause squat', muscle_group: 'quadricipiti', equipment: 'bilanciere', is_mine: true, status: 'pending' },
];

const set = (n, weight, reps) => ({ set_number: n, weight, reps: String(reps) });
const HISTORY = Array.from({ length: 12 }, (_, i) => ({
  id: 200 - i,
  date: isoDay(-(i * 3 + 1)),
  // l'istante da cui i Progressi contano i giorni: senza, "ultimo NaN gg fa" e ogni esercizio risulta "Nuovo"
  started_at: `${isoDay(-(i * 3 + 1))}T16:00:00.000Z`,
  notes: '',
  exercises: [
    { exercise_id: 3, name: 'Panca piana', sets: [set(1, round(55 + i * 1.25), 8), set(2, round(60 + i * 1.25), 8), set(3, round(62.5 + i * 1.25), 6)] },
    { exercise_id: 6, name: 'Rematore con bilanciere', sets: [set(1, round(45 + i), 10), set(2, round(47.5 + i), 8)] },
    { exercise_id: 7, name: 'Squat', sets: [set(1, round(80 + i * 1.5), 5), set(2, round(85 + i * 1.5), 5)] },
  ],
}));

// Pagina di un esercizio: 12 sessioni di panca in cui il carico sale a ogni allenamento (la più recente è la più pesante),
// quindi il grafico sale e ogni sessione dopo la prima è un record. Stessi giorni e stessi altri esercizi di HISTORY.
const SALITA = HISTORY.map((workout, i) => ({
  ...workout,
  exercises: workout.exercises.map((ex) => (ex.exercise_id === 3
    ? { ...ex, sets: [set(1, round(55 + (11 - i) * 1.25), 8), set(2, round(60 + (11 - i) * 1.25), 8), set(3, round(62.5 + (11 - i) * 1.25), 6)] }
    : ex)),
}));

// Storico: due mesi (ottobre e settembre). `250` ha il giorno della scheda e un record vero (la panca più pesante
// di tutti), `249` non ha il giorno della scheda, `248` non ha la durata; gli altri due sono i più vecchi
const storicoWorkout = (id, offset, time, day, duration, exercises) => ({
  id, date: stamp(offset, time), time_zone: null, started_at: `${isoDay(offset)}T${time}.000Z`, duration_seconds: duration,
  notes: '', health_written: false, day_id: day ? 1 : null, day_name: day, exercises,
});
const STORICO = [
  storicoWorkout(250, -1, '18:30:00', 'Push A', 3720, [
    { exercise_id: 3, name: 'Panca piana', sets: [set(1, 80, 5), set(2, 80, 5), set(3, 77.5, 6)] },
    { exercise_id: 8, name: 'Croci ai cavi', sets: [set(1, 20, 12), set(2, 20, 10)] },
  ]),
  storicoWorkout(249, -4, '09:15:00', null, 2700, [
    { exercise_id: 7, name: 'Squat', sets: [set(1, 100, 5), set(2, 100, 5)] },
  ]),
  storicoWorkout(248, -8, '19:00:00', 'Gambe', null, [
    { exercise_id: 3, name: 'Panca piana', sets: [set(1, 72.5, 8), set(2, 72.5, 8)] },
    { exercise_id: 7, name: 'Squat', sets: [set(1, 95, 5), set(2, 95, 5)] },
  ]),
  storicoWorkout(247, -33, '18:00:00', 'Push A', 3300, [
    { exercise_id: 3, name: 'Panca piana', sets: [set(1, 70, 8), set(2, 70, 8)] },
  ]),
  storicoWorkout(246, -37, '17:45:00', null, 2400, [
    { exercise_id: 7, name: 'Squat', sets: [set(1, 90, 5)] },
  ]),
];

const BODY = Array.from({ length: 10 }, (_, i) => ({
  id: 300 + i,
  date: isoDay(-7 * (9 - i)),
  weight: round(82 - i * 0.3),
  body_fat_percentage: round(17.5 - i * 0.2),
  muscle_mass_percentage: round(40 + i * 0.15),
  chest_size: round(104 + i * 0.2),
  waist_size: round(86 - i * 0.3),
  arm_size: round(36.5 + i * 0.1),
  leg_size: round(58 + i * 0.1),
}));

const recovery = {
  petto: { status: 'PRONTO', ready_at: null },
  glutei: { status: 'PRONTO', ready_at: null },
  schiena: { status: 'IN RECUPERO', ready_at: stamp(1, '08:00:00') },
  spalle: { status: 'IN RECUPERO', ready_at: stamp(1, '08:00:00') },
  quadricipiti: { status: 'AFFATICATO', ready_at: stamp(2, '08:00:00') },
  femorali: { status: 'AFFATICATO', ready_at: stamp(3, '08:00:00') },
};

const GROUP_ROWS = [
  { rank: 1, username: 'atleta_2', is_me: false, workouts: 3, goal: 3, volume_kg: 5420, adherence: 1 },
  { rank: 2, username: 'atleta_demo', is_me: true, workouts: 2, goal: 3, volume_kg: 4820, adherence: 0.67 },
  { rank: 3, username: 'atleta_3', is_me: false, workouts: 1, goal: 3, volume_kg: 1980, adherence: 0.33 },
];

// Piano dell'account: `pro` (default, come Plus/Pro: nessun tetto) o `gratis` (tetti del piano Gratis)
const LIMITS = {
  pro: { plans: 50, days_per_plan: 7, personal_exercises: 30 },
  gratis: { plans: 2, days_per_plan: 4, personal_exercises: 10 },
};
// Stati della conferma email: da confermare (5 giorni a scadere), confermata, cambio in attesa, bloccato
const EMAIL_STATES = {
  'da-confermare': { email_verified: false, email_verification: { deadline: isoInstant(5, '10:00:00'), blocked: false, days_left: 5 }, pending_email: null },
  confermata: { email_verified: true, email_verification: { deadline: null, blocked: false, days_left: null }, pending_email: null },
  'cambio-in-attesa': { email_verified: true, email_verification: { deadline: null, blocked: false, days_left: null }, pending_email: 'nuovo@example.com' },
  bloccato: { email_verified: false, email_verification: { deadline: isoInstant(-1, '10:00:00'), blocked: true, days_left: 0 }, pending_email: null },
};
// Livello dell'account (`tierState`): `plus` (codice applicato, scade il 15/02/2027), `attesa` (Gratis, Plus in
// attesa della conferma), `missed` (Gratis, codice non applicato), `gratis` (Gratis senza codice)
const TIER_STATES = {
  plus: { tier: 'plus', tier_until: '2027-02-15T23:00:00Z', tier_last_day: '2027-02-15', signup_code: { status: 'applied', tier: 'plus', duration_days: 90 } },
  attesa: { tier: 'free', tier_until: null, tier_last_day: null, signup_code: { status: 'pending', tier: 'plus', duration_days: 90 } },
  missed: { tier: 'free', tier_until: null, tier_last_day: null, signup_code: { status: 'missed', tier: 'plus', duration_days: 90 } },
  gratis: { tier: 'free', tier_until: null, tier_last_day: null, signup_code: null },
};
const user = ({ admin, gratis, email, tierState, modules }) => ({
  ...(EMAIL_STATES[email ?? 'confermata']),
  success: true, id: 1, username: 'atleta_demo', email: 'atleta@example.com',
  created_at: stamp(-900, '10:00:00'), password_changed_at: stamp(-140, '09:00:00'),
  age: 34, gender: 'm', experience_years: 4, birth_date: '1992-05-14', training_start_date: '2022-01-10',
  rest_timer_enabled: true, locale: 'it', language: 'it', features: [], is_admin: admin,
  tier: gratis ? 'free' : 'pro', tier_until: null, tier_last_day: null, signup_code: null,
  ...(tierState ? TIER_STATES[tierState] : {}),
  limits: gratis ? LIMITS.gratis : LIMITS.pro,
  ...(modules ? { modules } : {}),
});

// Codici di registrazione per la sezione admin (nomi e assegnatari inventati)
const CODE_ROWS = [
  { id: 1, code: 'AMICI-90', tier: 'plus', duration_days: 90, forever: false, max_uses: 10, last_day: '2027-03-15', expired: false, enabled: true, assignee: 'Luca', seats_taken: 3, registered: 3, confirmed: 2, missed: 0, created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z' },
  { id: 2, code: 'TESTER', tier: 'pro', duration_days: null, forever: true, max_uses: 2, last_day: null, expired: false, enabled: true, assignee: 'Marta', seats_taken: 1, registered: 1, confirmed: 1, missed: 0, created_at: '2026-10-05T10:00:00Z', updated_at: '2026-10-05T10:00:00Z' },
  { id: 3, code: 'PRIMAVERA-26', tier: 'plus', duration_days: 30, forever: false, max_uses: 5, last_day: '2026-10-01', expired: true, enabled: false, assignee: null, seats_taken: 0, registered: 0, confirmed: 0, missed: 0, created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-01T10:00:00Z' },
];
const CODE_USES = [
  { username: 'atleta_2', account_deleted: false, status: 'applied', created_at: '2026-10-10T09:00:00Z', applied_at: '2026-10-10T09:30:00Z' },
  { username: 'atleta_3', account_deleted: false, status: 'pending', created_at: '2026-10-20T09:00:00Z', applied_at: null },
  { username: null, account_deleted: true, status: 'pending', created_at: '2026-10-21T09:00:00Z', applied_at: null },
];
const signupCodes = ({ url }) => {
  const id = new URL(url).searchParams.get('id');
  if (id) return { success: true, code: CODE_ROWS.find((c) => c.id === Number(id)), uses: CODE_USES, page: 1, per_page: 20, total: CODE_USES.length, pages: 1 };
  return { success: true, codes: CODE_ROWS, page: 1, per_page: 20, total: CODE_ROWS.length, pages: 1 };
};

// Controllo anticipato della registrazione: `codice` = 'ok' (Plus 90 giorni), 'errore' (non valido)
const checkAvailability = ({ codice }) => {
  if (codice === 'errore') return { __status: 400, success: false, code: 'signup_code_invalid', message: 'Il codice di registrazione non è valido.', field: 'signup_code' };
  return { success: true, username_taken: false, email_taken: false, ...(codice === 'ok' ? { signup_code: { usable: true, tier: 'plus', duration_days: 90 } } : {}) };
};

// Utenti dei dati finti: `attivo` è l'utente di tutte le pagine, `un-allenamento` cambia solo lo storico
// (un solo allenamento: ogni esercizio è "Nuovo" nei Progressi), `progressi` anche (la panca sale a ogni allenamento). `nuovo` risponde come un account vuoto
// (livello 1, nessuna streak, nessun gruppo, muscoli mai allenati). È scritto per esteso e non parte da
// `attivo`; prende solo l'elenco dei traguardi da `PROFILE_ATTIVO`, tutti bloccati.
const PROFILE_ATTIVO = {
  success: true, level: 7, total_xp: 3140, xp_into_level: 340, xp_for_next_level: 600,
  lifetime_volume_kg: 184250, total_sessions: 58, longest_streak: 5,
  exercises: [
    { exercise_id: 3, name: 'Panca piana', level: 6, xp: 820 },
    { exercise_id: 6, name: 'Rematore con bilanciere', level: 5, xp: 610 },
    { exercise_id: 7, name: 'Squat', level: 4, xp: 430 },
  ],
  achievements: [
    { key: 's10', category: 'sessions', label: '10 sessioni', threshold: 10, unlocked_at: stamp(-200, '18:00:00'), locked: false },
    { key: 's50', category: 'sessions', label: '50 sessioni', threshold: 50, unlocked_at: null, locked: true },
    { key: 't10000', category: 'tonnage', label: '10.000 kg sollevati', threshold: 10000, unlocked_at: stamp(-120, '18:00:00'), locked: false },
    { key: 't100000', category: 'tonnage', label: '100.000 kg sollevati', threshold: 100000, unlocked_at: null, locked: true },
    { key: 'st4', category: 'streak', label: '4 settimane di fila', threshold: 4, unlocked_at: stamp(-30, '18:00:00'), locked: false },
    { key: 'st12', category: 'streak', label: '12 settimane di fila', threshold: 12, unlocked_at: null, locked: true },
  ],
};
const ATTIVO = {
  history: HISTORY,
  plans: [plan, planInactive],
  weekly: { workouts: 2, kg: 4820, reps: 118 },
  // Serie della settimana per muscolo (53, contro 48 la settimana scorsa a quest'ora e 61 intera): nove muscoli con serie e tre a
  // zero. Il recupero è quello di `recovery` (pronto, in recupero, affaticato); i muscoli senza voce restano «nessun dato»
  sets: {
    week: { petto: 12, schiena: 10, spalle: 6, bicipiti: 4, tricipiti: 3, addome: 0, quadricipiti: 8, femorali: 5, glutei: 3, adduttori: 2, abduttori: 0, polpacci: 0 },
    previous_to_date: { petto: 8, schiena: 8, spalle: 4, bicipiti: 4, tricipiti: 3, addome: 3, quadricipiti: 9, femorali: 4, glutei: 3, adduttori: 0, abduttori: 0, polpacci: 2 },
    previous_total: 61,
  },
  recovery,
  streak: { current_streak_weeks: 3, longest_streak_weeks: 5, this_week: { count: 2, goal: 3, completed: false } },
  profile: PROFILE_ATTIVO,
  groups: [
    { id: 1, name: 'Palestra Esempio', type: 'gym', members_count: 4, my_role: 'owner' },
    { id: 2, name: 'Amici del sabato', type: 'friends', members_count: 3, my_role: 'member' },
  ],
};
// I muscoli di MUSCLE_GROUPS (src/utils/recoveryGroups.js): il file non si importa da Node (import senza estensione)
const MUSCLI = ['petto', 'schiena', 'spalle', 'bicipiti', 'tricipiti', 'addome', 'quadricipiti', 'femorali', 'glutei', 'adduttori', 'abduttori', 'polpacci'];
const UTENTI = {
  attivo: ATTIVO,
  'un-allenamento': { ...ATTIVO, history: HISTORY.slice(0, 1) },
  progressi: { ...ATTIVO, history: SALITA },
  storico: { ...ATTIVO, history: STORICO },
  nuovo: {
    history: [],
    plans: [],
    weekly: { workouts: 0, kg: 0, reps: 0 },
    recovery: Object.fromEntries(MUSCLI.map((group) => [group, { status: 'PRONTO', percent: 100, last_trained: null }])),
    streak: { current_streak_weeks: 0, longest_streak_weeks: 0, this_week: { count: 0, goal: 3, completed: false } },
    profile: {
      success: true, level: 1, total_xp: 0, xp_into_level: 0, xp_for_next_level: 100,
      lifetime_volume_kg: 0, total_sessions: 0, longest_streak: 0, exercises: [],
      achievements: PROFILE_ATTIVO.achievements.map((a) => ({ ...a, unlocked_at: null, locked: true })),
    },
    groups: [],
  },
};

const fixtures = [
  ['user/read.php', user],
  ['user/check_availability.php', checkAvailability],
  ['admin/signup_codes.php', signupCodes],
  ['user/consent.php', () => ({ success: true, consents: { terms: { granted: true }, health_data: { granted: true } } })],
  ['workout_history/read.php', ({ u }) => ({ success: true, records: u.history })],
  ['workout/read_plans.php', ({ plans, u }) => ({ success: true, records: plans ? PLAN_SETS[plans] : u.plans })],
  ['workout_stats/dashboard.php', ({ u, gratis, sets }) => gratis ? ({
    // Piano Gratis: solo il totale delle serie e lo stato pronto / in recupero, senza percentuali né date
    success: true, detail: 'basic', weekly_workouts: u.weekly.workouts, weekly_goal: 3,
    weekly_volume: { total_weight: u.weekly.kg, total_reps: u.weekly.reps }, weekly_sets: { total: 14 },
    recovery: Object.fromEntries(Object.entries(u.recovery).map(([group, r]) => [group, { status: r.status === 'PRONTO' ? 'PRONTO' : 'IN RECUPERO', last_trained: stamp(-3, '18:00:00') }])),
  }) : ({
    success: true, detail: 'full', weekly_workouts: u.weekly.workouts, weekly_goal: 3,
    weekly_volume: { total_weight: u.weekly.kg, total_reps: u.weekly.reps }, recovery: u.recovery,
    // Le serie per muscolo le mandano solo i flussi della tab Volume (`sets`): le altre schermate restano com'erano
    ...(sets ? { weekly_sets: u.sets } : {}),
  })],
  ['gamification/streak.php', ({ u }) => ({ success: true, ...u.streak })],
  ['gamification/profile.php', ({ u }) => u.profile],
  ['exercise/read_all.php', ({ catalog }) => ({ success: true, records: catalog === 'completo' ? CATALOG_COMPLETO : CATALOG })],
  ['user_stats/read.php', ({ statsError }) => (statsError ? { __status: 500, success: false } : { success: true, records: BODY, consent_required: false, consent_updated: false })],
  ['groups/list.php', ({ u }) => ({ success: true, groups: u.groups })],
  ['groups/read.php', () => ({
    success: true,
    group: { id: 1, name: 'Palestra Esempio', type: 'gym', invite_code: 'ESEMPIO7', invite_enabled: true, members_count: 4, max_members: 30, my_role: 'owner', name_locked: false, name_locked_until: null },
    week: { iso: '2026-W43', from: isoDay(-2), to: isoDay(4) },
    members: [
      { username: 'atleta_demo', role: 'owner', is_me: true, ref: null },
      { username: 'atleta_2', role: 'member', is_me: false, ref: 'm-2' },
      { username: 'atleta_4', role: 'admin', is_me: false, ref: 'm-3' },
      { username: 'atleta_3', role: 'member', is_me: false, ref: 'm-4' },
    ],
    board_type: 'week',
    board: GROUP_ROWS,
  })],
  ['admin/reports.php', () => ({ success: true, reports: [
    { id: 1, group_id: 1, group_name: 'Palestra Esempio', target: 'post', target_label: 'Commento di atleta_2', reason: 'Linguaggio offensivo verso un altro membro', status: 'open', created_at: stamp(-1, '18:20:00') },
  ] })],
  ['admin/groups.php', () => ({ success: true, groups: [
    { id: 1, name: 'Palestra Esempio', owner: 'atleta_demo', members_count: 4, created_at: stamp(-300, '10:00:00'), name_locked: false, name_locked_until: null, group_admin_renames: 0 },
  ] })],
  ['admin/exercises.php', () => ({ success: true, exercises: CATALOG.map((e) => ({ ...e, equipment: null, uses: 42, similar: [], merged_into: null, created_by_username: 'atleta_demo' })), muscle_groups: ['petto', 'schiena', 'quadricipiti', 'femorali'], equipment: [] })],
];
const fallback = { success: true, records: [] };

const FREEZE_CSS = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}';
const SETTLE_MS = 2500;

const browser = await chromium.launch();
const problems = [];
const failures = [];
let shots = 0;

async function freeze(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => !document.querySelector('[role="progressbar"]:not([aria-valuenow])'), null, { timeout: 15000 })
    .catch(async (err) => {
      const busy = await page.$$eval('[role="progressbar"]:not([aria-valuenow])', (els) => els.map((e) => e.outerHTML.slice(0, 160)));
      throw new Error(`spinner ancora attivo (${busy.length}): ${busy.join(' | ')} :: ${err.message.split('\n')[0]}`);
    });
  await page.addStyleTag({ content: FREEZE_CSS });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(SETTLE_MS);
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement?.blur());
}

// `clip`: un locator da ritagliare al posto della pagina intera (i dialog)
async function snap(page, name, tag, clip) {
  await freeze(page);
  const text = await (clip ?? page.locator('body')).innerText();
  const suspicious = text.match(/pagina non trovata|impossibile caricare|errore nel caricamento|Errore/i);
  if (suspicious) problems.push(`[${tag}] ${name}: testo sospetto "${suspicious[0]}"`);
  const file = { path: path.join(outDir, `${name}_${tag}.png`), animations: 'disabled', caret: 'hide' };
  await (clip ? clip.screenshot(file) : page.screenshot({ ...file, fullPage: true }));
  shots++;
}

async function attempt(tag, name, fn) {
  try {
    await fn();
  } catch (err) {
    failures.push(`[${tag}] ${name}: ${err.message.split('\n')[0]}`);
  }
}

// SHOTS_WIDTHS="320,390" sostituisce le larghezze di base (altezza 844 per tutte tranne 1440, alta 900)
const viewports = (process.env.SHOTS_WIDTHS || '390,1440').split(',').map(Number).map((w) => ({ w, h: w >= 1440 ? 900 : 844 }));
const themes = ['light', 'dark'];

async function openPage(vp, theme, opts, tag) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, reducedMotion: 'reduce',
    colorScheme: theme, locale: 'it-IT', timezoneId: 'Europe/Rome',
  });
  await ctx.clock.setFixedTime(NOW);
  await ctx.addInitScript(({ mode, loggedIn, reminder, today, draft }) => {
    localStorage.setItem('themeMode', mode);
    localStorage.setItem('lx_locale', 'it');
    localStorage.setItem('lx_lang_choice', 'it');
    localStorage.removeItem('gym_focus_workout_draft');
    // Allenamento in corso su questo browser (il ventaglio propone «Riprendi»)
    if (draft) localStorage.setItem('gym_focus_workout_draft', JSON.stringify({ selectedDay: { id: 10, name: 'Giorno 1' }, selectedDayId: 10, startTime: Date.now() - 600000 }));
    // Promemoria dell'email già mostrato oggi (orologio fisso 2026-10-23), salvo `reminder`: la finestra non copre la pagina
    if (!reminder) localStorage.setItem('lx_email_reminder_1', today);
    if (loggedIn) {
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('user', JSON.stringify({ id: 1, username: 'atleta_demo' }));
    } else {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('user');
    }
  }, { mode: theme, loggedIn: opts.loggedIn, reminder: opts.reminder === true, today: TODAY, draft: opts.draft === true });
  await ctx.route('**/backend/**', (route) => {
    const url = route.request().url();
    const hit = fixtures.find(([key]) => url.includes(key));
    const body = hit ? hit[1]({ admin: opts.admin === true, gratis: opts.gratis === true, email: opts.email, tierState: opts.tierState, codice: opts.codice, modules: opts.modules, url, plans: opts.plans, catalog: opts.catalog, sets: opts.sets === true, statsError: opts.statsError === true, u: UTENTI[opts.utente ?? 'attivo'] }) : fallback;
    const { __status: status = 200, ...payload } = body;
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (err) => problems.push(`[${tag}] ${page.url()} pageerror: ${err.message}`));
  page.on('console', (msg) => { if (msg.type() === 'error') problems.push(`[${tag}] ${page.url()} console: ${msg.text()}`); });
  return { ctx, page };
}

const SHOT_LIST = [
  ['landing', '/', { loggedIn: false }],
  ['home', '/', { loggedIn: true }],
  ['home-nuovo', '/', { loggedIn: true, utente: 'nuovo' }],
  ['progressi', '/progressi?tab=progress', { loggedIn: true }],
  ['progressi-nuovo', '/progressi?tab=progress', { loggedIn: true, utente: 'un-allenamento' }],
  ['misure', '/progressi?tab=body', { loggedIn: true }],
  // Lettura delle misure fallita (il server risponde 500): l'errore nella pagina con «Riprova»
  ['misure-errore', '/progressi?tab=body', { loggedIn: true, statsError: true, readyText: 'Errore nel caricamento delle statistiche' }],
  // Tab Volume: con il modulo Recupero attivo (card «Questa settimana» e «Per muscolo») e con il modulo spento (solo la card
  // della settimana)
  ['volume', '/progressi?tab=volume', { loggedIn: true, sets: true, readyText: 'Per muscolo' }],
  ['volume-base', '/progressi?tab=volume', { loggedIn: true, sets: true, modules: { recovery: false }, readyText: 'Questa settimana' }],
  // Pagina di un esercizio (la panca): 12 sessioni, grafico in salita, record e cronologia
  ['progressi-esercizio', '/progressi/esercizi/3', { loggedIn: true, utente: 'progressi', ready: 'Panca piana' }],
  // Account: l'elenco delle quattro voci (con il livello in testata) e, una per una, le sue pagine
  ['account', '/account', { loggedIn: true }],
  ['account-profilo', '/account/profilo', { loggedIn: true }],
  ['account-moduli', '/account/moduli', { loggedIn: true }],
  ['account-dati', '/account/dati', { loggedIn: true }],
  ['account-sicurezza', '/account/sicurezza', { loggedIn: true }],
  ['livelli', '/livelli', { loggedIn: true }],
  ['gruppi', '/gruppi', { loggedIn: true }],
  ['gruppo-dettaglio', '/gruppi/1', { loggedIn: true }],
  ['allenamenti-piani', '/schede', { loggedIn: true }],
  ['allenamenti-piani-ricche', '/schede', { loggedIn: true, plans: 'ricche' }],
  // Pagina di una scheda in lettura: attiva (con «Inizia»), non attiva (con «Rendi attiva»), ricca (giorni lunghi e vuoto)
  ['allenamenti-piani-pagina', '/schede/5', { loggedIn: true, ready: 'Push Pull' }],
  ['allenamenti-piani-pagina-non-attiva', '/schede/6', { loggedIn: true, ready: 'Gambe e core' }],
  ['allenamenti-piani-pagina-ricche', '/schede/5', { loggedIn: true, plans: 'ricche', ready: 'Push Pull Legs' }],
  ['allenamenti-cronologia', '/storico', { loggedIn: true, utente: 'storico', readyText: 'Gambe' }],
  // Pagina di un allenamento con giorno della scheda, record e dettaglio
  ['storico-allenamento', '/storico/250', { loggedIn: true, utente: 'storico', ready: 'Push A' }],
  // Vista «Calendario»: ottobre 2026 con tre giorni allenati (15, 19 e 22), scelto il 22 col suo allenamento; senza ?giorno
  // si apre su oggi (23 ottobre), che non ha allenamenti
  ['storico-calendario', '/storico?vista=calendario&giorno=2026-10-22', { loggedIn: true, utente: 'storico', ready: 'Storico', readyText: 'Push A' }],
  ['storico-calendario-vuoto', '/storico?vista=calendario', { loggedIn: true, utente: 'storico', readyText: 'Nessun allenamento in questo giorno.' }],
  ['admin', '/admin', { loggedIn: true, admin: true }],
];

for (const vp of viewports) {
  for (const theme of themes) {
    const tag = `${vp.w}_${theme}`;

    for (const [name, url, opts] of SHOT_LIST) {
      if (!want(name)) continue;
      await attempt(tag, name, async () => {
        const { ctx, page } = await openPage(vp, theme, opts, tag);
        try {
          await page.goto(`${base}${url}`, { waitUntil: 'domcontentloaded' });
          if (opts.ready) await page.getByRole('heading', { level: 1, name: opts.ready }).waitFor();
          if (opts.readyText) await page.getByText(opts.readyText).first().waitFor();
          await snap(page, name, tag);
        } finally {
          await ctx.close();
        }
      });
    }

    for (const [name, plans] of [['focus-scelta-giorno-un-giorno', 'un-giorno'], ['focus-scelta-giorno-vuoto', 'un-giorno-vuoto']]) {
      if (!want(name)) continue;
      await attempt(tag, name, async () => {
        const { ctx, page } = await openPage(vp, theme, { loggedIn: true, plans }, tag);
        try {
          await page.goto(`${base}/focus`, { waitUntil: 'domcontentloaded' });
          await page.getByRole('button', { name: 'Inizia allenamento', exact: true }).waitFor();
          await snap(page, name, tag);
        } finally {
          await ctx.close();
        }
      });
    }

    // La pagina della scheda ricca in modifica: giorni con più di 4 esercizi, vuoto, nome lungo
    if (want(PLANS_OPEN_SHOT)) {
      await attempt(tag, PLANS_OPEN_SHOT, async () => {
        const { ctx, page } = await openPage(vp, theme, { loggedIn: true, plans: 'ricche' }, tag);
        try {
          await page.goto(`${base}/schede/5`, { waitUntil: 'domcontentloaded' });
          await page.getByRole('button', { name: 'Modifica', exact: true }).click();
          await page.getByText('Nessun esercizio aggiunto').first().waitFor();
          await snap(page, PLANS_OPEN_SHOT, tag);
        } finally {
          await ctx.close();
        }
      });
    }

    if (want(...Object.values(FOCUS_SHOTS))) await attempt(tag, 'focus', async () => {
      const { ctx, page } = await openPage(vp, theme, { loggedIn: true }, tag);
      try {
        await page.goto(`${base}/focus`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'Inizia allenamento', exact: true }).waitFor();
        await snap(page, FOCUS_SHOTS.scelta, tag);

        await page.getByRole('combobox').click();
        await page.getByRole('option', { name: 'Trazione', exact: true }).click();
        await page.getByRole('button', { name: 'Inizia allenamento', exact: true }).click();
        await page.getByRole('button', { name: 'Conferma serie', exact: true }).waitFor();

        // Trazioni: 12 / 10 / a cedimento (min. 6) con Rest Pause. Il recupero si fotografa dopo la prima serie;
        // la terza mostra l'obiettivo "a cedimento" in grigio e la tecnica già scelta
        const confirmSet = async (reps) => {
          await page.getByLabel('Peso (kg)').fill('60');
          await page.getByLabel('Ripetizioni').fill(reps);
          await page.getByRole('button', { name: 'Conferma serie', exact: true }).click();
        };
        const skipRest = async () => {
          await page.getByText('Recupero', { exact: true }).waitFor();
          await page.getByRole('button', { name: 'Salta timer', exact: true }).click();
          await page.getByRole('button', { name: 'Conferma serie', exact: true }).waitFor();
        };
        await confirmSet('12');
        await page.getByText('Recupero', { exact: true }).waitFor();
        await snap(page, FOCUS_SHOTS.recupero, tag);
        await skipRest();
        await confirmSet('10');
        await skipRest();
        await snap(page, FOCUS_SHOTS.allenamento, tag);

        // L'ultima serie dell'esercizio porta subito al successivo (Rematore, parte dal riscaldamento), senza recupero
        await confirmSet('8');
        await page.getByRole('heading', { name: 'Rematore con bilanciere' }).waitFor();
        await snap(page, FOCUS_SHOTS.riscaldamento, tag);
        for (let i = 0; i < 10 && !(await page.getByText('Riepilogo', { exact: true }).isVisible()); i++) {
          await page.getByRole('button', { name: 'Salta esercizio', exact: true }).click();
          await page.waitForTimeout(300);
        }
        await page.getByText('Riepilogo', { exact: true }).waitFor();
        await snap(page, FOCUS_SHOTS.riepilogo, tag);
      } finally {
        await ctx.close();
      }
    });

    if (want(...Object.values(PLAN_EDITOR_SHOTS))) await attempt(tag, 'piani-editor', async () => {
      const { ctx, page } = await openPage(vp, theme, { loggedIn: true }, tag);
      try {
        await page.goto(`${base}/schede/5`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'Modifica', exact: true }).click();
        await page.getByText('Trazioni').first().waitFor();
        await snap(page, PLAN_EDITOR_SHOTS.giorni, tag);

        // I dialog sono più alti dello schermo: si allarga la finestra e si ritaglia il solo dialog
        await page.setViewportSize({ width: vp.w, height: 1600 });
        const snapDialog = (name) => snap(page, name, tag, page.getByRole('dialog'));

        await page.getByRole('button', { name: 'Aggiungi esercizio' }).first().click();
        await page.locator('#mui-component-select-muscleGroup').click();
        await page.getByRole('option', { name: 'Petto' }).click();
        await page.getByLabel('Nome esercizio').fill('Croci');
        await page.getByRole('option', { name: 'Croci' }).click();
        await page.getByLabel('Serie', { exact: true }).fill('3');
        await page.getByLabel('Riscaldamento', { exact: true }).fill('2');
        await page.getByLabel('Ripetizioni').fill('8-10');
        await page.getByRole('combobox', { name: /Tecnica/ }).click();
        await page.getByRole('option', { name: 'Drop set (stripping)' }).click();
        await page.getByLabel('Recupero (s)').fill('90');
        await snapDialog(PLAN_EDITOR_SHOTS.aggiungiCompatto);

        await page.getByLabel('Serie diverse').check();
        await page.getByRole('group', { name: 'Serie 1' }).getByRole('textbox').fill('12');
        await page.getByRole('group', { name: 'Serie 2' }).getByRole('textbox').fill('10');
        const last = page.getByRole('group', { name: 'Serie 3' });
        await last.getByRole('checkbox', { name: 'A cedimento' }).check();
        await last.getByRole('textbox').fill('6');
        await snapDialog(PLAN_EDITOR_SHOTS.aggiungiLista);
        await page.getByRole('button', { name: 'Annulla' }).click();
        await page.getByRole('dialog').waitFor({ state: 'detached' });

        // Trazioni ha serie diverse: la modifica si apre già per serie
        await page.getByRole('button', { name: 'Modifica esercizio' }).nth(2).click();
        await page.getByRole('group', { name: 'Serie 3' }).waitFor();
        await snapDialog(PLAN_EDITOR_SHOTS.modificaLista);
      } finally {
        await ctx.close();
      }
    });

    // Piano Gratis: schermate con i limiti, le righe con lucchetto e la sola lettura (account `gratis`)
    for (const [name, url] of [['home-gratis', '/'], ['volume-gratis', '/progressi?tab=volume']]) {
      if (!want(name)) continue;
      await attempt(tag, name, async () => {
        const { ctx, page } = await openPage(vp, theme, { loggedIn: true, gratis: true }, tag);
        try {
          await page.goto(`${base}${url}`, { waitUntil: 'domcontentloaded' });
          await snap(page, name, tag);
        } finally {
          await ctx.close();
        }
      });
    }
    // «troppe schede» e il tetto si vedono sull'elenco; «troppi giorni» nella pagina della scheda, in modifica
    for (const [name, plans, url, edit] of [
      ['allenamenti-piani-sola-lettura-schede', 'gratis-schede', '/schede', false],
      ['allenamenti-piani-sola-lettura-giorni', 'gratis-giorni', '/schede/1', true],
      ['allenamenti-piani-limite', 'gratis-limite', '/schede', false],
    ]) {
      if (!want(name)) continue;
      await attempt(tag, name, async () => {
        const { ctx, page } = await openPage(vp, theme, { loggedIn: true, gratis: true, plans }, tag);
        try {
          await page.goto(`${base}${url}`, { waitUntil: 'domcontentloaded' });
          if (edit) await page.getByRole('button', { name: 'Modifica', exact: true }).click();
          else await page.getByRole('button', { name: 'Nuova scheda' }).waitFor();
          await snap(page, name, tag);
        } finally {
          await ctx.close();
        }
      });
    }
    // «Tutti gli esercizi»: la pagina piena, poi con un testo cercato
    if (want('allenamenti-esercizi', 'allenamenti-esercizi-cerca')) await attempt(tag, 'allenamenti-esercizi', async () => {
      const { ctx, page } = await openPage(vp, theme, { loggedIn: true, catalog: 'completo' }, tag);
      try {
        await page.goto(`${base}/schede/esercizi`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('list').waitFor();
        await snap(page, 'allenamenti-esercizi', tag);
        await page.getByRole('textbox', { name: 'Cerca un esercizio' }).fill('squat');
        await page.getByText('Squat bulgaro').waitFor();
        await snap(page, 'allenamenti-esercizi-cerca', tag);
      } finally {
        await ctx.close();
      }
    });
    if (want('allenamenti-piani-nuova-gratis')) await attempt(tag, 'allenamenti-piani-nuova-gratis', async () => {
      const { ctx, page } = await openPage(vp, theme, { loggedIn: true, gratis: true, plans: 'gratis-nuova' }, tag);
      try {
        await page.goto(`${base}/schede`, { waitUntil: 'domcontentloaded' });
        await page.setViewportSize({ width: vp.w, height: 1600 });
        await page.getByRole('button', { name: 'Nuova scheda' }).click();
        await page.getByRole('dialog').waitFor();
        await snap(page, 'allenamenti-piani-nuova-gratis', tag, page.getByRole('dialog'));
      } finally {
        await ctx.close();
      }
    });
    if (want('storico-allenamento-elimina')) await attempt(tag, 'storico-allenamento-elimina', async () => {
      const { ctx, page } = await openPage(vp, theme, { loggedIn: true, utente: 'storico' }, tag);
      try {
        await page.goto(`${base}/storico/250`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { level: 1, name: 'Push A' }).waitFor();
        await page.getByRole('button', { name: 'Elimina', exact: true }).click();
        await page.getByRole('dialog').waitFor();
        await snap(page, 'storico-allenamento-elimina', tag, page.getByRole('dialog'));
      } finally {
        await ctx.close();
      }
    });
    // «Profilo e preferenze» con la finestra di una riga aperta: l'obiettivo settimanale e l'unità di misura
    for (const [name, row] of [['account-profilo-obiettivo', 'Obiettivo settimanale'], ['account-profilo-unita', 'Unità di misura']]) {
      if (!want(name)) continue;
      await attempt(tag, name, async () => {
        const { ctx, page } = await openPage(vp, theme, { loggedIn: true }, tag);
        try {
          await page.goto(`${base}/account/profilo`, { waitUntil: 'domcontentloaded' });
          await page.getByRole('button', { name: row, exact: true }).click();
          const dialog = page.getByRole('dialog');
          await dialog.waitFor();
          await snap(page, name, tag, dialog);
        } finally {
          await ctx.close();
        }
      });
    }
    if (want('allenamenti-piani-elimina-giorno')) await attempt(tag, 'allenamenti-piani-elimina-giorno', async () => {
      const { ctx, page } = await openPage(vp, theme, { loggedIn: true, gratis: true, plans: 'gratis-elimina' }, tag);
      try {
        await page.goto(`${base}/schede/1`, { waitUntil: 'domcontentloaded' });
        await page.setViewportSize({ width: vp.w, height: 1600 });
        await page.getByRole('button', { name: 'Modifica', exact: true }).click();
        await page.getByRole('button', { name: /^Elimina giorno/ }).first().click();
        await page.getByRole('dialog').waitFor();
        await snap(page, 'allenamenti-piani-elimina-giorno', tag, page.getByRole('dialog'));
      } finally {
        await ctx.close();
      }
    });
    if (want('focus-plus-dialogo', 'focus-plus-allenamento')) await attempt(tag, 'focus-plus-dialogo', async () => {
      const { ctx, page } = await openPage(vp, theme, { loggedIn: true, gratis: true }, tag);
      try {
        await page.goto(`${base}/focus`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'Inizia allenamento', exact: true }).waitFor();
        await page.getByRole('combobox').click();
        await page.getByRole('option', { name: 'Trazione', exact: true }).click();
        await page.getByRole('button', { name: 'Inizia allenamento', exact: true }).click();
        await page.getByRole('button', { name: 'Conferma serie', exact: true }).waitFor();
        await snap(page, 'focus-plus-allenamento', tag);
        await page.getByRole('button', { name: /Cambia esercizio/ }).click();
        await page.getByRole('dialog').waitFor();
        await snap(page, 'focus-plus-dialogo', tag, page.getByRole('dialog'));
      } finally {
        await ctx.close();
      }
    });

    // Conferma email: finestra del codice, striscia, schermata di blocco, card dell'account nei tre stati, cambio indirizzo
    for (const [name, url, opts] of [
      ['email-striscia', '/', { loggedIn: true, email: 'da-confermare' }],
      ['email-blocco', '/', { loggedIn: true, email: 'bloccato' }],
      ['email-account-da-confermare', '/account/profilo', { loggedIn: true, email: 'da-confermare' }],
      ['email-account-confermata', '/account/profilo', { loggedIn: true, email: 'confermata' }],
      ['email-account-cambio-in-attesa', '/account/profilo', { loggedIn: true, email: 'cambio-in-attesa' }],
    ]) {
      if (!want(name)) continue;
      await attempt(tag, name, async () => {
        const { ctx, page } = await openPage(vp, theme, opts, tag);
        try {
          await page.goto(`${base}${url}`, { waitUntil: 'domcontentloaded' });
          await page.getByRole('heading', { level: 1 }).first().waitFor();
          await snap(page, name, tag);
        } finally {
          await ctx.close();
        }
      });
    }
    if (want('email-dialogo-conferma')) await attempt(tag, 'email-dialogo-conferma', async () => {
      const { ctx, page } = await openPage(vp, theme, { loggedIn: true, email: 'da-confermare', reminder: true }, tag);
      try {
        await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
        const dialog = page.getByRole('dialog');
        await dialog.waitFor();
        await snap(page, 'email-dialogo-conferma', tag, dialog);
      } finally {
        await ctx.close();
      }
    });
    if (want('email-dialogo-cambia-indirizzo')) await attempt(tag, 'email-dialogo-cambia-indirizzo', async () => {
      const { ctx, page } = await openPage(vp, theme, { loggedIn: true, email: 'da-confermare' }, tag);
      try {
        await page.goto(`${base}/account/profilo`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'Cambia indirizzo' }).click();
        const dialog = page.getByRole('dialog');
        await dialog.waitFor();
        await snap(page, 'email-dialogo-cambia-indirizzo', tag, dialog);
      } finally {
        await ctx.close();
      }
    });

    // Codici di registrazione: registrazione con il campo aperto (e il codice controllato o rifiutato), livello in Account, sezione admin
    for (const [name, url, opts] of [
      ['codici-registrazione-campo', '/register?code=PRIMAVERA-26', { loggedIn: false }],
      ['codici-account-gratis', '/account', { loggedIn: true, tierState: 'gratis' }],
      ['codici-account-plus', '/account', { loggedIn: true, tierState: 'plus' }],
      ['codici-account-attesa', '/account', { loggedIn: true, tierState: 'attesa', email: 'da-confermare' }],
      ['codici-account-non-applicato', '/account', { loggedIn: true, tierState: 'missed' }],
    ]) {
      if (!want(name)) continue;
      await attempt(tag, name, async () => {
        const { ctx, page } = await openPage(vp, theme, opts, tag);
        try {
          await page.goto(`${base}${url}`, { waitUntil: 'domcontentloaded' });
          await page.getByRole('heading', { level: 1 }).first().waitFor();
          await snap(page, name, tag);
        } finally {
          await ctx.close();
        }
      });
    }
    for (const [name, codice] of [['codici-registrazione-errore', 'errore'], ['codici-registrazione-ok', 'ok']]) {
      if (!want(name)) continue;
      await attempt(tag, name, async () => {
        const { ctx, page } = await openPage(vp, theme, { loggedIn: false, codice }, tag);
        try {
          await page.goto(`${base}/register?code=PRIMAVERA-26`, { waitUntil: 'domcontentloaded' });
          await page.getByLabel(/^Username/).fill('atletanuovo');
          await page.getByLabel(/^Email/).fill('nuovo@example.com');
          await page.getByLabel(/^Password/).fill('Segreta!2026');
          await page.getByLabel(/^Conferma password/).fill('Segreta!2026');
          await page.getByRole('button', { name: 'Avanti' }).click();
          if (codice === 'ok') await page.getByText('Il tuo profilo').waitFor();
          else await page.getByText('Il codice di registrazione non è valido.').waitFor();
          await snap(page, name, tag);
        } finally {
          await ctx.close();
        }
      });
    }
    const codesCard = (page) => page.getByRole('heading', { name: 'Codici di registrazione' }).locator('xpath=ancestor::*[contains(@class,"MuiCard-root")][1]');
    for (const name of ['codici-admin-elenco', 'codici-admin-creazione', 'codici-admin-dettaglio']) {
      if (!want(name)) continue;
      await attempt(tag, name, async () => {
        const { ctx, page } = await openPage(vp, theme, { loggedIn: true, admin: true }, tag);
        try {
          await page.goto(`${base}/admin`, { waitUntil: 'domcontentloaded' });
          const card = codesCard(page);
          await card.waitFor();
          if (name === 'codici-admin-creazione') await page.getByRole('button', { name: 'Nuovo codice' }).click();
          if (name === 'codici-admin-dettaglio') await page.getByRole('button', { name: 'Apri il codice AMICI-90' }).click();
          await page.getByRole('heading', { name: 'Codici di registrazione' }).scrollIntoViewIfNeeded();
          await snap(page, name, tag, codesCard(page));
        } finally {
          await ctx.close();
        }
      });
    }

    // Barra nuova: ventaglio del bottone centrale (telefono) e menu «Inizia allenamento ▾» (desktop)
    const FANS = [
      ['barra-ventaglio-2', { loggedIn: true, modules: { body: false } }],
      ['barra-ventaglio-3', { loggedIn: true }],
      ['barra-ventaglio-riprendi', { loggedIn: true, draft: true }],
    ];
    for (const [name, opts] of FANS) {
      if (!want(name) || vp.w >= 900) continue;
      await attempt(tag, name, async () => {
        const { ctx, page } = await openPage(vp, theme, opts, tag);
        try {
          await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
          await page.getByRole('button', { name: 'Cosa vuoi fare' }).click();
          await page.getByRole('dialog', { name: 'Cosa vuoi fare' }).waitFor();
          await snap(page, name, tag);
        } finally {
          await ctx.close();
        }
      });
    }

    if (want('barra-desktop-menu') && vp.w >= 1440) {
      await attempt(tag, 'barra-desktop-menu', async () => {
        const { ctx, page } = await openPage(vp, theme, { loggedIn: true }, tag);
        try {
          await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
          await page.getByRole('button', { name: 'Altre azioni' }).click();
          await page.getByRole('menu').waitFor();
          await snap(page, 'barra-desktop-menu', tag);
        } finally {
          await ctx.close();
        }
      });
    }

    console.log(`ok ${tag}`);
  }
}

await browser.close();

console.log(`\nScreenshot salvati: ${shots} in ${outDir}`);
if (failures.length) {
  console.log(`\nPagine NON riuscite (${failures.length}):`);
  failures.forEach((f) => console.log(`  ${f}`));
}
if (problems.length) {
  console.log(`\nAvvisi (errori console, testo sospetto) (${problems.length}):`);
  problems.forEach((p) => console.log(`  ${p}`));
}
process.exitCode = failures.length ? 1 : 0;
