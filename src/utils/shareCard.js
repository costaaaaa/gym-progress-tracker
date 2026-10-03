// ============================================================================
// Card da condividere dopo un allenamento (storia 1080×1920).
// Funzioni pure, senza React: statistiche, testi e posizione di ogni elemento.
// Il web le disegna su <canvas> (renderShareCard.js), il mobile con
// react-native-svg (ShareCardSvg.jsx): la grafica è definita solo qui.
// Copia identica in gym-progress-tracker-mobile/src/domain/shareCard.js.
// ============================================================================

import { extractReps, summarizeSets, buildExerciseHistoryIndex, detectPersonalRecords } from './workoutMetrics';

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;

const MARGIN = 90;
const CONTENT_WIDTH = CARD_WIDTH - 2 * MARGIN;

const DAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio',
  'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

// "2026-10-02 18:30:00" (MySQL) non è ISO: Safari e Hermes non lo leggono senza la "T".
export const toDate = (value) => {
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value.replace(' ', 'T'));
  return new Date(value);
};

export const formatDateLabel = (value) => {
  const d = toDate(value);
  if (isNaN(d)) return '';
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

// 12450 → "12.450" (separatore delle migliaia italiano, senza dipendere da Intl)
export const formatThousands = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined || seconds <= 0) return null;
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

export const totalReps = (sets) => {
  if (!Array.isArray(sets)) return 0;
  return sets.reduce((sum, set) => sum + extractReps(set.reps), 0);
};

// Dal più pesante al più leggero: si usa il primo che il volume supera almeno una volta.
const EQUIVALENTS = [
  { kg: 150000, one: 'balenottera azzurra', many: 'balenottere azzurre' },
  { kg: 6000, one: 'elefante africano', many: 'elefanti africani' },
  { kg: 1200, one: 'auto utilitaria', many: 'auto utilitarie' },
  { kg: 500, one: 'pianoforte a coda', many: 'pianoforti a coda' },
  { kg: 70, one: 'lavatrice', many: 'lavatrici' },
];

export const volumeEquivalent = (kg) => {
  const item = EQUIVALENTS.find((e) => kg >= e.kg);
  if (!item) return null;
  const ratio = kg / item.kg;
  const count = ratio < 10 ? Math.round(ratio * 10) / 10 : Math.round(ratio);
  const label = count === 1 ? item.one : item.many;
  return `Come sollevare ${String(count).replace('.', ',')} ${label}`;
};

/**
 * I due gruppi muscolari con più serie, es. "Petto · Tricipiti". Titolo della card
 * per gli allenamenti della cronologia, che non ricordano piano e giorno.
 */
export const muscleGroupsTitle = (exercises) => {
  const counts = {};
  (exercises || []).forEach((ex) => {
    if (!ex.muscle_group) return;
    counts[ex.muscle_group] = (counts[ex.muscle_group] || 0) + (ex.sets?.length || 0);
  });
  return Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, 2)
    .map((g) => g.charAt(0).toUpperCase() + g.slice(1))
    .join(' · ');
};

/**
 * Esercizi con un record battuto in un allenamento della cronologia, confrontando
 * solo gli allenamenti precedenti (come fa il riepilogo a fine sessione).
 */
export const historyPrNames = (records, workout) => {
  const t = toDate(workout.date).getTime();
  const older = (records || []).filter((r) => {
    if (r.id === workout.id) return false;
    const rt = toDate(r.date).getTime();
    return rt < t || (rt === t && Number(r.id) < Number(workout.id));
  });
  const index = buildExerciseHistoryIndex(older);
  return (workout.exercises || [])
    .filter((ex) => ex.sets?.length && detectPersonalRecords(ex.sets, index[ex.exercise_id]).isPR)
    .map((ex) => ex.name);
};

/**
 * exercises: [{ sets: [{ weight, reps }] }]. Ritorna i numeri e i testi della card.
 */
