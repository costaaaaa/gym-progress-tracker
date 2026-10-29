import { describe, it, expect } from 'vitest';
import { totalSets } from './weeklySets';

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
