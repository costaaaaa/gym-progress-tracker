// Posizioni dei tondi del ventaglio: «Inizia» sempre nello stesso punto, le altre voci in arco o a rombo.
import { describe, it, expect } from 'vitest';
import { fanLayout, START_POSITION } from './fanLayout';

const main = { key: 'start', main: true };
const record = { key: 'record' };
const measure = { key: 'measure' };
const cardio = { key: 'cardio' };
const coach = { key: 'coach' };
const at = (items) => Object.fromEntries(items.map((item, i) => [item.key, fanLayout(items)[i]]));

describe('ventaglio: posizioni', () => {
  it('«Inizia» sta sempre in alto al centro, qualunque sia il numero di voci', () => {
    for (const others of [[], [record], [record, measure], [record, cardio, measure], [record, cardio, measure, coach]]) {
      expect(at([main, ...others]).start).toEqual(START_POSITION);
    }
    expect(START_POSITION.x).toBe(0);
  });

  it('con 2 voci «Registra» sta sotto «Inizia»', () => {
    const p = at([main, record]);
    expect(p.record.x).toBe(0);
    expect(p.record.y).toBeLessThan(START_POSITION.y);
  });

  it('con 3 voci l\'arco è simmetrico: Registra a sinistra, Misura a destra, alla stessa altezza', () => {
    const p = at([main, record, measure]);
    expect(p.record.x).toBe(-p.measure.x);
    expect(p.record.x).toBeLessThan(0);
    expect(p.record.y).toBe(p.measure.y);
    expect(p.record.y).toBeLessThan(START_POSITION.y);
  });

  it('con 4 voci è un rombo: Registra in basso al centro, le altre due a mezza altezza ai lati', () => {
    const p = at([main, record, cardio, measure]);
    expect(p.record.x).toBe(0);
    expect(p.cardio.x).toBe(-p.measure.x);
    expect(p.cardio.x).toBeLessThan(0);
    expect(p.cardio.y).toBe(p.measure.y);
    expect(p.record.y).toBeLessThan(p.cardio.y);
    expect(p.cardio.y).toBeLessThan(START_POSITION.y);
  });

  it('con 5 voci l\'arco è simmetrico e le voci vanno da sinistra a destra nell\'ordine dell\'elenco', () => {
    const p = at([main, record, cardio, measure, coach]);
    expect(p.record.x).toBe(-p.coach.x);
    expect(p.cardio.x).toBe(-p.measure.x);
    expect(p.record.x).toBeLessThan(p.cardio.x);
    expect(p.cardio.x).toBeLessThan(0);
    expect(p.record.y).toBeLessThan(p.cardio.y);
  });

  it('una voce che non è la prima nell\'elenco non sposta «Inizia»', () => {
    const items = [record, main, measure];
    expect(fanLayout(items)[1]).toEqual(START_POSITION);
  });

  it('le posizioni stanno in 320 px: i testi sotto i tondi non escono dallo schermo', () => {
    for (const items of [[main, record, cardio, measure, coach], [main, record, cardio, measure]]) {
      for (const { x } of fanLayout(items)) expect(Math.abs(x) + 32).toBeLessThanOrEqual(160);
    }
  });
});
