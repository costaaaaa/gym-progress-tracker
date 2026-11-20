// Posizioni dei tondi del ventaglio: «Inizia» sempre nello stesso punto, le altre voci in arco o a rombo.
import { describe, it, expect } from 'vitest';
import { fanLayout, START_POSITION } from './fanLayout';
import { CIRCLE, TARGET_WIDTH, LABEL_SPACE } from './barMetrics';

const main = { key: 'start', main: true };
const record = { key: 'record' };
const measure = { key: 'measure' };
const cardio = { key: 'cardio' };
const coach = { key: 'coach' };
const at = (items) => Object.fromEntries(items.map((item, i) => [item.key, fanLayout(items)[i]]));

describe('ventaglio: posizioni', () => {
  it('«Inizia» sta sempre in alto al centro, qualunque sia il numero di voci', () => {
    for (const others of [[record], [record, measure], [record, cardio, measure], [record, cardio, measure, coach]]) {
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

});

// Il bersaglio vero di una voce, come lo disegna CenterFan: largo TARGET_WIDTH, centrato su x; alto tondo + LABEL_SPACE,
// con il tondo che sta sopra il punto y e il testo sotto
const target = (item, { x, y }) => {
  const size = item.main ? CIRCLE.main : CIRCLE.other;
  return { left: x - TARGET_WIDTH / 2, right: x + TARGET_WIDTH / 2, top: y + size / 2, bottom: y - size / 2 - LABEL_SPACE };
};
const touch = (a, b) => a.left <= b.right && b.left <= a.right && a.bottom <= b.top && b.bottom <= a.top;

describe.each([
  ['2', [main, record]],
  ['3', [main, record, measure]],
  ['4', [main, record, cardio, measure]],
  ['5', [main, record, cardio, measure, coach]],
])('ventaglio a %s voci: bersagli veri', (_, items) => {
  const boxes = () => fanLayout(items).map((position, i) => target(items[i], position));

  it('stanno dentro lo schermo largo 320 px (160 px per lato dal centro) e sopra la barra', () => {
    for (const box of boxes()) {
      expect(box.left).toBeGreaterThanOrEqual(-160);
      expect(box.right).toBeLessThanOrEqual(160);
      expect(box.bottom).toBeGreaterThanOrEqual(0);
    }
  });

  it('non si toccano tra loro', () => {
    const all = boxes();
    for (let a = 0; a < all.length; a += 1) {
      for (let b = a + 1; b < all.length; b += 1) expect(touch(all[a], all[b]), `${items[a].key} e ${items[b].key}`).toBe(false);
    }
  });
});

describe('ventaglio: numero di voci', () => {
  it.each([[0], [1], [6]])('con %s voci lancia un errore chiaro', (count) => {
    const items = Array.from({ length: count }, (_, i) => ({ key: `k${i}`, main: i === 0 }));
    expect(() => fanLayout(items)).toThrow('da 2 a 5 voci');
  });
});
