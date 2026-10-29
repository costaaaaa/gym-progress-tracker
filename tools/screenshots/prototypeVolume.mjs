// PROTOTIPO volume (branch usa e getta): riquadro della Home (A|B) e vista Volume (A|B|C).
// Uso: node prototypeVolume.mjs <cartella-output> [porta]  (build con VITE_PROTOTYPE=1)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , outName = 'before', port = '4181'] = process.argv;
const base = `http://localhost:${port}`;
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), outName);
mkdirSync(outDir, { recursive: true });

const NOW = Date.parse('2026-10-23T10:00:00+02:00');
const DAY = 86400000;
const isoDay = (offset) => new Date(NOW + offset * DAY).toISOString().slice(0, 10);
const stamp = (offset, time) => `${isoDay(offset)} ${time}`;
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

const exercise = (id, exercise_id, exercise_name, reps, muscle_group) =>
  ({ id, exercise_id, exercise_name, sets: 3, reps, rest: 90, muscle_group });
const plan = {
  id: 5, name: 'Push Pull', description: 'Spinta e trazione, tre allenamenti a settimana', is_active: true,
  days: [
    { id: 1, name: 'Spinta', exercises: [exercise(9, 3, 'Panca piana', '8-10', 'petto'), exercise(10, 4, 'Croci', '12', 'petto')] },
    { id: 2, name: 'Trazione', exercises: [exercise(11, 5, 'Trazioni', '6-8', 'schiena'), exercise(12, 6, 'Rematore con bilanciere', '8-10', 'schiena')] },
  ],
};
const planInactive = {
  id: 6, name: 'Gambe e core', description: 'Blocco di forza sulle gambe', is_active: false,
  days: [{ id: 3, name: 'Gambe', exercises: [exercise(13, 7, 'Squat', '5', 'quadricipiti'), exercise(14, 8, 'Stacco da terra', '5', 'femorali')] }],
};

const CATALOG = [
  { id: 3, name: 'Panca piana', name_it: 'Panca piana', name_en: 'Bench press', muscle_group: 'petto' },
  { id: 4, name: 'Croci', name_it: 'Croci', name_en: 'Dumbbell fly', muscle_group: 'petto' },
  { id: 9, name: 'Panca inclinata con manubri', name_it: 'Panca inclinata con manubri', name_en: 'Incline dumbbell press', muscle_group: 'petto' },
  { id: 10, name: 'Dip alle parallele', name_it: 'Dip alle parallele', name_en: 'Dips', muscle_group: 'petto' },
  { id: 5, name: 'Trazioni', name_it: 'Trazioni', name_en: 'Pull-up', muscle_group: 'schiena' },
  { id: 6, name: 'Rematore con bilanciere', name_it: 'Rematore con bilanciere', name_en: 'Barbell row', muscle_group: 'schiena' },
  { id: 11, name: 'Lat machine', name_it: 'Lat machine', name_en: 'Lat pulldown', muscle_group: 'schiena' },
  { id: 7, name: 'Squat', name_it: 'Squat', name_en: 'Squat', muscle_group: 'quadricipiti' },
  { id: 12, name: 'Leg press', name_it: 'Leg press', name_en: 'Leg press', muscle_group: 'quadricipiti' },
  { id: 8, name: 'Stacco da terra', name_it: 'Stacco da terra', name_en: 'Deadlift', muscle_group: 'femorali' },
  { id: 13, name: 'Leg curl', name_it: 'Leg curl', name_en: 'Leg curl', muscle_group: 'femorali' },
  { id: 14, name: 'Military press', name_it: 'Military press', name_en: 'Overhead press', muscle_group: 'spalle' },
  { id: 15, name: 'Alzate laterali', name_it: 'Alzate laterali', name_en: 'Lateral raise', muscle_group: 'spalle' },
];

