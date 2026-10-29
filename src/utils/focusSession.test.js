import { describe, it, expect } from 'vitest';
import {
  lastSessionSets, totalSlots, setSlot, skipWarmup, slotWeight, numberedSets, swapExercise, buildSessionEntry, initialSetRows, suggestedWeight, toggleWarmupRow, rowPlanReps,
} from './focusSession';

describe('suggestedWeight: il peso suggerito viene dalle serie allenanti dell\'ultima volta (#67)', () => {
  it('è il peso più alto tra le serie allenanti, come stringa', () => {
    expect(suggestedWeight({ sets: [{ weight: 40, reps: 8, is_warmup: true }, { weight: 100, reps: 5 }, { weight: 95, reps: 6 }] })).toBe('100');
  });

  it('un riscaldamento più pesante di tutte le serie non conta', () => {
    expect(suggestedWeight({ sets: [{ weight: 120, reps: 1, is_warmup: true }, { weight: 100, reps: 5 }] })).toBe('100');
  });

  it('con soli riscaldamenti, senza serie o senza sessione non suggerisce niente', () => {
    expect(suggestedWeight({ sets: [{ weight: 40, reps: 8, is_warmup: true }] })).toBe('');
    expect(suggestedWeight({ sets: [] })).toBe('');
    expect(suggestedWeight(null)).toBe('');
  });
});

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

describe('sequenza delle serie di un esercizio: prima il riscaldamento, poi le serie allenanti (#67)', () => {
  const squat = { sets: 3, warmup_sets: 2 };

  it('le serie di riscaldamento della scheda si sommano alle allenanti', () => {
    expect(totalSlots(squat)).toBe(5);
    expect(totalSlots({ sets: 3 })).toBe(3);
    expect(totalSlots({ sets: 3, warmup_sets: 0 })).toBe(3);
  });

  it('ogni posizione dice se è riscaldamento, il suo numero e il totale del suo tipo', () => {
    expect(setSlot(squat, 0)).toEqual({ isWarmup: true, number: 1, total: 2, workingIndex: -1 });
    expect(setSlot(squat, 1)).toEqual({ isWarmup: true, number: 2, total: 2, workingIndex: -1 });
    expect(setSlot(squat, 2)).toEqual({ isWarmup: false, number: 1, total: 3, workingIndex: 0 });
    expect(setSlot(squat, 4)).toEqual({ isWarmup: false, number: 3, total: 3, workingIndex: 2 });
  });

  it('senza riscaldamento la posizione coincide con la serie, come prima', () => {
    expect(setSlot({ sets: 3 }, 1)).toEqual({ isWarmup: false, number: 2, total: 3, workingIndex: 1 });
  });
});

describe('"Salta riscaldamento" (#67)', () => {
  const squat = { sets: 3, warmup_sets: 3 };

  it('segna come saltate le serie di riscaldamento rimaste e porta alla prima allenante', () => {
    expect(skipWarmup(squat, 0)).toEqual({ skipped: [0, 1, 2], nextIndex: 3 });
    expect(skipWarmup(squat, 1)).toEqual({ skipped: [1, 2], nextIndex: 3 });
    expect(skipWarmup(squat, 2)).toEqual({ skipped: [2], nextIndex: 3 });
  });
});

describe('peso con cui parte ogni serie (#67)', () => {
  const squat = { sets: 3, warmup_sets: 2, equipment: 'bilanciere' };
  const pullup = { sets: 3, warmup_sets: 1, equipment: 'corpo_libero' };

  it('il riscaldamento parte vuoto, anche con un peso suggerito dall\'ultima volta', () => {
    expect(slotWeight(squat, 0, { suggested: '100' })).toBe('');
    expect(slotWeight(squat, 1, { suggested: '100', current: '40' })).toBe('');
  });

  it('la prima serie allenante prende il peso suggerito, anche dopo un riscaldamento', () => {
    expect(slotWeight(squat, 2, { suggested: '100', current: '60' })).toBe('100');
    expect(slotWeight({ sets: 3 }, 0, { suggested: '100' })).toBe('100');
  });

  it('le allenanti successive ripartono vuote', () => {
    expect(slotWeight(squat, 3, { suggested: '100', current: '100' })).toBe('');
  });

  it('i corpo libero partono da 0 e mantengono il peso appena usato', () => {
    expect(slotWeight(pullup, 0, {})).toBe('0');
    expect(slotWeight(pullup, 1, { current: '5' })).toBe('0');
    expect(slotWeight(pullup, 2, { current: '5' })).toBe('5');
  });
});