export const buildShareStats = ({ exercises, date, durationSec, title, prNames, streakWeeks }) => {
  const done = (exercises || []).filter((ex) => ex.sets?.length);
  let volume = 0;
  let reps = 0;
  let sets = 0;
  done.forEach((ex) => {
    volume += summarizeSets(ex.sets).sessionVolume;
    reps += totalReps(ex.sets);
    sets += ex.sets.length;
  });
  return {
    volumeKg: Math.round(volume),
    reps,
    sets,
    exercises: done.length,
    durationSec: durationSec > 0 ? durationSec : null,
    prNames: prNames || [],
    streakWeeks: streakWeeks || 0,
    dateLabel: formatDateLabel(date || new Date()),
    title: title || '',
  };
};

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export const TEMPLATES = [
  { id: 'scuro', label: 'Scuro' },
  { id: 'rosso', label: 'Rosso' },
  { id: 'foto', label: 'Foto' },
];

const THEMES = {
  scuro: {
    background: { gradient: { x0: 0, y0: 0, x1: 0, y1: CARD_HEIGHT, stops: [[0, '#2a0606'], [0.45, '#0a0a0b'], [1, '#0a0a0b']] } },
    text: '#ffffff', muted: '#a1a1aa', accent: '#ff3d3d', big: '#ff3d3d', tile: 'rgba(255,255,255,0.07)', mark: '#d50000',
  },
  rosso: {
    background: { gradient: { x0: 0, y0: 0, x1: CARD_WIDTH, y1: CARD_HEIGHT, stops: [[0, '#ff5131'], [0.55, '#d50000'], [1, '#7a0000']] } },
    text: '#ffffff', muted: 'rgba(255,255,255,0.78)', accent: '#ffe0b2', big: '#ffffff', tile: 'rgba(0,0,0,0.2)', mark: '#ffffff',
  },
  foto: {
    background: { gradient: { x0: 0, y0: 0, x1: 0, y1: CARD_HEIGHT, stops: [[0, '#3a3a3f'], [1, '#0a0a0b']] } },
    text: '#ffffff', muted: 'rgba(255,255,255,0.8)', accent: '#ff5131', big: '#ffffff', tile: 'rgba(0,0,0,0.45)', mark: '#d50000',
  },
};

// Senza misurare il testo: larghezza media di un carattere in em, per eccesso. Lexend in
// grassetto: ~0,62 per cifre e maiuscole, ~0,52 per il testo normale.
const charEm = (value) => (/[a-z]/.test(value) ? 0.52 : 0.62);

// Dimensione del font perché il testo stia in maxWidth; sotto minSize il testo si tronca.
const fit = (text, maxWidth, size, minSize = size * 0.6) => {
  const em = charEm(text);
  const s = Math.min(size, maxWidth / (Math.max(text.length, 1) * em));
  if (s >= minSize) return { text, size: Math.floor(s) };
  const maxChars = Math.max(1, Math.floor(maxWidth / (minSize * em)) - 1);
  return { text: `${text.slice(0, maxChars).trimEnd()}…`, size: Math.floor(minSize) };
};

const text = (x, y, value, size, color, opts = {}) => ({
  type: 'text', x, y, text: value, size, color,
  weight: opts.weight || 700, align: opts.align || 'left', letterSpacing: opts.letterSpacing || 0,
});

const tilesFor = (stats) => {
  const tiles = [
    { value: formatThousands(stats.reps), label: 'RIPETIZIONI' },
    { value: String(stats.sets), label: 'SERIE' },
    { value: String(stats.exercises), label: 'ESERCIZI' },
  ];
  const duration = formatDuration(stats.durationSec);
  if (duration) tiles.push({ value: duration, label: 'DURATA' });
  return tiles;
};

