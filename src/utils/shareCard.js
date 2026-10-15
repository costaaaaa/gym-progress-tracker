// ============================================================================
// Card da condividere dopo un allenamento (storia 1080×1920 o quadrato 1080×1080).
// Funzioni pure, senza React: statistiche, testi e posizione di ogni elemento.
// Il web le disegna su <canvas> (renderShareCard.js), il mobile con
// react-native-svg (ShareCardSvg.jsx): la grafica è definita solo qui.
// Copia identica in gym-progress-tracker-mobile/src/domain/shareCard.js.
// ============================================================================

import { extractReps, estimateOneRepMax, summarizeSets, buildExerciseHistoryIndex, detectPersonalRecords } from './workoutMetrics';

// Formato della card: dimensioni in px. Storia per le storie, Quadrato per feed e chat.
export const FORMAT_STORIA = { id: 'storia', label: 'Storia', width: 1080, height: 1920 };
export const FORMAT_QUADRATO = { id: 'quadrato', label: 'Quadrato', width: 1080, height: 1080 };
export const FORMATS = [FORMAT_STORIA, FORMAT_QUADRATO];

export const CARD_WIDTH = FORMAT_STORIA.width;
export const CARD_HEIGHT = FORMAT_STORIA.height;

const MARGIN = 90;

// Tutti i testi della card. Chi disegna la card in un'altra lingua passa un oggetto con le
// stesse chiavi; {nome} è un segnaposto sostituito da fill(). Facoltativo: muscleName(gruppo)
// per tradurre i gruppi muscolari (di base si mostra il nome del catalogo).
export const STRINGS_IT = {
  days: ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'],
  months: ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio',
    'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
  date: '{weekday} {day} {month}',
  thousands: '.',
  decimal: ',',
  minutes: '{m} min',
  hours: '{h}h {m}m',
  sets: 'SERIE',
  duration: 'DURATA',
  volume: 'VOLUME',
  muscles: 'MUSCOLI ALLENATI',
  newRecord: 'NUOVO RECORD',
  setValue: '{weight} kg × {reps}',
  repsValue: '{reps} rip.',
  deltaKg: '+{n} kg',
  deltaOneRm: '+{n} kg stimati',
  deltaReps: '+{n} rip.',
  othersOne: 'e un altro record',
  othersMany: 'e altri {n} record',
  kg: '{n} kg',
  effortLine: '{sets} serie · {exercises}',
  exerciseOne: '{n} esercizio',
  exerciseMany: '{n} esercizi',
  streakOne: '{n} settimana di fila',
  streakMany: '{n} settimane di fila',
  exercisesLabel: 'ESERCIZI',
  recordsLabel: 'TUTTI I RECORD',
  bodyweightValue: '{sets} serie · × {reps}',
  volumeRecord: 'volume',
  moreExercises: '+{n} esercizi',
  moreRecords: '+{n} record',
  setsCount: '{n} serie',
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

// 12.5 → "12,5" (una cifra decimale al massimo, separatore della lingua)
const formatDecimal = (n, strings = STRINGS_IT) =>
  String(Math.round(n * 10) / 10).replace('.', strings.decimal);

/**
 * I due gruppi muscolari con più serie, es. "Petto · Tricipiti". Titolo della card
 * per gli allenamenti della cronologia, che non ricordano piano e giorno.
 */
export const muscleGroupsTitle = (exercises, label) => {
  const counts = {};
  (exercises || []).forEach((ex) => {
    if (!ex.muscle_group) return;
    counts[ex.muscle_group] = (counts[ex.muscle_group] || 0) + (ex.sets?.length || 0);
  });
  return Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, 2)
    .map((g) => (label ? label(g) : g.charAt(0).toUpperCase() + g.slice(1)))
    .join(' · ');
};

// Tipi di record dal più importante: peso, massimale stimato, ripetizioni a corpo libero.
// Il volume di sessione è un record ma non è mai il protagonista della card.
const RECORD_TYPES = ['weight', 'oneRM', 'reps'];

const playedSets = (sets) => sets
  .map((set) => ({ weight: parseFloat(set.weight) || 0, reps: extractReps(set.reps) }))
  .filter((set) => set.reps > 0);

/**
 * Il record battuto da un esercizio, o null: { name, type, weight, reps, delta, pct }.
 * type = il più importante tra i record battuti; weight × reps = la serie che lo fa;
 * delta = di quanto supera il record precedente (null alla prima volta), pct = in percentuale.
 */
