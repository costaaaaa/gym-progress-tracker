import { describe, it, expect } from 'vitest';
import { NO_TECHNIQUE, SELECTABLE_TECHNIQUES, isSelectableTechnique, techniqueChoices } from './intensityTechniques';

describe('SELECTABLE_TECHNIQUES', () => {
  it('sono quattro, nell\'ordine dei menu, con i valori salvati di oggi', () => {
    expect(SELECTABLE_TECHNIQUES).toEqual(['Drop Set (Stripping)', 'Rest Pause', 'Myo-Reps', 'Negative']);
  });
});

describe('isSelectableTechnique', () => {
  it('vale per le quattro e per nient\'altro', () => {
    SELECTABLE_TECHNIQUES.forEach((tech) => expect(isSelectableTechnique(tech)).toBe(true));
    ['Super Set', 'Jump Set', 'Ripetizioni Forzate', 'Isometria', 'Peak Contraction', NO_TECHNIQUE, '', null, undefined]
      .forEach((tech) => expect(isSelectableTechnique(tech)).toBe(false));
  });
});

describe('techniqueChoices', () => {
  it('offre le quattro quando il valore attuale è vuoto, «nessuna» o una delle quattro', () => {
    [undefined, null, '', NO_TECHNIQUE, 'Rest Pause'].forEach((current) => {
      expect(techniqueChoices(current)).toEqual(SELECTABLE_TECHNIQUES);
    });
  });

  it('aggiunge in coda il valore attuale se è una tecnica tolta', () => {
    expect(techniqueChoices('Super Set')).toEqual([...SELECTABLE_TECHNIQUES, 'Super Set']);
  });
});
