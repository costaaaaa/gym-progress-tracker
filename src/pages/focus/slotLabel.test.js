import { describe, it, expect } from 'vitest';
import { slotLabel } from './slotLabel';

// Traduttore finto: chiave e variabili, per vedere cosa chiede l'helper
const t = (key, vars) => `${key}|${vars.n}|${vars.total}`;
const warmup = { isWarmup: true, number: 1, total: 2, workingIndex: -1 };
const working = { isWarmup: false, number: 3, total: 4, workingIndex: 2 };

describe('slotLabel: il testo di una posizione dipende dal tipo di serie', () => {
  it('riscaldamento e allenante usano chiavi diverse per nome, "N di M" e prossima serie', () => {
    expect(['name', 'of', 'next'].map((kind) => slotLabel(t, warmup, kind))).toEqual([
      'focus.warmup_n|1|2', 'focus.warmup_of|1|2', 'focus.next_warmup|1|2',
    ]);
    expect(['name', 'of', 'next'].map((kind) => slotLabel(t, working, kind))).toEqual([
      'focus.set_n|3|4', 'focus.set_of|3|4', 'focus.next_set|3|4',
    ]);
  });

  it('dentro il pallino il riscaldamento ha la sigla, l\'allenante il solo numero', () => {
    expect(slotLabel(t, warmup, 'dot')).toBe('focus.warmup_dot|1|2');
    expect(slotLabel(t, working, 'dot')).toBe('3');
  });
});
