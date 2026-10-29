// Creazione di un esercizio personale: con gruppo "Gambe" va scelto anche il muscolo
// principale (obbligatorio, 5 opzioni); gli altri gruppi non mostrano la scelta.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ExerciseDialog from './ExerciseDialog';
import { json } from '../test/dom';

const RECORDS = [
  { id: 1, name: 'Squat (Bilanciere)', muscle_group: 'gambe', equipment: 'bilanciere' },
  { id: 2, name: 'Panca Piana', muscle_group: 'petto', equipment: 'bilanciere' },
];

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn((url) => {
    if (String(url).includes('exercise/read_all.php')) {
      return Promise.resolve(json({ records: RECORDS }));
    }
    return Promise.resolve(json({ success: true, exercise: { id: 99, name: 'Nuovo', muscle_group: 'gambe' } }, 201));
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); });

// Apre il dialog e aspetta che i gruppi muscolari (dal fetch) siano in stato
const apri = async () => {
  render(<ExerciseDialog open onClose={() => {}} onAdd={() => {}} dayIndex={0} />);
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};

// Apre la select del gruppo muscolare e sceglie l'opzione data (by id, stabile anche quando
// la select del muscolo principale compare/scompare più sotto nel form)
const scegliGruppo = async (label) => {
  fireEvent.mouseDown(document.getElementById('mui-component-select-muscleGroup'));
  fireEvent.click(screen.getByRole('option', { name: label }));
  await act(async () => {});
};

describe('ExerciseDialog · creazione con gruppo "Gambe"', () => {
  it('mostra la select obbligatoria del muscolo principale', async () => {
    await apri();
    await scegliGruppo('Gambe');

    expect(screen.getAllByText('Muscolo principale').length).toBeGreaterThan(0);
  });

  it('non mostra la select per un gruppo diverso da "Gambe"', async () => {
    await apri();
    await scegliGruppo('Petto');

    expect(screen.queryAllByText('Muscolo principale')).toHaveLength(0);
  });

  it('il bottone "Crea" resta disabilitato finché non si scegie il muscolo principale', async () => {
    await apri();
    await scegliGruppo('Gambe');
    fireEvent.change(screen.getByPlaceholderText(/Nuovo esercizio/), { target: { value: 'Affondi Manubri' } });

    expect(screen.getByRole('button', { name: 'Crea' }).disabled).toBe(true);
  });

  it('scelto il muscolo principale, crea invia primary_muscle al server', async () => {
    await apri();
    await scegliGruppo('Gambe');
    fireEvent.change(screen.getByPlaceholderText(/Nuovo esercizio/), { target: { value: 'Affondi Manubri' } });

    fireEvent.mouseDown(document.getElementById('mui-component-select-primaryMuscle'));
    fireEvent.click(screen.getByRole('option', { name: 'Adduttori' }));
    await act(async () => {});

    expect(screen.getByRole('button', { name: 'Crea' }).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Crea' }));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    const call = fetchMock.mock.calls.find(([url]) => String(url).includes('exercise/create.php'));
    expect(call).toBeTruthy();
    const body = JSON.parse(call[1].body);
    expect(body).toMatchObject({ name: 'Affondi Manubri', muscle_group: 'Gambe', primary_muscle: 'adduttori' });
  });

  it('per un gruppo diverso da "Gambe" non invia primary_muscle (lo deriva il server)', async () => {
    await apri();
    await scegliGruppo('Petto');
    fireEvent.change(screen.getByPlaceholderText(/Nuovo esercizio/), { target: { value: 'Panca Nuova' } });

    expect(screen.getByRole('button', { name: 'Crea' }).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Crea' }));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    const call = fetchMock.mock.calls.find(([url]) => String(url).includes('exercise/create.php'));
    const body = JSON.parse(call[1].body);
    expect(body.primary_muscle).toBeUndefined();
  });
});
