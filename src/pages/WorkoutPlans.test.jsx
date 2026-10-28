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

describe('dialogo di eliminazione di una scheda', () => {
  const STORICO = 'Gli allenamenti già fatti restano nello storico.';
  const OBIETTIVO = 'L\'obiettivo della settimana tornerà a quello predefinito (3 allenamenti).';
  const inactive = { ...plan, is_active: 0 };

  const apriEliminaScheda = async (records, user) => {
    vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
      url.includes('user/read.php') ? json(user) : json({ records }),
    )));
    render(<MemoryRouter><ThemeModeProvider><WorkoutPlans /></ThemeModeProvider></MemoryRouter>);
    const dialogoAperto = (await screen.findByText('Forza A', { selector: 'h6, h5, h4, p, span' })).closest('[class*="MuiCard"], [class*="MuiPaper"]');
    fireEvent.click(within(dialogoAperto).getByTestId('DeleteIcon').closest('button'));
    return screen.findByRole('dialog');
  };

  it('dice sempre che lo storico resta', async () => {
    const dialog = await apriEliminaScheda([inactive], {});
    expect(within(dialog).getByText(STORICO)).toBeTruthy();
  });

  it('con la scheda attiva e nessun obiettivo scelto avvisa che l\'obiettivo torna a quello predefinito', async () => {
    const dialog = await apriEliminaScheda([plan], { weekly_goal: null, weekly_goal_default: 1 });
    expect(await within(dialog).findByText(OBIETTIVO)).toBeTruthy();
  });

  it('se l\'utente ha scelto un obiettivo non ne parla', async () => {
    const dialog = await apriEliminaScheda([plan], { weekly_goal: 2, weekly_goal_default: 1 });
    await within(dialog).findByText(STORICO);
    expect(within(dialog).queryByText(OBIETTIVO)).toBeNull();
  });

  it('se l\'obiettivo predefinito è già quello senza scheda (3) non c\'è nulla da avvisare', async () => {
    const dialog = await apriEliminaScheda([plan], { weekly_goal: null, weekly_goal_default: 3 });
    await within(dialog).findByText(STORICO);
    expect(within(dialog).queryByText(OBIETTIVO)).toBeNull();
  });

  it('con una scheda non attiva non ne parla e non chiede l\'obiettivo al server', async () => {
    const dialog = await apriEliminaScheda([inactive], { weekly_goal: null, weekly_goal_default: 1 });
    await within(dialog).findByText(STORICO);
    expect(within(dialog).queryByText(OBIETTIVO)).toBeNull();
    expect(fetch.mock.calls.some(([url]) => url.includes('user/read.php'))).toBe(false);
  });
});
