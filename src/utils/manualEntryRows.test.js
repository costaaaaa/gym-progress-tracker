import { describe, it, expect } from 'vitest';
import { initialSetRows, toggleWarmupRow, rowTarget, rowPlannedSet } from './manualEntryRows';
import { DROP, plannedSets, times } from '../test/plannedSets';

// 1 riscaldamento, poi 12 / 10 / a cedimento (min. 6) con Drop set sulla terza allenante
const squat = {
  equipment: 'bilanciere',
  planned_sets: plannedSets(1, [{ min: 12, max: 12 }, { min: 10, max: 10 }, { min: 6, failure: true, technique: DROP }]),
};

describe('righe iniziali dell\'inserimento manuale (#77)', () => {
  it('una riga per serie pianificata: riscaldamento vuoto, target numerico precompilato, tecnica sulla sua serie', () => {
    expect(initialSetRows(squat)).toEqual([
      { is_warmup: true, weight: '', reps: '', intensity_technique: '' },
      { is_warmup: false, weight: '', reps: '12', intensity_technique: '' },
      { is_warmup: false, weight: '', reps: '10', intensity_technique: '' },
      { is_warmup: false, weight: '', reps: '', intensity_technique: DROP },
    ]);
  });

  it('un intervallo o un cedimento restano vuoti, con l\'obiettivo in grigio; i corpo libero hanno peso 0', () => {
    const rows = initialSetRows({
      equipment: 'corpo_libero',
      planned_sets: plannedSets(0, [{ min: 8, max: 10 }, { failure: true }]),
    });
    expect(rows).toEqual([
      { is_warmup: false, weight: '0', reps: '', intensity_technique: '' },
      { is_warmup: false, weight: '0', reps: '', intensity_technique: '' },
    ]);
  });
});

describe('obiettivo in grigio e serie pianificata di una riga (#77)', () => {
  const rows = initialSetRows(squat);

  it('rowTarget: vuoto per il riscaldamento; per le altre la k-esima allenante, a parole', () => {
    expect([0, 1, 2, 3].map((i) => rowTarget(rows, i, squat))).toEqual(['', '12', '10', 'a cedimento (min. 6)']);
  });

  it('conta solo le righe che non sono riscaldamento, e oltre l\'ultima ripete l\'ultima', () => {
    const shifted = rows.map((r, i) => ({ ...r, is_warmup: i === 3 }));
    expect([0, 1, 2, 3].map((i) => rowTarget(shifted, i, squat))).toEqual(['12', '10', 'a cedimento (min. 6)', '']);
    const allWorking = rows.map((r) => ({ ...r, is_warmup: false }));
    expect(rowTarget(allWorking, 3, squat)).toBe('a cedimento (min. 6)');
    expect(rowTarget(allWorking, 0, squat)).toBe('12');
  });

  it('rowPlannedSet è la serie allenante pianificata della riga, null in riscaldamento', () => {
    expect(rowPlannedSet(rows, 0, squat)).toBeNull();
    expect(rowPlannedSet(rows, 3, squat)).toMatchObject({ set_number: 4, to_failure: true, reps_min: 6 });
  });
});

describe('righe del manuale: attivare o disattivare il riscaldamento (#77)', () => {
  const plan = {
    planned_sets: plannedSets(1, [{ min: 8, max: 8 }, { min: 6, max: 6 }, { min: 4, max: 4, technique: DROP }]),
  };
  const rows = (...reps) => reps.map((r, i) => ({ is_warmup: i === 0, weight: '', reps: r, intensity_technique: i === 0 ? '' : 'X' }));

  it('spegnendo il riscaldamento target e ripetizioni precompilate scalano; oltre l\'ultima vale l\'ultimo', () => {
    expect(toggleWarmupRow(rows('', '8', '6', '4'), 0, plan).map((r) => [r.is_warmup, r.reps])).toEqual([
      [false, '8'], [false, '6'], [false, '4'], [false, '4'],
    ]);
  });

  it('riaccendendolo tornano com\'erano; le righe già scritte dall\'utente non si toccano', () => {
    const off = toggleWarmupRow(rows('', '8', '6', '4'), 0, plan);
    expect(toggleWarmupRow(off, 0, plan).map((r) => r.reps)).toEqual(['', '8', '6', '4']);
    expect(toggleWarmupRow(rows('', '8', '7', '4'), 0, plan).map((r) => r.reps)).toEqual(['8', '6', '7', '4']);
  });

  it('se il target non è un numero singolo le righe restano vuote e il resto della riga non cambia', () => {
    const range = { planned_sets: plannedSets(1, times(3, { min: 8, max: 10 })) };
    const r = rows('', '', '', '');
    const out = toggleWarmupRow(r, 0, range);
    expect(out.map((x) => x.reps)).toEqual(['', '', '', '']);
    expect(out[1]).toEqual(r[1]);
    expect(out[0]).toEqual({ ...r[0], is_warmup: false });
  });

  it('spegnendo una riga le dà la tecnica della sua serie in scheda se è vuota; una scelta dell\'utente resta', () => {
    const noTechnique = (list) => list.map((r) => ({ ...r, intensity_technique: '' }));
    // Il riscaldamento in testa diventa la 1ª allenante (8, senza tecnica)
    expect(toggleWarmupRow(noTechnique(rows('', '8', '6', '4')), 0, plan)[0].intensity_technique).toBe('');
    // Quello in coda diventa la 4ª allenante: oltre la lista vale l'ultima serie, col Drop set
    const last = noTechnique(rows('8', '6', '4', '')).map((r, i) => ({ ...r, is_warmup: i === 3 }));
    expect(toggleWarmupRow(last, 3, plan)[3].intensity_technique).toBe(DROP);
    const chosen = last.map((r) => ({ ...r, intensity_technique: 'Rest Pause' }));
    expect(toggleWarmupRow(chosen, 3, plan)[3].intensity_technique).toBe('Rest Pause');
  });

  it('accendendo il riscaldamento la tecnica nella riga non cambia (il salvataggio la lascia vuota)', () => {
    const r = rows('8', '6', '4', '4').map((x) => ({ ...x, is_warmup: false }));
    expect(toggleWarmupRow(r, 1, plan)[1].intensity_technique).toBe('X');
  });
});
