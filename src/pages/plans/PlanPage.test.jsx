// Pagina di una scheda (/schede/:id): lettura con «Inizia» per giorno, modifica dopo «Modifica», sola lettura, ritorni.
// Raccoglie i test che prima stavano sulla card espandibile della pagina Schede. La fetch è il confine.
// Colori del tema chiaro scritti a mano: text.secondary #6b6663, error #d50000.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import PlanPage from './PlanPage';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import { json, colorOf, textsBelow16pxExceptActiveBadge } from '../../test/dom';
import { plannedSets, times } from '../../test/plannedSets';
import { unnamedControls } from '../../test/accessibleNames';
import i18n from '../../i18n';

const GREY = 'rgb(107, 102, 99)';
const RED = 'rgb(213, 0, 0)';

const FREE = { success: true, email_verified: true, email_verification: null, pending_email: null, tier: 'free', tier_until: null, tier_last_day: null, signup_code: null, limits: { plans: 2, days_per_plan: 4, personal_exercises: 10 }, features: [] };
const PRO = { success: true, email_verified: true, email_verification: null, pending_email: null, tier: 'pro', tier_until: null, tier_last_day: null, signup_code: null, limits: { plans: 50, days_per_plan: 14, personal_exercises: 30 }, features: ['focus_session_edit'] };
const ex = (id, name, over = {}) => ({ id, exercise_name: name, muscle_group: 'petto', planned_sets: plannedSets(0, times(3, { min: 8, max: 10 })), rest: 90, notes: '', ...over });
const day = (id, name = `Giorno ${id}`, exercises = [ex(id * 10, `Esercizio ${id}`)]) => ({ id, name, exercises });
const mk = (id, over = {}) => ({
  id, name: `Scheda ${id}`, description: '', is_active: id === 1 ? 1 : 0,
  days: [day(id * 100 + 1), day(id * 100 + 2)], read_only: false, read_only_reason: null, ...over,
});
const forza = {
  id: 1, name: 'Forza A', description: 'Base', is_active: 1, read_only: false, read_only_reason: null,
  days: [{
    id: 11, name: 'Giorno 1',
    exercises: [
      ex(101, 'Panca piana', { planned_sets: plannedSets(0, times(4, { min: 6, max: 8 })), rest: 120 }),
      ex(102, 'Croci ai cavi', { planned_sets: plannedSets(0, times(3, { min: 12, max: 12 })), rest: 60, notes: 'Piano lento' }),
    ],
  }],
};

const FocusProbe = () => <div data-testid="focus">{JSON.stringify(useLocation().state)}</div>;
// Lo stato di navigazione della pagina in corso: dopo l'ingresso deve tornare vuoto
const StateProbe = () => <div data-testid="stato">{JSON.stringify(useLocation().state)}</div>;

