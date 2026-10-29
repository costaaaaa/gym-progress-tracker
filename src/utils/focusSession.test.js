import { describe, it, expect } from 'vitest';
import { lastSessionSets } from './focusSession';

describe('lastSessionSets: il riscaldamento non è "ultima volta" (#66)', () => {
  it('esclude le serie is_warmup dalle chip "ultima volta"', () => {
    const chips = lastSessionSets({
      sets: [
        { weight: 20, reps: 10, is_warmup: true },
        { weight: 80, reps: 5, intensity_technique: '' },
      ],
    });
    expect(chips).toEqual([{ label: '80kg×5', technique: '' }]);
  });

  it('senza sessione precedente ritorna un elenco vuoto', () => {
    expect(lastSessionSets(null)).toEqual([]);
  });
});