const set = (n, weight, reps) => ({ set_number: n, weight, reps: String(reps) });
const ex = (id, sets) => ({ exercise_id: id, name: CATALOG.find((c) => c.id === id).name, sets });
// 24 allenamenti a giorni alterni, a rotazione spinta / trazione / gambe (i = 0 il più vecchio):
// andamenti misti su, giù, fermo; alzate laterali solo nell'ultima spinta (nuovo), leg curl fermo da 80 giorni (inattivo)
const DAYS = ['push', 'pull', 'legs'];
const HISTORY = Array.from({ length: 24 }, (_, k) => {
  const day = DAYS[k % 3];
  const i = 7 - Math.floor(k / 3);
  const exercises = {
    push: [
      ex(3, [set(1, round(60 + i * 2.4), 8), set(2, round(62.5 + i * 2.4), 6)]),
      ex(4, [set(1, 14, 12), set(2, 14, 12)]),
      ex(9, [set(1, round(30 - i * 0.7), 10)]),
      ex(10, [set(1, 0, 8 + Math.floor(i / 2)), set(2, 0, 7)]),
      ex(14, [set(1, 40, 8), set(2, 40, 7)]),
      ...(k === 0 ? [ex(15, [set(1, 10, 12), set(2, 10, 12)])] : []),
    ],
    pull: [
      ex(5, [set(1, 0, 6 + Math.floor(i / 2)), set(2, 0, 5)]),
      ex(6, [set(1, round(50 + i * 1.3), 10), set(2, round(52.5 + i * 1.3), 8)]),
      ex(11, [set(1, 55, 10), set(2, 55, 10)]),
    ],
    legs: [
      ex(7, [set(1, round(90 + i * 3), 5), set(2, round(92.5 + i * 3), 5)]),
      ex(12, [set(1, round(180 - i * 3.5), 10)]),
      ex(8, [set(1, 120, 5), set(2, i % 2 ? 122.5 : 120, 5)]),
    ],
  }[day];
  return { id: 200 - k, date: isoDay(-(k * 2 + 1)), notes: '', exercises };
}).concat([80, 86, 92].map((d, j) => ({ id: 100 - j, date: isoDay(-d), notes: '', exercises: [ex(13, [set(1, 40 + j, 12)])] })));

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
  bicipiti: { status: 'PRONTO', ready_at: null },
  tricipiti: { status: 'PRONTO', ready_at: null },
  addome: { status: 'PRONTO', ready_at: null },
  adduttori: { status: 'PRONTO', ready_at: null },
  polpacci: { status: 'PRONTO', ready_at: null },
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

const user = ({ admin }) => ({
  success: true, id: 1, username: 'atleta_demo', email: 'atleta@example.com',
  created_at: stamp(-900, '10:00:00'), password_changed_at: stamp(-140, '09:00:00'),
  age: 34, gender: 'm', experience_years: 4, birth_date: '1992-05-14', training_start_date: '2022-01-10',
  rest_timer_enabled: true, locale: 'it', language: 'it', features: [], is_admin: admin,
});

