// Editor delle serie pianificate: compatto (serie, riscaldamento, ripetizioni, tecnica sull'ultima)
// o per serie ("Serie diverse"). Emette planned_sets, oppure null finché c'è un errore.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PlannedSetsEditor from './PlannedSetsEditor';
import { buildPlannedSets, fromCompact } from '../utils/plannedSets';
import { DROP, normal, failure } from '../test/plannedSets';

const setup = (value = null) => {
  const onChange = vi.fn();
  render(<PlannedSetsEditor value={value} onChange={onChange} />);
  const last = () => onChange.mock.calls.at(-1)[0];
  return { onChange, last };
};
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const choose = (name, option) => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name }));
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: option }));
};
const switchDiverse = () => screen.getByLabelText('Serie diverse');
// Una riga della forma lista: gruppo "Serie N" con campo, cedimento, tecnica e pulsante per toglierla
const rowOf = (n) => within(screen.getByRole('group', { name: `Serie ${n}` }));
const typeRow = (n, value) => fireEvent.change(rowOf(n).getByRole('textbox'), { target: { value } });
const rowValue = (n) => rowOf(n).getByRole('textbox').value;
const chooseInRow = (n, option) => {
  fireEvent.mouseDown(rowOf(n).getByRole('combobox'));
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: option }));
};

describe('PlannedSetsEditor · forma compatta', () => {
  it('serie, riscaldamento, ripetizioni e tecnica danno le planned_sets, con la tecnica sull\'ultima', () => {
    const { last } = setup();
    type('Serie', '3');
    type('Riscaldamento', '2');
    type('Ripetizioni', '8-10');
    choose(/Tecnica/, 'Drop set (stripping)');

    expect(last()).toEqual(fromCompact({
      warmups: 2, sets: 3, target: { reps_min: 8, reps_max: 10, to_failure: false }, technique: DROP,
    }));
  });

  it('sotto il select dice che la tecnica si applica all\'ultima serie', () => {
    setup();
    expect(screen.getByText('Si applica all\'ultima serie')).toBeTruthy();
  });

  it('esercizio nuovo: finché mancano serie e ripetizioni emette null', () => {
    const { last } = setup();
    expect(last()).toBeNull();
  });

  it('"A cedimento": il campo diventa "Minimo" e il minimo si può lasciare vuoto', () => {
    const { last } = setup();
    type('Serie', '2');
    type('Ripetizioni', '8');
    fireEvent.click(screen.getByRole('checkbox', { name: 'A cedimento' }));

    expect(screen.queryByLabelText('Ripetizioni')).toBeNull();
    expect(last()).toEqual(buildPlannedSets(0, [failure(), failure()]));
    type('Minimo', '6');
    expect(last()).toEqual(buildPlannedSets(0, [failure(6), failure(6)]));
  });

  it('si apre sui valori di un esercizio esistente compattabile', () => {
    setup(buildPlannedSets(1, [normal(8, 10), normal(8, 10), normal(8, 10, DROP)]));
    expect(screen.getByLabelText('Serie').value).toBe('3');
    expect(screen.getByLabelText('Riscaldamento').value).toBe('1');
    expect(screen.getByLabelText('Ripetizioni').value).toBe('8-10');
    expect(screen.queryByRole('group', { name: 'Serie 1' })).toBeNull();
  });
});

