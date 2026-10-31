import { describe, it, expect } from 'vitest';
import {
  lastSessionSets, totalSlots, setSlot, skipWarmup, slotWeight, numberedSets, withWarmupRule, isCurrentDraft, swapExercise, buildSessionEntry, suggestedWeight,
  plannedSetAt, slotTarget, slotTechnique, repsNeedConfirm, addedPlannedSets,
} from './focusSession';
import { DROP, plannedSets, times, work } from '../test/plannedSets';

// Squat: 2 riscaldamenti + 3 serie allenanti (12 / 10 / a cedimento min. 6 con Drop set)
const squatSets = plannedSets(2, [{ min: 12, max: 12 }, { min: 10, max: 10 }, { min: 6, failure: true, technique: DROP }]);
const squatEx = { planned_sets: squatSets };

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
  const squat = squatEx;
  const noWarmup = { planned_sets: plannedSets(0, times(3, { min: 8, max: 10 })) };

  it('le serie di riscaldamento della scheda si sommano alle allenanti', () => {
    expect(totalSlots(squat)).toBe(5);
    expect(totalSlots(noWarmup)).toBe(3);
  });

  it('ogni posizione dice se è riscaldamento, il suo numero e il totale del suo tipo', () => {
    expect(setSlot(squat, 0)).toEqual({ isWarmup: true, number: 1, total: 2, workingIndex: -1 });
    expect(setSlot(squat, 1)).toEqual({ isWarmup: true, number: 2, total: 2, workingIndex: -1 });
    expect(setSlot(squat, 2)).toEqual({ isWarmup: false, number: 1, total: 3, workingIndex: 0 });
    expect(setSlot(squat, 4)).toEqual({ isWarmup: false, number: 3, total: 3, workingIndex: 2 });
  });

  it('senza riscaldamento la posizione coincide con la serie, come prima', () => {
    expect(setSlot(noWarmup, 1)).toEqual({ isWarmup: false, number: 2, total: 3, workingIndex: 1 });
  });
});

describe('"Salta riscaldamento" (#67)', () => {
  const squat = { planned_sets: plannedSets(3, times(3, { min: 8, max: 8 })) };

  it('segna come saltate le serie di riscaldamento rimaste e porta alla prima allenante', () => {
    expect(skipWarmup(squat, 0)).toEqual({ skipped: [0, 1, 2], nextIndex: 3 });
    expect(skipWarmup(squat, 1)).toEqual({ skipped: [1, 2], nextIndex: 3 });
    expect(skipWarmup(squat, 2)).toEqual({ skipped: [2], nextIndex: 3 });
  });
});