let handlers;
const calls = (part) => fetch.mock.calls.filter(([url]) => String(url).includes(part));
const mount = async (records, { user = FREE, path = '/schede/1', state } = {}) => {
  handlers = {};
  vi.stubGlobal('fetch', vi.fn((url) => {
    const key = Object.keys(handlers).find((k) => String(url).includes(k));
    if (key) return Promise.resolve(handlers[key]());
    if (String(url).includes('user/read.php')) return Promise.resolve(json(user));
    return Promise.resolve(json({ records }));
  }));
  render(
    <ThemeModeProvider>
      <MemoryRouter initialEntries={[{ pathname: path, state }]}>
        <Routes>
          <Route path="/schede" element={<div>ELENCO<StateProbe /></div>} />
          <Route path="/schede/:id" element={<><PlanPage /><StateProbe /></>} />
          <Route path="/focus" element={<FocusProbe />} />
        </Routes>
      </MemoryRouter>
    </ThemeModeProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
  await waitFor(() => expect(calls('user/read.php')).toHaveLength(1));
  await act(async () => {});
};
const toggle = () => screen.getByRole('button', { name: /^(Modifica|Fatto)$/ });
const startEdit = () => fireEvent.click(screen.getByRole('button', { name: 'Modifica' }));

beforeEach(() => localStorage.setItem('themeMode', 'light'));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('lettura', () => {
  it('un solo h1 con il nome della scheda, i giorni come h2, la descrizione, il ritorno all\'elenco', async () => {
    await mount([mk(1, { description: 'Base' })]);
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Scheda 1']);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Giorno 101', 'Giorno 102']);
    expect(screen.getByText('Base')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Schede' }).getAttribute('href')).toBe('/schede');
  });

  it('mostra tutti gli esercizi del giorno, anche oltre i primi quattro, senza «Dettagli» né «+N altri»', async () => {
    const many = day(11, 'Push', ['A', 'B', 'C', 'D', 'E', 'F'].map((n, i) => ex(20 + i, `Esercizio ${n}`)));
    await mount([mk(1, { days: [many] })]);
    for (const n of ['A', 'B', 'C', 'D', 'E', 'F']) expect(screen.getByText(`Esercizio ${n}`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Dettagli|Nascondi|altri|esercizi$/ })).toBeNull();
  });

  it('ogni esercizio ha la riga con serie e recupero, e le note', async () => {
    await mount([forza]);
    expect(screen.getByText('4 × 6-8 · recupero: 120s')).toBeTruthy();
    expect(screen.getByText('3 × 12 · recupero: 60s')).toBeTruthy();
    expect(screen.getByText('Note: Piano lento')).toBeTruthy();
  });

  it('il riepilogo mostra "N risc. +" solo per l\'esercizio con riscaldamento', async () => {
    await mount([{ ...forza, days: [{ ...forza.days[0], exercises: [
      ex(101, 'Panca piana', { planned_sets: plannedSets(2, times(4, { min: 6, max: 8 })), rest: 120 }), forza.days[0].exercises[1],
    ] }] }]);
    expect(screen.getByText('2 risc. + 4 × 6-8 · recupero: 120s')).toBeTruthy();
    expect(screen.getByText('3 × 12 · recupero: 60s')).toBeTruthy();
  });

  it('serie diverse e tecnica stanno nella stessa riga, la tecnica compare una volta sola', async () => {
    await mount([{ ...forza, days: [{ ...forza.days[0], exercises: [ex(101, 'Panca piana', {
      planned_sets: plannedSets(0, [{ min: 12, max: 12 }, { min: 10, max: 10 }, { min: 6, failure: true, technique: 'Rest Pause' }]), rest: 120,
    })] }] }]);
    expect(screen.getByText('1 × 12 + 1 × 10 + 1 × a cedimento (min. 6) · Rest pause sulla serie 3 · recupero: 120s')).toBeTruthy();
    expect(screen.getAllByText(/Rest pause/)).toHaveLength(1);
  });

  it('un giorno senza esercizi dice che non ce ne sono, e non ha «Inizia»', async () => {
    await mount([mk(1, { days: [day(11, 'Vuoto', []), day(12)] })]);
    expect(screen.getByText('Nessun esercizio aggiunto')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Inizia/ })).toHaveLength(1);
  });

  it('non ha nessun comando di modifica', async () => {
    await mount([forza]);
    for (const re of [/^Modifica esercizio/, /^Elimina esercizio/, /^Sposta su/, /^Sposta giù/, /^Elimina giorno/, /^Aggiungi esercizio/, /^Elimina scheda$/, /^Modifica nome e descrizione$/]) {
      expect(screen.queryByRole('button', { name: re })).toBeNull();
    }
  });

  it('«Modifica» è un pulsante a due stati e non è premuto', async () => {
    await mount([forza]);
    expect(toggle().getAttribute('aria-pressed')).toBe('false');
  });

  it('i riquadri dei giorni sono tanti quanti i giorni, nell\'ordine del server', async () => {
    await mount([mk(1, { days: [day(11), day(12), day(13)] })]);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Giorno 11', 'Giorno 12', 'Giorno 13']);
  });
});

describe('aspetto della pagina', () => {
  it('«Rendi attiva» ha il bordo e nessun riempimento', async () => {
    await mount([mk(2), mk(1)], { path: '/schede/2' });
    const style = getComputedStyle(screen.getByRole('button', { name: 'Rendi attiva' }));
    expect(style.borderTopStyle).toBe('solid');
    expect(parseFloat(style.borderTopWidth)).toBeGreaterThan(0);
    // jsdom calcola lo sfondo: un pulsante pieno darebbe un rgb(...), «nessun riempimento» è vuoto o trasparente
    expect(['', 'transparent', 'rgba(0, 0, 0, 0)']).toContain(style.backgroundColor);
  });

  it('la descrizione è in text.secondary', async () => {
    await mount([mk(1, { description: 'Base' })]);
    expect(colorOf(screen.getByText('Base'))).toBe(GREY);
  });

  it('nessun testo sotto i 16px, in lettura e in modifica, salvo la pillola "Attiva" (13px o più)', async () => {
    await mount([mk(1, { description: 'Base' })]);
    expect(textsBelow16pxExceptActiveBadge()).toEqual([]);
    startEdit();
    expect(textsBelow16pxExceptActiveBadge()).toEqual([]);
  });

  it('nessun testo sotto i 16px nemmeno su una scheda non attiva, con «Rendi attiva»', async () => {
    await mount([mk(2), mk(1)], { path: '/schede/2' });
    expect(textsBelow16pxExceptActiveBadge()).toEqual([]);
  });
});

