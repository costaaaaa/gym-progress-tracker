import { describe, it, expect } from 'vitest';
import { buildPlannedSets, fromCompact } from './plannedSets';
import {
  draftFromPlannedSets, draftErrors, plannedSetsFromDraft, draftToList, draftToCompact, addRow, removeRow,
} from './plannedSetsDraft';
import { DROP, normal, failure } from '../test/plannedSets';

const row = (target = '', to_failure = false, technique = '') => ({ target, to_failure, technique });
const compactDraft = (over = {}) => ({ warmups: '0', list: false, sets: '3', row: row('8-10'), rows: [], ...over });
const listDraft = (rows, warmups = '0') => ({ warmups, list: true, sets: '', row: row(), rows });

describe('draftFromPlannedSets: da serie salvate alla bozza dell\'editor', () => {
  it('nessuna serie (esercizio nuovo): forma compatta vuota', () => {
    expect(draftFromPlannedSets(null)).toEqual({ warmups: '0', list: false, sets: '', row: row(), rows: [] });
  });

  it('serie compattabili: forma compatta, con il testo del target', () => {
    const sets = fromCompact({ warmups: 2, sets: 3, target: { reps_min: 8, reps_max: 10, to_failure: false }, technique: DROP });
    expect(draftFromPlannedSets(sets)).toEqual({
      warmups: '2', list: false, sets: '3', row: row('8-10', false, DROP), rows: [],
    });
  });

  it('target uguale scritto come numero: "8", non "8-8"', () => {
    const sets = fromCompact({ warmups: 0, sets: 2, target: { reps_min: 8, reps_max: 8, to_failure: false }, technique: null });
    expect(draftFromPlannedSets(sets).row.target).toBe('8');
  });

  it('serie diverse: forma lista, a cedimento il testo è il minimo', () => {
    const sets = buildPlannedSets(1, [normal(12, 12), normal(10, 10), failure(6, DROP)]);
    expect(draftFromPlannedSets(sets)).toEqual({
      warmups: '1', list: true, sets: '', row: row(),
      rows: [row('12'), row('10'), row('6', true, DROP)],
    });
  });

  it('a cedimento senza minimo: testo vuoto', () => {
    const sets = buildPlannedSets(0, [failure(), failure()]);
    expect(draftFromPlannedSets(sets).row).toEqual(row('', true));
  });
});

describe('draftErrors: un messaggio per campo', () => {
  it('bozza valida: nessun errore', () => {
    expect(draftErrors(compactDraft())).toEqual({ warmups: null, sets: null, target: null, rows: [] });
  });

  it('serie: intero da 1 a 20', () => {
    ['', '0', '21', 'x', '2.5'].forEach((sets) => expect(draftErrors(compactDraft({ sets })).sets).toBe('plan_editor.error_sets'));
    ['1', '20'].forEach((sets) => expect(draftErrors(compactDraft({ sets })).sets).toBeNull());
  });

  it('riscaldamento: intero da 0 a 10, vuoto vale 0', () => {
    ['11', '-1', 'x'].forEach((warmups) => expect(draftErrors(compactDraft({ warmups })).warmups).toBe('plan_editor.error_warmups'));
    ['', '0', '10'].forEach((warmups) => expect(draftErrors(compactDraft({ warmups })).warmups).toBeNull());
  });

  it('ripetizioni: numero o intervallo da 1 a 250', () => {
    ['', '0', '251', '10-8', 'Max'].forEach((target) => {
      expect(draftErrors(compactDraft({ row: row(target) })).target).toBe('plan_editor.error_target');
    });
    expect(draftErrors(compactDraft({ row: row('1-250') })).target).toBeNull();
  });

  it('a cedimento: il minimo è facoltativo, ma deve essere un numero', () => {
    expect(draftErrors(compactDraft({ row: row('', true) })).target).toBeNull();
    expect(draftErrors(compactDraft({ row: row('6', true) })).target).toBeNull();
    expect(draftErrors(compactDraft({ row: row('6-8', true) })).target).toBe('plan_editor.error_min');
    expect(draftErrors(compactDraft({ row: row('0', true) })).target).toBe('plan_editor.error_min');
  });

  it('forma lista: un errore per riga, nella stessa posizione', () => {
    const errors = draftErrors(listDraft([row('12'), row('x'), row('6', true), row('9-')]));
    expect(errors.rows).toEqual([null, 'plan_editor.error_target', null, 'plan_editor.error_target']);
  });

  it('forma lista: da 1 a 20 righe', () => {
    expect(draftErrors(listDraft([])).sets).toBe('plan_editor.error_sets');
    expect(draftErrors(listDraft(Array.from({ length: 21 }, () => row('8')))).sets).toBe('plan_editor.error_sets');
    expect(draftErrors(listDraft(Array.from({ length: 20 }, () => row('8')))).sets).toBeNull();
  });
});

