// Schede: nel giorno aperto l'intestazione del gruppo muscolare è in inchiostro e le azioni delle righe (Modifica,
// Elimina) sono grigie come le frecce; il rosso sta solo nel bottone di conferma dei dialoghi. La fetch è il confine.
// Colori del tema chiaro scritti a mano: text.primary #1a1816, text.secondary #6b6663, error #d50000.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitForElementToBeRemoved, waitFor, act } from '@testing-library/react';
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

describe('serie di riscaldamento (#66)', () => {
  const planWithWarmup = {
    ...plan,
    days: [{
      ...plan.days[0],
      exercises: [
        { ...plan.days[0].exercises[0], warmup_sets: 2 },
        plan.days[0].exercises[1],
      ],
    }],
  };

  it('il riepilogo mostra "N risc. +" solo per l\'esercizio con warmup_sets > 0', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ records: [planWithWarmup] }))));
    render(<MemoryRouter><ThemeModeProvider><WorkoutPlans /></ThemeModeProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Mostra dettagli' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dettagli' }));
    await screen.findByText('Panca piana');

    expect(screen.getByText('2 risc. + 4 serie x 6-8 - recupero: 120s')).toBeTruthy();
  });

  it('non mostra il prefisso per un esercizio senza riscaldamento', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ records: [planWithWarmup] }))));
    render(<MemoryRouter><ThemeModeProvider><WorkoutPlans /></ThemeModeProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Mostra dettagli' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dettagli' }));
    await screen.findByText('Croci ai cavi');

    expect(screen.getByText('3 serie x 12 - recupero: 60s')).toBeTruthy();
  });

  it('modificare l\'esercizio invia warmup_sets a update_exercise.php', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json({ records: [planWithWarmup] })));
    vi.stubGlobal('fetch', fetchMock);
    render(<MemoryRouter><ThemeModeProvider><WorkoutPlans /></ThemeModeProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Mostra dettagli' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dettagli' }));
    await screen.findByText('Panca piana');

    fireEvent.click(screen.getAllByRole('button', { name: 'Modifica esercizio' })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Serie di riscaldamento').value).toBe('2');

    fireEvent.change(within(dialog).getByLabelText('Serie di riscaldamento'), { target: { value: '3' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salva modifiche' }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes('update_exercise.php'))).toBe(true));
    const call = fetchMock.mock.calls.find(([url]) => url.includes('update_exercise.php'));
    const body = JSON.parse(call[1].body);
    expect(body.warmup_sets).toBe(3);
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
  const obiettivo = (n) => `L'obiettivo della settimana tornerà a quello predefinito (${n} allenamenti).`;
  const inactive = { ...plan, is_active: 0 };
  const other = { ...inactive, id: 2, name: 'Forza B' };

  const stubFetch = (records, user) => vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(
    url.includes('user/read.php') ? user() : json({ records }),
  )));
  const clickDeleteOf = async (name) => {
    const card = (await screen.findByText(name, { selector: 'h6, h5, h4, p, span' })).closest('[class*="MuiCard"], [class*="MuiPaper"]');
    fireEvent.click(within(card).getByTestId('DeleteIcon').closest('button'));
    return screen.findByRole('dialog');
  };
  const apriEliminaScheda = async (records, user) => {
    stubFetch(records, () => json(user));
    render(<MemoryRouter><ThemeModeProvider><WorkoutPlans /></ThemeModeProvider></MemoryRouter>);
    return clickDeleteOf('Forza A');
  };

  it('dice sempre che lo storico resta', async () => {
    const dialog = await apriEliminaScheda([inactive], {});
    expect(within(dialog).getByText(STORICO)).toBeTruthy();
  });

  it('con la scheda attiva e nessun obiettivo scelto avvisa che l\'obiettivo torna a quello senza scheda, col numero del server', async () => {
    const dialog = await apriEliminaScheda([plan], { weekly_goal: null, weekly_goal_default: 1, weekly_goal_without_plan: 4 });
    expect(await within(dialog).findByText(obiettivo(4))).toBeTruthy();
  });

  it('se l\'utente ha scelto un obiettivo non ne parla', async () => {
    const dialog = await apriEliminaScheda([plan], { weekly_goal: 2, weekly_goal_default: 1, weekly_goal_without_plan: 3 });
    await within(dialog).findByText(STORICO);
    expect(within(dialog).queryByText(obiettivo(3))).toBeNull();
  });

  it('se l\'obiettivo predefinito è già quello senza scheda non c\'è nulla da avvisare', async () => {
    const dialog = await apriEliminaScheda([plan], { weekly_goal: null, weekly_goal_default: 5, weekly_goal_without_plan: 5 });
    await within(dialog).findByText(STORICO);
    expect(within(dialog).queryByText(obiettivo(5))).toBeNull();
  });

  it('con una scheda non attiva non ne parla e non chiede l\'obiettivo al server', async () => {
    const dialog = await apriEliminaScheda([inactive], { weekly_goal: null, weekly_goal_default: 1, weekly_goal_without_plan: 3 });
    await within(dialog).findByText(STORICO);
    expect(within(dialog).queryByText(obiettivo(3))).toBeNull();
    expect(fetch.mock.calls.some(([url]) => url.includes('user/read.php'))).toBe(false);
  });

  it('la risposta tardiva per una scheda attiva non finisce nel dialogo di un\'altra scheda', async () => {
    let rispondi;
    stubFetch([plan, other], () => new Promise((resolve) => { rispondi = () => resolve(json({ weekly_goal: null, weekly_goal_default: 1, weekly_goal_without_plan: 3 })); }));
    render(<MemoryRouter><ThemeModeProvider><WorkoutPlans /></ThemeModeProvider></MemoryRouter>);
    const primo = await clickDeleteOf('Forza A');
    fireEvent.click(within(primo).getByRole('button', { name: 'Annulla' }));
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
    const secondo = await clickDeleteOf('Forza B');
    await act(async () => { rispondi(); });
    await within(secondo).findByText(STORICO);
    expect(within(secondo).queryByText(obiettivo(3))).toBeNull();
  });

  it('la risposta tardiva arrivata dopo la conferma dell\'eliminazione non rimette l\'avviso nel dialogo che si sta chiudendo', async () => {
    let rispondi;
    stubFetch([plan], () => new Promise((resolve) => { rispondi = () => resolve(json({ weekly_goal: null, weekly_goal_default: 1, weekly_goal_without_plan: 3 })); }));
    render(<MemoryRouter><ThemeModeProvider><WorkoutPlans /></ThemeModeProvider></MemoryRouter>);
    const dialog = await clickDeleteOf('Forza A');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Elimina' }));
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.includes('delete_plan.php'))).toBe(true));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Elimina', hidden: true }).disabled).toBe(false));
    await act(async () => { rispondi(); });
    expect(screen.queryByText(obiettivo(3))).toBeNull();
  });
});