// Griglia di riquadri a partire da y; ritorna gli elementi e la y sotto la griglia.
const tileGrid = (tiles, y, theme, { columns, height, valueSize, labelSize }) => {
  const gap = 30;
  const w = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
  const elements = [];
  tiles.forEach((tile, i) => {
    const x = MARGIN + (i % columns) * (w + gap);
    const ty = y + Math.floor(i / columns) * (height + gap);
    const value = fit(tile.value, w - 40, valueSize);
    elements.push({ type: 'rect', x, y: ty, w, h: height, r: 28, fill: theme.tile });
    elements.push(text(x + w / 2, ty + height * 0.55, value.text, value.size, theme.text, { weight: 800, align: 'center' }));
    elements.push(text(x + w / 2, ty + height * 0.82, tile.label, labelSize, theme.muted, { weight: 600, align: 'center', letterSpacing: 3 }));
  });
  const rows = Math.ceil(tiles.length / columns);
  return { elements, bottom: y + rows * height + (rows - 1) * gap };
};

const prLine = (names) => {
  if (!names.length) return null;
  const shown = names.slice(0, 2).join(' · ');
  return names.length > 2 ? `${shown} +${names.length - 2}` : shown;
};

const streakLine = (weeks) => (weeks > 0 ? `${weeks} ${weeks === 1 ? 'settimana' : 'settimane'} di fila` : null);

const header = (theme) => [
  { type: 'rect', x: MARGIN, y: 228, w: 14, h: 58, r: 4, fill: theme.mark },
  text(MARGIN + 34, 276, 'LIFTINDEX', 46, theme.text, { weight: 800, letterSpacing: 6 }),
];

const footer = (theme) => text(CARD_WIDTH / 2, 1830, 'liftindex.app', 32, theme.muted, { weight: 500, align: 'center', letterSpacing: 2 });

// Scuro e Rosso: la card intera è dedicata ai numeri.
const fullLayout = (stats, theme) => {
  const el = [...header(theme)];
  el.push(text(MARGIN, 400, stats.dateLabel.toUpperCase(), 34, theme.muted, { weight: 600, letterSpacing: 3 }));
  if (stats.title) {
    const t = fit(stats.title, CONTENT_WIDTH, 64, 46);
    el.push(text(MARGIN, 480, t.text, t.size, theme.text, { weight: 800 }));
  }

  el.push(text(MARGIN, 640, 'VOLUME TOTALE', 34, theme.muted, { weight: 600, letterSpacing: 4 }));
  const big = fit(formatThousands(stats.volumeKg), CONTENT_WIDTH, 250);
  el.push(text(MARGIN - 6, 640 + 40 + big.size * 0.78, big.text, big.size, theme.big, { weight: 800 }));
  let y = 640 + 40 + big.size * 0.78 + 80;
  el.push(text(MARGIN, y, 'kg sollevati', 52, theme.text, { weight: 700 }));
  const equivalent = volumeEquivalent(stats.volumeKg);
  if (equivalent) {
    const eq = fit(equivalent, CONTENT_WIDTH, 38, 30);
    el.push(text(MARGIN, y + 64, eq.text, eq.size, theme.muted, { weight: 500 }));
  }

  const tiles = tilesFor(stats);
  const grid = tileGrid(tiles, y + 140, theme, tiles.length === 4
    ? { columns: 2, height: 190, valueSize: 84, labelSize: 28 }
    : { columns: 3, height: 210, valueSize: 76, labelSize: 26 });
  el.push(...grid.elements);

  y = grid.bottom + 90;
  const pr = prLine(stats.prNames);
  if (pr) {
    el.push(text(MARGIN, y, 'NUOVI RECORD', 30, theme.accent, { weight: 700, letterSpacing: 4 }));
    const p = fit(pr, CONTENT_WIDTH, 44, 34);
    el.push(text(MARGIN, y + 58, p.text, p.size, theme.text, { weight: 700 }));
    y += 130;
  }
  const streak = streakLine(stats.streakWeeks);
  if (streak && y < 1760) el.push(text(MARGIN, y, streak.toUpperCase(), 32, theme.accent, { weight: 700, letterSpacing: 3 }));

  el.push(footer(theme));
  return el;
};

