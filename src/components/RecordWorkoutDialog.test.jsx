// Inserimento manuale di un allenamento: righe del riscaldamento della scheda (#67)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import RecordWorkoutDialog from './RecordWorkoutDialog';
import { json } from '../test/dom';
import { plannedSets } from '../test/plannedSets';

vi.mock('../utils/analytics', () => ({ track: vi.fn() }));

// Le righe dell'inserimento manuale leggono ancora sets/warmup_sets/reps (lavoro di 3b); la riga della scheda legge planned_sets
const planned = plannedSets(2, [{ min: 5, max: 5 }, { min: 5, max: 5, technique: 'Rest Pause' }]);
const squat = {
  id: 11, exercise_id: 5, exercise_name: 'Squat', sets: 2, warmup_sets: 2, reps: '5', rest: 60,
  equipment: 'bilanciere', intensity_technique: 'Rest Pause', planned_sets: planned,
};
const basePlan = { id: 5, name: 'Gambe', days: [{ id: 3, name: 'Gambe', exercises: [squat] }] };
// 1 riscaldamento + 3 serie con ripetizioni a lista
const listRepsPlan = { id: 5, name: 'Gambe', days: [{ id: 3, name: 'Gambe', exercises: [{ ...squat, warmup_sets: 1, sets: 3, reps: '8/6/4' }] }] };

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn(() => Promise.resolve(json({ success: true })));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); });

const open = (activePlan = basePlan) => {
  render(<RecordWorkoutDialog open onClose={() => {}} activePlan={activePlan} />);
  fireEvent.mouseDown(screen.getByRole('combobox'));
  fireEvent.click(screen.getByRole('option', { name: 'Gambe' }));
};
const toggles = () => [1, 2, 3, 4].map((n) => screen.getByRole('checkbox', { name: `Risc. (riscaldamento), serie ${n}` }));
const fill = (row, weight, reps) => {
  fireEvent.change(screen.getAllByLabelText('Peso (kg)')[row], { target: { value: weight } });
  fireEvent.change(screen.getAllByLabelText('Ripetizioni')[row], { target: { value: reps } });
};
const save = async () => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Salva' })); });
  const call = fetchMock.mock.calls.find(([url]) => url.includes('record_workout.php'));
  return JSON.parse(call[1].body);
};

describe('righe di un esercizio con riscaldamento', () => {
  it('prima le righe di riscaldamento (già attivate), poi le serie; la riga della scheda le conta a parte', () => {
    open();
    expect(toggles().map((c) => c.checked)).toEqual([true, true, false, false]);
    expect(screen.getByText('2 risc. + 2 × 5 · Rest pause sull\'ultima · recupero: 60s')).toBeTruthy();
  });

  it('in una riga di riscaldamento la tecnica è disabilitata e le ripetizioni non sono precompilate', () => {
    open();
    const reps = screen.getAllByLabelText('Ripetizioni').map((i) => i.value);
    expect(reps).toEqual(['', '', '5', '5']);
    // combobox: giorno, poi la tecnica di ogni riga
    const selects = screen.getAllByRole('combobox').slice(1);
    expect(selects.map((s) => s.getAttribute('aria-disabled') === 'true')).toEqual([true, true, false, false]);
  });

  it('ogni riga si può attivare o disattivare come riscaldamento', () => {
    open();
    fireEvent.click(toggles()[3]);
    fireEvent.click(toggles()[0]);
    expect(toggles().map((c) => c.checked)).toEqual([false, true, false, true]);
  });
});

describe('ripetizioni suggerite dalla scheda', () => {
  const placeholders = () => screen.getAllByLabelText('Ripetizioni').map((i) => i.getAttribute('placeholder') ?? '');

  it('seguono le righe che in questo momento non sono riscaldamento, non la loro posizione', () => {
    open(listRepsPlan);
    expect(placeholders()).toEqual(['', '8', '6', '4']);
    // Il riscaldamento passa in fondo: le tre serie allenanti ripartono da 8
    fireEvent.click(screen.getByRole('checkbox', { name: 'Risc. (riscaldamento), serie 1' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Risc. (riscaldamento), serie 4' }));
    expect(placeholders()).toEqual(['8', '6', '4', '']);
  });
});

describe('tecnica di una riga che smette di essere riscaldamento', () => {
  it('prende la tecnica della scheda, come le serie allenanti originali', () => {
    open();
    // combobox: giorno, poi la tecnica di ogni riga; true se la riga mostra la tecnica della scheda
    const hasTechnique = () => screen.getAllByRole('combobox').slice(1).map((s) => /Rest pause/.test(s.textContent));
    expect(hasTechnique()).toEqual([false, false, true, true]);
    fireEvent.click(toggles()[0]);
    expect(hasTechnique()).toEqual([true, false, true, true]);
  });
});

describe('ripetizioni precompilate dalla scheda', () => {
  const values = () => screen.getAllByLabelText('Ripetizioni').map((i) => i.value);

  it('scalano con le righe che non sono riscaldamento, salvo quelle già scritte', () => {
    open(listRepsPlan);
    expect(values()).toEqual(['', '8', '6', '4']);
    const warmup = screen.getByRole('checkbox', { name: 'Risc. (riscaldamento), serie 1' });
    fireEvent.click(warmup);
    // Quattro serie allenanti per una scheda da tre: l'ultima ripete l'ultimo valore
    expect(values()).toEqual(['8', '6', '4', '4']);
    fireEvent.click(warmup);
    expect(values()).toEqual(['', '8', '6', '4']);
    fireEvent.change(screen.getAllByLabelText('Ripetizioni')[2], { target: { value: '7' } });
    fireEvent.click(warmup);
    expect(values()).toEqual(['8', '6', '7', '4']);
  });
});

describe('salvataggio con il riscaldamento', () => {
  it('invia is_warmup e set_number = posizione della riga; il riscaldamento senza tecnica; le righe vuote restano fuori', async () => {
    open();
    fill(0, '20', '10');
    fill(2, '100', '5');
    fill(3, '100', '4');
    const body = await save();
    expect(body.workout_records.map((r) => [r.set_number, r.weight, r.reps, r.is_warmup, r.intensity_technique])).toEqual([
      [1, 20, '10', true, ''],
      [3, 100, '5', false, 'Rest Pause'],
      [4, 100, '4', false, 'Rest Pause'],
    ]);
  });

  it('una riga trasformata in riscaldamento si salva come tale e senza tecnica', async () => {
    open();
    fill(2, '100', '6');
    fireEvent.click(toggles()[2]);
    const body = await save();
    expect(body.workout_records.map((r) => [r.set_number, r.is_warmup, r.intensity_technique])).toEqual([[3, true, '']]);
  });
});
