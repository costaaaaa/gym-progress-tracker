// Schede: nel giorno aperto l'intestazione del gruppo muscolare è in inchiostro e le azioni delle righe (Modifica,
// Elimina) sono grigie come le frecce; il rosso sta solo nel bottone di conferma dei dialoghi. La fetch è il confine.
// Colori del tema chiaro scritti a mano: text.primary #1a1816, text.secondary #6b6663, error #d50000.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitForElementToBeRemoved, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkoutPlans from './WorkoutPlans';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { json, colorOf } from '../test/dom';
import { plannedSets, times } from '../test/plannedSets';
import i18n from '../i18n';
import { unnamedControls } from '../test/accessibleNames';

const INK = 'rgb(26, 24, 22)';
const GREY = 'rgb(107, 102, 99)';
const RED = 'rgb(213, 0, 0)';

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
  fireEvent.click(await screen.findByRole('button', { name: 'Mostra giorni' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Dettagli' }));
  await screen.findAllByText('Panca piana');
};

describe('giorno aperto', () => {
  it('Modifica ed Elimina di ogni esercizio sono grigi come le frecce, non rosso', async () => {
    await openDay();
    const edits = screen.getAllByRole('button', { name: /^Modifica esercizio/ });
    const deletes = screen.getAllByRole('button', { name: /^Elimina esercizio/ });
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
    fireEvent.click(await screen.findByRole('button', { name: 'Mostra giorni' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Dettagli' }));
    await screen.findAllByText('Panca piana');
    return fetchMock;
  };

  it('il riepilogo mostra "N risc. +" solo per l\'esercizio con riscaldamento', async () => {
    await apriConPiano([planWith({ planned_sets: plannedSets(2, times(4, { min: 6, max: 8 })) })]);

    expect(screen.getByText('2 risc. + 4 × 6-8 · recupero: 120s')).toBeTruthy();
    expect(screen.getByText('3 × 12 · recupero: 60s')).toBeTruthy();
  });

  it('serie diverse e tecnica stanno nella stessa riga, la tecnica compare una volta sola', async () => {
    await apriConPiano([planWith({
      planned_sets: plannedSets(0, [{ min: 12, max: 12 }, { min: 10, max: 10 }, { min: 6, failure: true, technique: 'Rest Pause' }]),
    })]);

    expect(screen.getByText('1 × 12 + 1 × 10 + 1 × a cedimento (min. 6) · Rest pause sulla serie 3 · recupero: 120s')).toBeTruthy();
    expect(screen.getAllByText(/Rest pause/)).toHaveLength(1);
  });

  it('modificare l\'esercizio invia planned_sets (e non più sets/reps) a update_exercise.php', async () => {
    const records = [planWith({ planned_sets: plannedSets(2, times(4, { min: 6, max: 8 })) })];
    const fetchMock = await apriConPiano(records);

    fireEvent.click(screen.getAllByRole('button', { name: /^Modifica esercizio/ })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Riscaldamento').value).toBe('2');
    expect(within(dialog).getByLabelText('Serie').value).toBe('4');
    expect(within(dialog).getByLabelText('Ripetizioni').value).toBe('6-8');

    fireEvent.change(within(dialog).getByLabelText('Riscaldamento'), { target: { value: '3' } });
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

    fireEvent.click(screen.getAllByRole('button', { name: /^Modifica esercizio/ })[0]);
    const first = await screen.findByRole('dialog');
    expect(within(first).getByLabelText('Ripetizioni').value).toBe('6-8');
    vi.useFakeTimers();
    try {
      fireEvent.click(within(first).getByRole('button', { name: 'Annulla' }));
      fireEvent.click(screen.getAllByRole('button', { name: /^Modifica esercizio/, hidden: true })[1]);
      act(() => { vi.advanceTimersByTime(300); });
    } finally {
      vi.useRealTimers();
    }

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByLabelText('Ripetizioni').value).toBe('12'));
    expect(within(dialog).getByLabelText('Serie').value).toBe('3');
    expect(within(dialog).getByRole('button', { name: 'Salva modifiche' }).disabled).toBe(false);
  });

  it('con un valore non valido "Salva modifiche" è disabilitato', async () => {
    await apriConPiano([plan]);

    fireEvent.click(screen.getAllByRole('button', { name: /^Modifica esercizio/ })[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Ripetizioni'), { target: { value: '10-8' } });

    expect(within(dialog).getByRole('button', { name: 'Salva modifiche' }).disabled).toBe(true);
  });
});

describe('dialogo di eliminazione di un esercizio', () => {
  it('il rosso resta nel dialogo: il bottone di conferma è pieno rosso', async () => {
    await openDay();
    fireEvent.click(screen.getAllByRole('button', { name: /^Elimina esercizio/ })[0]);
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Elimina' });
    expect(confirm.classList.contains('MuiButton-containedError')).toBe(true);
    expect(getComputedStyle(confirm).backgroundColor).toBe(RED);
  });
});

describe('dialogo di eliminazione di una scheda', () => {
  const CRONOLOGIA = 'Gli allenamenti già fatti restano nella cronologia.';
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

  it('dice sempre che la cronologia resta', async () => {
    const dialog = await apriEliminaScheda([inactive], {});
    expect(within(dialog).getByText(CRONOLOGIA)).toBeTruthy();
  });

  it('con la scheda attiva e nessun obiettivo scelto avvisa che l\'obiettivo torna a quello senza scheda, col numero del server', async () => {
    const dialog = await apriEliminaScheda([plan], { weekly_goal: null, weekly_goal_default: 1, weekly_goal_without_plan: 4 });
    expect(await within(dialog).findByText(obiettivo(4))).toBeTruthy();
  });

  it('se l\'utente ha scelto un obiettivo non ne parla', async () => {
    const dialog = await apriEliminaScheda([plan], { weekly_goal: 2, weekly_goal_default: 1, weekly_goal_without_plan: 3 });
    await within(dialog).findByText(CRONOLOGIA);
    expect(within(dialog).queryByText(obiettivo(3))).toBeNull();
  });

  it('se l\'obiettivo predefinito è già quello senza scheda non c\'è nulla da avvisare', async () => {
    const dialog = await apriEliminaScheda([plan], { weekly_goal: null, weekly_goal_default: 5, weekly_goal_without_plan: 5 });
    await within(dialog).findByText(CRONOLOGIA);
    expect(within(dialog).queryByText(obiettivo(5))).toBeNull();
  });

  it('con una scheda non attiva non ne parla e non chiede l\'obiettivo al server', async () => {
    const prima = () => fetch.mock.calls.filter(([url]) => url.includes('user/read.php')).length;
    stubFetch([inactive], () => json({ weekly_goal: null, weekly_goal_default: 1, weekly_goal_without_plan: 3 }));
    render(<MemoryRouter><ThemeModeProvider><WorkoutPlans /></ThemeModeProvider></MemoryRouter>);
    await screen.findByText('Forza A');
    await waitFor(() => expect(prima()).toBe(1)); // la pagina legge da sola livello e limiti
    const dialog = await clickDeleteOf('Forza A');
    await within(dialog).findByText(CRONOLOGIA);
    expect(within(dialog).queryByText(obiettivo(3))).toBeNull();
    expect(prima()).toBe(1); // l'apertura del dialogo non chiede l'obiettivo
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
    await within(secondo).findByText(CRONOLOGIA);
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

describe('nuova scheda', () => {
  it.each([
    ['it', 'Nuova scheda', '1 giorno', 'Nome scheda', 'Crea', 'Giorno 1'],
    ['en', 'New plan', '1 day', 'Plan name', 'Create', 'Day 1'],
  ])('(%s) di base ha un solo giorno, col nome nella lingua, anche dopo averne creata una', async (lang, apri, uno, nome, crea, giorno) => {
    await i18n.changeLanguage(lang);
    const creaScheda = async () => {
      fireEvent.click(screen.getAllByRole('button', { name: apri })[0]);
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByRole('combobox').textContent).toBe(uno);
      return dialog;
    };
    render(<MemoryRouter><ThemeModeProvider><WorkoutPlans /></ThemeModeProvider></MemoryRouter>);
    await screen.findByText('Forza A');
    fetch.mockImplementation((url) => Promise.resolve(
      String(url).includes('create_plan.php') ? json({ plan: { id: 9 } }, 201) : json({ records: [plan] }),
    ));

    const dialog = await creaScheda();
    fireEvent.change(within(dialog).getByLabelText(nome), { target: { value: 'Nuova' } });
    fireEvent.click(within(dialog).getByRole('button', { name: crea }));
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).includes('create_days.php'))).toBe(true));
    const call = fetch.mock.calls.find(([url]) => String(url).includes('create_days.php'));
    expect(JSON.parse(call[1].body).days).toEqual([{ name: giorno, exercises: [] }]);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await creaScheda(); // riaperto dopo la creazione: mostra di nuovo un solo giorno (lo controlla creaScheda)
  });
});

describe('card della scheda: riepilogo (A15)', () => {
  const exercise = (id, name, warmups, n) => ({
    id, exercise_name: name, muscle_group: 'petto', rest: 90, notes: '',
    planned_sets: plannedSets(warmups, times(n, { min: 8, max: 10 })),
  });
  const mostraSchede = async (records) => {
    fetch.mockImplementation(() => Promise.resolve(json({ records })));
    render(<MemoryRouter><ThemeModeProvider><WorkoutPlans /></ThemeModeProvider></MemoryRouter>);
    await screen.findByText(records[0].name);
  };
  const ppl = {
    id: 1, name: 'PPL', description: 'Tre giorni', is_active: 1,
    days: [
      { id: 1, name: 'Push', exercises: [exercise(1, 'Panca piana', 2, 3), exercise(2, 'Lento', 0, 3)] },
      { id: 2, name: 'Pull', exercises: [exercise(3, 'Trazioni', 0, 4)] },
    ],
  };

  it('con nomi propri: riga divisa e conteggi senza i giorni (serie allenanti, niente riscaldamento)', async () => {
    await mostraSchede([ppl]);
    expect(screen.getByText('Push')).toBeTruthy();
    expect(screen.getByText('Pull')).toBeTruthy();
    expect(screen.getByText('3 esercizi · 10 serie')).toBeTruthy();
  });

  it('con i nomi di base: niente riga divisa e i giorni compaiono nei conteggi', async () => {
    await mostraSchede([{ ...ppl, days: ppl.days.map((d, i) => ({ ...d, name: `Giorno ${i + 1}` })) }]);
    expect(screen.getByText('2 giorni · 3 esercizi · 10 serie')).toBeTruthy();
    expect(screen.queryByText('Giorno 1')).toBeNull();
  });

  it('senza giorni dice di aggiungerne uno', async () => {
    await mostraSchede([{ ...ppl, days: [] }]);
    expect(screen.getByText('Nessun giorno: aggiungine uno')).toBeTruthy();
  });

  it('aperta: righe con serie compatte, al massimo 4, "+N esercizi" apre i dettagli del giorno', async () => {
    const many = { id: 9, name: 'Push', exercises: ['A', 'B', 'C', 'D', 'E', 'F'].map((n, i) => exercise(20 + i, `Esercizio ${n}`, i === 0 ? 2 : 0, 3)) };
    await mostraSchede([{ ...ppl, days: [many, { id: 10, name: 'Vuoto', exercises: [] }] }]);
    fireEvent.click(screen.getByRole('button', { name: 'Mostra giorni' }));
    // D sta nelle righe e nel pannello dei dettagli (chiuso), E solo nel pannello
    expect(screen.getAllByText('Esercizio D')).toHaveLength(2);
    expect(screen.getAllByText('Esercizio E')).toHaveLength(1);
    expect(screen.getByText('2 risc. + 3 × 8-10')).toBeTruthy();
    expect(screen.getByText('Nessun esercizio aggiunto')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '+2 esercizi' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nascondi' })).toBeTruthy());
    expect(screen.queryByRole('button', { name: '+2 esercizi' })).toBeNull();
  });
});

describe('nomi accessibili', () => {
  it('Modifica ed Elimina di ogni esercizio hanno il nome dell\'esercizio', async () => {
    await openDay();
    for (const nome of ['Panca piana', 'Croci ai cavi']) {
      expect(screen.getByRole('button', { name: `Modifica esercizio ${nome}` })).toBeTruthy();
      expect(screen.getByRole('button', { name: `Elimina esercizio ${nome}` })).toBeTruthy();
    }
  });

  it('ogni bottone, campo e dialogo della scheda aperta ha un nome', async () => {
    await openDay();
    expect(unnamedControls()).toEqual([]);
  });

  it('modifica ed elimina scheda dicono quale scheda, le frecce quale esercizio', async () => {
    await openDay();
    expect(screen.getByRole('button', { name: 'Modifica scheda Forza A' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Elimina scheda Forza A' })).toBeTruthy();
    for (const name of ['Panca piana', 'Croci ai cavi']) {
      expect(screen.getByRole('button', { name: `Sposta su ${name}` })).toBeTruthy();
      expect(screen.getByRole('button', { name: `Sposta giù ${name}` })).toBeTruthy();
    }
  });
});

// Piano Gratis: sola lettura, elimina giorno, selettore dei giorni, "Nuova scheda" al limite.
describe('limiti del piano Gratis', () => {
  const FREE = { success: true, tier: 'free', limits: { plans: 2, days_per_plan: 4, personal_exercises: 10 }, features: [] };
  const PRO = { success: true, tier: 'pro', limits: { plans: 50, days_per_plan: 14, personal_exercises: 30 }, features: ['focus_session_edit'] };
  const ex = (id, name) => ({ id, exercise_name: name, muscle_group: 'petto', planned_sets: plannedSets(0, times(3, { min: 8, max: 10 })), rest: 90, notes: '' });
  const day = (id, name = `Giorno ${id}`) => ({ id, name, exercises: [ex(id * 10, `Esercizio ${id}`)] });
  const mk = (id, over = {}) => ({
    id, name: `Scheda ${id}`, description: '', is_active: id === 1 ? 1 : 0,
    days: [day(id * 100 + 1), day(id * 100 + 2)], read_only: false, read_only_reason: null, ...over,
  });

  let handlers;
  const calls = (part) => fetch.mock.calls.filter(([url]) => String(url).includes(part));
  const mount = async (records, user = FREE) => {
    handlers = {};
    vi.stubGlobal('fetch', vi.fn((url) => {
      const key = Object.keys(handlers).find((k) => String(url).includes(k));
      if (key) return Promise.resolve(handlers[key]());
      if (String(url).includes('user/read.php')) return Promise.resolve(json(user));
      return Promise.resolve(json({ records }));
    }));
    render(<MemoryRouter><ThemeModeProvider><WorkoutPlans /></ThemeModeProvider></MemoryRouter>);
    await screen.findByText(records[0].name);
    await waitFor(() => expect(calls('user/read.php')).toHaveLength(1));
    await act(async () => {});
  };
  const openAll = () => {
    fireEvent.click(screen.getAllByRole('button', { name: 'Mostra giorni' })[0]);
    for (const b of screen.getAllByRole('button', { name: 'Dettagli' })) fireEvent.click(b);
  };

  describe('scheda in sola lettura', () => {
    const readOnly = (reason, days = 2, id = 1) => mk(id, {
      read_only: true, read_only_reason: reason, days: Array.from({ length: days }, (_, i) => day(101 + i)),
    });

    it.each([
      ['plans_over_limit', 2, /Hai più di 2 schede: sono in sola lettura finché non ne elimini alcune/],
      ['days_over_limit', 5, /Questa scheda ha più di 4 giorni: è in sola lettura finché non ne elimini alcuni/],
    ])('(%s) avvisa col numero del server, nasconde i comandi bloccati e lascia gli altri', async (reason, days, notice) => {
      await mount([readOnly(reason, days), mk(2)]);
      expect(screen.getAllByText(notice)).toHaveLength(1);
      expect(screen.getByText(/Con Plus o Pro il limite è più alto/)).toBeTruthy();
      openAll();
      expect(screen.queryByRole('button', { name: 'Aggiungi esercizio' })).toBeNull();
      for (const re of [/^Modifica esercizio/, /^Elimina esercizio/, /^Sposta su/, /^Sposta giù/]) {
        // le card non in sola lettura (Scheda 2) restano chiuse: qui non c'è nessun comando bloccato
        expect(screen.queryAllByRole('button', { name: re })).toHaveLength(0);
      }
      expect(screen.getByRole('button', { name: 'Modifica scheda Scheda 1' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Elimina scheda Scheda 1' })).toBeTruthy();
      expect(screen.getAllByRole('button', { name: /^Elimina giorno/ })).toHaveLength(days);
    });

    it.each([
      ['plans_over_limit', /Hai più schede del limite consentito: sono in sola lettura/],
      ['days_over_limit', /Questa scheda ha più giorni del limite consentito: è in sola lettura/],
    ])('(%s) senza i limiti dell\'account l\'avviso c\'è comunque, senza numero', async (reason, notice) => {
      await mount([readOnly(reason, 5)], { success: false });
      expect(screen.getAllByText(notice)).toHaveLength(1);
      expect(screen.queryByText(/Con Plus o Pro/)).toBeNull();
      expect(screen.queryByRole('button', { name: 'Aggiungi esercizio' })).toBeNull();
    });

    it('con un limite null nell\'account l\'avviso non cita "null"', async () => {
      await mount([readOnly('plans_over_limit')], { ...FREE, limits: { plans: null, days_per_plan: null, personal_exercises: 10 } });
      expect(screen.getByText(/Hai più schede del limite consentito/)).toBeTruthy();
    });

    it('tre schede plans_over_limit: un solo avviso, sopra l\'elenco e non sulle card', async () => {
      const over = (id) => mk(id, { read_only: true, read_only_reason: 'plans_over_limit' });
      await mount([over(1), over(2), over(3)]);
      const notice = screen.getAllByText(/Hai più di 2 schede: sono in sola lettura/);
      expect(notice).toHaveLength(1);
      expect(notice[0].closest('.MuiCard-root')).toBeNull();
      // i comandi restano nascosti sulle schede in sola lettura
      for (const b of screen.getAllByRole('button', { name: 'Mostra giorni' })) fireEvent.click(b);
      expect(screen.queryByRole('button', { name: 'Aggiungi esercizio' })).toBeNull();
    });

    it('una scheda days_over_limit ha l\'avviso sulla sua card, non in cima', async () => {
      await mount([mk(1), readOnly('days_over_limit', 5, 2)]);
      const notice = screen.getAllByText(/Questa scheda ha più di 4 giorni/);
      expect(notice).toHaveLength(1);
      expect(notice[0].closest('.MuiCard-root')).not.toBeNull();
    });

    it('sola lettura con un motivo sconosciuto: l\'avviso generale, una volta sola sopra l\'elenco', async () => {
      await mount([readOnly('altro', 2, 1), readOnly(undefined, 2, 2)]);
      const notice = screen.getAllByText(/Hai più di 2 schede: sono in sola lettura/);
      expect(notice).toHaveLength(1);
      expect(notice[0].closest('.MuiCard-root')).toBeNull();
    });

    it('la scheda in sola lettura non ancora attiva si può attivare', async () => {
      await mount([mk(2, { read_only: true, read_only_reason: 'plans_over_limit' })]);
      expect(screen.getByRole('button', { name: 'Attiva scheda' })).toBeTruthy();
    });

    it('per Plus e Pro il messaggio non cita il livello superiore', async () => {
      await mount([readOnly('plans_over_limit')], { ...PRO, limits: { plans: 2, days_per_plan: 4, personal_exercises: 30 } });
      expect(screen.getByText(/Hai più di 2 schede/)).toBeTruthy();
      expect(screen.queryByText(/Con Plus o Pro/)).toBeNull();
    });

    it('una scheda modificabile ha tutti i comandi e nessun avviso', async () => {
      await mount([mk(1)]);
      openAll();
      expect(screen.queryByText(/sola lettura/)).toBeNull();
      expect(screen.getAllByRole('button', { name: 'Aggiungi esercizio' })).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: /^Modifica esercizio/ })).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: /^Sposta su/ })).toHaveLength(2);
    });
  });

  describe('rifiuto plan_read_only dal server', () => {
    const MSG = 'Hai più di 2 schede: sono in sola lettura finché non ne elimini alcune.';
    const refuse = () => json({ success: false, code: 'plan_read_only', message: MSG, reason: 'plans_over_limit', limit: 2 }, 409);

    it('eliminare un esercizio mostra il messaggio come errore', async () => {
      await mount([mk(1)]);
      handlers['delete_exercise.php'] = refuse;
      openAll();
      fireEvent.click(screen.getAllByRole('button', { name: /^Elimina esercizio/ })[0]);
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Elimina' }));
      expect((await screen.findByRole('alert')).textContent).toContain(MSG);
    });

    it('spostare un esercizio mostra il messaggio come errore', async () => {
      await mount([mk(1, { days: [{ ...day(101), exercises: [ex(1, 'A'), ex(2, 'B')] }, day(102)] })]);
      handlers['reorder_exercise.php'] = refuse;
      openAll();
      fireEvent.click(screen.getByRole('button', { name: 'Sposta giù A' }));
      expect((await screen.findByRole('alert')).textContent).toContain(MSG);
    });

    it('aggiungere un esercizio mostra il messaggio come errore', async () => {
      await mount([mk(1)]);
      handlers['add_exercise.php'] = refuse;
      handlers['exercise/read_all.php'] = () => json({ records: [{ id: 7, name: 'Panca Piana', muscle_group: 'petto', equipment: 'bilanciere' }] });
      openAll();
      fireEvent.click(screen.getAllByRole('button', { name: 'Aggiungi esercizio' })[0]);
      const dialog = await screen.findByRole('dialog');
      await act(async () => {});
      fireEvent.mouseDown(document.getElementById('mui-component-select-muscleGroup'));
      fireEvent.click(screen.getByRole('option', { name: 'Petto' }));
      fireEvent.change(within(dialog).getByLabelText('Nome esercizio'), { target: { value: 'Panca' } });
      await act(async () => {});
      fireEvent.click(screen.getByRole('option', { name: 'Panca Piana' }));
      fireEvent.change(within(dialog).getByLabelText('Serie'), { target: { value: '3' } });
      fireEvent.change(within(dialog).getByLabelText('Ripetizioni'), { target: { value: '8-10' } });
      fireEvent.change(within(dialog).getByLabelText(/Recupero \(s\)/), { target: { value: '90' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Aggiungi' }));
      await waitFor(() => expect(calls('add_exercise.php')).toHaveLength(1));
      await waitFor(() => expect(screen.getAllByRole('alert').some((a) => a.textContent.includes(MSG))).toBe(true));
    });

    it('modificare un esercizio mostra il messaggio come errore', async () => {
      await mount([mk(1)]);
      handlers['update_exercise.php'] = refuse;
      openAll();
      fireEvent.click(screen.getAllByRole('button', { name: /^Modifica esercizio/ })[0]);
      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Salva modifiche' }));
      await waitFor(() => expect(screen.getAllByRole('alert').some((a) => a.textContent.includes(MSG))).toBe(true));
    });
  });

  describe('elimina giorno', () => {
    it('chiede conferma (si perdono gli esercizi, non gli allenamenti registrati) e chiama delete_day.php', async () => {
      await mount([mk(1)]);
      handlers['delete_day.php'] = () => json({ success: true, message: 'Giorno eliminato' });
      openAll();
      fireEvent.click(screen.getByRole('button', { name: 'Elimina giorno Giorno 102' }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(/Gli esercizi di questo giorno verranno eliminati/)).toBeTruthy();
      expect(within(dialog).getByText('Gli allenamenti già fatti restano nella cronologia.')).toBeTruthy();
      expect(calls('delete_day.php')).toHaveLength(0);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Elimina' }));
      await waitFor(() => expect(calls('delete_day.php')).toHaveLength(1));
      expect(JSON.parse(calls('delete_day.php')[0][1].body)).toEqual({ day_id: 102 });
      await waitFor(() => expect(calls('read_plans.php').length).toBeGreaterThan(1));
    });

    it('con un solo giorno il comando non c\'è', async () => {
      await mount([mk(1, { days: [day(101)] })]);
      openAll();
      expect(screen.queryByRole('button', { name: /^Elimina giorno/ })).toBeNull();
    });

    it('un rifiuto del server si vede come errore', async () => {
      await mount([mk(1)]);
      handlers['delete_day.php'] = () => json({ success: false, code: 'last_day', message: 'Non puoi eliminare l\'ultimo giorno.' }, 409);
      openAll();
      fireEvent.click(screen.getByRole('button', { name: 'Elimina giorno Giorno 101' }));
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Elimina' }));
      expect((await screen.findByRole('alert')).textContent).toContain('Non puoi eliminare l\'ultimo giorno.');
    });

    describe('con un allenamento Focus in corso su quel giorno', () => {
      afterEach(() => localStorage.removeItem('gym_focus_workout_draft'));

      it('spiega di salvarlo o scartarlo prima e non lascia confermare', async () => {
        localStorage.setItem('gym_focus_workout_draft', JSON.stringify({ selectedDayId: 102, selectedDay: day(102), startTime: '2026-11-16T10:00:00Z' }));
        await mount([mk(1)]);
        openAll();
        fireEvent.click(screen.getByRole('button', { name: 'Elimina giorno Giorno 102' }));
        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText(/allenamento in corso su questo giorno/)).toBeTruthy();
        expect(within(dialog).getByRole('button', { name: 'Elimina' }).disabled).toBe(true);
        expect(calls('delete_day.php')).toHaveLength(0);
      });

      it('a chi ha la funzione focus_session_edit (Plus, Pro) il salvataggio riuscirebbe: l\'eliminazione resta possibile', async () => {
        localStorage.setItem('gym_focus_workout_draft', JSON.stringify({ selectedDayId: 102, selectedDay: day(102), startTime: '2026-11-16T10:00:00Z' }));
        await mount([mk(1)], PRO);
        openAll();
        fireEvent.click(screen.getByRole('button', { name: 'Elimina giorno Giorno 102' }));
        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).queryByText(/allenamento in corso/)).toBeNull();
        expect(within(dialog).getByRole('button', { name: 'Elimina' }).disabled).toBe(false);
      });

      it('un allenamento in corso su un altro giorno non blocca nulla', async () => {
        localStorage.setItem('gym_focus_workout_draft', JSON.stringify({ selectedDayId: 101, selectedDay: day(101), startTime: '2026-11-16T10:00:00Z' }));
        await mount([mk(1)]);
        openAll();
        fireEvent.click(screen.getByRole('button', { name: 'Elimina giorno Giorno 102' }));
        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByRole('button', { name: 'Elimina' }).disabled).toBe(false);
      });
    });
  });

  describe('nuova scheda', () => {
    const openNew = () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Nuova scheda' })[0]);
      return screen.findByRole('dialog');
    };
    const dayOptions = async (dialog) => {
      fireEvent.mouseDown(within(dialog).getByRole('combobox'));
      return screen.getAllByRole('option').map((o) => o.textContent);
    };

    it('il selettore dei giorni si ferma al limite del piano Gratis e mostra la riga con lucchetto', async () => {
      await mount([mk(1)]);
      const dialog = await openNew();
      expect(await dayOptions(dialog)).toEqual(['1 giorno', '2 giorni', '3 giorni', '4 giorni']);
      expect(within(dialog).getByText('Più di 4 giorni per scheda')).toBeTruthy();
      expect(within(dialog).getByRole('link', { name: 'Confronta i piani', hidden: true }).getAttribute('href')).toBe('/piani');
    });

    it('con limite alto il selettore arriva a 7 e non c\'è la riga con lucchetto', async () => {
      await mount([mk(1)], PRO);
      const dialog = await openNew();
      expect(await dayOptions(dialog)).toHaveLength(7);
      expect(within(dialog).queryByText(/Più di/)).toBeNull();
    });

    it('con il piano Gratis al limite delle schede il comando è disattivato e c\'è la riga con lucchetto', async () => {
      await mount([mk(1), mk(2)]);
      expect(screen.getByRole('button', { name: 'Nuova scheda' }).disabled).toBe(true);
      expect(screen.getByText('Hai 2 schede su 2')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Confronta i piani' }).getAttribute('href')).toBe('/piani');
    });

    it('finché user/read.php non ha risposto il comando è disattivato; se la lettura fallisce si attiva', async () => {
      let rispondi;
      vi.stubGlobal('fetch', vi.fn((url) => (String(url).includes('user/read.php')
        ? new Promise((resolve) => { rispondi = () => resolve(json({ success: false }, 500)); })
        : Promise.resolve(json({ records: [mk(1)] })))));
      render(<MemoryRouter><ThemeModeProvider><WorkoutPlans /></ThemeModeProvider></MemoryRouter>);
      await screen.findByText('Scheda 1');
      expect(screen.getByRole('button', { name: 'Nuova scheda' }).disabled).toBe(true);
      await act(async () => { rispondi(); });
      expect(screen.getByRole('button', { name: 'Nuova scheda' }).disabled).toBe(false);
    });

    it('se la lettura di user/read.php fallisce per la rete il comando si attiva', async () => {
      vi.stubGlobal('fetch', vi.fn((url) => (String(url).includes('user/read.php')
        ? Promise.reject(new TypeError('Failed to fetch'))
        : Promise.resolve(json({ records: [mk(1)] })))));
      render(<MemoryRouter><ThemeModeProvider><WorkoutPlans /></ThemeModeProvider></MemoryRouter>);
      await screen.findByText('Scheda 1');
      await waitFor(() => expect(screen.getByRole('button', { name: 'Nuova scheda' }).disabled).toBe(false));
    });

    it('sotto il limite il comando è attivo e senza riga', async () => {
      await mount([mk(1)]);
      expect(screen.getByRole('button', { name: 'Nuova scheda' }).disabled).toBe(false);
      expect(screen.queryByText(/Hai \d+ schede su/)).toBeNull();
    });

    it('per Plus e Pro al limite il comando resta attivo (risponde il server)', async () => {
      await mount([mk(1), mk(2)], { ...PRO, limits: { plans: 2, days_per_plan: 14, personal_exercises: 30 } });
      expect(screen.getByRole('button', { name: 'Nuova scheda' }).disabled).toBe(false);
      expect(screen.queryByText(/Hai \d+ schede su/)).toBeNull();
    });
  });
});
