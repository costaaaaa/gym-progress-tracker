// Schede: nel giorno aperto l'intestazione del gruppo muscolare è in inchiostro e le azioni delle righe (Modifica,
// Elimina) sono grigie come le frecce; il rosso sta solo nel bottone di conferma dei dialoghi. La fetch è il confine.
// Colori del tema chiaro scritti a mano: text.primary #1a1816, text.secondary #6b6663, error #d50000.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkoutPlans from './WorkoutPlans';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { json, colorOf } from '../test/dom';

const INK = 'rgb(26, 24, 22)';
const GREY = 'rgb(107, 102, 99)';
const RED = 'rgb(213, 0, 0)';

const plan = {
  id: 1, name: 'Forza A', description: '', is_active: 1,
  days: [{
    id: 11, name: 'Giorno 1',
    exercises: [
      { id: 101, exercise_name: 'Panca piana', muscle_group: 'petto', sets: 4, reps: '6-8', rest: 120, intensity_technique: '', notes: '' },
      { id: 102, exercise_name: 'Croci ai cavi', muscle_group: 'petto', sets: 3, reps: '12', rest: 60, intensity_technique: '', notes: '' },
    ],
  }],
};

beforeEach(() => {
  localStorage.setItem('themeMode', 'light');
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ records: [plan] }))));
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const openDay = async () => {
  render(<MemoryRouter><ThemeModeProvider><WorkoutPlans /></ThemeModeProvider></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Mostra dettagli' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Dettagli' }));
  await screen.findByText('Panca piana');
};

describe('giorno aperto', () => {
  it('Modifica ed Elimina di ogni esercizio sono grigi come le frecce, non rosso', async () => {
    await openDay();
    const edits = screen.getAllByRole('button', { name: 'Modifica esercizio' });
    const deletes = screen.getAllByRole('button', { name: 'Elimina esercizio' });
    expect(edits).toHaveLength(2);
    expect(deletes).toHaveLength(2);
    for (const button of [...edits, ...deletes]) expect(colorOf(button)).toBe(GREY);
  });

  it('l\'intestazione del gruppo muscolare è in inchiostro, con il manubrio grigio', async () => {
    await openDay();
    const header = screen.getByText('Petto', { selector: 'h6' });
    expect(colorOf(header)).toBe(INK);
    expect(colorOf(within(header).getByTestId('FitnessCenterIcon'))).toBe(GREY);
  });
});

describe('dialogo di eliminazione di un esercizio', () => {
  it('il rosso resta nel dialogo: il bottone di conferma è pieno rosso', async () => {
    await openDay();
    fireEvent.click(screen.getAllByRole('button', { name: 'Elimina esercizio' })[0]);
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Elimina' });
    expect(confirm.classList.contains('MuiButton-containedError')).toBe(true);
    expect(getComputedStyle(confirm).backgroundColor).toBe(RED);
  });
});
