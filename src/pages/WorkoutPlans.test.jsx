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

// Serie pianificate come le restituisce il server: `warmups` di riscaldamento, poi le allenanti { min, max, failure, technique }
const plannedSets = (warmups, rows) => [
  ...Array.from({ length: warmups }, () => ({ kind: 'warmup', reps_min: null, reps_max: null, to_failure: false, intensity_technique: null })),
  ...rows.map(({ min = null, max = null, failure = false, technique = null }) => ({
    kind: 'working', reps_min: min, reps_max: failure ? null : max, to_failure: failure, intensity_technique: technique,
  })),
].map((set, i) => ({ set_number: i + 1, ...set }));
const times = (n, row) => Array.from({ length: n }, () => row);

const plan = {
  id: 1, name: 'Forza A', description: '', is_active: 1,
  days: [{
    id: 11, name: 'Giorno 1',
    exercises: [
      { id: 101, exercise_name: 'Panca piana', muscle_group: 'petto', planned_sets: plannedSets(0, times(4, { min: 6, max: 8 })), rest: 120, notes: '' },
      { id: 102, exercise_name: 'Croci ai cavi', muscle_group: 'petto', planned_sets: plannedSets(0, times(3, { min: 12, max: 12 })), rest: 60, notes: '' },
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

describe('serie pianificate (#77)', () => {
  const planWith = (first) => ({
    ...plan,
    days: [{ ...plan.days[0], exercises: [{ ...plan.days[0].exercises[0], ...first }, plan.days[0].exercises[1]] }],
  });
  const apriConPiano = async (records, fetchMock = vi.fn(() => Promise.resolve(json({ records })))) => {
    vi.stubGlobal('fetch', fetchMock);
    render(<MemoryRouter><ThemeModeProvider><WorkoutPlans /></ThemeModeProvider></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Mostra dettagli' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dettagli' }));
    await screen.findByText('Panca piana');
    return fetchMock;
  };

  it('il riepilogo mostra "N risc. +" solo per l\'esercizio con riscaldamento', async () => {
    await apriConPiano([planWith({ planned_sets: plannedSets(2, times(4, { min: 6, max: 8 })) })]);

    expect(screen.getByText('2 risc. + 4 × 6-8 · recupero: 120s')).toBeTruthy();
    expect(screen.getByText('3 × 12 · recupero: 60s')).toBeTruthy();
  });

  it('serie diverse e tecnica stanno nella stessa riga, senza il chip della tecnica', async () => {
    await apriConPiano([planWith({
      planned_sets: plannedSets(0, [{ min: 12, max: 12 }, { min: 10, max: 10 }, { min: 6, failure: true, technique: 'Rest Pause' }]),
    })]);

    expect(screen.getByText('1 × 12 + 1 × 10 + 1 × a cedimento (min. 6) · Rest pause (serie 3) · recupero: 120s')).toBeTruthy();
    expect(document.querySelector('.MuiChip-root')).toBeNull();
  });

  it('modificare l\'esercizio invia planned_sets (e non più sets/reps) a update_exercise.php', async () => {
    const records = [planWith({ planned_sets: plannedSets(2, times(4, { min: 6, max: 8 })) })];
    const fetchMock = await apriConPiano(records);

    fireEvent.click(screen.getAllByRole('button', { name: 'Modifica esercizio' })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Serie di riscaldamento').value).toBe('2');
    expect(within(dialog).getByLabelText('Serie').value).toBe('4');
    expect(within(dialog).getByLabelText('Ripetizioni').value).toBe('6-8');

    fireEvent.change(within(dialog).getByLabelText('Serie di riscaldamento'), { target: { value: '3' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salva modifiche' }));

    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url.includes('update_exercise.php'))).toBe(true));
    const body = JSON.parse(fetchMock.mock.calls.find(([url]) => url.includes('update_exercise.php'))[1].body);
    expect(body.planned_sets.filter((set) => set.kind === 'warmup')).toHaveLength(3);
    expect(body.planned_sets.filter((set) => set.kind === 'working')).toHaveLength(4);
    expect(body).not.toHaveProperty('sets');
    expect(body).not.toHaveProperty('warmup_sets');
    expect(body).not.toHaveProperty('reps');
    expect(body).not.toHaveProperty('intensity_technique');
  });

  it('chiudere la modifica di un esercizio e aprire subito quella di un altro mostra le serie del secondo e permette di salvare', async () => {
    await apriConPiano([plan]);

    fireEvent.click(screen.getAllByRole('button', { name: 'Modifica esercizio' })[0]);
    const first = await screen.findByRole('dialog');
    expect(within(first).getByLabelText('Ripetizioni').value).toBe('6-8');
    fireEvent.click(within(first).getByRole('button', { name: 'Annulla' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Modifica esercizio', hidden: true })[1]);
    await new Promise((resolve) => setTimeout(resolve, 300));

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByLabelText('Ripetizioni').value).toBe('12'));
    expect(within(dialog).getByLabelText('Serie').value).toBe('3');
    expect(within(dialog).getByRole('button', { name: 'Salva modifiche' }).disabled).toBe(false);
  });

  it('con un valore non valido "Salva modifiche" è disabilitato', async () => {
    await apriConPiano([plan]);

    fireEvent.click(screen.getAllByRole('button', { name: 'Modifica esercizio' })[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Ripetizioni'), { target: { value: '10-8' } });

    expect(within(dialog).getByRole('button', { name: 'Salva modifiche' }).disabled).toBe(true);
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