// Foto: la foto resta visibile in alto, i numeri stanno nella parte bassa su una sfumatura scura.
const photoLayout = (stats, theme, hasPhoto) => {
  const el = [];
  if (hasPhoto) {
    el.push({ type: 'photo', x: 0, y: 0, w: CARD_WIDTH, h: CARD_HEIGHT });
    el.push({ type: 'rect', x: 0, y: 0, w: CARD_WIDTH, h: 520, fill: { gradient: { x0: 0, y0: 0, x1: 0, y1: 520, stops: [[0, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']] } } });
    el.push({ type: 'rect', x: 0, y: 560, w: CARD_WIDTH, h: CARD_HEIGHT - 560, fill: { gradient: { x0: 0, y0: 560, x1: 0, y1: CARD_HEIGHT, stops: [[0, 'rgba(0,0,0,0)'], [0.25, 'rgba(0,0,0,0.72)'], [1, 'rgba(0,0,0,0.94)']] } } });
  }
  el.push(...header(theme));

  const tiles = tilesFor(stats);
  const pr = prLine(stats.prNames);
  const streak = streakLine(stats.streakWeeks);
  const extraLines = (pr ? 1 : 0) + (streak ? 1 : 0);
  // Il blocco cresce verso l'alto: più righe sotto, più in alto parte.
  let y = 980 - extraLines * 60;

  el.push(text(MARGIN, y, stats.dateLabel.toUpperCase(), 32, theme.muted, { weight: 600, letterSpacing: 3 }));
  if (stats.title) {
    const t = fit(stats.title, CONTENT_WIDTH, 54, 40);
    el.push(text(MARGIN, y + 66, t.text, t.size, theme.text, { weight: 800 }));
  }
  y += 140;
  el.push(text(MARGIN, y, 'VOLUME TOTALE', 30, theme.muted, { weight: 600, letterSpacing: 4 }));
  const big = fit(formatThousands(stats.volumeKg), CONTENT_WIDTH, 200);
  y += 26 + big.size * 0.78;
  el.push(text(MARGIN - 4, y, big.text, big.size, theme.big, { weight: 800 }));
  y += 70;
  el.push(text(MARGIN, y, 'kg sollevati', 46, theme.text, { weight: 700 }));
  const equivalent = volumeEquivalent(stats.volumeKg);
  if (equivalent) {
    const eq = fit(equivalent, CONTENT_WIDTH, 36, 28);
    el.push(text(MARGIN, y + 56, eq.text, eq.size, theme.muted, { weight: 500 }));
  }

  const grid = tileGrid(tiles, y + 100, theme, { columns: tiles.length, height: 170, valueSize: tiles.length === 4 ? 58 : 66, labelSize: 22 });
  el.push(...grid.elements);

  y = grid.bottom + 70;
  if (pr) {
    const p = fit(`Record: ${pr}`, CONTENT_WIDTH, 40, 30);
    el.push(text(MARGIN, y, p.text, p.size, theme.text, { weight: 700 }));
    y += 60;
  }
  if (streak) el.push(text(MARGIN, y, streak.toUpperCase(), 30, theme.accent, { weight: 700, letterSpacing: 3 }));

  el.push(footer(theme));
  return el;
};

/**
 * Elementi della card, in ordine di disegno. Coordinate in px su 1080×1920.
 *   rect:  { x, y, w, h, r?, fill }   fill = colore | { gradient: { x0, y0, x1, y1, stops: [[offset, colore]] } }
 *   text:  { x, y (linea di base), text, size, weight, color, align: left|center|right, letterSpacing }
 *   photo: { x, y, w, h }              la foto dell'utente, ritagliata per riempire (cover)
 */
export const layoutShareCard = (stats, templateId, { hasPhoto = false } = {}) => {
  const theme = THEMES[templateId] || THEMES.scuro;
  const elements = [{ type: 'rect', x: 0, y: 0, w: CARD_WIDTH, h: CARD_HEIGHT, fill: theme.background }];
  if (templateId === 'foto') elements.push(...photoLayout(stats, theme, hasPhoto));
  else elements.push(...fullLayout(stats, theme));
  return { width: CARD_WIDTH, height: CARD_HEIGHT, elements };
};
