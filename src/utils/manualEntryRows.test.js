import { describe, it, expect } from 'vitest';
import { initialSetRows, toggleWarmupRow, rowPlanReps } from './manualEntryRows';

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
  const plan = { reps: '8/6/4', intensity_technique: 'Drop set' };
  const rows = (...reps) => reps.map((r, i) => ({ is_warmup: i === 0, weight: '', reps: r, intensity_technique: 'Drop set' }));

  it('rowPlanReps: vuoto per il riscaldamento, per le altre conta solo chi non è riscaldamento prima', () => {
    const r = rows('', '8', '6', '4');
    expect([0, 1, 2, 3].map((i) => rowPlanReps(r, i, '8/6/4'))).toEqual(['', '8', '6', '4']);
    expect(rowPlanReps(r, 1, '8-10')).toBe('8-10');
  });

  it('spegnendo il riscaldamento le ripetizioni precompilate scalano; oltre la lista vale l\'ultimo valore', () => {
    expect(toggleWarmupRow(rows('', '8', '6', '4'), 0, plan).map((r) => [r.is_warmup, r.reps])).toEqual([
      [false, '8'], [false, '6'], [false, '4'], [false, '4'],
    ]);
  });

  it('riaccendendolo tornano com\'erano; le righe già scritte dall\'utente non si toccano', () => {
    const off = toggleWarmupRow(rows('', '8', '6', '4'), 0, plan);
    expect(toggleWarmupRow(off, 0, plan).map((r) => r.reps)).toEqual(['', '8', '6', '4']);
    const edited = rows('', '8', '7', '4');
    expect(toggleWarmupRow(edited, 0, plan).map((r) => r.reps)).toEqual(['8', '6', '7', '4']);
  });

  it('se la scheda non ha numeri per serie le righe restano vuote e il resto della riga non cambia', () => {
    const r = rows('', '', '', '');
    const out = toggleWarmupRow(r, 0, { reps: 'Max' });
    expect(out.map((x) => x.reps)).toEqual(['', '', '', '']);
    expect(out[1]).toEqual(r[1]);
    expect(out[0]).toEqual({ ...r[0], is_warmup: false });
  });

  it('spegnendo una riga le dà la tecnica della scheda se è vuota; una scelta dell\'utente resta', () => {
    const empty = rows('', '8').map((r) => ({ ...r, intensity_technique: '' }));
    expect(toggleWarmupRow(empty, 0, plan)[0].intensity_technique).toBe('Drop set');
    const chosen = empty.map((r) => ({ ...r, intensity_technique: 'Rest Pause' }));
    expect(toggleWarmupRow(chosen, 0, plan)[0].intensity_technique).toBe('Rest Pause');
  });

  it('accendendo il riscaldamento la tecnica nella riga non cambia (il salvataggio la lascia vuota)', () => {
    expect(toggleWarmupRow(rows('', '8').map((r) => ({ ...r, is_warmup: false })), 1, plan)[1].intensity_technique).toBe('Drop set');
  });
});