const fixtures = [
  ['user/read.php', user],
  ['user/consent.php', () => ({ success: true, consents: { terms: { granted: true }, health_data: { granted: true } } })],
  ['workout_history/read.php', () => ({ success: true, records: HISTORY })],
  ['workout/read_plans.php', () => ({ success: true, records: [plan, planInactive] })],
  ['workout_stats/dashboard.php', () => ({
    success: true, weekly_workouts: 2, weekly_goal: 3,
    weekly_volume: { total_weight: 4820, total_reps: 418 }, recovery,
    weekly_sets: {
      week: { petto: 12, schiena: 10, spalle: 6, bicipiti: 4, tricipiti: 3, addome: 0, quadricipiti: 8, femorali: 5, glutei: 3, adduttori: 2, abduttori: 0, polpacci: 0 },
      // Q16: settimana scorsa fino allo stesso giorno (somma 48) + totale intero solo come riferimento
      previous_to_date: { petto: 8, schiena: 8, spalle: 4, bicipiti: 4, tricipiti: 3, addome: 3, quadricipiti: 9, femorali: 4, glutei: 3, adduttori: 0, abduttori: 0, polpacci: 2 },
      previous_total: 61,
    },
  })],
  ['gamification/streak.php', () => ({ success: true, current_streak_weeks: 3, longest_streak_weeks: 5, this_week: { count: 2, goal: 3, completed: false } })],
  ['gamification/profile.php', () => ({
    success: true, level: 7, total_xp: 3140, xp_into_level: 340, xp_for_next_level: 600,
    lifetime_volume_kg: 184250, total_sessions: 58, longest_streak: 5,
    exercises: [
      { exercise_id: 3, name: 'Panca piana', level: 6, xp: 820 },
      { exercise_id: 6, name: 'Rematore con bilanciere', level: 5, xp: 610 },
      { exercise_id: 7, name: 'Squat', level: 4, xp: 430 },
      { exercise_id: 8, name: 'Stacco da terra', level: 4, xp: 395 },
    ],
    achievements: [
      { key: 'sessions_10', category: 'sessions', label: 'Prime 10 sessioni', threshold: 10, unlocked_at: stamp(-230, '18:00:00'), locked: false },
      { key: 'sessions_50', category: 'sessions', label: '50 sessioni', threshold: 50, unlocked_at: stamp(-21, '18:00:00'), locked: false },
      { key: 'sessions_100', category: 'sessions', label: 'Centurione', threshold: 100, unlocked_at: null, locked: true },
      { key: 'sessions_250', category: 'sessions', label: '250 sessioni', threshold: 250, unlocked_at: null, locked: true },
      { key: 'tonnage_auto', category: 'tonnage', label: '1,5 t — automobile', threshold: 1500, unlocked_at: stamp(-260, '18:00:00'), locked: false },
      { key: 'tonnage_elephant', category: 'tonnage', label: '6 t — elefante', threshold: 6000, unlocked_at: stamp(-245, '18:00:00'), locked: false },
      { key: 'tonnage_bus', category: 'tonnage', label: '15 t — autobus', threshold: 15000, unlocked_at: stamp(-225, '18:00:00'), locked: false },
      { key: 'tonnage_tank', category: 'tonnage', label: '60 t — carro armato', threshold: 60000, unlocked_at: stamp(-160, '18:00:00'), locked: false },
      { key: 'tonnage_whale', category: 'tonnage', label: '150 t — balenottera azzurra', threshold: 150000, unlocked_at: stamp(-40, '18:00:00'), locked: false },
      { key: 'tonnage_iss', category: 'tonnage', label: '420 t — Stazione Spaziale', threshold: 420000, unlocked_at: null, locked: true },
      { key: 'tonnage_shuttle', category: 'tonnage', label: '2.000 t — Space Shuttle', threshold: 2000000, unlocked_at: null, locked: true },
      { key: 'tonnage_eiffel', category: 'tonnage', label: '7.300 t — Torre Eiffel', threshold: 7300000, unlocked_at: null, locked: true },
      { key: 'streak_4', category: 'streak', label: '4 settimane consecutive', threshold: 4, unlocked_at: stamp(-95, '18:00:00'), locked: false },
      { key: 'streak_8', category: 'streak', label: '8 settimane consecutive', threshold: 8, unlocked_at: null, locked: true },
      { key: 'streak_12', category: 'streak', label: '12 settimane consecutive', threshold: 12, unlocked_at: null, locked: true },
      { key: 'streak_24', category: 'streak', label: '24 settimane consecutive', threshold: 24, unlocked_at: null, locked: true },
    ],
  })],
  ['exercise/read_all.php', () => ({ success: true, records: CATALOG })],
  ['user_stats/read.php', () => ({ success: true, records: BODY, consent_required: false, consent_updated: false })],
  ['groups/list.php', () => ({ success: true, groups: [
    { id: 1, name: 'Palestra Esempio', type: 'open', members_count: 4, my_role: 'owner' },
    { id: 2, name: 'Amici del sabato', type: 'open', members_count: 3, my_role: 'member' },
  ] })],
  ['groups/read.php', () => ({
    success: true,
    group: { id: 1, name: 'Palestra Esempio', type: 'open', invite_code: 'ESEMPIO7', invite_enabled: true, members_count: 4, max_members: 30, my_role: 'owner', name_locked: false, name_locked_until: null },
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

async function snap(page, name, tag) {
  await freeze(page);
  const text = await page.innerText('body');
  const suspicious = text.match(/pagina non trovata|impossibile caricare|errore nel caricamento|Errore/i);
  if (suspicious) problems.push(`[${tag}] ${name}: testo sospetto "${suspicious[0]}"`);
  await page.screenshot({ path: path.join(outDir, `${name}_${tag}.png`), fullPage: true, animations: 'disabled', caret: 'hide' });
  shots++;
}

async function attempt(tag, name, fn) {
  try {
    await fn();
  } catch (err) {
    failures.push(`[${tag}] ${name}: ${err.message.split('\n')[0]}`);
  }
}

const viewports = [{ w: 390, h: 844 }, { w: 1440, h: 900 }];
const themes = ['light', 'dark'];

async function openPage(vp, theme, opts, tag) {
  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, reducedMotion: 'reduce',
    colorScheme: theme, locale: 'it-IT', timezoneId: 'Europe/Rome',
  });
  await ctx.clock.setFixedTime(NOW);
  await ctx.addInitScript(({ mode, loggedIn }) => {
    localStorage.setItem('themeMode', mode);
    localStorage.setItem('lx_locale', 'it');
    localStorage.setItem('lx_lang_choice', 'it');
    localStorage.removeItem('gym_focus_workout_draft');
    localStorage.setItem('liftindex.progress.favorites', JSON.stringify(['3', '7']));
    if (loggedIn) {
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('user', JSON.stringify({ id: 1, username: 'atleta_demo' }));
    } else {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('user');
    }
  }, { mode: theme, loggedIn: opts.loggedIn });
  await ctx.route('**/backend/**', (route) => {
    const url = route.request().url();
    const hit = fixtures.find(([key]) => url.includes(key));
    const body = hit ? hit[1]({ admin: opts.admin === true }) : fallback;
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (err) => problems.push(`[${tag}] ${page.url()} pageerror: ${err.message}`));
  page.on('console', (msg) => { if (msg.type() === 'error') problems.push(`[${tag}] ${page.url()} console: ${msg.text()}`); });
  return { ctx, page };
}


// nasconde la barra delle varianti: la variante è nel nome del file
const HIDE_SWITCHER = '[data-prototype-switcher]{display:none!important}';
// [nome, url, testo da cui parte il ritaglio (null = dall'alto), varianti]
const SHOTS = [
  ['home', '/', 'Riepilogo settimanale', ['P2']],
  ['place', '/dashboard?tab=volume', null, ['P1']],
  ['place', '/dashboard?tab=muscles', null, ['P2']],
  ['place', '/dashboard?tab=progress', null, ['P3']],
];
const CASES = [{ w: 390, h: 844, theme: 'light' }, { w: 390, h: 844, theme: 'dark' }, { w: 1440, h: 900, theme: 'light' }];

for (const c of CASES) {
  const tag = `${c.w}_${c.theme}`;
  for (const [name, url, anchor, vs] of SHOTS) {
    for (const v of vs) {
      await attempt(tag, `${name}-${v}`, async () => {
        const { ctx, page } = await openPage({ w: c.w, h: c.h }, c.theme, { loggedIn: true }, tag);
        try {
          await page.goto(`${base}${url}${url.includes('?') ? '&' : '?'}variant=${v}`, { waitUntil: 'domcontentloaded' });
          await page.addStyleTag({ content: HIDE_SWITCHER }).catch(() => {});
          await freeze(page);
          // barra in basso fissa: nello screenshot full page finirebbe a metà pagina
          await page.evaluate(() => document.querySelectorAll('nav').forEach((n) => { if (getComputedStyle(n).position === 'fixed') n.style.display = 'none'; }));
          await snap(page, `${name}-${v}`, tag);
          // ritaglio JPEG della parte che cambia, per il documento
          const box = anchor ? await page.getByText(anchor).first().boundingBox() : { y: 16 };
          const full = await page.evaluate(() => document.documentElement.scrollHeight);
          const y = Math.max(0, Math.floor(box.y) - 16);
          await page.screenshot({ path: path.join(outDir, `${name}-${v}_${tag}.jpg`), type: 'jpeg', quality: 62, fullPage: true,
            clip: { x: 0, y, width: c.w, height: Math.min(full - y, name === 'home' ? 900 : (c.w === 390 ? 1500 : 1100)) } });
        } finally {
          await ctx.close();
        }
      });
    }
  }
}

await browser.close();
console.log(`${shots} screenshot in ${outDir}`);
if (failures.length) console.log(`NON RIUSCITE:\n${failures.join('\n')}`);
if (problems.length) console.log(`AVVISI:\n${problems.join('\n')}`);