describe('PlannedSetsEditor · errori', () => {
  it('ripetizioni non valide: messaggio sul campo e null', () => {
    const { last } = setup();
    type('Serie', '3');
    type('Ripetizioni', '10-8');

    expect(screen.getByText(/numero \(8\) o un intervallo/)).toBeTruthy();
    expect(screen.getByLabelText('Ripetizioni').getAttribute('aria-invalid')).toBe('true');
    expect(last()).toBeNull();
  });

  it('serie fuori da 1-20 e riscaldamento fuori da 0-10: messaggio sul campo e null', () => {
    const { last } = setup();
    type('Ripetizioni', '8');
    type('Serie', '21');
    type('Riscaldamento', '11');

    expect(screen.getByLabelText('Serie').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Riscaldamento').getAttribute('aria-invalid')).toBe('true');
    expect(last()).toBeNull();
    type('Serie', '20');
    type('Riscaldamento', '10');
    expect(last()).toHaveLength(30);
  });

  it('correggendo il valore l\'errore sparisce', () => {
    const { last } = setup();
    type('Serie', '3');
    type('Ripetizioni', 'abc');
    type('Ripetizioni', '12');

    expect(screen.getByLabelText('Ripetizioni').getAttribute('aria-invalid')).toBe('false');
    expect(last()).toEqual(fromCompact({ warmups: 0, sets: 3, target: { reps_min: 12, reps_max: 12, to_failure: false }, technique: '' }));
  });
});

describe('PlannedSetsEditor · serie diverse', () => {
  it('accendendo l\'interruttore le righe partono dai valori della forma compatta', () => {
    const { last } = setup(fromCompact({ warmups: 1, sets: 3, target: { reps_min: 8, reps_max: 10, to_failure: false }, technique: DROP }));
    fireEvent.click(switchDiverse());

    expect([1, 2, 3].map(rowValue)).toEqual(['8-10', '8-10', '8-10']);
    expect(screen.getByLabelText('Riscaldamento').value).toBe('1');
    expect(last()).toEqual(fromCompact({ warmups: 1, sets: 3, target: { reps_min: 8, reps_max: 10, to_failure: false }, technique: DROP }));
  });

  it('si può cambiare il target di una serie, metterla a cedimento e dare una tecnica a una sola', () => {
    const { last } = setup(fromCompact({ warmups: 0, sets: 3, target: { reps_min: 8, reps_max: 8, to_failure: false }, technique: '' }));
    fireEvent.click(switchDiverse());
    typeRow(1, '12');
    typeRow(2, '10');
    fireEvent.click(rowOf(3).getByRole('checkbox', { name: 'A cedimento' }));
    typeRow(3, '6');
    chooseInRow(3, 'Drop set (stripping)');

    expect(last()).toEqual(buildPlannedSets(0, [normal(12, 12), normal(10, 10), failure(6, DROP)]));
  });

  it('"Aggiungi serie" copia il target dell\'ultima, senza tecnica; fino a 20', () => {
    const { last } = setup(buildPlannedSets(0, [normal(12, 12), failure(6, DROP)]));
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi serie' }));

    expect(last()).toEqual(buildPlannedSets(0, [normal(12, 12), failure(6, DROP), failure(6)]));
    for (let i = 3; i < 20; i += 1) fireEvent.click(screen.getByRole('button', { name: 'Aggiungi serie' }));
    expect(last()).toHaveLength(20);
    expect(screen.queryByRole('button', { name: 'Aggiungi serie' })).toBeNull();
  });

  it('si toglie una serie; con una sola allenante il pulsante è disabilitato', () => {
    const { last } = setup(buildPlannedSets(0, [normal(12, 12), normal(10, 10)]));
    fireEvent.click(rowOf(1).getByRole('button', { name: 'Togli la serie' }));

    expect(last()).toEqual(buildPlannedSets(0, [normal(10, 10)]));
    expect(rowOf(1).getByRole('button', { name: 'Togli la serie' }).disabled).toBe(true);
  });

  it('un errore in una riga: messaggio su quella riga e null', () => {
    const { last } = setup(buildPlannedSets(0, [normal(12, 12), normal(10, 10)]));
    typeRow(2, 'x');

    expect(rowOf(2).getByRole('textbox').getAttribute('aria-invalid')).toBe('true');
    expect(rowOf(1).getByRole('textbox').getAttribute('aria-invalid')).toBe('false');
    expect(last()).toBeNull();
  });

  it('si apre in forma lista su un esercizio con target diversi', () => {
    setup(buildPlannedSets(0, [normal(12, 12), normal(10, 10), failure(6)]));

    expect(switchDiverse().checked).toBe(true);
    expect(rowValue(1)).toBe('12');
    expect(rowValue(3)).toBe('6');
    expect(screen.queryByLabelText('Ripetizioni')).toBeNull();
  });

  it('l\'interruttore non si spegne finché le serie sono diverse, e spiega perché', () => {
    setup(buildPlannedSets(0, [normal(12, 12), normal(10, 10)]));

    expect(switchDiverse().disabled).toBe(true);
    expect(screen.getByText(/stesso target e al massimo una tecnica sull'ultima/)).toBeTruthy();
  });

  it('una tecnica non sull\'ultima impedisce di tornare alla forma compatta', () => {
    setup(buildPlannedSets(0, [normal(8, 8, DROP), normal(8, 8)]));
    expect(switchDiverse().disabled).toBe(true);
  });

  it('con serie di nuovo uguali l\'interruttore si spegne e torna la forma compatta', () => {
    const { last } = setup(buildPlannedSets(1, [normal(12, 12), normal(10, 10)]));
    typeRow(2, '12');
    expect(switchDiverse().disabled).toBe(false);
    fireEvent.click(switchDiverse());

    expect(screen.getByLabelText('Serie').value).toBe('2');
    expect(screen.getByLabelText('Ripetizioni').value).toBe('12');
    expect(last()).toEqual(buildPlannedSets(1, [normal(12, 12), normal(12, 12)]));
  });

  it('con una riga non valida l\'interruttore non si spegne', () => {
    setup(buildPlannedSets(0, [normal(8, 8), normal(8, 8)]));
    fireEvent.click(switchDiverse());
    typeRow(2, 'x');
    expect(switchDiverse().disabled).toBe(true);
  });
});
