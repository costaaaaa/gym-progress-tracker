import { describe, it, expect } from 'vitest';
import { DEFAULT_PERIOD, PERIODS, periodStart, filterByPeriod, periodWeightDelta, sortByDate, paginate } from './bodyStatsPeriod';

const day = (y, m, d) => new Date(y, m - 1, d, 12, 0);
const row = (date, weight) => ({ id: date, date, weight });

describe('periodStart', () => {
  const today = day(2026, 10, 20);

  it('conta mesi di calendario da oggi', () => {
    expect(periodStart('1m', today)).toBe('2026-09-20');
    expect(periodStart('3m', today)).toBe('2026-07-20');
    expect(periodStart('6m', today)).toBe('2026-04-20');
    expect(periodStart('1y', today)).toBe('2025-10-20');
  });

  it('se il giorno non esiste nel mese di partenza prende l\'ultimo giorno di quel mese', () => {
    expect(periodStart('1m', day(2026, 3, 31))).toBe('2026-02-28');
    expect(periodStart('1m', day(2024, 3, 31))).toBe('2024-02-29');
    expect(periodStart('6m', day(2026, 8, 31))).toBe('2026-02-28');
  });

  it('attraversa l\'anno', () => {
    expect(periodStart('3m', day(2026, 1, 15))).toBe('2025-10-15');
    expect(periodStart('1y', day(2024, 2, 29))).toBe('2023-02-28');
  });

  it('"all" non ha un inizio', () => {
    expect(periodStart('all', today)).toBeNull();
  });

  it('il periodo di partenza è uno di quelli offerti', () => {
    expect(PERIODS).toContain(DEFAULT_PERIOD);
  });
});

describe('filterByPeriod', () => {
  const today = day(2026, 10, 20);
  const stats = [row('2026-09-19', '80'), row('2026-09-20', '79.5'), row('2026-10-20', '79'), row('2025-01-01', '85')];

  it('include il giorno di inizio ed esclude il giorno prima', () => {
    expect(filterByPeriod(stats, '1m', today).map((r) => r.date)).toEqual(['2026-09-20', '2026-10-20']);
  });

  it('"all" restituisce tutte le righe', () => {
    expect(filterByPeriod(stats, 'all', today)).toHaveLength(4);
  });

  it('restituisce le righe in ordine di data anche se arrivano disordinate, senza toccare l\'input', () => {
    const input = [row('2026-10-01', '79'), row('2026-08-01', '81'), row('2026-09-01', '80')];
    const snapshot = JSON.parse(JSON.stringify(input));
    expect(filterByPeriod(input, 'all', today).map((r) => r.date)).toEqual(['2026-08-01', '2026-09-01', '2026-10-01']);
    expect(input).toEqual(snapshot);
  });

  it('un periodo senza righe dà una lista vuota', () => {
    expect(filterByPeriod([row('2025-01-01', '85')], '3m', today)).toEqual([]);
  });
});

describe('periodWeightDelta', () => {
  it('è ultimo meno primo peso del periodo', () => {
    expect(periodWeightDelta([row('2026-09-01', '82.0'), row('2026-10-01', '80.5')])).toBeCloseTo(-1.5);
  });

  it('con meno di due pesi non c\'è variazione', () => {
    expect(periodWeightDelta([])).toBeNull();
    expect(periodWeightDelta([row('2026-10-01', '80')])).toBeNull();
  });

  it('una variazione di 0 è un risultato, non "nessun dato"', () => {
    expect(periodWeightDelta([row('2026-09-01', '80'), row('2026-10-01', '80.0')])).toBe(0);
  });

  it('salta le righe senza peso valido (null, vuoto, non numerico)', () => {
    const rows = [row('2026-08-01', null), row('2026-09-01', '81'), row('2026-09-15', ''), row('2026-09-20', 'abc'), row('2026-10-01', 79), row('2026-10-05', undefined)];
    expect(periodWeightDelta(rows)).toBe(-2);
  });

  it('accetta pesi numerici o stringa e righe disordinate', () => {
    expect(periodWeightDelta([row('2026-10-01', 79), row('2026-09-01', '81')])).toBe(-2);
  });
});

describe('sortByDate', () => {
  it('non modifica l\'array ricevuto', () => {
    const input = [row('2026-10-01', '1'), row('2026-09-01', '2')];
    sortByDate(input);
    expect(input[0].date).toBe('2026-10-01');
  });
});

describe('paginate', () => {
  const rows = Array.from({ length: 23 }, (_, i) => i + 1);

  it('prima pagina: le prime 10 righe, "1–10 di 23"', () => {
    expect(paginate(rows, 0)).toMatchObject({ rows: rows.slice(0, 10), page: 0, lastPage: 2, from: 1, to: 10, total: 23 });
  });

  it('ultima pagina parziale: "21–23 di 23"', () => {
    expect(paginate(rows, 2)).toMatchObject({ rows: [21, 22, 23], page: 2, from: 21, to: 23 });
  });

  it('una pagina oltre i limiti viene riportata nei limiti', () => {
    expect(paginate(rows, 9).page).toBe(2);
    expect(paginate(rows, -3).page).toBe(0);
  });

  it('senza righe: pagina 0 e "0–0 di 0"', () => {
    expect(paginate([], 0)).toMatchObject({ rows: [], page: 0, lastPage: 0, from: 0, to: 0, total: 0 });
  });

  it('con esattamente 10 righe c\'è una sola pagina', () => {
    expect(paginate(rows.slice(0, 10), 0).lastPage).toBe(0);
  });
});
