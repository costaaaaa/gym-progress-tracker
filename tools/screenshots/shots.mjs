// Screenshot full page di tutte le pagine principali con API finte e orologio fisso.
// Uso: node shots.mjs <cartella-output> [porta]
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

const CATALOG = [
  { id: 3, name: 'Panca piana', name_it: 'Panca piana', name_en: 'Bench press', muscle_group: 'petto' },
  { id: 4, name: 'Croci', name_it: 'Croci', name_en: 'Dumbbell fly', muscle_group: 'petto' },
  { id: 5, name: 'Trazioni', name_it: 'Trazioni', name_en: 'Pull-up', muscle_group: 'schiena' },
  { id: 6, name: 'Rematore con bilanciere', name_it: 'Rematore con bilanciere', name_en: 'Barbell row', muscle_group: 'schiena' },
  { id: 7, name: 'Squat', name_it: 'Squat', name_en: 'Squat', muscle_group: 'quadricipiti' },
  { id: 8, name: 'Stacco da terra', name_it: 'Stacco da terra', name_en: 'Deadlift', muscle_group: 'femorali' },
];

const set = (n, weight, reps) => ({ set_number: n, weight, reps: String(reps) });
const HISTORY = Array.from({ length: 12 }, (_, i) => ({
  id: 200 - i,
  date: isoDay(-(i * 3 + 1)),
  notes: '',
  exercises: [
    { exercise_id: 3, name: 'Panca piana', sets: [set(1, round(55 + i * 1.25), 8), set(2, round(60 + i * 1.25), 8), set(3, round(62.5 + i * 1.25), 6)] },
    { exercise_id: 6, name: 'Rematore con bilanciere', sets: [set(1, round(45 + i), 10), set(2, round(47.5 + i), 8)] },
    { exercise_id: 7, name: 'Squat', sets: [set(1, round(80 + i * 1.5), 5), set(2, round(85 + i * 1.5), 5)] },
  ],
}));

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
    weekly_volume: { total_weight: 4820, total_reps: 118 }, recovery,
  })],
  ['gamification/streak.php', () => ({ success: true, current_streak_weeks: 3, longest_streak_weeks: 5, this_week: { count: 2, goal: 3, completed: false } })],
  ['gamification/profile.php', () => ({
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
  })],
  ['exercise/read_all.php', () => ({ success: true, records: CATALOG })],
  ['user_stats/read.php', () => ({ success: true, records: BODY, consent_required: false, consent_updated: false })],
  ['groups/list.php', () => ({ success: true, groups: [
    { id: 1, name: 'Palestra Esempio', type: 'gym', members_count: 4, my_role: 'owner' },
    { id: 2, name: 'Amici del sabato', type: 'friends', members_count: 3, my_role: 'member' },
  ] })],
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

const SHOT_LIST = [
  ['landing', '/', { loggedIn: false }],
  ['home', '/', { loggedIn: true }],
  ['progressi', '/dashboard?tab=progress', { loggedIn: true }],
  ['misure', '/dashboard?tab=body', { loggedIn: true }],
  ['account', '/account', { loggedIn: true }],
  ['profilo', '/profilo', { loggedIn: true }],
  ['gruppi', '/gruppi', { loggedIn: true }],
  ['gruppo-dettaglio', '/gruppi/1', { loggedIn: true }],
  ['allenamenti-piani', '/workouts?tab=plans', { loggedIn: true }],
  ['allenamenti-cronologia', '/workouts?tab=history', { loggedIn: true }],
  ['admin', '/admin', { loggedIn: true, admin: true }],
];

for (const vp of viewports) {
  for (const theme of themes) {
    const tag = `${vp.w}_${theme}`;

    for (const [name, url, opts] of SHOT_LIST) {
      await attempt(tag, name, async () => {
        const { ctx, page } = await openPage(vp, theme, opts, tag);
        try {
          await page.goto(`${base}${url}`, { waitUntil: 'domcontentloaded' });
          await snap(page, name, tag);
        } finally {
          await ctx.close();
        }
      });
    }

    await attempt(tag, 'focus', async () => {
      const { ctx, page } = await openPage(vp, theme, { loggedIn: true }, tag);
      try {
        await page.goto(`${base}/focus`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'Inizia allenamento', exact: true }).waitFor();
        await snap(page, 'focus-scelta-giorno', tag);

        await page.getByRole('combobox').click();
        await page.getByRole('option', { name: 'Spinta', exact: true }).click();
        await page.getByRole('button', { name: 'Inizia allenamento', exact: true }).click();
        await page.getByRole('button', { name: 'Conferma serie', exact: true }).waitFor();
        await snap(page, 'focus-allenamento', tag);

        await page.getByLabel('Peso (kg)').fill('60');
        await page.getByLabel('Ripetizioni').fill('8');
        await page.getByRole('button', { name: 'Conferma serie', exact: true }).click();
        await page.getByText('Recupero', { exact: true }).waitFor();
        await snap(page, 'focus-recupero', tag);

        await page.getByRole('button', { name: 'Salta timer', exact: true }).click();
        for (let i = 0; i < 10 && !(await page.getByText('Riepilogo', { exact: true }).isVisible()); i++) {
          await page.getByRole('button', { name: 'Salta esercizio', exact: true }).click();
          await page.waitForTimeout(300);
        }
        await page.getByText('Riepilogo', { exact: true }).waitFor();
        await snap(page, 'focus-riepilogo', tag);
      } finally {
        await ctx.close();
      }
    });

    await attempt(tag, 'piani-editor', async () => {
      const { ctx, page } = await openPage(vp, theme, { loggedIn: true }, tag);
      try {
        await page.goto(`${base}/workouts?tab=plans`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'Mostra dettagli' }).first().click();
        await page.getByRole('button', { name: 'Dettagli', exact: true }).first().click();
        await page.getByRole('button', { name: 'Dettagli', exact: true }).first().click();
        await page.getByText('Trazioni').first().waitFor();
        await snap(page, 'allenamenti-piani-giorni', tag);

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
        await snapDialog('allenamenti-piani-aggiungi-compatto');

        await page.getByLabel('Serie diverse').check();
        await page.getByRole('group', { name: 'Serie 1' }).getByRole('textbox').fill('12');
        await page.getByRole('group', { name: 'Serie 2' }).getByRole('textbox').fill('10');
        const last = page.getByRole('group', { name: 'Serie 3' });
        await last.getByRole('checkbox', { name: 'A cedimento' }).check();
        await last.getByRole('textbox').fill('6');
        await snapDialog('allenamenti-piani-aggiungi-lista');
        await page.getByRole('button', { name: 'Annulla' }).click();
        await page.getByRole('dialog').waitFor({ state: 'detached' });

        // Trazioni ha serie diverse: la modifica si apre già per serie
        await page.getByRole('button', { name: 'Modifica esercizio' }).nth(2).click();
        await page.getByRole('group', { name: 'Serie 3' }).waitFor();
        await snapDialog('allenamenti-piani-modifica-lista');
      } finally {
        await ctx.close();
      }
    });

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
