// Comportamenti della pagina Schede che la divisione in file non deve cambiare: attributo della card, campi dei
// dialog a ogni apertura, bersaglio di «Elimina esercizio». La fetch è il confine.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkoutPlans from '../WorkoutPlans';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import { json } from '../../test/dom';
import { plannedSets, times } from '../../test/plannedSets';

const plan = {
  id: 1, name: 'Forza A', description: 'Base', is_active: 1,
  days: [{
    id: 11, name: 'Giorno 1',
    exercises: [
      { id: 101, exercise_name: 'Panca piana', muscle_group: 'petto', planned_sets: plannedSets(0, times(4, { min: 6, max: 8 })), rest: 120, notes: '' },
    ],
  }],
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ records: [plan] }))));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const open = async () => {
  render(<MemoryRouter><ThemeModeProvider><WorkoutPlans /></ThemeModeProvider></MemoryRouter>);
  await screen.findByText('Forza A');
};
const openDay = async () => {
  await open();
  fireEvent.click(screen.getByRole('button', { name: 'Mostra giorni' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Dettagli' }));
  await screen.findAllByText('Panca piana');
};

describe('card', () => {
  it('«Mostra giorni» non ha aria-expanded finché la card non è mai stata aperta', async () => {
    await open();
    const toggle = screen.getByRole('button', { name: 'Mostra giorni' });
    expect(toggle.hasAttribute('aria-expanded')).toBe(false);
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Nascondi giorni' }).getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Nascondi giorni' }));
    expect(screen.getByRole('button', { name: 'Mostra giorni' }).getAttribute('aria-expanded')).toBe('false');
  });
});

describe('campi dei dialog a ogni apertura', () => {
  it('«Modifica scheda»: annullare e riaprire subito la stessa scheda riparte dai suoi valori', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Modifica scheda Forza A' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nome scheda'), { target: { value: 'Scartato' } });
    vi.useFakeTimers();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla' }));
    fireEvent.click(screen.getByRole('button', { name: 'Modifica scheda Forza A', hidden: true }));
    act(() => { vi.advanceTimersByTime(0); });
    expect(within(screen.getByRole('dialog')).getByLabelText('Nome scheda').value).toBe('Forza A');
  });

  it('«Modifica esercizio»: annullare e riaprire subito lo stesso esercizio riparte dai suoi valori', async () => {
    await openDay();
    fireEvent.click(screen.getByRole('button', { name: /^Modifica esercizio/ }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Recupero (s)'), { target: { value: '999' } });
    vi.useFakeTimers();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla' }));
    fireEvent.click(screen.getByRole('button', { name: /^Modifica esercizio/, hidden: true }));
    act(() => { vi.advanceTimersByTime(0); });
    expect(within(screen.getByRole('dialog')).getByLabelText('Recupero (s)').value).toBe('120');
  });
});

describe('Elimina esercizio', () => {
  it('alla conferma il nome nel dialog sparisce subito, senza aspettare la dissolvenza', async () => {
    await openDay();
    fireEvent.click(screen.getByRole('button', { name: /^Elimina esercizio/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/^Esercizio:/)).toBeTruthy();
    vi.useFakeTimers();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Elimina' }));
    await act(async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); });
    expect(fetch.mock.calls.some(([url]) => url.includes('delete_exercise.php'))).toBe(true);
    expect(screen.queryByText(/^Esercizio:/)).toBeNull();
  });
});
