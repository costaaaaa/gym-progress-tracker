// ============================================================================
// Periodi di Misure Corporee: quali righe stanno nel periodo scelto e quanto
// è cambiato il peso. Funzioni pure, senza import di piattaforma: il mobile
// le copia in src/domain con scripts/check-sync.sh.
// ============================================================================

export const DEFAULT_PERIOD = '3m';
export const PERIODS = ['1m', '3m', '6m', '1y', 'all'];

// Chiavi i18n di ogni periodo: etichetta del selettore e testo della variazione del peso
export const PERIOD_UI = {
  '1m': { label: 'body.period_1m', delta: 'body.weight_delta_1m' },
  '3m': { label: 'body.period_3m', delta: 'body.weight_delta_3m' },
  '6m': { label: 'body.period_6m', delta: 'body.weight_delta_6m' },
  '1y': { label: 'body.period_1y', delta: 'body.weight_delta_1y' },
  all: { label: 'body.period_all', delta: 'body.weight_delta' },
};

// Mesi di calendario all'indietro da oggi. 'all' non c'è: nessun limite.
const PERIOD_MONTHS = { '1m': 1, '3m': 3, '6m': 6, '1y': 12 };

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (year, monthIndex, day) => `${year}-${pad(monthIndex + 1)}-${pad(day)}`;

const isValidNumber = (value) => {
  if (value === null || value === undefined || value === '') return false;
  return Number.isFinite(parseFloat(value));
};

/**
 * Copia delle righe in ordine di data crescente (le date sono 'YYYY-MM-DD',
 * si confrontano come stringhe). L'ordine dell'API non è un contratto.
 */
export const sortByDate = (stats) => [...stats].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

/**
 * Primo giorno del periodo ('YYYY-MM-DD', incluso), o null per 'all'.
 * Mesi di calendario: il 20/10 il periodo '1m' parte dal 20/09; il 31/03 parte
 * dall'ultimo giorno di febbraio.
 */
export const periodStart = (period, today = new Date()) => {
  const months = PERIOD_MONTHS[period];
  if (!months) return null;
  const target = new Date(today.getFullYear(), today.getMonth() - months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return isoDate(target.getFullYear(), target.getMonth(), Math.min(today.getDate(), lastDay));
};

/** Righe del periodo, in ordine di data crescente. */
export const filterByPeriod = (stats, period, today = new Date()) => {
  const sorted = sortByDate(stats);
  const start = periodStart(period, today);
  return start === null ? sorted : sorted.filter((row) => row.date >= start);
};

/**
 * Variazione del peso tra la prima e l'ultima riga con un peso valido.
 * Ritorna null con meno di due pesi; 0 è un risultato valido.
 */
export const periodWeightDelta = (rows) => {
  const weights = sortByDate(rows).map((row) => row.weight).filter(isValidNumber).map(parseFloat);
  if (weights.length < 2) return null;
  return weights[weights.length - 1] - weights[0];
};

export const PAGE_SIZE = 10;

/**
 * Una pagina di righe. `page` parte da 0 e viene riportato dentro i limiti
 * (si può cancellare l'ultima riga dell'ultima pagina); from/to sono 1-based.
 */
export const paginate = (rows, page, pageSize = PAGE_SIZE) => {
  const total = rows.length;
  const lastPage = Math.max(Math.ceil(total / pageSize) - 1, 0);
  const current = Math.min(Math.max(page, 0), lastPage);
  const start = current * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    page: current,
    lastPage,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, total),
    total,
  };
};
