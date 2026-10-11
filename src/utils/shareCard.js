// ============================================================================
// Card da condividere dopo un allenamento (storia 1080×1920).
// Funzioni pure, senza React: statistiche, testi e posizione di ogni elemento.
// Il web le disegna su <canvas> (renderShareCard.js), il mobile con
// react-native-svg (ShareCardSvg.jsx): la grafica è definita solo qui.
// Copia identica in gym-progress-tracker-mobile/src/domain/shareCard.js.
// ============================================================================

import { extractReps, summarizeSets, buildExerciseHistoryIndex, detectPersonalRecords } from './workoutMetrics';

// Formato della card: dimensioni in px. Per ora solo la storia.
export const FORMAT_STORIA = { id: 'storia', width: 1080, height: 1920 };

export const CARD_WIDTH = FORMAT_STORIA.width;
export const CARD_HEIGHT = FORMAT_STORIA.height;

const MARGIN = 90;

// Tutti i testi della card. Chi disegna la card in un'altra lingua passa un oggetto con le
// stesse chiavi; {nome} è un segnaposto sostituito da fill().
export const STRINGS_IT = {
  days: ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'],
  months: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio',
    'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
  date: '{weekday} {day} {month}',
  thousands: '.',
  decimal: ',',
  minutes: '{m} min',
  hours: '{h}h {m}m',
  equivalentLine: 'Come sollevare {count} {item}',
  equivalents: {
    balena: ['balenottera azzurra', 'balenottere azzurre'],
    elefante: ['elefante africano', 'elefanti africani'],
    auto: ['auto utilitaria', 'auto utilitarie'],
    pianoforte: ['pianoforte a coda', 'pianoforti a coda'],
    lavatrice: ['lavatrice', 'lavatrici'],
  },
  reps: 'RIPETIZIONI',
  sets: 'SERIE',
  exercises: 'ESERCIZI',
  duration: 'DURATA',
  totalVolume: 'VOLUME TOTALE',
  kgLifted: 'kg sollevati',
  newRecords: 'NUOVI RECORD',
  recordLine: 'Record: {names}',
  streakOne: '{n} settimana di fila',
  streakMany: '{n} settimane di fila',
};

const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => values[key]);

// "2026-10-02 18:30:00" (MySQL) non è ISO: Safari e Hermes non lo leggono senza la "T".
export const toDate = (value) => {
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value.replace(' ', 'T'));
  return new Date(value);
};

export const formatDateLabel = (value, strings = STRINGS_IT) => {
  const d = toDate(value);
  if (isNaN(d)) return '';
  return fill(strings.date, { weekday: strings.days[d.getDay()], day: d.getDate(), month: strings.months[d.getMonth()] });
};

// 12450 → "12.450" (separatore delle migliaia della lingua, senza dipendere da Intl)
export const formatThousands = (n, strings = STRINGS_IT) =>
  String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, strings.thousands);

export const formatDuration = (seconds, strings = STRINGS_IT) => {
  if (seconds === null || seconds === undefined || seconds <= 0) return null;
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return fill(strings.minutes, { m: totalMinutes });
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return fill(strings.hours, { h, m: String(m).padStart(2, '0') });
};

export const totalReps = (sets) => {
  if (!Array.isArray(sets)) return 0;
  return sets.reduce((sum, set) => sum + extractReps(set.reps), 0);
};

// Dal più pesante al più leggero: si usa il primo che il volume supera almeno una volta.
// I nomi (singolare, plurale) stanno in strings.equivalents.
const EQUIVALENTS = [
  { id: 'balena', kg: 150000 },
  { id: 'elefante', kg: 6000 },
  { id: 'auto', kg: 1200 },
  { id: 'pianoforte', kg: 500 },
  { id: 'lavatrice', kg: 70 },
];