const exerciseRecord = (ex, historyEntry) => {
  const pr = detectPersonalRecords(ex.sets, historyEntry);
  if (!pr.isPR) return null;
  const type = RECORD_TYPES.find((t) => pr[t]) || 'volume';
  if (type === 'volume') return { name: ex.name, type, weight: 0, reps: 0, delta: null, pct: 0 };

  const sets = playedSets(ex.sets);
  const previous = { weight: historyEntry.bestWeight, oneRM: historyEntry.bestOneRM, reps: historyEntry.bestBodyweightReps || 0 }[type];
  let best;
  if (type === 'weight') best = sets.filter((x) => x.weight === pr.weight).sort((a, b) => b.reps - a.reps)[0];
  else if (type === 'oneRM') best = [...sets].sort((a, b) => estimateOneRepMax(b.weight, b.reps) - estimateOneRepMax(a.weight, a.reps))[0];
  else best = sets.filter((x) => x.weight === 0).sort((a, b) => b.reps - a.reps)[0];
  const delta = previous > 0 ? Math.round((pr[type] - previous) * 10) / 10 : null;
  return { name: ex.name, type, weight: best.weight, reps: best.reps, delta, pct: previous > 0 ? (pr[type] - previous) / previous : 1 };
};

/**
 * Record battuti in un allenamento. exercises: [{ exercise_id, name, sets }];
 * historyIndex = buildExerciseHistoryIndex degli allenamenti precedenti.
 */
export const sessionRecords = (exercises, historyIndex) => (exercises || [])
  .filter((ex) => ex.sets?.length)
  .map((ex) => exerciseRecord(ex, historyIndex?.[ex.exercise_id]))
  .filter(Boolean);

/**
 * Record di un allenamento della cronologia, confrontando solo gli allenamenti
 * precedenti (come fa il riepilogo a fine sessione).
 */
export const historyRecords = (records, workout) => {
  const t = toDate(workout.date).getTime();
  const older = (records || []).filter((r) => {
    if (r.id === workout.id) return false;
    const rt = toDate(r.date).getTime();
    return rt < t || (rt === t && Number(r.id) < Number(workout.id));
  });
  return sessionRecords(workout.exercises, buildExerciseHistoryIndex(older));
};

// Record dal più importante: per tipo, a parità quello che migliora di più in percentuale;
// i record di solo volume in fondo.
const sortRecords = (records) => [...records].sort((a, b) => {
  const ra = a.type === 'volume' ? RECORD_TYPES.length : RECORD_TYPES.indexOf(a.type);
  const rb = b.type === 'volume' ? RECORD_TYPES.length : RECORD_TYPES.indexOf(b.type);
  return ra - rb || b.pct - a.pct;
});

// La serie migliore di un esercizio: la più alta per massimale stimato; a corpo libero la
// più lunga. Null se nessuna serie ha ripetizioni.
const bestSet = (sets) => {
  const played = playedSets(sets);
  const weighted = played.filter((x) => x.weight > 0);
  if (weighted.length) return [...weighted].sort((a, b) => estimateOneRepMax(b.weight, b.reps) - estimateOneRepMax(a.weight, a.reps))[0];
  return [...played].sort((a, b) => b.reps - a.reps)[0] || null;
};

const MUSCLES_SHOWN = 4;

// Primi gruppi muscolari per numero di serie, in % sul totale delle serie con un gruppo.
const muscleShares = (exercises) => {
  const counts = new Map();
  exercises.forEach((ex) => {
    if (ex.muscle_group) counts.set(ex.muscle_group, (counts.get(ex.muscle_group) || 0) + ex.sets.length);
  });
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MUSCLES_SHOWN)
    .map(([group, count]) => ({ group: group.charAt(0).toUpperCase() + group.slice(1), pct: Math.round((count / total) * 100) }));
};

/**
 * exercises: [{ name, muscle_group, sets: [{ weight, reps }] }]; records = sessionRecords(...)
 * o historyRecords(...). Ritorna i numeri della card; exerciseList = nome, serie migliore
 * ({ weight, reps } o null) e se è un record, per ogni esercizio fatto.
 */
