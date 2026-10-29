// Nuovo esercizio ufficiale / modifica: col gruppo "gambe" il muscolo principale è
// obbligatorio (5 opzioni), con "glutei" si scegie tra glutei (default) e abduttori,
// gli altri gruppi non mostrano la select (il server lo deriva da solo).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import AdminExercises from './AdminExercises';
import { json } from '../../test/dom';

const MUSCLE_GROUPS = ['petto', 'glutei', 'gambe', 'spalle'];

// Esercizi già esistenti da mostrare in lista (per i test di modifica); [] = solo creazione.
let exercisesFixture;

let fetchMock;
beforeEach(() => {
  exercisesFixture = [];
  fetchMock = vi.fn((url, opts) => {
    if (opts?.method === 'POST') {
      return Promise.resolve(json({ success: true, id: 123 }, 201));
    }
    return Promise.resolve(json({ success: true, exercises: exercisesFixture, muscle_groups: MUSCLE_GROUPS, equipment: [] }));
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); });

const apri = async () => {
  render(<AdminExercises />);
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  fireEvent.click(screen.getByRole('button', { name: 'Nuovo esercizio' }));
  await act(async () => {});
};

// Apre il dialog di modifica del (solo) esercizio di exercisesFixture, cliccando "Modifica"
const apriModifica = async () => {
  render(<AdminExercises />);
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  fireEvent.click(screen.getByRole('button', { name: 'Modifica' }));
  await act(async () => {});
};

// Apre la select "Gruppo muscolare" del form e sceglie il valore (capitalizzato, come mostrato).
// Il nome accessibile può includere il valore già scelto (in modifica): matcher con prefisso.
const scegliGruppo = (label) => {
  fireEvent.mouseDown(within(screen.getByRole('dialog')).getByRole('combobox', { name: /^Gruppo muscolare/ }));
  fireEvent.click(screen.getByRole('option', { name: label }));
};

const salva = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};

const ultimaCreate = () => {
  const call = fetchMock.mock.calls.filter(([, opts]) => opts?.method === 'POST').pop();
  return JSON.parse(call[1].body);
};

describe('AdminExercises · ExerciseFormDialog · muscolo principale', () => {
  it('gruppo "gambe": mostra la select obbligatoria con 5 opzioni', async () => {
    await apri();
    scegliGruppo('Gambe');

    expect(screen.getAllByText('Muscolo principale').length).toBeGreaterThan(0);
    fireEvent.mouseDown(within(screen.getByRole('dialog')).getByRole('combobox', { name: /^Muscolo principale/ }));
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Quadricipiti', 'Femorali', 'Glutei', 'Adduttori', 'Abduttori']);
  });

  it('gruppo "gambe": "Salva" resta disabilitato finché non si scegie il muscolo principale', async () => {
    await apri();
    fireEvent.change(screen.getByLabelText(/^Nome\s*\*?$/), { target: { value: 'Nuovo Esercizio Gambe' } });
    scegliGruppo('Gambe');

    expect(screen.getByRole('button', { name: 'Salva' }).disabled).toBe(true);
  });

  it('gruppo "gambe": scelto il muscolo, salva invia primary_muscle', async () => {
    await apri();
    fireEvent.change(screen.getByLabelText(/^Nome\s*\*?$/), { target: { value: 'Nuovo Esercizio Gambe' } });
    scegliGruppo('Gambe');
    fireEvent.mouseDown(within(screen.getByRole('dialog')).getByRole('combobox', { name: /^Muscolo principale/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Adduttori' }));

    await salva();

    expect(ultimaCreate()).toMatchObject({ muscle_group: 'gambe', primary_muscle: 'adduttori' });
  });

  it('gruppo "glutei": propone glutei di default, con abduttori come alternativa', async () => {
    await apri();
    fireEvent.change(screen.getByLabelText(/^Nome\s*\*?$/), { target: { value: 'Nuovo Esercizio Glutei' } });
    scegliGruppo('Glutei');

    await salva();

    expect(ultimaCreate()).toMatchObject({ muscle_group: 'glutei', primary_muscle: 'glutei' });
  });

  it('gruppo diverso da "gambe"/"glutei": non mostra la select e non invia primary_muscle', async () => {
    await apri();
    fireEvent.change(screen.getByLabelText(/^Nome\s*\*?$/), { target: { value: 'Nuovo Esercizio Petto' } });
    scegliGruppo('Petto');

    expect(screen.queryAllByText('Muscolo principale')).toHaveLength(0);

    await salva();

    expect(ultimaCreate().primary_muscle).toBeUndefined();
  });

  it('modifica: cambiando da "glutei" (abduttori) a un altro gruppo non invia più primary_muscle', async () => {
    exercisesFixture = [
      { id: 10, name: 'Hip Thrust', muscle_group: 'glutei', primary_muscle: 'abduttori', equipment: '', uses: 0 },
    ];
    await apriModifica();
    expect(screen.getByLabelText(/^Nome\s*\*?$/).value).toBe('Hip Thrust');

    scegliGruppo('Spalle');
    expect(screen.queryAllByText('Muscolo principale')).toHaveLength(0);

    await salva();

    const body = ultimaCreate();
    expect(body).toMatchObject({ id: 10, muscle_group: 'spalle' });
    expect(body.primary_muscle).toBeUndefined();
  });

  it('modifica: passando a "gambe" richiede comunque la scelta del muscolo principale', async () => {
    exercisesFixture = [
      { id: 11, name: 'Panca Piana', muscle_group: 'petto', primary_muscle: null, equipment: '', uses: 0 },
    ];
    await apriModifica();

    scegliGruppo('Gambe');
    expect(screen.getByRole('button', { name: 'Salva' }).disabled).toBe(true);

    fireEvent.mouseDown(within(screen.getByRole('dialog')).getByRole('combobox', { name: /^Muscolo principale/ }));
    fireEvent.click(screen.getByRole('option', { name: 'Femorali' }));

    await salva();

    expect(ultimaCreate()).toMatchObject({ id: 11, muscle_group: 'gambe', primary_muscle: 'femorali' });
  });
});
