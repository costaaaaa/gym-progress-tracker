import { describe, it, expect } from 'vitest';
import { totalSets, weeklyTotal } from './weeklySets';

describe('totalSets', () => {
  it('somma le serie dei muscoli contati', () => {
    expect(totalSets({ petto: 3, schiena: 2, polpacci: 1 })).toBe(6);
  });

  it('ignora chiavi che non sono muscoli contati', () => {
    expect(totalSets({ petto: 3, gambe: 5 })).toBe(3);
  });

  it('blocco assente (server vecchio): 0', () => {
    expect(totalSets(undefined)).toBe(0);
  });
});

describe('weeklyTotal', () => {
  it('piano Gratis: usa total', () => {
    expect(weeklyTotal({ total: 11 })).toBe(11);
  });

  it('piano completo senza total (server vecchio): somma week', () => {
    expect(weeklyTotal({ week: { petto: 5, schiena: 3 } })).toBe(8);
  });

  it('total a 0 vale 0, non somma week', () => {
    expect(weeklyTotal({ total: 0, week: { petto: 5 } })).toBe(0);
  });

  it('weekly_sets assente: 0', () => {
    expect(weeklyTotal(undefined)).toBe(0);
  });
});
