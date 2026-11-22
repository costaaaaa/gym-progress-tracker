// Pagina Schede (/schede) vista dall'utente: titolo di pagina unico, poi l'elenco compatto (una card-collegamento per scheda
// con nome, giorni ed «Attiva»), «Nuova scheda» con i tetti del piano, avvisi di sola lettura. La fetch è il confine.
// Colori del tema chiaro scritti a mano: text.primary #1a1816, text.secondary #6b6663.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import Plans from './Plans';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { json, expectNoNestedContainer, textsBelow16pxExceptActiveBadge } from '../test/dom';
import { plannedSets, times } from '../test/plannedSets';
import { unnamedControls } from '../test/accessibleNames';
import i18n from '../i18n';

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: true, loading: false }) }));

const day = { id: 1, name: 'Push', exercises: [{ id: 11, exercise_name: 'Panca piana', planned_sets: plannedSets(0, times(3, { min: 8, max: 8 })), rest: 90, muscle_group: 'petto' }] };
const pullDay = { id: 2, name: 'Pull', exercises: [{ id: 12, exercise_name: 'Trazioni', planned_sets: plannedSets(0, times(3, { min: 8, max: 8 })), rest: 90, muscle_group: 'schiena' }] };
const plan = { id: 5, name: 'Push Pull', description: 'Spinta e tirata', is_active: true, days: [day, pullDay] };
const otherPlan = { id: 6, name: 'Full body', description: 'Tre giorni a settimana', is_active: false, days: [day] };

const FREE = { success: true, email_verified: true, email_verification: null, pending_email: null, tier: 'free', tier_until: null, tier_last_day: null, signup_code: null, limits: { plans: 2, days_per_plan: 4, personal_exercises: 10 }, features: [] };
const PRO = { success: true, email_verified: true, email_verification: null, pending_email: null, tier: 'pro', tier_until: null, tier_last_day: null, signup_code: null, limits: { plans: 50, days_per_plan: 14, personal_exercises: 30 }, features: ['focus_session_edit'] };
const ex = (id, name) => ({ id, exercise_name: name, muscle_group: 'petto', planned_sets: plannedSets(0, times(3, { min: 8, max: 10 })), rest: 90, notes: '' });
const dayOf = (id, name = `Giorno ${id}`) => ({ id, name, exercises: [ex(id * 10, `Esercizio ${id}`)] });
const mk = (id, over = {}) => ({
  id, name: `Scheda ${id}`, description: '', is_active: id === 1 ? 1 : 0,
  days: [dayOf(id * 100 + 1), dayOf(id * 100 + 2)], read_only: false, read_only_reason: null, ...over,
});

// Dove porta una scheda: mostra lo stato di navigazione
const PagePlace = () => {
  const location = useLocation();
  return <div data-testid="pagina">{location.pathname} {JSON.stringify(location.state)}</div>;
};

let handlers;
const calls = (part) => fetch.mock.calls.filter(([url]) => String(url).includes(part));
const stub = (records, user = FREE) => {
  handlers = {};
  vi.stubGlobal('fetch', vi.fn((url) => {
    const key = Object.keys(handlers).find((k) => String(url).includes(k));
    if (key) return Promise.resolve(handlers[key]());
    if (String(url).includes('user/read.php')) return Promise.resolve(json(user));
    return Promise.resolve(json({ records }));
  }));
};
const ListPlace = () => {
  const location = useLocation();
  return <><Plans /><div data-testid="stato">{JSON.stringify(location.state)}</div></>;
};
const renderPlans = (state = null) => render(
  <ThemeModeProvider>
    <MemoryRouter initialEntries={[{ pathname: '/schede', state }]}>
      <Routes>
        <Route path="/schede" element={<ListPlace />} />
        <Route path="/schede/:id" element={<PagePlace />} />
      </Routes>
    </MemoryRouter>
  </ThemeModeProvider>,
);
// Monta l'elenco e aspetta schede e dati dell'account
const mount = async (records = [plan, otherPlan], user = FREE, state = null) => {
  stub(records, user);
  renderPlans(state);
  await screen.findByRole('link', { name: new RegExp(`^${records[0].name}`) });
  await waitFor(() => expect(calls('user/read.php')).toHaveLength(1));
  await act(async () => {});
};

