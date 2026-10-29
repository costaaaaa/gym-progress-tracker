import { describe, it, expect } from 'vitest';
import { primaryMuscleOptions } from './muscleRules';

describe('primaryMuscleOptions', () => {
  it('gambe: 5 opzioni, nessun default', () => {
    expect(primaryMuscleOptions('gambe')).toEqual(['quadricipiti', 'femorali', 'glutei', 'adduttori', 'abduttori']);
  });

  it('glutei: glutei (default) o abduttori', () => {
    expect(primaryMuscleOptions('glutei')).toEqual(['glutei', 'abduttori']);
  });

  it('un altro gruppo: nessuna scelta in UI, il server lo deriva da solo', () => {
    expect(primaryMuscleOptions('petto')).toBeNull();
  });

  it('maiuscole indifferenti (come lo salva ExerciseDialog, "Gambe")', () => {
    expect(primaryMuscleOptions('Gambe')).toEqual(['quadricipiti', 'femorali', 'glutei', 'adduttori', 'abduttori']);
  });
});
