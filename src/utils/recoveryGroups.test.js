import { describe, it, expect } from 'vitest';
import { groupRecovery } from './recoveryGroups';

const now = new Date(2026, 9, 21, 18, 30);

describe('groupRecovery', () => {
  it('divide i gruppi in "puoi allenare", "a riposo" e "nessun dato"', () => {
    const result = groupRecovery({
      petto: { status: 'PRONTO', percent: 100, ready_at: null },
      schiena: { status: 'IN RECUPERO', percent: 60, ready_at: '2026-10-22 08:00:00' },
      spalle: { status: 'AFFATICATO', percent: 20, ready_at: '2026-10-24 08:00:00' },
      tricipiti: { status: null },
    }, now);

    expect(result.canTrain).toEqual(['petto']);
    expect(result.resting).toEqual([
      { group: 'schiena', status: 'IN RECUPERO', percent: 60, days: 1 },
      { group: 'spalle', status: 'AFFATICATO', percent: 20, days: 3 },
    ]);
    expect(result.noData).toEqual(['bicipiti', 'tricipiti', 'addome', 'quadricipiti', 'femorali', 'glutei', 'polpacci']);
  });

  it('"a riposo" va per giorni crescenti, a parità nell\'ordine del corpo; senza giorno in fondo, sempre nell\'ordine del corpo', () => {
    const result = groupRecovery({
      spalle: { status: 'AFFATICATO', percent: 20, ready_at: '2026-10-24 08:00:00' },
      femorali: { status: 'IN RECUPERO', percent: 50, ready_at: null },
      glutei: { status: 'AFFATICATO', percent: 30, ready_at: null },
      quadricipiti: { status: 'IN RECUPERO', percent: 70, ready_at: '2026-10-22 09:00:00' },
      bicipiti: { status: 'IN RECUPERO', percent: 85, ready_at: '2026-10-21 20:00:00' },
      schiena: { status: 'IN RECUPERO', percent: 60, ready_at: '2026-10-22 08:00:00' },
    }, now);

    expect(result.resting.map((r) => [r.group, r.days])).toEqual([
      ['bicipiti', 0], ['schiena', 1], ['quadricipiti', 1], ['spalle', 3], ['femorali', null], ['glutei', null],
    ]);
  });

  it('"puoi allenare" segue l\'ordine del corpo, non quello dei dati', () => {
    const result = groupRecovery({
      polpacci: { status: 'PRONTO', percent: 100 },
      petto: { status: 'PRONTO', percent: 100 },
      glutei: { status: 'PRONTO', percent: 100 },
    }, now);

    expect(result.canTrain).toEqual(['petto', 'glutei', 'polpacci']);
  });

  it('la percentuale è limitata tra 0 e 100; se manca resta null', () => {
    const result = groupRecovery({
      petto: { status: 'IN RECUPERO', percent: 150, ready_at: '2026-10-22 08:00:00' },
      schiena: { status: 'IN RECUPERO', percent: -5, ready_at: '2026-10-22 08:00:00' },
      spalle: { status: 'IN RECUPERO', ready_at: '2026-10-22 08:00:00' },
    }, now);

    expect(result.resting.map((r) => [r.group, r.percent])).toEqual([['petto', 100], ['schiena', 0], ['spalle', null]]);
  });

  it('tutto pronto: "a riposo" è vuoto', () => {
    const data = Object.fromEntries(
      ['petto', 'schiena', 'spalle', 'bicipiti', 'tricipiti', 'addome', 'quadricipiti', 'femorali', 'glutei', 'polpacci']
        .map((g) => [g, { status: 'PRONTO', percent: 100, ready_at: null }]),
    );
    const result = groupRecovery(data, now);

    expect(result.resting).toEqual([]);
    expect(result.noData).toEqual([]);
    expect(result.canTrain).toHaveLength(10);
  });

  it('senza dati (undefined) tutti i gruppi sono "nessun dato", nell\'ordine del corpo', () => {
    expect(groupRecovery(undefined, now)).toEqual({
      canTrain: [],
      resting: [],
      noData: ['petto', 'schiena', 'spalle', 'bicipiti', 'tricipiti', 'addome', 'quadricipiti', 'femorali', 'glutei', 'polpacci'],
    });
  });
});
