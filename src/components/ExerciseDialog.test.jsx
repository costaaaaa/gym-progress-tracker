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

// Scelgo l'esercizio esistente "Panca Piana" via autocomplete e riempio serie/ripetizioni/recupero
const scegliEsercizioEsistente = async () => {
  await scegliGruppo('Petto');
  const input = screen.getByLabelText('Nome esercizio');
  fireEvent.change(input, { target: { value: 'Panca' } });
  await act(async () => {});
  fireEvent.click(screen.getByRole('option', { name: 'Panca Piana' }));
  fireEvent.change(screen.getByLabelText('Serie'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Ripetizioni'), { target: { value: '8-10' } });
  fireEvent.change(screen.getByLabelText('Recupero (s)'), { target: { value: '90' } });
};

describe('ExerciseDialog · serie di riscaldamento (#66)', () => {
  it('di base è 0 e non invalida il form', async () => {
    await apri();
    await scegliEsercizioEsistente();
    expect(screen.getByLabelText('Riscaldamento').value).toBe('0');
    expect(screen.getByRole('button', { name: 'Aggiungi' }).disabled).toBe(false);
  });

  it('fuori range (0-10) disabilita "Aggiungi"', async () => {
    await apri();
    await scegliEsercizioEsistente();
    fireEvent.change(screen.getByLabelText('Riscaldamento'), { target: { value: '11' } });
    expect(screen.getByRole('button', { name: 'Aggiungi' }).disabled).toBe(true);
  });

  it('passa a onAdd le serie pianificate: prima il riscaldamento, poi le allenanti', async () => {
    const onAdd = vi.fn();
    render(<ExerciseDialog open onClose={() => {}} onAdd={onAdd} dayIndex={0} />);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    await scegliEsercizioEsistente();
    fireEvent.change(screen.getByLabelText('Riscaldamento'), { target: { value: '2' } });

    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }));

    const planned = onAdd.mock.calls[0][1].planned_sets;
    expect(planned.map((set) => set.kind)).toEqual(['warmup', 'warmup', 'working', 'working', 'working']);
    expect(planned.map((set) => set.set_number)).toEqual([1, 2, 3, 4, 5]);
    expect(planned[4]).toEqual({
      set_number: 5, kind: 'working', reps_min: 8, reps_max: 10, to_failure: false, intensity_technique: null,
    });
  });
});