beforeEach(() => localStorage.setItem('themeMode', 'light'));
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('pagina Schede', () => {
  it('Layout ha già il Container: la pagina non ne apre un secondo', async () => {
    await mount();
    expectNoNestedContainer();
  });

  it('un solo h1 "Schede" nello stile titolo di pagina, senza schede interne', async () => {
    await mount();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s.map((h) => h.textContent)).toEqual(['Schede']);
    const style = getComputedStyle(h1s[0]);
    expect(style.fontSize).toBe('28px');
    expect(style.fontWeight).toBe('800');
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('il titolo della pagina non si ripete sotto', async () => {
    await mount();
    expect(screen.getAllByText('Schede')).toHaveLength(1);
  });

  it('il titolo del documento è «Schede | LiftIndex»', async () => {
    await mount();
    expect(document.title).toBe('Schede | LiftIndex');
  });

  it('nessun controllo senza nome', async () => {
    await mount();
    expect(unnamedControls()).toEqual([]);
  });
});

describe('elenco compatto', () => {
  it('ogni scheda è un collegamento alla sua pagina, col nome (e «Attiva» se lo è) come nome accessibile', async () => {
    await mount();
    const active = screen.getByRole('link', { name: 'Push Pull Attiva' });
    expect(active.getAttribute('href')).toBe('/schede/5');
    expect(screen.getByRole('link', { name: 'Full body' }).getAttribute('href')).toBe('/schede/6');
  });

  it('la card mostra solo nome, numero di giorni ed «Attiva»', async () => {
    await mount();
    const card = screen.getByRole('link', { name: 'Push Pull Attiva' });
    expect(within(card).getByText('Push Pull')).toBeTruthy();
    expect(within(card).getByText('2 giorni')).toBeTruthy();
    expect(within(card).getByText('Attiva')).toBeTruthy();
    expect(within(screen.getByRole('link', { name: 'Full body' })).getByText('1 giorno')).toBeTruthy();
    expect(within(screen.getByRole('link', { name: 'Full body' })).queryByText('Attiva')).toBeNull();
    expect(screen.queryByText('Spinta e tirata')).toBeNull();
    expect(within(card).queryByText(/esercizi|serie/)).toBeNull();
    expect(card.querySelector('svg')).toBeNull();
  });

  it('non ci sono più i comandi della card di prima', async () => {
    await mount();
    for (const re of [/Mostra giorni/, /Nascondi giorni/, /Attiva scheda/, /^Modifica scheda/, /^Elimina scheda/, /Dettagli/]) {
      expect(screen.queryByRole('button', { name: re })).toBeNull();
    }
  });

  it('cliccare la card porta alla pagina della scheda', async () => {
    await mount();
    fireEvent.click(screen.getByRole('link', { name: 'Full body' }));
    expect((await screen.findByTestId('pagina')).textContent).toBe('/schede/6 null');
  });

  it('le attive vanno per prime, le altre nell\'ordine del server', async () => {
    await mount([mk(2), mk(3), mk(1)], PRO);
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/schede/1', '/schede/2', '/schede/3', '/schede/esercizi']);
  });

  it('la card è alta almeno 64 px', async () => {
    await mount();
    const style = getComputedStyle(screen.getByRole('link', { name: 'Full body' }));
    expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(64);
  });

  it('il badge "Attiva" è una pillola verde pallida, senza maiuscolo e a 13px o più', async () => {
    await mount();
    const badge = screen.getByText('Attiva');
    const style = getComputedStyle(badge);
    expect(style.backgroundColor).toBe('rgb(232, 243, 236)');
    expect(style.color).toBe('rgb(22, 101, 52)');
    expect(style.textTransform).not.toBe('uppercase');
    expect(parseFloat(style.fontSize)).toBeGreaterThanOrEqual(13);
  });

  it('card e bottoni a riposo senza ombra né sfumatura', async () => {
    await mount();
    const piatti = [...document.querySelectorAll('.MuiCard-root, .MuiButton-root')];
    expect(piatti.length).toBeGreaterThan(2);
    piatti.forEach((el) => {
      const style = getComputedStyle(el);
      expect(['', 'none']).toContain(style.boxShadow);
      expect(['', 'none']).toContain(style.backgroundImage);
    });
  });

  it('l\'unico elemento con sfondo rosso del marchio è "Nuova scheda"', async () => {
    await mount([plan, otherPlan], PRO);
    const rossi = [...document.body.querySelectorAll('*')].filter((el) => getComputedStyle(el).backgroundColor === 'rgb(213, 0, 0)');
    expect(rossi.map((el) => el.textContent)).toEqual(['Nuova scheda']);
  });

  it('nessun testo sotto i 16px, salvo il badge "Attiva" (13px o più)', async () => {
    await mount([plan, otherPlan], PRO);
    expect(textsBelow16pxExceptActiveBadge()).toEqual([]);
  });

  it('senza schede non c\'è nessun collegamento, e «Nuova scheda» c\'è', async () => {
    stub([]);
    renderPlans();
    await waitFor(() => expect(calls('read_plans.php')).toHaveLength(1));
    await waitFor(() => expect(calls('user/read.php')).toHaveLength(1));
    expect(screen.queryAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/schede/esercizi']);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nuova scheda' }).disabled).toBe(false));
  });
});