describe('plannedSetsFromDraft: la bozza diventa planned_sets, o null', () => {
  it('forma compatta', () => {
    expect(plannedSetsFromDraft(compactDraft({ warmups: '1', row: row('8-10', false, DROP) }))).toEqual(
      fromCompact({ warmups: 1, sets: 3, target: { reps_min: 8, reps_max: 10, to_failure: false }, technique: DROP }),
    );
  });

  it('forma lista, tecnica di ogni riga', () => {
    const draft = listDraft([row('12'), row('10'), row('6', true, DROP)], '');
    expect(plannedSetsFromDraft(draft)).toEqual(buildPlannedSets(0, [normal(12, 12), normal(10, 10), failure(6, DROP)]));
  });

  it('con un errore qualsiasi è null', () => {
    expect(plannedSetsFromDraft(compactDraft({ sets: '' }))).toBeNull();
    expect(plannedSetsFromDraft(compactDraft({ row: row('') }))).toBeNull();
    expect(plannedSetsFromDraft(listDraft([row('12'), row('x')]))).toBeNull();
  });

  it('andata e ritorno con draftFromPlannedSets', () => {
    const sets = buildPlannedSets(2, [normal(12, 15), normal(8, 10), failure(), failure(5, DROP)]);
    expect(plannedSetsFromDraft(draftFromPlannedSets(sets))).toEqual(sets);
    const compact = fromCompact({ warmups: 0, sets: 4, target: { reps_min: null, reps_max: null, to_failure: true }, technique: 'Rest Pause' });
    expect(plannedSetsFromDraft(draftFromPlannedSets(compact))).toEqual(compact);
  });
});

describe('passare dalla forma compatta alla lista e ritorno', () => {
  it('draftToList: una riga per serie dai valori compatti, tecnica sull\'ultima', () => {
    const list = draftToList(compactDraft({ warmups: '1', sets: '3', row: row('8-10', false, DROP) }));
    expect(list).toMatchObject({ list: true, warmups: '1' });
    expect(list.rows).toEqual([row('8-10'), row('8-10'), row('8-10', false, DROP)]);
  });

  it('draftToList con "serie" non valide parte da una riga', () => {
    expect(draftToList(compactDraft({ sets: '' })).rows).toEqual([row('8-10', false, '')]);
  });

  it('draftToCompact: possibile solo se le serie sono compattabili', () => {
    const same = listDraft([row('8-10'), row('8-10'), row('8-10', false, DROP)], '2');
    expect(draftToCompact(same)).toEqual({ warmups: '2', list: false, sets: '3', row: row('8-10', false, DROP), rows: [] });
    expect(draftToCompact(listDraft([row('12'), row('10')]))).toBeNull();
    expect(draftToCompact(listDraft([row('8', false, DROP), row('8')]))).toBeNull();
  });

  it('draftToCompact: con righe non valide non si può', () => {
    expect(draftToCompact(listDraft([row('8'), row('x')]))).toBeNull();
  });
});

describe('addRow / removeRow', () => {
  it('addRow copia il target (e il cedimento) dell\'ultima riga, senza tecnica', () => {
    const next = addRow(listDraft([row('12'), row('6', true, DROP)]));
    expect(next.rows).toEqual([row('12'), row('6', true, DROP), row('6', true, '')]);
  });

  it('addRow non supera le 20 serie', () => {
    const full = listDraft(Array.from({ length: 20 }, () => row('8')));
    expect(addRow(full).rows).toHaveLength(20);
  });

  it('removeRow toglie la riga, ma ne resta sempre una', () => {
    expect(removeRow(listDraft([row('12'), row('10'), row('8')]), 1).rows).toEqual([row('12'), row('8')]);
    expect(removeRow(listDraft([row('12')]), 0).rows).toEqual([row('12')]);
  });
});