describe('set da inviare con il riscaldamento (#67)', () => {
  it('numera di seguito le serie fatte nell\'ordine, riscaldamento per primo, e porta is_warmup', () => {
    const sets = [
      { weight: 20, reps: '10', is_warmup: true },
      { weight: 80, reps: '5', is_warmup: false },
      { weight: 80, reps: '5' },
    ];
    expect(numberedSets(sets).map((x) => [x.set_number, x.is_warmup])).toEqual([[1, true], [2, false], [3, false]]);
  });
});

describe('cambio e aggiunta esercizio con il riscaldamento (#67)', () => {
  it('il cambio mantiene i riscaldamenti della scheda', () => {
    const exercises = [{ id: 1, exercise_name: 'Squat', sets: 3, warmup_sets: 2, reps: '5', rest: 120 }];
    const swapped = swapExercise(exercises, 0, { id: 7, name: 'Leg press', muscle_group: 'gambe' });
    expect(swapped[0].warmup_sets).toBe(2);
  });

  it('un esercizio aggiunto in sessione non ha riscaldamento', () => {
    const entry = buildSessionEntry({ id: 7, name: 'Leg press', muscle_group: 'gambe' }, { sets: 3, reps: '10', rest: 60 });
    expect(entry.warmup_sets).toBe(0);
  });
});

describe('righe iniziali dell\'inserimento manuale (#67)', () => {
  it('prima le righe di riscaldamento (senza peso, ripetizioni né tecnica), poi le allenanti dalla scheda', () => {
    const rows = initialSetRows({ sets: 2, warmup_sets: 2, reps: '10/8', equipment: 'bilanciere', intensity_technique: 'Drop set' });
    expect(rows).toEqual([
      { is_warmup: true, weight: '', reps: '', intensity_technique: '' },
      { is_warmup: true, weight: '', reps: '', intensity_technique: '' },
      { is_warmup: false, weight: '', reps: '10', intensity_technique: 'Drop set' },
      { is_warmup: false, weight: '', reps: '8', intensity_technique: 'Drop set' },
    ]);
  });

  it('senza riscaldamento restano le righe di prima; i corpo libero hanno peso 0', () => {
    const rows = initialSetRows({ sets: 2, reps: 'Max', equipment: 'corpo_libero' });
    expect(rows).toEqual([
      { is_warmup: false, weight: '0', reps: '', intensity_technique: '' },
      { is_warmup: false, weight: '0', reps: '', intensity_technique: '' },
    ]);
  });
});

describe('righe del manuale: attivare o disattivare il riscaldamento (#67)', () => {
  const rows = (...reps) => reps.map((r, i) => ({ is_warmup: i === 0, weight: '', reps: r, intensity_technique: 'Drop set' }));

  it('rowPlanReps: vuoto per il riscaldamento, per le altre conta solo chi non è riscaldamento prima', () => {
    const r = rows('', '8', '6', '4');
    expect([0, 1, 2, 3].map((i) => rowPlanReps(r, i, '8/6/4'))).toEqual(['', '8', '6', '4']);
    expect(rowPlanReps(r, 1, '8-10')).toBe('8-10');
  });

  it('spegnendo il riscaldamento le ripetizioni precompilate scalano; oltre la lista vale l\'ultimo valore', () => {
    expect(toggleWarmupRow(rows('', '8', '6', '4'), 0, '8/6/4').map((r) => [r.is_warmup, r.reps])).toEqual([
      [false, '8'], [false, '6'], [false, '4'], [false, '4'],
    ]);
  });

  it('riaccendendolo tornano com\'erano; le righe già scritte dall\'utente non si toccano', () => {
    const off = toggleWarmupRow(rows('', '8', '6', '4'), 0, '8/6/4');
    expect(toggleWarmupRow(off, 0, '8/6/4').map((r) => r.reps)).toEqual(['', '8', '6', '4']);
    const edited = rows('', '8', '7', '4');
    expect(toggleWarmupRow(edited, 0, '8/6/4').map((r) => r.reps)).toEqual(['8', '6', '7', '4']);
  });

  it('se la scheda non ha numeri per serie le righe restano vuote e il resto della riga non cambia', () => {
    const r = rows('', '', '', '');
    const out = toggleWarmupRow(r, 0, 'Max');
    expect(out.map((x) => x.reps)).toEqual(['', '', '', '']);
    expect(out[1]).toEqual(r[1]);
    expect(out[0]).toEqual({ ...r[0], is_warmup: false });
  });
});