describe('scheda attiva e «Inizia»', () => {
  it('la scheda attiva ha l\'etichetta «Attiva» e non il pulsante «Rendi attiva»', async () => {
    await mount([mk(1)]);
    expect(screen.getByText('Attiva')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Rendi attiva' })).toBeNull();
  });

  it('«Inizia» porta al Focus con il giorno proposto, per ogni giorno con esercizi', async () => {
    await mount([mk(1)]);
    expect(screen.getAllByRole('button', { name: /^Inizia/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Inizia Giorno 102' }));
    expect(JSON.parse((await screen.findByTestId('focus')).textContent)).toEqual({ suggestedDayId: 102 });
  });

  it('su una scheda non attiva non c\'è «Inizia» e c\'è «Rendi attiva», che chiama activate_plan.php', async () => {
    await mount([mk(2), mk(1)], { path: '/schede/2' });
    expect(screen.queryByText('Attiva')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Inizia/ })).toBeNull();
    handlers['activate_plan.php'] = () => json({ success: true });
    fireEvent.click(screen.getByRole('button', { name: 'Rendi attiva' }));
    await waitFor(() => expect(calls('activate_plan.php')).toHaveLength(1));
    expect(JSON.parse(calls('activate_plan.php')[0][1].body)).toEqual({ plan_id: 2 });
    expect((await screen.findByRole('alert')).textContent).toContain('Scheda attivata con successo');
    await waitFor(() => expect(calls('read_plans.php').length).toBeGreaterThan(1));
  });

  it('un rifiuto del server su «Rendi attiva» si vede come errore', async () => {
    await mount([mk(2), mk(1)], { path: '/schede/2' });
    handlers['activate_plan.php'] = () => json({ success: false, message: 'No' }, 409);
    fireEvent.click(screen.getByRole('button', { name: 'Rendi attiva' }));
    expect((await screen.findByRole('alert')).textContent).toContain('No');
  });
});

describe('allineamento in modifica', () => {
  it('le icone di un esercizio e i bottoni di solo testo partono dal bordo del testo, con aree da 44 px', async () => {
    await mount([mk(1)]);
    startEdit();
    const icone = screen.getAllByRole('button', { name: /^Sposta su/ })[0].parentElement;
    expect(getComputedStyle(icone).marginLeft).toBe('-12px');
    for (const nome of [/^Sposta su/, /^Sposta giù/, /^Modifica esercizio/, /^Elimina esercizio/]) {
      const style = getComputedStyle(screen.getAllByRole('button', { name: nome })[0]);
      expect([style.width, style.height]).toEqual(['44px', '44px']);
    }
    for (const nome of [/^Elimina giorno/, 'Elimina scheda']) {
      const style = getComputedStyle(screen.getAllByRole('button', { name: nome })[0]);
      expect(style.marginLeft).toBe('-8px');
      expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(44);
    }
  });

  it('«Aggiungi esercizio» è bordato, con il «+» davanti; «Elimina giorno» ed «Elimina scheda» restano testo rosso', async () => {
    await mount([mk(1)]);
    startEdit();
    const aggiungi = screen.getAllByRole('button', { name: 'Aggiungi esercizio' })[0];
    expect(getComputedStyle(aggiungi).borderTopStyle).toBe('solid');
    expect(aggiungi.querySelector('.MuiButton-startIcon svg[data-testid="AddIcon"]')).not.toBeNull();
    for (const nome of [/^Elimina giorno/, 'Elimina scheda']) {
      const style = getComputedStyle(screen.getAllByRole('button', { name: nome })[0]);
      expect(style.color).toBe(RED);
      expect(style.borderTopStyle).not.toBe('solid');
    }
  });
});

describe('arrivo dopo la creazione', () => {
  it('l\'avviso di scheda creata si vede una volta sola, e lo stato di navigazione si toglie', async () => {
    await mount([forza], { state: { edit: true, notice: 'Scheda creata con successo' } });
    expect((await screen.findByRole('alert')).textContent).toContain('Scheda creata con successo');
    await waitFor(() => expect(screen.getByTestId('stato').textContent).toBe('null'));
  });

  it('senza stato di arrivo (ricarica, tasto indietro) nessun avviso', async () => {
    await mount([forza]);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('modifica', () => {
  it('«Modifica» diventa «Fatto» e viceversa, sullo stesso pulsante', async () => {
    await mount([forza]);
    const button = toggle();
    fireEvent.click(button);
    expect(toggle()).toBe(button);
    expect(button.textContent).toBe('Fatto');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    expect(button.textContent).toBe('Modifica');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('button', { name: /^Modifica esercizio/ })).toBeNull();
  });

  it('entrando con state.edit la modifica è accesa e il fuoco è su «Fatto»', async () => {
    await mount([forza], { state: { edit: true } });
    expect(toggle().textContent).toBe('Fatto');
    expect(document.activeElement).toBe(toggle());
  });

  it('senza state.edit si entra in lettura e il fuoco non viene spostato', async () => {
    await mount([forza]);
    expect(toggle().textContent).toBe('Modifica');
    expect(document.activeElement).toBe(document.body);
  });

  it('mostra i comandi di ogni esercizio, del giorno e della scheda; «Inizia» e «Rendi attiva» spariscono', async () => {
    await mount([mk(1), mk(2)]);
    startEdit();
    expect(screen.getAllByRole('button', { name: /^Sposta su/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /^Sposta giù/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /^Modifica esercizio/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /^Elimina esercizio/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Aggiungi esercizio' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /^Elimina giorno/ })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Modifica nome e descrizione' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Elimina scheda' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Inizia/ })).toBeNull();
  });

  it('«Rendi attiva» non si vede in modifica', async () => {
    await mount([mk(2), mk(1)], { path: '/schede/2' });
    startEdit();
    expect(screen.queryByRole('button', { name: 'Rendi attiva' })).toBeNull();
  });

  it('l\'ingresso dopo la creazione (state.edit) parte già in modifica', async () => {
    await mount([forza], { state: { edit: true } });
    expect(toggle().textContent).toBe('Fatto');
    expect(screen.getAllByRole('button', { name: /^Modifica esercizio/ })).toHaveLength(2);
  });

  it('senza state.edit parte in lettura', async () => {
    await mount([forza], { state: {} });
    expect(toggle().textContent).toBe('Modifica');
  });

  it('un comando è un bersaglio di almeno 44 × 44 px', async () => {
    await mount([forza]);
    startEdit();
    for (const name of ['Sposta su Panca piana', 'Sposta giù Panca piana', 'Modifica esercizio Panca piana', 'Elimina esercizio Panca piana']) {
      const style = getComputedStyle(screen.getByRole('button', { name }));
      expect(parseFloat(style.minWidth)).toBeGreaterThanOrEqual(44);
      expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(44);
    }
  });

  it('Modifica ed Elimina di ogni esercizio sono grigi come le frecce, non rosso', async () => {
    await mount([forza]);
    startEdit();
    const buttons = [...screen.getAllByRole('button', { name: /^Modifica esercizio/ }), ...screen.getAllByRole('button', { name: /^Elimina esercizio/ })];
    expect(buttons).toHaveLength(4);
    for (const button of buttons) expect(colorOf(button)).toBe(GREY);
  });

  it('nomi accessibili: ogni comando dice scheda, giorno o esercizio; nessun controllo senza nome', async () => {
    await mount([forza]);
    startEdit();
    for (const name of ['Panca piana', 'Croci ai cavi']) {
      for (const verb of ['Modifica esercizio', 'Elimina esercizio', 'Sposta su', 'Sposta giù']) {
        expect(screen.getByRole('button', { name: `${verb} ${name}` })).toBeTruthy();
      }
    }
    expect(unnamedControls()).toEqual([]);
  });

  it('le frecce: la prima non va su e l\'ultima non va giù', async () => {
    await mount([forza]);
    startEdit();
    expect(screen.getByRole('button', { name: 'Sposta su Panca piana' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Sposta giù Croci ai cavi' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Sposta giù Panca piana' }).disabled).toBe(false);
  });

  it('spostare un esercizio chiama reorder_exercise.php con la direzione e avvisa', async () => {
    await mount([forza]);
    handlers['reorder_exercise.php'] = () => json({ success: true });
    startEdit();
    fireEvent.click(screen.getByRole('button', { name: 'Sposta giù Panca piana' }));
    await waitFor(() => expect(calls('reorder_exercise.php')).toHaveLength(1));
    expect(JSON.parse(calls('reorder_exercise.php')[0][1].body)).toEqual({ day_id: 11, exercise_id: 101, direction: 'down' });
    expect((await screen.findByRole('alert')).textContent).toContain('Ordine degli esercizi aggiornato');
    await waitFor(() => expect(calls('read_plans.php').length).toBeGreaterThan(1));
  });
});

describe('modifica nome e descrizione', () => {
  it('apre il dialog con i valori e salva con update_plan.php', async () => {
    await mount([forza]);
    handlers['update_plan.php'] = () => json({ success: true });
    startEdit();
    fireEvent.click(screen.getByRole('button', { name: 'Modifica nome e descrizione' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Nome scheda').value).toBe('Forza A');
    fireEvent.change(within(dialog).getByLabelText('Nome scheda'), { target: { value: 'Forza B' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /^Salva/ }));
    await waitFor(() => expect(calls('update_plan.php')).toHaveLength(1));
    expect(JSON.parse(calls('update_plan.php')[0][1].body)).toMatchObject({ plan_id: 1, name: 'Forza B', is_active: 1 });
    expect((await screen.findByRole('alert')).textContent).toContain('Scheda aggiornata con successo');
  });

  it('annullare e riaprire subito riparte dai valori della scheda', async () => {
    await mount([forza]);
    startEdit();
    fireEvent.click(screen.getByRole('button', { name: 'Modifica nome e descrizione' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nome scheda'), { target: { value: 'Scartato' } });
    vi.useFakeTimers();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla' }));
    fireEvent.click(screen.getByRole('button', { name: 'Modifica nome e descrizione', hidden: true }));
    act(() => { vi.advanceTimersByTime(0); });
    expect(within(screen.getByRole('dialog')).getByLabelText('Nome scheda').value).toBe('Forza A');
  });
});

describe('modifica esercizio', () => {
  it('annullare e riaprire subito lo stesso esercizio riparte dai suoi valori', async () => {
    await mount([forza]);
    startEdit();
    fireEvent.click(screen.getByRole('button', { name: 'Modifica esercizio Panca piana' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Recupero (s)'), { target: { value: '999' } });
    vi.useFakeTimers();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla' }));
    fireEvent.click(screen.getByRole('button', { name: 'Modifica esercizio Panca piana', hidden: true }));
    act(() => { vi.advanceTimersByTime(0); });
    expect(within(screen.getByRole('dialog')).getByLabelText('Recupero (s)').value).toBe('120');
  });

  it('invia planned_sets (e non più sets/reps) a update_exercise.php', async () => {
    const records = [{ ...forza, days: [{ ...forza.days[0], exercises: [
      ex(101, 'Panca piana', { planned_sets: plannedSets(2, times(4, { min: 6, max: 8 })), rest: 120 }), forza.days[0].exercises[1],
    ] }] }];
    await mount(records);
    startEdit();
    fireEvent.click(screen.getAllByRole('button', { name: /^Modifica esercizio/ })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Riscaldamento').value).toBe('2');
    expect(within(dialog).getByLabelText('Serie').value).toBe('4');
    expect(within(dialog).getByLabelText('Ripetizioni').value).toBe('6-8');
    fireEvent.change(within(dialog).getByLabelText('Riscaldamento'), { target: { value: '3' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salva modifiche' }));
    await waitFor(() => expect(calls('update_exercise.php')).toHaveLength(1));
    const body = JSON.parse(calls('update_exercise.php')[0][1].body);
    expect(body.planned_sets.filter((set) => set.kind === 'warmup')).toHaveLength(3);
    expect(body.planned_sets.filter((set) => set.kind === 'working')).toHaveLength(4);
    for (const key of ['sets', 'warmup_sets', 'reps', 'intensity_technique']) expect(body).not.toHaveProperty(key);
  });

  it('chiudere la modifica di un esercizio e aprire subito quella di un altro mostra le serie del secondo e permette di salvare', async () => {
    await mount([forza]);
    startEdit();
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
    await mount([forza]);
    startEdit();
    fireEvent.click(screen.getAllByRole('button', { name: /^Modifica esercizio/ })[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Ripetizioni'), { target: { value: '10-8' } });
    expect(within(dialog).getByRole('button', { name: 'Salva modifiche' }).disabled).toBe(true);
  });
});

describe('elimina esercizio', () => {
  it('il rosso resta nel dialogo: il bottone di conferma è pieno rosso', async () => {
    await mount([forza]);
    startEdit();
    fireEvent.click(screen.getAllByRole('button', { name: /^Elimina esercizio/ })[0]);
    const confirm = within(await screen.findByRole('dialog')).getByRole('button', { name: 'Elimina' });
    expect(confirm.classList.contains('MuiButton-containedError')).toBe(true);
    expect(getComputedStyle(confirm).backgroundColor).toBe(RED);
  });

  it('alla conferma il nome nel dialog sparisce subito, senza aspettare la dissolvenza', async () => {
    await mount([forza]);
    startEdit();
    fireEvent.click(screen.getAllByRole('button', { name: /^Elimina esercizio/ })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/^Esercizio:/)).toBeTruthy();
    vi.useFakeTimers();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Elimina' }));
    await act(async () => { for (let i = 0; i < 20; i += 1) await Promise.resolve(); });
    expect(calls('delete_exercise.php')).toHaveLength(1);
    expect(screen.queryByText(/^Esercizio:/)).toBeNull();
  });

  it('chiama delete_exercise.php con giorno ed esercizio e avvisa', async () => {
    await mount([forza]);
    handlers['delete_exercise.php'] = () => json({ success: true });
    startEdit();
    fireEvent.click(screen.getByRole('button', { name: 'Elimina esercizio Croci ai cavi' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Elimina' }));
    await waitFor(() => expect(calls('delete_exercise.php')).toHaveLength(1));
    expect(JSON.parse(calls('delete_exercise.php')[0][1].body)).toEqual({ day_id: 11, exercise_id: 102 });
    expect((await screen.findByRole('alert')).textContent).toContain('Esercizio eliminato con successo');
  });
});

describe('aggiungi esercizio', () => {
  const addOne = async (day) => {
    fireEvent.click(screen.getAllByRole('button', { name: 'Aggiungi esercizio' })[day]);
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
  };

  it('aggiunge l\'esercizio al giorno su cui si è premuto, con add_exercise.php', async () => {
    await mount([mk(1)]);
    handlers['add_exercise.php'] = () => json({ success: true });
    handlers['exercise/read_all.php'] = () => json({ records: [{ id: 7, name: 'Panca Piana', muscle_group: 'petto', equipment: 'bilanciere' }] });
    startEdit();
    await addOne(1);
    await waitFor(() => expect(calls('add_exercise.php')).toHaveLength(1));
    expect(JSON.parse(calls('add_exercise.php')[0][1].body)).toMatchObject({ day_id: 102, exercise_id: 7, rest: 90 });
    await waitFor(() => expect(screen.getAllByRole('alert').some((a) => a.textContent.includes('Esercizio aggiunto con successo'))).toBe(true));
  });
});

describe('elimina giorno', () => {
  it('chiede conferma (si perdono gli esercizi, non gli allenamenti registrati) e chiama delete_day.php', async () => {
    await mount([mk(1)]);
    handlers['delete_day.php'] = () => json({ success: true, message: 'Giorno eliminato' });
    startEdit();
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

  it('il comando ha il nome «Elimina giorno» visibile e quello accessibile col nome del giorno', async () => {
    await mount([mk(1)]);
    startEdit();
    const button = screen.getByRole('button', { name: 'Elimina giorno Giorno 101' });
    expect(button.textContent).toContain('Elimina giorno');
  });

  it('con un solo giorno il comando non c\'è', async () => {
    await mount([mk(1, { days: [day(101)] })]);
    startEdit();
    expect(screen.queryByRole('button', { name: /^Elimina giorno/ })).toBeNull();
  });

  it('un rifiuto del server si vede come errore', async () => {
    await mount([mk(1)]);
    handlers['delete_day.php'] = () => json({ success: false, code: 'last_day', message: 'Non puoi eliminare l\'ultimo giorno.' }, 409);
    startEdit();
    fireEvent.click(screen.getByRole('button', { name: 'Elimina giorno Giorno 101' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Elimina' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Non puoi eliminare l\'ultimo giorno.');
  });

  describe('con un allenamento Focus in corso su quel giorno', () => {
    afterEach(() => localStorage.removeItem('gym_focus_workout_draft'));
    const draft = (id) => localStorage.setItem('gym_focus_workout_draft', JSON.stringify({ selectedDayId: id, selectedDay: day(id), startTime: '2026-11-16T10:00:00Z' }));

    it('spiega di salvarlo o scartarlo prima e non lascia confermare', async () => {
      draft(102);
      await mount([mk(1)]);
      startEdit();
      fireEvent.click(screen.getByRole('button', { name: 'Elimina giorno Giorno 102' }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(/allenamento in corso su questo giorno/)).toBeTruthy();
      expect(within(dialog).getByRole('button', { name: 'Elimina' }).disabled).toBe(true);
      expect(calls('delete_day.php')).toHaveLength(0);
    });

    it('a chi ha la funzione focus_session_edit (Plus, Pro) il salvataggio riuscirebbe: l\'eliminazione resta possibile', async () => {
      draft(102);
      await mount([mk(1)], { user: PRO });
      startEdit();
      fireEvent.click(screen.getByRole('button', { name: 'Elimina giorno Giorno 102' }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).queryByText(/allenamento in corso/)).toBeNull();
      expect(within(dialog).getByRole('button', { name: 'Elimina' }).disabled).toBe(false);
    });

    it('un allenamento in corso su un altro giorno non blocca nulla', async () => {
      draft(101);
      await mount([mk(1)]);
      startEdit();
      fireEvent.click(screen.getByRole('button', { name: 'Elimina giorno Giorno 102' }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByRole('button', { name: 'Elimina' }).disabled).toBe(false);
    });
  });
});

describe('elimina scheda', () => {
  const CRONOLOGIA = 'Gli allenamenti già fatti restano nella cronologia.';
  const obiettivo = (n) => `L'obiettivo della settimana tornerà a quello predefinito (${n} allenamenti).`;
  const inactive = { ...forza, is_active: 0 };
  const apri = async (records, goal, path = '/schede/1') => {
    await mount(records, { path });
    handlers['user/read.php'] = goal;
    startEdit();
    fireEvent.click(screen.getByRole('button', { name: 'Elimina scheda' }));
    return screen.findByRole('dialog');
  };

  it('dice sempre che la cronologia resta', async () => {
    const dialog = await apri([inactive], () => json({}));
    expect(within(dialog).getByText(CRONOLOGIA)).toBeTruthy();
  });

  it('con la scheda attiva e nessun obiettivo scelto avvisa che l\'obiettivo torna a quello senza scheda, col numero del server', async () => {
    const dialog = await apri([forza], () => json({ weekly_goal: null, weekly_goal_default: 1, weekly_goal_without_plan: 4 }));
    expect(await within(dialog).findByText(obiettivo(4))).toBeTruthy();
  });

  it('se l\'utente ha scelto un obiettivo non ne parla', async () => {
    const dialog = await apri([forza], () => json({ weekly_goal: 2, weekly_goal_default: 1, weekly_goal_without_plan: 3 }));
    await within(dialog).findByText(CRONOLOGIA);
    expect(within(dialog).queryByText(obiettivo(3))).toBeNull();
  });

  it('se l\'obiettivo predefinito è già quello senza scheda non c\'è nulla da avvisare', async () => {
    const dialog = await apri([forza], () => json({ weekly_goal: null, weekly_goal_default: 5, weekly_goal_without_plan: 5 }));
    await within(dialog).findByText(CRONOLOGIA);
    expect(within(dialog).queryByText(obiettivo(5))).toBeNull();
  });

  it('con una scheda non attiva non ne parla e non chiede l\'obiettivo al server', async () => {
    await mount([inactive]);
    const prima = calls('user/read.php').length;
    startEdit();
    fireEvent.click(screen.getByRole('button', { name: 'Elimina scheda' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText(CRONOLOGIA);
    expect(calls('user/read.php')).toHaveLength(prima);
  });

  it('la risposta tardiva arrivata dopo la conferma non rimette l\'avviso nel dialogo che si sta chiudendo', async () => {
    let rispondi;
    await mount([forza]);
    handlers['user/read.php'] = () => new Promise((resolve) => { rispondi = () => resolve(json({ weekly_goal: null, weekly_goal_default: 1, weekly_goal_without_plan: 3 })); });
    startEdit();
    fireEvent.click(screen.getByRole('button', { name: 'Elimina scheda' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Elimina' }));
    await waitFor(() => expect(calls('delete_plan.php')).toHaveLength(1));
    await act(async () => { rispondi(); });
    expect(screen.queryByText(obiettivo(3))).toBeNull();
  });

  it('eliminata la scheda si torna all\'elenco', async () => {
    const dialog = await apri([forza], () => json({}));
    handlers['delete_plan.php'] = () => json({ success: true });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Elimina' }));
    await waitFor(() => expect(calls('delete_plan.php')).toHaveLength(1));
    expect(JSON.parse(calls('delete_plan.php')[0][1].body)).toEqual({ plan_id: 1 });
    expect(await screen.findByText('ELENCO')).toBeTruthy();
    expect(screen.getByTestId('stato').textContent).toBe('{"notice":"Scheda eliminata con successo"}');
  });

  it('se il server rifiuta si resta sulla pagina, con l\'errore', async () => {
    const dialog = await apri([forza], () => json({}));
    handlers['delete_plan.php'] = () => json({ success: false, message: 'Non si può' }, 409);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Elimina' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Non si può');
    expect(screen.queryByText('ELENCO')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Forza A');
  });
});

describe('scheda che non c\'è', () => {
  it('un id che non è dell\'utente riporta all\'elenco', async () => {
    handlers = {};
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ records: [mk(1)] }))));
    render(
      <MemoryRouter initialEntries={['/schede/99']}>
        <Routes><Route path="/schede" element={<div>ELENCO</div>} /><Route path="/schede/:id" element={<PlanPage />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText('ELENCO')).toBeTruthy();
  });

  it('durante il caricamento non torna all\'elenco: c\'è l\'indicatore', async () => {
    let rispondi;
    vi.stubGlobal('fetch', vi.fn((url) => (String(url).includes('read_plans.php')
      ? new Promise((resolve) => { rispondi = () => resolve(json({ records: [mk(1)] })); })
      : Promise.resolve(json(FREE)))));
    render(
      <ThemeModeProvider>
        <MemoryRouter initialEntries={['/schede/1']}>
          <Routes><Route path="/schede" element={<div>ELENCO</div>} /><Route path="/schede/:id" element={<PlanPage />} /></Routes>
        </MemoryRouter>
      </ThemeModeProvider>,
    );
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByText('ELENCO')).toBeNull();
    await act(async () => { rispondi(); });
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Scheda 1');
  });
});

// Scheda in sola lettura: l'avviso sta nella pagina; i comandi spenti o nascosti sono gli stessi della card di prima.
describe('scheda in sola lettura', () => {
  const readOnly = (reason, days = 2, id = 1) => mk(id, {
    read_only: true, read_only_reason: reason, days: Array.from({ length: days }, (_, i) => day(101 + i)),
  });

  it.each([
    ['plans_over_limit', 2, /Hai più di 2 schede: sono in sola lettura finché non ne elimini alcune/],
    ['days_over_limit', 5, /Questa scheda ha più di 4 giorni: è in sola lettura finché non ne elimini alcuni/],
  ])('(%s) avvisa col numero del server, nasconde i comandi bloccati e lascia gli altri', async (reason, days, notice) => {
    await mount([readOnly(reason, days)]);
    expect(screen.getAllByText(notice)).toHaveLength(1);
    expect(screen.getByText(/Con Plus o Pro il limite è più alto/)).toBeTruthy();
    startEdit();
    expect(screen.queryByRole('button', { name: 'Aggiungi esercizio' })).toBeNull();
    for (const re of [/^Modifica esercizio/, /^Elimina esercizio/, /^Sposta su/, /^Sposta giù/]) {
      expect(screen.queryAllByRole('button', { name: re })).toHaveLength(0);
    }
    expect(screen.getByRole('button', { name: 'Modifica nome e descrizione' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Elimina scheda' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Elimina giorno/ })).toHaveLength(days);
  });

  it.each([
    ['plans_over_limit', /Hai più schede del limite consentito: sono in sola lettura/],
    ['days_over_limit', /Questa scheda ha più giorni del limite consentito: è in sola lettura/],
  ])('(%s) senza i limiti dell\'account l\'avviso c\'è comunque, senza numero', async (reason, notice) => {
    await mount([readOnly(reason, 5)], { user: { success: false } });
    expect(screen.getAllByText(notice)).toHaveLength(1);
    expect(screen.queryByText(/Con Plus o Pro/)).toBeNull();
  });

  it('un motivo sconosciuto o assente: l\'avviso «troppe schede»', async () => {
    await mount([readOnly('altro', 2, 1)]);
    expect(screen.getAllByText(/Hai più di 2 schede: sono in sola lettura/)).toHaveLength(1);
  });

  it('per Plus e Pro il messaggio non cita il livello superiore', async () => {
    await mount([readOnly('plans_over_limit')], { user: { ...PRO, limits: { plans: 2, days_per_plan: 4, personal_exercises: 30 } } });
    expect(screen.getByText(/Hai più di 2 schede/)).toBeTruthy();
    expect(screen.queryByText(/Con Plus o Pro/)).toBeNull();
  });

  it('la scheda in sola lettura non ancora attiva si può attivare', async () => {
    await mount([mk(2, { read_only: true, read_only_reason: 'plans_over_limit' })], { path: '/schede/2' });
    expect(screen.getByRole('button', { name: 'Rendi attiva' })).toBeTruthy();
  });

  it('una scheda modificabile non ha nessun avviso', async () => {
    await mount([mk(1)]);
    expect(screen.queryByText(/sola lettura/)).toBeNull();
  });

  describe('rifiuto plan_read_only dal server', () => {
    const MSG = 'Hai più di 2 schede: sono in sola lettura finché non ne elimini alcune.';
    const refuse = () => json({ success: false, code: 'plan_read_only', message: MSG, reason: 'plans_over_limit', limit: 2 }, 409);

    it('eliminare un esercizio mostra il messaggio come errore', async () => {
      await mount([mk(1)]);
      handlers['delete_exercise.php'] = refuse;
      startEdit();
      fireEvent.click(screen.getAllByRole('button', { name: /^Elimina esercizio/ })[0]);
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Elimina' }));
      expect((await screen.findByRole('alert')).textContent).toContain(MSG);
    });

    it('spostare un esercizio mostra il messaggio come errore', async () => {
      await mount([mk(1, { days: [day(101, 'Giorno 101', [ex(1, 'A'), ex(2, 'B')]), day(102)] })]);
      handlers['reorder_exercise.php'] = refuse;
      startEdit();
      fireEvent.click(screen.getByRole('button', { name: 'Sposta giù A' }));
      expect((await screen.findByRole('alert')).textContent).toContain(MSG);
    });

    it('modificare un esercizio mostra il messaggio come errore', async () => {
      await mount([mk(1)]);
      handlers['update_exercise.php'] = refuse;
      startEdit();
      fireEvent.click(screen.getAllByRole('button', { name: /^Modifica esercizio/ })[0]);
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Salva modifiche' }));
      await waitFor(() => expect(screen.getAllByRole('alert').some((a) => a.textContent.includes(MSG))).toBe(true));
    });

    it('aggiungere un esercizio mostra il messaggio come errore', async () => {
      await mount([mk(1)]);
      handlers['add_exercise.php'] = refuse;
      handlers['exercise/read_all.php'] = () => json({ records: [{ id: 7, name: 'Panca Piana', muscle_group: 'petto', equipment: 'bilanciere' }] });
      startEdit();
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
  });
});

describe('inglese', () => {
  afterEach(() => i18n.changeLanguage('it'));

  it('i testi nuovi sono tradotti', async () => {
    await i18n.changeLanguage('en');
    await mount([mk(2), mk(1)], { path: '/schede/2' });
    expect(screen.getByRole('link', { name: 'Plans' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Make active' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('button', { name: 'Done' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Edit name and description' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete plan' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete day Giorno 201' }).textContent).toContain('Delete day');
  });

  it('«Start Giorno 1» su una scheda attiva', async () => {
    await i18n.changeLanguage('en');
    await mount([mk(1)]);
    expect(screen.getByRole('button', { name: 'Start Giorno 101' }).textContent).toBe('Start');
  });
});