export const buildShareStats = ({ exercises, date, durationSec, title, records, streakWeeks }) => {
  const done = (exercises || []).filter((ex) => ex.sets?.length);
  let volume = 0;
  let sets = 0;
  done.forEach((ex) => {
    volume += summarizeSets(ex.sets).sessionVolume;
    sets += ex.sets.length;
  });
  const ordered = sortRecords(records || []);
  const hero = ordered[0] && ordered[0].type !== 'volume' ? ordered[0] : null;
  return {
    volumeKg: Math.round(volume),
    sets,
    exercises: done.length,
    durationSec: durationSec > 0 ? durationSec : null,
    record: hero,
    otherRecords: hero ? ordered.length - 1 : 0,
    recordList: hero ? ordered.slice(1) : [],
    exerciseList: done.map((ex) => ({
      name: ex.name, sets: ex.sets.length, best: bestSet(ex.sets), isRecord: ordered.some((r) => r.name === ex.name),
    })),
    muscles: muscleShares(done),
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
  { id: 'trasparente', label: 'Trasparente' },
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
  // Senza sfondo: il PNG resta trasparente, da usare come adesivo sopra una foto.
  trasparente: {
    text: '#ffffff', muted: 'rgba(255,255,255,0.85)', accent: '#ff8a65', big: '#ffffff', tile: 'rgba(0,0,0,0.35)', mark: '#d50000',
  },
};

// Senza misurare il testo: larghezza media di un carattere in em, per eccesso. Lexend in
// grassetto: ~0,62 per cifre e maiuscole, ~0,52 per il testo normale.
const charEm = (value) => (/[a-z]/.test(value) && !/\d/.test(value) ? 0.52 : 0.62);

// Dimensione del font perché il testo stia in maxWidth; sotto minSize il testo si tronca.
const fit = (text, maxWidth, size, minSize = size * 0.6, em = charEm(text)) => {
  const s = Math.min(size, maxWidth / (Math.max(text.length, 1) * em));
  if (s >= minSize) return { text, size: Math.floor(s) };
  const maxChars = Math.max(1, Math.floor(maxWidth / (minSize * em)) - 1);
  return { text: `${text.slice(0, maxChars).trimEnd()}…`, size: Math.floor(minSize) };
};

const text = (x, y, value, size, color, opts = {}) => ({
  type: 'text', x, y, text: value, size, color,
  weight: opts.weight || 700, align: opts.align || 'left', letterSpacing: opts.letterSpacing || 0,
});

// Riquadri. Durata e serie ci sono già nel blocco principale quando la card lo mostra e non
// c'è un record; il volume manca negli allenamenti a corpo libero.
const tilesFor = (stats, strings, effortInHero, hideWeights) => {
  const tiles = [];
  const duration = formatDuration(stats.durationSec, strings);
  if (!effortInHero && duration) tiles.push({ value: duration, label: strings.duration });
  if (stats.volumeKg > 0 && !hideWeights) tiles.push({ value: fill(strings.kg, { n: formatThousands(stats.volumeKg, strings) }), label: strings.volume });
  if (!effortInHero) tiles.push({ value: String(stats.sets), label: strings.sets });
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

const streakLine = (weeks, strings) =>
  (weeks > 0 ? fill(weeks === 1 ? strings.streakOne : strings.streakMany, { n: weeks }) : null);

const header = (theme, { header: h }) => [
  { type: 'rect', x: MARGIN, y: h.y, w: 14, h: h.markH, r: 4, fill: theme.mark },
  text(MARGIN + 34, h.y + h.baselineDy, 'LIFTINDEX', h.size, theme.text, { weight: 800, letterSpacing: 6 }),
];

const footer = (theme, format, { footerDy }) => text(format.width / 2, format.height - footerDy, 'liftindex.app', 32, theme.muted, { weight: 500, align: 'center', letterSpacing: 2 });

// ── Blocchi ────────────────────────────────────────────────────────────────
// Un blocco è (stats, ctx, y) => { elements, height }: disegna a partire da y e dice quanto
// spazio occupa, compreso il vuoto che lo separa dal blocco dopo. stack() li impila.
// ctx = { theme, strings, layout, metrics, contentWidth, height, hasHero, hideWeights, fit }. Le misure (corpi dei testi,
// distanze) cambiano da un layout all'altro e stanno in METRICS.

const METRICS = {
  // Scuro e Rosso: la card intera è dedicata ai numeri.
  full: {
    heading: { dateSize: 34, titleSize: 64, titleMin: 46, titleDy: 80, height: 240 },
    record: { labelSize: 30, nameSize: 58, nameMin: 42, nameDy: 72, valueSize: 170, valueGap: 36, deltaSize: 46, deltaStep: 82, othersSize: 34, othersStep: 58, tail: 60 },
    effort: { valueSize: 150, valueDy: 120, labelDy: 60, labelSize: 30, lineSize: 96, lineDy: 80, tail: 80 },
    tiles: { columns: 3, height: 170, valueSize: 56, labelSize: 24 },
    tilesAfter: 70,
    muscles: { labelSize: 30, firstRow: 56, pitch: 76, nameSize: 32, nameDy: 30, barDy: 44, barHeight: 14, tail: 50 },
    streak: { size: 32, height: 60, maxY: 1760 },
    recordBig: { labelSize: 34, nameSize: 70, nameMin: 46, nameDy: 88, valueSize: 220, valueGap: 40, deltaSize: 56, deltaStep: 96, othersSize: 34, othersStep: 58, tail: 70 },
    musclesBig: { labelSize: 34, firstRow: 70, pitch: 112, nameSize: 44, nameDy: 42, barDy: 62, barHeight: 22, tail: 60 },
    list: { labelSize: 30, firstRow: 56, pitch: 84, rowHeight: 68, rowDy: 46, nameSize: 38, nameMin: 28, valueSize: 38, padding: 24, tail: 40, minRows: 1, maxRows: 9, limit: 1780 },
  },
  // Foto: la foto resta visibile in alto, i numeri stanno nella parte bassa.
  photo: {
    heading: { dateSize: 32, titleSize: 54, titleMin: 40, titleDy: 66, height: 140 },
    record: { labelSize: 26, nameSize: 50, nameMin: 38, nameDy: 62, valueSize: 120, valueGap: 30, deltaSize: 38, deltaStep: 54, othersSize: 30, othersStep: 48, tail: 56 },
    effort: { valueSize: 110, valueDy: 90, labelDy: 50, labelSize: 26, lineSize: 72, lineDy: 60, tail: 60 },
    tiles: { columns: 3, height: 150, valueSize: 50, labelSize: 22 },
    tilesAfter: 50,
    muscles: { labelSize: 26, firstRow: 48, pitch: 64, nameSize: 28, nameDy: 26, barDy: 38, barHeight: 12, tail: 44 },
    streak: { size: 30, height: 60, maxY: Infinity },
    recordBig: { labelSize: 30, nameSize: 58, nameMin: 40, nameDy: 74, valueSize: 160, valueGap: 34, deltaSize: 44, deltaStep: 64, othersSize: 30, othersStep: 48, tail: 60 },
    musclesBig: { labelSize: 28, firstRow: 56, pitch: 88, nameSize: 36, nameDy: 34, barDy: 50, barHeight: 18, tail: 50 },
    list: { labelSize: 26, firstRow: 48, pitch: 72, rowHeight: 58, rowDy: 40, nameSize: 32, nameMin: 24, valueSize: 32, padding: 20, tail: 40, minRows: 1, maxRows: 5, limit: Infinity },
  },
  // Quadrato (1080×1080): misure compatte, uguali per tutti i template. L'altezza non basta
  // per tutti i blocchi: layoutShareCard li accorcia (vedi FIT_STATES).
  square: {
    heading: { dateSize: 30, titleSize: 52, titleMin: 38, titleDy: 62, height: 112 },
    record: { labelSize: 26, nameSize: 48, nameMin: 36, nameDy: 58, valueSize: 112, valueGap: 24, deltaSize: 36, deltaStep: 52, othersSize: 28, othersStep: 44, tail: 32 },
    effort: { valueSize: 110, valueDy: 90, labelDy: 48, labelSize: 26, lineSize: 72, lineDy: 60, tail: 40 },
    tiles: { columns: 3, height: 112, valueSize: 44, labelSize: 20 },
    tilesAfter: 32,
    muscles: { labelSize: 26, firstRow: 40, pitch: 50, nameSize: 28, nameDy: 24, barDy: 34, barHeight: 10, tail: 28 },
    streak: { size: 28, height: 50, maxY: Infinity },
    recordBig: { labelSize: 28, nameSize: 56, nameMin: 40, nameDy: 70, valueSize: 150, valueGap: 28, deltaSize: 42, deltaStep: 68, othersSize: 28, othersStep: 44, tail: 44 },
    musclesBig: { labelSize: 28, firstRow: 50, pitch: 80, nameSize: 36, nameDy: 34, barDy: 50, barHeight: 16, tail: 40 },
    list: { labelSize: 24, firstRow: 42, pitch: 62, rowHeight: 50, rowDy: 35, nameSize: 28, nameMin: 22, valueSize: 28, padding: 18, tail: 24, minRows: 2, maxRows: 9, limit: Infinity },
  },
};

// Misure e posizioni fisse di ogni formato. bottom = dove finisce lo spazio dei blocchi, che si
// accorciano se non entrano; senza bottom non si accorciano (la storia ha spazio da vendere).
const LAYOUTS = {
  storia: {
    header: { y: 228, markH: 58, baselineDy: 48, size: 46 }, footerDy: 90,
    top: 400, photoBottom: 150, photoTop: 0, gradient: { top: 520, bottom: 560 },
    metrics: { full: METRICS.full, photo: METRICS.photo },
  },
  quadrato: {
    header: { y: 50, markH: 44, baselineDy: 36, size: 36 }, footerDy: 36,
    top: 146, bottom: 1020, photoBottom: 80, photoTop: 130, gradient: { top: 290, bottom: 300 },
    metrics: { full: METRICS.square, photo: METRICS.square },
  },
};
const layoutOf = (format) => LAYOUTS[format.id] || LAYOUTS.storia;


const headingBlock = (stats, { theme, strings, metrics, contentWidth }, y) => {
  const m = metrics.heading;
  const elements = [text(MARGIN, y, formatDateLabel(stats.date, strings).toUpperCase(), m.dateSize, theme.muted, { weight: 600, letterSpacing: 3 })];
  if (stats.title) {
    const t = fit(stats.title, contentWidth, m.titleSize, m.titleMin);
    elements.push(text(MARGIN, y + m.titleDy, t.text, t.size, theme.text, { weight: 800 }));
  }
  return { elements, height: m.height };
};

const recordValue = (record, strings) => (record.type === 'reps'
  ? fill(strings.repsValue, { reps: record.reps })
  : fill(strings.setValue, { weight: formatDecimal(record.weight, strings), reps: record.reps }));

const recordDelta = (record, strings) => {
  if (record.delta === null) return null;
  const template = { weight: strings.deltaKg, oneRM: strings.deltaOneRm, reps: strings.deltaReps }[record.type];
  return fill(template, { n: formatDecimal(record.delta, strings) });
};

// Blocco principale con un record: esercizio, serie che lo fa, di quanto migliora.
const recordHero = (stats, { theme, strings, metrics, contentWidth, hideWeights }, y) => {
  const m = metrics.record;
  const { record } = stats;
  const weightless = hideWeights && record.type !== 'reps';
  const elements = [text(MARGIN, y, strings.newRecord, m.labelSize, theme.accent, { weight: 700, letterSpacing: 4 })];
  let cursor;
  if (weightless) {
    // Senza il peso il protagonista è l'esercizio
    const name = fit(record.name, contentWidth, m.nameSize * 1.6, m.nameMin);
    cursor = y + m.nameDy + (name.size - m.nameSize) * 0.8;
    elements.push(text(MARGIN, cursor, name.text, name.size, theme.big, { weight: 800 }));
  } else {
    const name = fit(record.name, contentWidth, m.nameSize, m.nameMin);
    const value = fit(recordValue(record, strings), contentWidth, m.valueSize);
    elements.push(text(MARGIN, y + m.nameDy, name.text, name.size, theme.text, { weight: 800 }));
    cursor = y + m.nameDy + m.valueGap + value.size * 0.78;
    elements.push(text(MARGIN - 4, cursor, value.text, value.size, theme.big, { weight: 800 }));
    const delta = recordDelta(record, strings);
    if (delta) {
      cursor += m.deltaStep;
      const d = fit(delta, contentWidth, m.deltaSize);
      elements.push(text(MARGIN, cursor, d.text, d.size, theme.text, { weight: 700 }));
    }
  }
  if (stats.otherRecords > 0) {
    cursor += m.othersStep;
    const others = fill(stats.otherRecords === 1 ? strings.othersOne : strings.othersMany, { n: stats.otherRecords });
    elements.push(text(MARGIN, cursor, others, m.othersSize, theme.muted, { weight: 500 }));
  }
  return { elements, height: cursor + m.tail - y };
};

// Blocco principale senza record: durata e serie in grande; senza durata, serie ed esercizi.
const effortHero = (stats, { theme, strings, metrics, contentWidth }, y) => {
  const m = metrics.effort;
  const duration = formatDuration(stats.durationSec, strings);
  if (!duration) {
    const exercises = fill(stats.exercises === 1 ? strings.exerciseOne : strings.exerciseMany, { n: stats.exercises });
    const line = fit(fill(strings.effortLine, { sets: stats.sets, exercises }), contentWidth, m.lineSize);
    return { elements: [text(MARGIN, y + m.lineDy, line.text, line.size, theme.big, { weight: 800 })], height: m.lineDy + m.tail };
  }
  const columnWidth = contentWidth / 2;
  const elements = [];
  [[duration, strings.duration], [String(stats.sets), strings.sets]].forEach(([value, label], i) => {
    const x = MARGIN + i * columnWidth;
    const big = fit(value, columnWidth - 30, m.valueSize);
    elements.push(text(x - 4, y + m.valueDy, big.text, big.size, theme.big, { weight: 800 }));
    elements.push(text(x, y + m.valueDy + m.labelDy, label, m.labelSize, theme.muted, { weight: 600, letterSpacing: 4 }));
  });
  return { elements, height: m.valueDy + m.labelDy + m.tail };
};

const heroBlock = (stats, ctx, y) => (stats.record ? recordHero(stats, ctx, y) : effortHero(stats, ctx, y));

const tilesBlock = (stats, ctx, y) => {
  const tiles = tilesFor(stats, ctx.strings, ctx.hasHero && !stats.record, ctx.hideWeights);
  if (!tiles.length) return { elements: [], height: 0 };
  const grid = tileGrid(tiles, y, ctx, { ...ctx.metrics.tiles, columns: tiles.length });
  return { elements: grid.elements, height: grid.height + ctx.metrics.tilesAfter };
};

const musclesBlock = (stats, { theme, strings, metrics, contentWidth, fit: shrink }, y) => {
  const m = metrics.muscles;
  const muscles = stats.muscles.slice(0, shrink.muscleRows);
  if (!muscles.length) return { elements: [], height: 0 };
  const elements = [text(MARGIN, y, strings.muscles, m.labelSize, theme.muted, { weight: 600, letterSpacing: 4 })];
  muscles.forEach((muscle, i) => {
    const top = y + m.firstRow + i * m.pitch;
    const name = fit(strings.muscleName ? strings.muscleName(muscle.group) : muscle.group, contentWidth - 140, m.nameSize, m.nameSize * 0.7);
    elements.push(text(MARGIN, top + m.nameDy, name.text, name.size, theme.text, { weight: 600 }));
    elements.push(text(MARGIN + contentWidth, top + m.nameDy, `${muscle.pct}%`, m.nameSize, theme.text, { weight: 700, align: 'right' }));
    elements.push({ type: 'rect', x: MARGIN, y: top + m.barDy, w: contentWidth, h: m.barHeight, r: m.barHeight / 2, fill: theme.tile });
    elements.push({ type: 'rect', x: MARGIN, y: top + m.barDy, w: Math.max(m.barHeight, (contentWidth * muscle.pct) / 100), h: m.barHeight, r: m.barHeight / 2, fill: theme.big });
  });
  return { elements, height: m.firstRow + muscles.length * m.pitch + m.tail };
};

const streakBlock = (stats, { theme, strings, metrics, fit: shrink }, y) => {
  const streak = streakLine(stats.streakWeeks, strings);
  const m = metrics.streak;
  if (!streak || !shrink.streak || y >= m.maxY) return { elements: [], height: 0 };
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

// Varianti "in grande" per le card dedicate: stesso blocco con misure più generose.
const bigRecordBlock = (stats, ctx, y) =>
  recordHero({ ...stats, otherRecords: 0 }, { ...ctx, metrics: { ...ctx.metrics, record: ctx.metrics.recordBig } }, y);
const bigMusclesBlock = (stats, ctx, y) =>
  musclesBlock(stats, { ...ctx, metrics: { ...ctx.metrics, muscles: ctx.metrics.musclesBig } }, y);

// Elenco a righe: nome a sinistra, valore a destra; le righe evidenziate (record) hanno uno
// sfondo e il valore in accento. Se non entrano tutte, l'ultima riga diventa "+N ...".
const listBlock = (label, rows, moreTemplate) => (stats, { theme, strings, metrics, contentWidth, hideWeights, fit: shrink }, y) => {
  const m = metrics.list;
  const items = rows(stats, strings, hideWeights);
  if (!items.length) return { elements: [], height: 0 };
  const space = Math.floor((m.limit - y - m.firstRow - m.tail) / m.pitch);
  const capacity = Math.max(m.minRows, Math.min(m.maxRows, space, shrink.listRows));
  const shown = items.length > capacity ? items.slice(0, capacity - 1) : items;
  const elements = [text(MARGIN, y, strings[label], m.labelSize, theme.muted, { weight: 600, letterSpacing: 4 })];
  shown.forEach((item, i) => {
    const top = y + m.firstRow + i * m.pitch;
    const left = MARGIN + m.padding;
    const right = MARGIN + contentWidth - m.padding;
    const value = item.value ? fit(item.value, contentWidth / 2, m.valueSize, m.valueSize * 0.7) : null;
    const valueWidth = value ? value.text.length * charEm(value.text) * value.size : 0;
    const name = fit(item.name, right - left - valueWidth - 30, m.nameSize, m.nameMin, 0.62);
    if (item.highlight) elements.push({ type: 'rect', x: MARGIN, y: top, w: contentWidth, h: m.rowHeight, r: 20, fill: theme.tile });
    elements.push(text(left, top + m.rowDy, name.text, name.size, theme.text, { weight: 600 }));
    if (value) elements.push(text(right, top + m.rowDy, value.text, value.size, item.highlight ? theme.accent : theme.text, { weight: 700, align: 'right' }));
  });
  if (shown.length < items.length) {
    const top = y + m.firstRow + shown.length * m.pitch;
    elements.push(text(MARGIN + m.padding, top + m.rowDy, fill(strings[moreTemplate], { n: items.length - shown.length }), m.nameSize, theme.muted, { weight: 600 }));
  }
  const rowsDrawn = shown.length + (shown.length < items.length ? 1 : 0);
  return { elements, height: m.firstRow + rowsDrawn * m.pitch + m.tail };
};

const exerciseValue = (ex, strings, hideWeights) => {
  if (!ex.best) return null;
  if (ex.best.weight <= 0) return fill(strings.bodyweightValue, { sets: ex.sets, reps: ex.best.reps });
  if (hideWeights) return fill(strings.setsCount, { n: ex.sets });
  return fill(strings.setValue, { weight: formatDecimal(ex.best.weight, strings), reps: ex.best.reps });
};

const exerciseRows = (stats, strings, hideWeights) => stats.exerciseList.map((ex) => ({
  name: ex.name, value: exerciseValue(ex, strings, hideWeights), highlight: ex.isRecord,
}));

const recordRowValue = (r, strings, hideWeights) => {
  if (r.type === 'volume') return strings.volumeRecord;
  return hideWeights && r.type !== 'reps' ? null : recordValue(r, strings);
};

const recordRows = (stats, strings, hideWeights) => stats.recordList.map((r) => ({
  name: r.name, value: recordRowValue(r, strings, hideWeights), highlight: true,
}));

const exercisesBlock = listBlock('exercisesLabel', exerciseRows, 'moreExercises');
const recordsBlock = listBlock('recordsLabel', recordRows, 'moreRecords');

const BLOCKS = {
  hero: heroBlock, bigRecord: bigRecordBlock, tiles: tilesBlock, muscles: musclesBlock,
  bigMuscles: bigMusclesBlock, exercises: exercisesBlock, records: recordsBlock, streak: streakBlock,
};

// Card pronte: ognuna è un elenco di blocchi (sotto l'intestazione, in quest'ordine).
export const PRESETS = [
  { id: 'riepilogo', label: 'Riepilogo', blocks: ['hero', 'tiles', 'muscles', 'streak'] },
  { id: 'record', label: 'Record', blocks: ['bigRecord', 'records'] },
  { id: 'muscoli', label: 'Muscoli', blocks: ['bigMuscles', 'tiles'] },
  { id: 'esercizi', label: 'Esercizi', blocks: ['tiles', 'exercises'] },
];

export const DEFAULT_PRESET = PRESETS[0].id;

// "Personalizza": i blocchi che l'utente accende e spegne, sempre in questo ordine e nelle
// misure normali. La card risultante è la "Personalizzata".
export const CUSTOM_BLOCKS = [
  { id: 'hero', label: 'Principale' },
  { id: 'tiles', label: 'Riquadri' },
  { id: 'muscles', label: 'Muscoli' },
  { id: 'exercises', label: 'Esercizi' },
  { id: 'streak', label: 'Settimane di fila' },
];

const NORMAL_BLOCK = { bigRecord: 'hero', bigMuscles: 'muscles' };

// I blocchi personalizzabili accesi in una card pronta: da qui parte "Personalizza".
export const presetToggles = (presetId) => {
  const preset = PRESETS.find((p) => p.id === presetId) || PRESETS[0];
  const ids = preset.blocks.map((id) => NORMAL_BLOCK[id] || id);
  return CUSTOM_BLOCKS.map((b) => b.id).filter((id) => ids.includes(id));
};

// Le card che hanno qualcosa da mostrare per questo allenamento: Record solo con un record,
// Muscoli solo se gli esercizi hanno un gruppo muscolare.
export const availablePresets = (stats) => PRESETS.filter((p) => {
  if (p.id === 'record') return !!stats.record;
  if (p.id === 'muscoli') return stats.muscles.length > 0;
  if (p.id === 'esercizi') return stats.exerciseList.length > 0;
  return true;
});

// Scelte ricordate tra una condivisione e l'altra (la foto mai). Il valore salvato può essere
// assente, vecchio o corrotto: ogni campo non valido torna al predefinito. Il template Foto
// si ripristina senza foto: la card resta sullo sfondo finché non se ne sceglie una.
export const sanitizePrefs = (raw) => {
  const p = raw && typeof raw === 'object' ? raw : {};
  const customIds = CUSTOM_BLOCKS.map((b) => b.id);
  return {
    template: TEMPLATES.some((t) => t.id === p.template) ? p.template : 'scuro',
    format: FORMATS.find((f) => f.id === p.format) || FORMAT_STORIA,
    preset: PRESETS.some((x) => x.id === p.preset) ? p.preset : DEFAULT_PRESET,
    customBlocks: Array.isArray(p.customBlocks) ? customIds.filter((id) => p.customBlocks.includes(id)) : null,
    hideWeights: p.hideWeights === true,
  };
};

// La card pronta a destra (+1) o a sinistra (-1) di quella attiva, in giro; salta quelle senza dati.
export const stepPreset = (stats, presetId, step) => {
  const list = availablePresets(stats);
  const i = list.findIndex((p) => p.id === presetId);
  return list[(Math.max(i, 0) + step + list.length) % list.length].id;
};

const chosenBlocks = (stats, presetId, custom) => {
  let ids;
  if (custom) ids = CUSTOM_BLOCKS.map((b) => b.id).filter((id) => custom.includes(id));
  else ids = (availablePresets(stats).find((p) => p.id === presetId) || PRESETS[0]).blocks;
  return { blocks: [headingBlock, ...ids.map((id) => BLOCKS[id])], hasHero: ids.includes('hero') };
};

// Quando i blocchi non entrano (quadrato) si prova, nell'ordine, ad accorciare l'elenco
// esercizi/record (fino a 2 righe + "+N"), poi i muscoli (3, poi 2 righe), poi si toglie la
// riga delle settimane di fila. Si usa il primo stato in cui l'altezza basta. Gli ultimi due
// stati servono solo alle card personalizzate con quasi tutti i blocchi accesi.
const NO_SHRINK = { listRows: Infinity, muscleRows: Infinity, streak: true };
const FIT_STATES = [
  ...[9, 8, 7, 6, 5, 4, 3].map((listRows) => ({ listRows, muscleRows: MUSCLES_SHOWN, streak: true })),
  { listRows: 3, muscleRows: 3, streak: true },
  { listRows: 3, muscleRows: 2, streak: true },
  { listRows: 3, muscleRows: 2, streak: false },
  { listRows: 2, muscleRows: 2, streak: false },
  { listRows: 2, muscleRows: 1, streak: false },
];

const fitted = (blocks, stats, ctx, y, available) => {
  if (ctx.layout.bottom === undefined) return { ...ctx, fit: NO_SHRINK };
  let tried;
  for (const state of FIT_STATES) {
    tried = { ...ctx, fit: state };
    if (stack(blocks, stats, tried, y).height <= available) break;
  }
  return tried;
};

// Scuro e Rosso: i blocchi scendono dall'alto, sotto l'intestazione.
const fullLayout = (blocks, stats, ctx) => {
  const { top, bottom } = ctx.layout;
  return stack(blocks, stats, fitted(blocks, stats, ctx, top, bottom - top), top).elements;
};

// Foto: i blocchi poggiano in basso e crescono verso l'alto, lasciando libera la foto.
const photoBlocksLayout = (blocks, stats, ctx) => {
  const { photoBottom, photoTop } = ctx.layout;
  const base = ctx.height - photoBottom;
  const sized = fitted(blocks, stats, ctx, 0, base - photoTop);
  const total = stack(blocks, stats, sized, 0).height;
  return stack(blocks, stats, sized, base - total).elements;
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
  const { top, bottom } = layoutOf(format).gradient;
  return [
    { type: 'photo', ...photoBox(format) },
    { type: 'rect', x: 0, y: 0, w: width, h: top, fill: { gradient: { x0: 0, y0: 0, x1: 0, y1: top, stops: [[0, 'rgba(0,0,0,0.55)'], [1, 'rgba(0,0,0,0)']] } } },
    { type: 'rect', x: 0, y: bottom, w: width, h: height - bottom, fill: { gradient: { x0: 0, y0: bottom, x1: 0, y1: height, stops: [[0, 'rgba(0,0,0,0)'], [0.25, 'rgba(0,0,0,0.72)'], [1, 'rgba(0,0,0,0.94)']] } } },
  ];
};

/**
 * Elementi della card, in ordine di disegno. Coordinate in px sul formato (di base 1080×1920).
 *   rect:  { x, y, w, h, r?, fill }   fill = colore | { gradient: { x0, y0, x1, y1, stops: [[offset, colore]] } }
 *   text:  { x, y (linea di base), text, size, weight, color, align: left|center|right, letterSpacing }
 *   photo: { x, y, w, h }              riquadro della foto dell'utente: dentro, photoRect() con lo zoom scelto
 * photoBackground: id di PHOTO_BACKGROUNDS, solo per il template foto.
 * strings: i testi della card (STRINGS_IT di base). format: FORMAT_STORIA di base.
 * preset: id di PRESETS (la card pronta); se non è disponibile per l'allenamento, Riepilogo.
 * blocks: id di CUSTOM_BLOCKS accesi (card personalizzata); se c'è, preset non conta.
 * hideWeights: nessun peso (kg) da nessuna parte.
 */
export const layoutShareCard = (stats, templateId, {
  hasPhoto = false, photoBackground, strings = STRINGS_IT, format = FORMAT_STORIA, preset = DEFAULT_PRESET,
  blocks: customBlocks, hideWeights = false,
} = {}) => {
  const theme = THEMES[templateId] || THEMES.scuro;
  const isPhoto = templateId === 'foto';
  const { blocks, hasHero } = chosenBlocks(stats, preset, customBlocks);
  const layout = layoutOf(format);
  const ctx = {
    theme, strings, layout, metrics: isPhoto ? layout.metrics.photo : layout.metrics.full,
    contentWidth: format.width - 2 * MARGIN, height: format.height, hasHero, hideWeights, fit: NO_SHRINK,
  };
  const background = isPhoto ? photoBackgroundFill(photoBackground, format) : theme.background?.(format);
  const elements = background ? [{ type: 'rect', x: 0, y: 0, w: format.width, h: format.height, fill: background }] : [];
  if (isPhoto) elements.push(...photoUnderlay(format, hasPhoto));
  elements.push(...header(theme, layout));
  elements.push(...(isPhoto ? photoBlocksLayout(blocks, stats, ctx) : fullLayout(blocks, stats, ctx)));
  elements.push(footer(theme, format, layout));
  return { width: format.width, height: format.height, elements };
};