describe('riga «Tutti gli esercizi»', () => {
  const row = () => screen.getByRole('link', { name: 'Tutti gli esercizi' });

  it('è l\'ultimo elemento dell\'elenco, dopo le card delle schede, e porta a /schede/esercizi', async () => {
    await mount();
    expect(row().getAttribute('href')).toBe('/schede/esercizi');
    const links = screen.getAllByRole('link');
    expect(links[links.length - 1]).toBe(row());
    expect(links.filter((a) => /^\/schede\/\d+$/.test(a.getAttribute('href')))).toHaveLength(2);
  });

  it('c\'è anche senza nessuna scheda', async () => {
    stub([]);
    renderPlans();
    await waitFor(() => expect(calls('read_plans.php')).toHaveLength(1));
    expect(row().getAttribute('href')).toBe('/schede/esercizi');
  });

  it('sotto il titolo dice «Cerca nel catalogo», ha una freccia a destra ed è alta almeno 64px', async () => {
    await mount();
    expect(document.getElementById(row().getAttribute('aria-describedby')).textContent).toBe('Cerca nel catalogo');
    expect(document.getElementById(row().getAttribute('aria-labelledby')).textContent).toBe('Tutti gli esercizi');
    expect(within(row()).getByText('Cerca nel catalogo')).toBeTruthy();
    expect(row().querySelector('svg')).toBeTruthy();
    expect(parseFloat(getComputedStyle(row()).minHeight)).toBeGreaterThanOrEqual(64);
  });

  it('è una card come le altre, non un pulsante rosso', async () => {
    await mount();
    expect(row().closest('.MuiCard-root')).toBeTruthy();
    expect(row().closest('.MuiButton-root')).toBeNull();
    expect(getComputedStyle(row()).backgroundColor).not.toBe('rgb(213, 0, 0)');
  });

  it('cliccandola si va alla pagina degli esercizi', async () => {
    await mount();
    fireEvent.click(row());
    expect((await screen.findByTestId('pagina')).textContent).toBe('/schede/esercizi null');
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

  it.each([
    ['it', 'Nuova scheda', '1 giorno', 'Nome scheda', 'Crea', 'Giorno 1'],
    ['en', 'New plan', '1 day', 'Plan name', 'Create', 'Day 1'],
  ])('(%s) di base ha un solo giorno, col nome nella lingua', async (lang, apri, uno, nome, crea, giorno) => {
    await i18n.changeLanguage(lang);
    try {
      await mount([mk(1)]);
      handlers['create_plan.php'] = () => json({ plan: { id: 9 } }, 201);
      handlers['create_days.php'] = () => json({ success: true }, 201);
      fireEvent.click(screen.getAllByRole('button', { name: apri })[0]);
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByRole('combobox').textContent).toBe(uno);
      fireEvent.change(within(dialog).getByLabelText(nome), { target: { value: 'Nuova' } });
      fireEvent.click(within(dialog).getByRole('button', { name: crea }));
      await waitFor(() => expect(calls('create_days.php')).toHaveLength(1));
      expect(JSON.parse(calls('create_days.php')[0][1].body).days).toEqual([{ name: giorno, exercises: [] }]);
    } finally {
      await i18n.changeLanguage('it');
    }
  });

  it('creata la scheda si va alla sua pagina, con «Modifica» già acceso', async () => {
    await mount([mk(1)]);
    handlers['create_plan.php'] = () => json({ plan: { id: 9 } }, 201);
    handlers['create_days.php'] = () => json({ success: true }, 201);
    const dialog = await openNew();
    fireEvent.change(within(dialog).getByLabelText('Nome scheda'), { target: { value: 'Nuova' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crea' }));
    expect((await screen.findByTestId('pagina')).textContent).toBe('/schede/9 {"edit":true,"notice":"Scheda creata con successo"}');
    expect(JSON.parse(calls('create_plan.php')[0][1].body)).toEqual({ name: 'Nuova', description: '' });
    expect(JSON.parse(calls('create_days.php')[0][1].body).plan_id).toBe(9);
  });

  it('arrivando dall\'eliminazione di una scheda l\'avviso si vede una volta e lo stato si toglie', async () => {
    await mount([mk(1)], PRO, { notice: 'Scheda eliminata con successo' });
    expect((await screen.findByRole('alert')).textContent).toContain('Scheda eliminata con successo');
    await waitFor(() => expect(screen.getByTestId('stato').textContent).toBe('null'));
  });

  it('senza stato di arrivo (ricarica, tasto indietro) nessun avviso', async () => {
    await mount([mk(1)]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('se i giorni non si creano si resta sull\'elenco, con l\'avviso', async () => {
    await mount([mk(1)]);
    handlers['create_plan.php'] = () => json({ plan: { id: 9 } }, 201);
    handlers['create_days.php'] = () => json({ message: 'Troppi giorni' }, 400);
    const dialog = await openNew();
    fireEvent.change(within(dialog).getByLabelText('Nome scheda'), { target: { value: 'Nuova' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crea' }));
    expect(await screen.findByText('Troppi giorni')).toBeTruthy();
    expect(screen.queryByTestId('pagina')).toBeNull();
  });

  it('se la scheda non si crea si resta sull\'elenco, con l\'avviso', async () => {
    await mount([mk(1)]);
    handlers['create_plan.php'] = () => json({ message: 'Limite raggiunto' }, 403);
    const dialog = await openNew();
    fireEvent.change(within(dialog).getByLabelText('Nome scheda'), { target: { value: 'Nuova' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crea' }));
    expect(await screen.findByText('Limite raggiunto')).toBeTruthy();
    expect(screen.queryByTestId('pagina')).toBeNull();
  });

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
    renderPlans();
    await screen.findByRole('link', { name: 'Scheda 1 Attiva' });
    expect(screen.getByRole('button', { name: 'Nuova scheda' }).disabled).toBe(true);
    await act(async () => { rispondi(); });
    expect(screen.getByRole('button', { name: 'Nuova scheda' }).disabled).toBe(false);
  });

  it('se la lettura di user/read.php fallisce per la rete il comando si attiva', async () => {
    vi.stubGlobal('fetch', vi.fn((url) => (String(url).includes('user/read.php')
      ? Promise.reject(new TypeError('Failed to fetch'))
      : Promise.resolve(json({ records: [mk(1)] })))));
    renderPlans();
    await screen.findByRole('link', { name: 'Scheda 1 Attiva' });
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

// Con «troppe schede» il server le segna tutte in sola lettura: l'avviso sta una volta sola sopra l'elenco.
// «Troppi giorni» riguarda una scheda sola: l'avviso sta nella sua pagina, non nella card.
describe('sola lettura', () => {
  const over = (id, reason = 'plans_over_limit', extra = {}) => mk(id, { read_only: true, read_only_reason: reason, ...extra });

  it('(plans_over_limit) avvisa col numero del server, una volta sola', async () => {
    await mount([over(1), mk(2)]);
    expect(screen.getAllByText(/Hai più di 2 schede: sono in sola lettura finché non ne elimini alcune/)).toHaveLength(1);
    expect(screen.getByText(/Con Plus o Pro il limite è più alto/)).toBeTruthy();
  });

  it('senza i limiti dell\'account l\'avviso c\'è comunque, senza numero', async () => {
    await mount([over(1)], { success: false });
    expect(screen.getAllByText(/Hai più schede del limite consentito: sono in sola lettura/)).toHaveLength(1);
    expect(screen.queryByText(/Con Plus o Pro/)).toBeNull();
  });

  it('con un limite null nell\'account l\'avviso resta senza numero', async () => {
    await mount([over(1)], { ...FREE, limits: { plans: null, days_per_plan: null, personal_exercises: 10 } });
    expect(screen.getByText(/Hai più schede del limite consentito/)).toBeTruthy();
  });

  it('tre schede plans_over_limit: un solo avviso, sopra l\'elenco e non sulle card', async () => {
    await mount([over(1), over(2), over(3)]);
    const notice = screen.getAllByText(/Hai più di 2 schede: sono in sola lettura/);
    expect(notice).toHaveLength(1);
    expect(notice[0].closest('a')).toBeNull();
  });

  it('una scheda days_over_limit non ha l\'avviso nella card né in cima: sta nella sua pagina', async () => {
    await mount([mk(1), over(2, 'days_over_limit', { days: [1, 2, 3, 4, 5].map((n) => dayOf(200 + n)) })]);
    expect(screen.queryByText(/Questa scheda ha più di 4 giorni/)).toBeNull();
    expect(screen.queryByText(/sola lettura/)).toBeNull();
  });

  it('sola lettura con un motivo sconosciuto o assente: l\'avviso «troppe schede», una volta sola sopra l\'elenco', async () => {
    await mount([over(1, 'altro'), over(2, null)]);
    const notice = screen.getAllByText(/Hai più di 2 schede: sono in sola lettura/);
    expect(notice).toHaveLength(1);
    expect(notice[0].closest('a')).toBeNull();
  });

  it('per Plus e Pro il messaggio non cita il livello superiore', async () => {
    await mount([over(1)], { ...PRO, limits: { plans: 2, days_per_plan: 4, personal_exercises: 30 } });
    expect(screen.getByText(/Hai più di 2 schede/)).toBeTruthy();
    expect(screen.queryByText(/Con Plus o Pro/)).toBeNull();
  });

  it('una scheda in sola lettura resta un collegamento alla sua pagina', async () => {
    await mount([over(1)]);
    expect(screen.getByRole('link', { name: 'Scheda 1 Attiva' }).getAttribute('href')).toBe('/schede/1');
  });

  it('nessun avviso quando nessuna scheda è in sola lettura', async () => {
    await mount([mk(1)]);
    expect(screen.queryByText(/sola lettura/)).toBeNull();
  });
});
