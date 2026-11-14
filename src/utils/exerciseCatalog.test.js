import { describe, it, expect } from 'vitest';
import { exerciseRank, rankExerciseMatches } from './exerciseCatalog';

const ex = (name, extra = {}) => ({ name, ...extra });

describe('exerciseRank', () => {
  it('0 nome uguale, 1 inizia con, 2 una parola inizia con, 3 contiene', () => {
    expect(exerciseRank(ex('Panca'), 'panca')).toBe(0);
    expect(exerciseRank(ex('Panca piana'), 'panca')).toBe(1);
    expect(exerciseRank(ex('Croci Panca Piana (Cavi)'), 'panca')).toBe(2);
    expect(exerciseRank(ex('Croci (Cavi)'), 'cavi')).toBe(2);
    expect(exerciseRank(ex('Superpanca'), 'panca')).toBe(3);
  });

  it('vince il nome migliore tra name, name_it e name_en', () => {
    expect(exerciseRank(ex('Bench Press', { name_it: 'Panca piana', name_en: 'Bench Press' }), 'panca')).toBe(1);
    expect(exerciseRank(ex('Croci panca', { name_en: 'Panca' }), 'panca')).toBe(0);
  });

  it('ignora maiuscole e spazi attorno; null senza corrispondenza', () => {
    expect(exerciseRank(ex('Panca piana'), '  PANCA ')).toBe(1);
    expect(exerciseRank(ex('Squat'), 'panca')).toBeNull();
  });
});

describe('rankExerciseMatches', () => {
  const list = [ex('Croci Panca Piana (Cavi)'), ex('Panca piana'), ex('Superpanca'), ex('Panca inclinata'), ex('Squat')];

  it('"panca" mette "Panca piana" prima di "Croci Panca Piana (Cavi)"', () => {
    const names = rankExerciseMatches(list, 'panca').map((e) => e.name);
    expect(names).toEqual(['Panca inclinata', 'Panca piana', 'Croci Panca Piana (Cavi)', 'Superpanca']);
  });

  it('senza ricerca lascia l\'elenco com\'è', () => {
    expect(rankExerciseMatches(list, '  ')).toBe(list);
  });

  it('a parità di pertinenza ordina per nome', () => {
    const names = rankExerciseMatches([ex('Pull B'), ex('Pull A')], 'pull').map((e) => e.name);
    expect(names).toEqual(['Pull A', 'Pull B']);
  });
});