export const volumeEquivalent = (kg, strings = STRINGS_IT) => {
  const item = EQUIVALENTS.find((e) => kg >= e.kg);
  if (!item) return null;
  const ratio = kg / item.kg;
  const count = ratio < 10 ? Math.round(ratio * 10) / 10 : Math.round(ratio);
  const [one, many] = strings.equivalents[item.id];
  return fill(strings.equivalentLine, {
    count: String(count).replace('.', strings.decimal),
    item: count === 1 ? one : many,
  });
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
    date: toDate(date || new Date()),
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

// Sfondo del template Foto, visibile quando la foto è rimpicciolita. Solo toni scuri o
// saturi: sopra ci sono testi bianchi. swatch = il colore da mostrare nel selettore.
export const PHOTO_BACKGROUNDS = [
  { id: 'grafite', label: 'Grafite', swatch: '#2a2a2e', stops: ['#3a3a3f', '#0a0a0b'] },
  { id: 'nero', label: 'Nero', swatch: '#0a0a0b', stops: ['#0a0a0b', '#0a0a0b'] },
  { id: 'rosso', label: 'Rosso', swatch: '#d50000', stops: ['#ff5131', '#7a0000'] },
  { id: 'blu', label: 'Blu', swatch: '#1e3a8a', stops: ['#2547a8', '#0b1530'] },
  { id: 'verde', label: 'Verde', swatch: '#166534', stops: ['#1f7a43', '#052e16'] },
  { id: 'viola', label: 'Viola', swatch: '#5b21b6', stops: ['#6d28d9', '#1e0b3d'] },
];

const photoBackgroundFill = (id, format) => {
  const bg = PHOTO_BACKGROUNDS.find((b) => b.id === id) || PHOTO_BACKGROUNDS[0];
  return { gradient: { x0: 0, y0: 0, x1: 0, y1: format.height, stops: [[0, bg.stops[0]], [1, bg.stops[1]]] } };
};

const THEMES = {
  scuro: {
    background: (f) => ({ gradient: { x0: 0, y0: 0, x1: 0, y1: f.height, stops: [[0, '#2a0606'], [0.45, '#0a0a0b'], [1, '#0a0a0b']] } }),
    text: '#ffffff', muted: '#a1a1aa', accent: '#ff3d3d', big: '#ff3d3d', tile: 'rgba(255,255,255,0.07)', mark: '#d50000',
  },
  rosso: {
    background: (f) => ({ gradient: { x0: 0, y0: 0, x1: f.width, y1: f.height, stops: [[0, '#ff5131'], [0.55, '#d50000'], [1, '#7a0000']] } }),
    text: '#ffffff', muted: 'rgba(255,255,255,0.78)', accent: '#ffe0b2', big: '#ffffff', tile: 'rgba(0,0,0,0.2)', mark: '#ffffff',
  },
  foto: {
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

const tilesFor = (stats, strings) => {
  const tiles = [
    { value: formatThousands(stats.reps, strings), label: strings.reps },
    { value: String(stats.sets), label: strings.sets },
    { value: String(stats.exercises), label: strings.exercises },
  ];
  const duration = formatDuration(stats.durationSec, strings);
  if (duration) tiles.push({ value: duration, label: strings.duration });
  return tiles;
};

// Griglia di riquadri a partire da y; ritorna gli elementi e l'altezza della griglia.
const tileGrid = (tiles, y, ctx, { columns, height, valueSize, labelSize }) => {
  const { theme, contentWidth } = ctx;
  const gap = 30;
  const w = (contentWidth - gap * (columns - 1)) / columns;
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
  return { elements, height: rows * height + (rows - 1) * gap };
};

const prLine = (names) => {
  if (!names.length) return null;
  const shown = names.slice(0, 2).join(' · ');
  return names.length > 2 ? `${shown} +${names.length - 2}` : shown;
};

const streakLine = (weeks, strings) =>
  (weeks > 0 ? fill(weeks === 1 ? strings.streakOne : strings.streakMany, { n: weeks }) : null);

const header = (theme) => [
  { type: 'rect', x: MARGIN, y: 228, w: 14, h: 58, r: 4, fill: theme.mark },
  text(MARGIN + 34, 276, 'LIFTINDEX', 46, theme.text, { weight: 800, letterSpacing: 6 }),
];

const footer = (theme, format) => text(format.width / 2, format.height - 90, 'liftindex.app', 32, theme.muted, { weight: 500, align: 'center', letterSpacing: 2 });

// ── Blocchi ────────────────────────────────────────────────────────────────
// Un blocco è (stats, ctx, y) => { elements, height }: disegna a partire da y e dice quanto
// spazio occupa, compreso il vuoto che lo separa dal blocco dopo. stack() li impila.
// ctx = { theme, strings, metrics, contentWidth, height }. Le misure (corpi dei testi,
// distanze) cambiano da un layout all'altro e stanno in METRICS.

const METRICS = {
  // Scuro e Rosso: la card intera è dedicata ai numeri.
  full: {
    heading: { dateSize: 34, titleSize: 64, titleMin: 46, titleDy: 80, height: 240 },
    volume: { labelSize: 34, bigSize: 250, bigDx: -6, bigDy: 40, kgDy: 80, kgSize: 52, eqDy: 64, eqSize: 38, eqMin: 30, after: 140 },
    tiles: (n) => (n === 4
      ? { columns: 2, height: 190, valueSize: 84, labelSize: 28 }
      : { columns: 3, height: 210, valueSize: 76, labelSize: 26 }),
    tilesAfter: 90,
    records: { withLabel: true, size: 44, min: 34, textDy: 58, height: 130 },
    streak: { size: 32, height: 60, maxY: 1760 },
  },
  // Foto: la foto resta visibile in alto, i numeri stanno nella parte bassa.
  photo: {
    heading: { dateSize: 32, titleSize: 54, titleMin: 40, titleDy: 66, height: 140 },
    volume: { labelSize: 30, bigSize: 200, bigDx: -4, bigDy: 26, kgDy: 70, kgSize: 46, eqDy: 56, eqSize: 36, eqMin: 28, after: 100 },
    tiles: (n) => ({ columns: n, height: 170, valueSize: n === 4 ? 58 : 66, labelSize: 22 }),
    tilesAfter: 70,
    records: { withLabel: false, size: 40, min: 30, height: 60 },
    streak: { size: 30, height: 60, maxY: Infinity },
  },
};

const headingBlock = (stats, { theme, strings, metrics, contentWidth }, y) => {
  const m = metrics.heading;
  const elements = [text(MARGIN, y, formatDateLabel(stats.date, strings).toUpperCase(), m.dateSize, theme.muted, { weight: 600, letterSpacing: 3 })];
  if (stats.title) {
    const t = fit(stats.title, contentWidth, m.titleSize, m.titleMin);
    elements.push(text(MARGIN, y + m.titleDy, t.text, t.size, theme.text, { weight: 800 }));
  }
  return { elements, height: m.height };
};

const volumeBlock = (stats, { theme, strings, metrics, contentWidth }, y) => {
  const m = metrics.volume;
  const elements = [text(MARGIN, y, strings.totalVolume, m.labelSize, theme.muted, { weight: 600, letterSpacing: 4 })];
  const big = fit(formatThousands(stats.volumeKg, strings), contentWidth, m.bigSize);
  const bigY = y + m.bigDy + big.size * 0.78;
  elements.push(text(MARGIN + m.bigDx, bigY, big.text, big.size, theme.big, { weight: 800 }));
  const kgY = bigY + m.kgDy;
  elements.push(text(MARGIN, kgY, strings.kgLifted, m.kgSize, theme.text, { weight: 700 }));
  const equivalent = volumeEquivalent(stats.volumeKg, strings);
  if (equivalent) {
    const eq = fit(equivalent, contentWidth, m.eqSize, m.eqMin);
    elements.push(text(MARGIN, kgY + m.eqDy, eq.text, eq.size, theme.muted, { weight: 500 }));
  }
  return { elements, height: kgY + m.after - y };
};

const tilesBlock = (stats, ctx, y) => {
  const tiles = tilesFor(stats, ctx.strings);
  const grid = tileGrid(tiles, y, ctx, ctx.metrics.tiles(tiles.length));
  return { elements: grid.elements, height: grid.height + ctx.metrics.tilesAfter };
};

const recordsBlock = (stats, { theme, strings, metrics, contentWidth }, y) => {
  const pr = prLine(stats.prNames);
  const m = metrics.records;
  if (!pr) return { elements: [], height: 0 };
  if (!m.withLabel) {
    const p = fit(fill(strings.recordLine, { names: pr }), contentWidth, m.size, m.min);
    return { elements: [text(MARGIN, y, p.text, p.size, theme.text, { weight: 700 })], height: m.height };
  }
  const p = fit(pr, contentWidth, m.size, m.min);
  return {
    elements: [
      text(MARGIN, y, strings.newRecords, 30, theme.accent, { weight: 700, letterSpacing: 4 }),
      text(MARGIN, y + m.textDy, p.text, p.size, theme.text, { weight: 700 }),
    ],
    height: m.height,
  };
};

const streakBlock = (stats, { theme, strings, metrics }, y) => {
  const streak = streakLine(stats.streakWeeks, strings);
  const m = metrics.streak;
  if (!streak || y >= m.maxY) return { elements: [], height: 0 };
  return { elements: [text(MARGIN, y, streak.toUpperCase(), m.size, theme.accent, { weight: 700, letterSpacing: 3 })], height: m.height };
};

// Mette i blocchi uno sotto l'altro da y; ritorna gli elementi e l'altezza totale.
const stack = (blocks, stats, ctx, y) => {
  const elements = [];
  let cursor = y;
  blocks.forEach((block) => {
    const result = block(stats, ctx, cursor);
    elements.push(...result.elements);
    cursor += result.height;
  });
  return { elements, height: cursor - y };
};

const MAIN_BLOCKS = [headingBlock, volumeBlock, tilesBlock];
// Record e settimane di fila compaiono solo se ci sono
const OPTIONAL_BLOCKS = [recordsBlock, streakBlock];

// Scuro e Rosso: i blocchi scendono dall'alto, sotto l'intestazione.
const FULL_TOP = 400;
const fullLayout = (stats, ctx) => stack([...MAIN_BLOCKS, ...OPTIONAL_BLOCKS], stats, ctx, FULL_TOP).elements;

// Foto: i blocchi opzionali, quando ci sono, spingono tutto verso l'alto.
const PHOTO_ANCHOR = 980;
const photoBlocksLayout = (stats, ctx) => {
  const optionalHeight = stack(OPTIONAL_BLOCKS, stats, ctx, 0).height;
  return stack([...MAIN_BLOCKS, ...OPTIONAL_BLOCKS], stats, ctx, PHOTO_ANCHOR - optionalHeight).elements;
};

// ── Foto: posizione e zoom scelti dall'utente ──────────────────────────────
// transform = { zoom, dx, dy }: zoom 1 = la foto riempie il riquadro (cover), meno di 1
// la rimpicciolisce fino a vederla tutta (contain); dx, dy spostano il centro, in px della card.

export const photoBox = (format = FORMAT_STORIA) => ({ x: 0, y: 0, w: format.width, h: format.height });
export const PHOTO_BOX = photoBox();
export const PHOTO_ZOOM_MAX = 4;
export const DEFAULT_PHOTO_TRANSFORM = { zoom: 1, dx: 0, dy: 0 };

const coverScale = (iw, ih, box) => Math.max(box.w / iw, box.h / ih);

export const photoMinZoom = (iw, ih, box = PHOTO_BOX) => Math.min(box.w / iw, box.h / ih) / coverScale(iw, ih, box);

// Dove disegnare la foto: rettangolo in px della card, da ritagliare sul riquadro.
export const photoRect = (iw, ih, transform = DEFAULT_PHOTO_TRANSFORM, box = PHOTO_BOX) => {
  const scale = coverScale(iw, ih, box) * transform.zoom;
  const w = iw * scale;
  const h = ih * scale;
  return { x: box.x + (box.w - w) / 2 + transform.dx, y: box.y + (box.h - h) / 2 + transform.dy, w, h };
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Tiene la foto al suo posto: se è più grande del riquadro non si scoprono i bordi,
// se è più piccola non esce dal riquadro.
export const clampPhotoTransform = (transform, iw, ih, box = PHOTO_BOX) => {
  const zoom = clamp(transform.zoom, photoMinZoom(iw, ih, box), PHOTO_ZOOM_MAX);
  const { w, h } = photoRect(iw, ih, { zoom, dx: 0, dy: 0 }, box);
  const limX = Math.abs(w - box.w) / 2;
  const limY = Math.abs(h - box.h) / 2;
  return { zoom, dx: clamp(transform.dx, -limX, limX), dy: clamp(transform.dy, -limY, limY) };
};

// Zoom di un fattore tenendo fermo il punto (x, y) della card: quello sotto le dita o il cursore.
export const zoomPhotoAt = (transform, factor, point, iw, ih, box = PHOTO_BOX) => {
  const zoom = clamp(transform.zoom * factor, photoMinZoom(iw, ih, box), PHOTO_ZOOM_MAX);
  const f = zoom / transform.zoom;
  const ax = point.x - (box.x + box.w / 2);
  const ay = point.y - (box.y + box.h / 2);
  return clampPhotoTransform({ zoom, dx: ax + (transform.dx - ax) * f, dy: ay + (transform.dy - ay) * f }, iw, ih, box);
};

// Foto: la foto sotto, una sfumatura scura per leggere i numeri.
const photoUnderlay = (format, hasPhoto) => {
  if (!hasPhoto) return [];
  const { width, height } = format;
  return [
    { type: 'photo', ...photoBox(format) },
    { type: 'rect', x: 0, y: 0, w: width, h: 520, fill: { gradient: { x0: 0, y0: 0, x1: 0, y1: 520, stops: [[0, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']] } } },
    { type: 'rect', x: 0, y: 560, w: width, h: height - 560, fill: { gradient: { x0: 0, y0: 560, x1: 0, y1: height, stops: [[0, 'rgba(0,0,0,0)'], [0.25, 'rgba(0,0,0,0.72)'], [1, 'rgba(0,0,0,0.94)']] } } },
  ];
};

/**
 * Elementi della card, in ordine di disegno. Coordinate in px sul formato (di base 1080×1920).
 *   rect:  { x, y, w, h, r?, fill }   fill = colore | { gradient: { x0, y0, x1, y1, stops: [[offset, colore]] } }
 *   text:  { x, y (linea di base), text, size, weight, color, align: left|center|right, letterSpacing }
 *   photo: { x, y, w, h }              riquadro della foto dell'utente: dentro, photoRect() con lo zoom scelto
 * photoBackground: id di PHOTO_BACKGROUNDS, solo per il template foto.
 * strings: i testi della card (STRINGS_IT di base). format: FORMAT_STORIA di base.
 */
export const layoutShareCard = (stats, templateId, {
  hasPhoto = false, photoBackground, strings = STRINGS_IT, format = FORMAT_STORIA,
} = {}) => {
  const theme = THEMES[templateId] || THEMES.scuro;
  const isPhoto = templateId === 'foto';
  const ctx = {
    theme, strings, metrics: isPhoto ? METRICS.photo : METRICS.full,
    contentWidth: format.width - 2 * MARGIN, height: format.height,
  };
  const background = isPhoto ? photoBackgroundFill(photoBackground, format) : theme.background(format);
  const elements = [{ type: 'rect', x: 0, y: 0, w: format.width, h: format.height, fill: background }];
  if (isPhoto) elements.push(...photoUnderlay(format, hasPhoto));
  elements.push(...header(theme));
  elements.push(...(isPhoto ? photoBlocksLayout(stats, ctx) : fullLayout(stats, ctx)));
  elements.push(footer(theme, format));
  return { width: format.width, height: format.height, elements };
};