describe('peso con cui parte ogni serie (#67)', () => {
  const squat = { ...squatEx, equipment: 'bilanciere' };
  const pullup = { planned_sets: plannedSets(1, times(3, { min: 8, max: 8 })), equipment: 'corpo_libero' };
  const noWarmup = { planned_sets: plannedSets(0, times(3, { min: 8, max: 8 })) };

  it('il riscaldamento parte vuoto, anche con un peso suggerito dall\'ultima volta', () => {
    expect(slotWeight(squat, 0, { suggested: '100' })).toBe('');
    expect(slotWeight(squat, 1, { suggested: '100', current: '40' })).toBe('');
  });

  it('la prima serie allenante prende il peso suggerito, anche dopo un riscaldamento', () => {
    expect(slotWeight(squat, 2, { suggested: '100', current: '60' })).toBe('100');
    expect(slotWeight(noWarmup, 0, { suggested: '100' })).toBe('100');
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

describe('regola del riscaldamento sulla serie registrata (#67)', () => {
  it('il riscaldamento perde la tecnica e is_warmup è sempre un booleano', () => {
    expect(withWarmupRule({ weight: 20, intensity_technique: 'Drop set', is_warmup: true })).toMatchObject({ intensity_technique: '', is_warmup: true });
    expect(withWarmupRule({ weight: 80, intensity_technique: 'Drop set' })).toMatchObject({ intensity_technique: 'Drop set', is_warmup: false });
  });
});

describe('bozza del Focus: solo quella del formato con le serie pianificate si riprende (#77)', () => {
  it('il segno plannedSetsFormat scritto dal salvataggio la rende riprendibile', () => {
    expect(isCurrentDraft({ plannedSetsFormat: true, selectedDay: {}, startTime: 'x' })).toBe(true);
  });

  it('una bozza vecchia, con o senza slotsIncludeWarmup, non lo è', () => {
    expect(isCurrentDraft({ selectedDay: {}, startTime: 'x' })).toBe(false);
    expect(isCurrentDraft({ slotsIncludeWarmup: true, selectedDay: {}, startTime: 'x' })).toBe(false);
  });
});

describe('serie pianificata di una posizione (#77)', () => {
  it('la posizione i della sessione è planned_sets[i], riscaldamenti compresi', () => {
    expect(plannedSetAt(squatEx, 0).kind).toBe('warmup');
    expect(plannedSetAt(squatEx, 4)).toMatchObject({ set_number: 5, kind: 'working', to_failure: true, reps_min: 6 });
  });

  it('fuori dalla lista o senza serie pianificate non c\'è niente', () => {
    expect(plannedSetAt(squatEx, 5)).toBeNull();
    expect(plannedSetAt({}, 0)).toBeNull();
    expect(plannedSetAt(null, 0)).toBeNull();
  });
});

describe('obiettivo e tecnica di ogni posizione (#77)', () => {
  it('l\'obiettivo in grigio è quello della serie: numero, intervallo, a cedimento con o senza minimo', () => {
    expect([2, 3, 4].map((i) => slotTarget(squatEx, i))).toEqual(['12', '10', 'a cedimento (min. 6)']);
    const ex = { planned_sets: plannedSets(0, [{ min: 8, max: 10 }, { failure: true }]) };
    expect([0, 1].map((i) => slotTarget(ex, i))).toEqual(['8-10', 'a cedimento']);
  });

  it('il riscaldamento e le posizioni fuori lista non hanno obiettivo', () => {
    expect([0, 1, 5].map((i) => slotTarget(squatEx, i))).toEqual(['', '', '']);
  });

  it('ogni posizione parte con la tecnica della sua serie; vuota senza tecnica e in riscaldamento', () => {
    expect([0, 1, 2, 3, 4].map((i) => slotTechnique(squatEx, i))).toEqual(['', '', '', '', DROP]);
    expect(slotTechnique(squatEx, 9)).toBe('');
  });
});

describe('ripetizioni insolite da confermare (#77)', () => {
  it('sopra la soglia e oltre il massimo della scheda serve la conferma', () => {
    expect(repsNeedConfirm('31', work(1, 12, 12))).toBe(true);
    expect(repsNeedConfirm('35', work(1, 8, 40))).toBe(false);
    expect(repsNeedConfirm('41', work(1, 8, 40))).toBe(true);
  });

  it('a cedimento si confronta con il minimo; senza minimo vale 0', () => {
    expect(repsNeedConfirm('40', work(1, 45, null, null, true))).toBe(false);
    expect(repsNeedConfirm('31', work(1, 30, null, null, true))).toBe(true);
    expect(repsNeedConfirm('31', work(1, null, null, null, true))).toBe(true);
  });

  it('fino alla soglia non si chiede mai; senza serie pianificata conta solo la soglia', () => {
    expect(repsNeedConfirm('30', work(1, null, null, null, true))).toBe(false);
    expect(repsNeedConfirm('31', null)).toBe(true);
    expect(repsNeedConfirm('12', null)).toBe(false);
  });
});

describe('cambio e aggiunta esercizio (#77)', () => {
  it('addedPlannedSets: serie o obiettivo non validi non producono niente', () => {
    expect(addedPlannedSets('0', '10')).toBeNull();
    expect(addedPlannedSets('21', '10')).toBeNull();
    expect(addedPlannedSets('3', 'abc')).toBeNull();
    expect(addedPlannedSets('3', '')).toBeNull();
  });

  it('il cambio eredita le serie pianificate dell\'esercizio sostituito, tecniche e riscaldamento compresi', () => {
    const exercises = [{ id: 1, exercise_name: 'Squat', planned_sets: squatSets, rest: 120 }];
    const swapped = swapExercise(exercises, 0, { id: 7, name: 'Leg press', muscle_group: 'gambe' });
    expect(swapped[0].planned_sets).toEqual(squatSets);
    expect(swapped[0]).toMatchObject({ exercise_id: 7, exercise_name: 'Leg press', rest: 120, replaces: 'Squat' });
    expect([0, 1, 2, 3, 4].map((i) => slotTechnique(swapped[0], i))).toEqual(['', '', '', '', DROP]);
  });

  it('un esercizio aggiunto in sessione è nella forma compatta: N serie uguali, senza riscaldamento né tecnica', () => {
    const planned = addedPlannedSets('3', '8-10');
    expect(planned).toEqual(plannedSets(0, times(3, { min: 8, max: 10 })));
    const entry = buildSessionEntry({ id: 7, name: 'Leg press', muscle_group: 'gambe' }, { planned_sets: planned, rest: 60 });
    expect(totalSlots(entry)).toBe(3);
    expect([0, 1, 2].map((i) => slotTarget(entry, i))).toEqual(['8-10', '8-10', '8-10']);
    expect([0, 1, 2].map((i) => slotTechnique(entry, i))).toEqual(['', '', '']);
  });

  it('la voce non porta più i campi della scheda vecchia', () => {
    const entry = buildSessionEntry({ id: 7, name: 'Leg press' }, { planned_sets: plannedSets(0, [{ min: 8, max: 8 }]), rest: 60 });
    for (const key of ['sets', 'warmup_sets', 'reps', 'intensity_technique']) expect(entry).not.toHaveProperty(key);
  });
});
