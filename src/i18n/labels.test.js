import { describe, it, expect } from 'vitest';
import { INTENSITY_TECHNIQUES, NO_TECHNIQUE } from './labels';

describe('INTENSITY_TECHNIQUES', () => {
  it('parte da "Nessuna (Normale)" e tiene l\'ordine del menu', () => {
    expect(NO_TECHNIQUE).toBe('Nessuna (Normale)');
    expect(INTENSITY_TECHNIQUES).toEqual([
      'Nessuna (Normale)', 'Drop Set (Stripping)', 'Rest Pause', 'Super Set', 'Jump Set',
      'Negative', 'Ripetizioni Forzate', 'Isometria', 'Peak Contraction', 'Myo-Reps',
    ]);
  });
});
