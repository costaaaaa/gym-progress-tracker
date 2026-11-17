// Sezione «Codici di registrazione»: elenco a pagine, dettaglio con gli iscritti, creazione (con la conferma «per
// sempre»), modifica ammessa o negata secondo gli usi, eliminazione, «Copia link». La fetch è il confine: un piccolo
// server finto con le risposte di api/admin/signup_codes.php.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import AdminSignupCodes from './AdminSignupCodes';
import { json } from '../../test/dom';
import { describedBy } from '../../test/accessibleNames';

const row = (extra = {}) => ({
  id: 1, code: 'AMICI-90', tier: 'plus', duration_days: 90, forever: false, max_uses: 10, last_day: '2027-03-15', expired: false,
  enabled: true, assignee: 'Luca', seats_taken: 3, registered: 3, confirmed: 2, missed: 0,
  created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-01T10:00:00Z', ...extra,
});
const UNUSED = row({ id: 2, code: 'NUOVO-1', tier: 'pro', duration_days: 30, max_uses: 5, last_day: null, assignee: null, seats_taken: 0, registered: 0, confirmed: 0 });
const FOREVER = row({ id: 3, code: 'TESTER', tier: 'pro', duration_days: null, forever: true, max_uses: 2, last_day: null, assignee: null, seats_taken: 1, registered: 1, confirmed: 1 });

let server;
let fetchMock;
const calls = () => fetchMock.mock.calls.map(([url, init]) => ({ url: String(url), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(init.body) : null }));
const posts = () => calls().filter((c) => c.method === 'POST');
const lastPost = () => posts().pop().body;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => {
  server = {
    list: (page) => ({ success: true, codes: [row(), UNUSED, FOREVER], page, per_page: 20, total: 3, pages: 1 }),
    detail: (id, page) => ({
      success: true, code: [row(), UNUSED, FOREVER].find((c) => c.id === id), page, per_page: 20, total: 2, pages: 1,
      uses: [
        { username: 'anna', account_deleted: false, status: 'applied', created_at: '2026-11-02T09:00:00Z', applied_at: '2026-11-02T09:30:00Z' },
        { username: null, account_deleted: true, status: 'pending', created_at: '2026-11-03T09:00:00Z', applied_at: null },
      ],
    }),
    post: (body) => ({ success: true, code: { ...UNUSED, ...body, id: 9, code: body.code || 'GENERATO01' } }),
  };
  fetchMock = vi.fn((url, init) => {
    const u = String(url);
    if (init?.method === 'POST') {
      const result = server.post(JSON.parse(init.body));
      return Promise.resolve(json(result.body ?? result, result.status ?? (result.success ? 200 : 400)));
    }
    const query = new URL(u, 'http://x').searchParams;
    const page = Number(query.get('page') ?? 1);
    if (query.get('id')) return Promise.resolve(json(server.detail(Number(query.get('id')), page)));
    const result = server.list(page);
    return Promise.resolve(json(result.body ?? result, result.status ?? 200));
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); });

const open = async () => {
  render(<AdminSignupCodes />);
  await flush();
};
const click = async (name) => {
  fireEvent.click(screen.getByRole('button', { name }));
  await flush();
};
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const openCode = async (code) => click(`Apri il codice ${code}`);
const rowOf = (code) => screen.getByRole('listitem', { name: code });

describe('elenco', () => {
  it('chiede la prima pagina e mostra per ogni codice livello, durata, posti, registrati, confermati, scadenza, stato, assegnatario', async () => {
    await open();
    expect(calls()[0].url).toContain('admin/signup_codes.php?page=1');
    const r = within(rowOf('AMICI-90'));
    expect(r.getByText('AMICI-90')).toBeTruthy();
    expect(r.getByText('Plus')).toBeTruthy();
    expect(r.getByText('90 giorni')).toBeTruthy();
    expect(r.getByText('Posti 3/10')).toBeTruthy();
    expect(r.getByText('Registrati 3')).toBeTruthy();
    expect(r.getByText('Confermati 2')).toBeTruthy();
    expect(r.getByText('Scade il 15/03/2027')).toBeTruthy();
    expect(r.getByText('Acceso')).toBeTruthy();
    expect(r.getByText('Assegnato a Luca')).toBeTruthy();
  });

  it('senza scadenza e senza assegnatario lo dice', async () => {
    await open();
    const r = within(rowOf('NUOVO-1'));
    expect(r.getByText('Non scade')).toBeTruthy();
    expect(r.getByText('Nessun assegnatario')).toBeTruthy();
  });

  it('un codice per sempre è marcato in modo evidente', async () => {
    await open();
    expect(within(rowOf('TESTER')).getByText('PER SEMPRE')).toBeTruthy();
    expect(within(rowOf('AMICI-90')).queryByText('PER SEMPRE')).toBeNull();
  });

  it('spento e scaduto sono segnati', async () => {
    server.list = (page) => ({ success: true, codes: [row({ enabled: false }), row({ id: 5, code: 'VECCHIO', expired: true, last_day: '2026-10-01' })], page, per_page: 20, total: 2, pages: 1 });
    await open();
    expect(within(rowOf('AMICI-90')).getByText('Spento')).toBeTruthy();
    expect(within(rowOf('VECCHIO')).getByText('Scaduto il 01/10/2026')).toBeTruthy();
  });

  it('elenco vuoto', async () => {
    server.list = (page) => ({ success: true, codes: [], page, per_page: 20, total: 0, pages: 1 });
    await open();
    expect(screen.getByText('Nessun codice.')).toBeTruthy();
  });

  it('errore del server: lo mostra', async () => {
    server.list = () => ({ status: 404, body: { success: false, code: 'not_found', message: 'Non trovato.' } });
    await open();
    expect(screen.getByText('Non trovato.')).toBeTruthy();
  });

  it('a pagine: Successiva e Precedente chiedono la pagina giusta, e agli estremi si fermano', async () => {
    server.list = (page) => ({ success: true, codes: [row({ id: page, code: `P${page}` })], page, per_page: 20, total: 45, pages: 3 });
    await open();
    expect(screen.getByText('Pagina 1 di 3')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pagina precedente' }).disabled).toBe(true);
    await click('Pagina successiva');
    expect(calls().pop().url).toContain('page=2');
    expect(screen.getByText('Pagina 2 di 3')).toBeTruthy();
    await click('Pagina successiva');
    expect(screen.getByRole('button', { name: 'Pagina successiva' }).disabled).toBe(true);
    await click('Pagina precedente');
    expect(calls().pop().url).toContain('page=2');
  });

  it('una sola pagina: nessuna paginazione', async () => {
    await open();
    expect(screen.queryByText(/Pagina 1 di/)).toBeNull();
  });
});

describe('creazione', () => {
  const create = async () => {
    await open();
    await click('Nuovo codice');
  };

  it('il modulo ha etichette, livello, durata, posti, ultimo giorno, assegnatario', async () => {
    await create();
    for (const label of ['Codice', 'Livello', 'Durata in giorni', 'Posti', 'Ultimo giorno d\'uso', 'Assegnatario']) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it('con durata e senza testo: il server genera il codice; non c\'è conferma e la richiesta non porta il testo', async () => {
    await create();
    type('Durata in giorni', '90');
    type('Posti', '5');
    type('Ultimo giorno d\'uso', '2027-06-30');
    type('Assegnatario', ' Marta ');
    await click('Crea codice');
    expect(lastPost()).toEqual({ action: 'create', tier: 'plus', duration_days: 90, max_uses: 5, last_day: '2027-06-30', assignee: 'Marta' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Codice creato: GENERATO01')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nuovo codice' })).toBeTruthy();
  });

  it('con il testo scelto e Pro', async () => {
    await create();
    type('Codice', 'Primavera-26');
    type('Livello', 'pro');
    type('Durata in giorni', '30');
    type('Posti', '3');
    await click('Crea codice');
    expect(lastPost()).toEqual({ action: 'create', code: 'Primavera-26', tier: 'pro', duration_days: 30, max_uses: 3 });
  });

  it('durata vuota: chiede «Questo codice dà il livello per sempre» e non parte finché non si conferma', async () => {
    await create();
    type('Posti', '2');
    await click('Crea codice');
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Questo codice dà il livello per sempre')).toBeTruthy();
    expect(posts()).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla' }));
    await flush();
    expect(posts()).toHaveLength(0);
    expect(screen.queryByRole('dialog')).toBeNull();
    await click('Crea codice');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sì, per sempre' }));
    await flush();
    expect(lastPost()).toEqual({ action: 'create', tier: 'plus', duration_days: null, confirm_forever: true, max_uses: 2 });
  });

  it('posti mancanti: errore sul campo, nessuna richiesta', async () => {
    await create();
    type('Durata in giorni', '90');
    await click('Crea codice');
    expect(posts()).toHaveLength(0);
    expect(screen.getByLabelText('Posti').getAttribute('aria-invalid')).toBe('true');
    expect(describedBy(screen.getByLabelText('Posti'))).toContain('almeno 1');
  });

  it('errore del server sul campo giusto: testo già preso', async () => {
    server.post = () => ({ status: 409, body: { success: false, code: 'code_taken', message: 'Esiste già un codice con questo testo.' } });
    await create();
    type('Codice', 'AMICI-90');
    type('Durata in giorni', '90');
    type('Posti', '5');
    await click('Crea codice');
    expect(describedBy(screen.getByLabelText('Codice'))).toBe('Esiste già un codice con questo testo.');
    expect(screen.getByLabelText('Codice').getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByText(/Codice creato/)).toBeNull();
  });

  it.each([
    ['invalid_date', 'Ultimo giorno d\'uso'],
    ['invalid_duration', 'Durata in giorni'],
    ['invalid_max_uses', 'Posti'],
    ['invalid_assignee', 'Assegnatario'],
    ['invalid_code', 'Codice'],
  ])('errore %s: messaggio del server sul campo «%s»', async (code, label) => {
    server.post = () => ({ status: 400, body: { success: false, code, message: `Messaggio ${code}` } });
    await create();
    type('Durata in giorni', '90');
    type('Posti', '5');
    await click('Crea codice');
    expect(describedBy(screen.getByLabelText(label))).toBe(`Messaggio ${code}`);
  });

  it('un errore che non riguarda un campo resta un avviso', async () => {
    server.post = () => ({ status: 500, body: { success: false, code: 'server_error', message: 'Errore interno del server.' } });
    await create();
    type('Durata in giorni', '90');
    type('Posti', '5');
    await click('Crea codice');
    expect(screen.getByRole('alert').textContent).toBe('Errore interno del server.');
  });

  it('Annulla torna all\'elenco', async () => {
    await create();
    await click('Annulla');
    expect(screen.getByRole('button', { name: 'Nuovo codice' })).toBeTruthy();
  });
});

describe('dettaglio', () => {
  it('mostra gli iscritti con lo stato e l\'account eliminato', async () => {
    await open();
    await openCode('AMICI-90');
    expect(calls().pop().url).toContain('admin/signup_codes.php?id=1&page=1');
    const list = screen.getByRole('list', { name: 'Iscritti con questo codice' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('anna')).toBeTruthy();
    expect(within(items[0]).getByText('Confermato')).toBeTruthy();
    expect(within(items[1]).getByText('Account eliminato')).toBeTruthy();
    expect(within(items[1]).getByText('In attesa di conferma')).toBeTruthy();
  });

  it('uso non applicato (posti finiti)', async () => {
    await open();
    server.detail = (id, page) => ({ success: true, code: row(), page, per_page: 20, total: 1, pages: 1, uses: [{ username: 'bruno', account_deleted: false, status: 'missed', created_at: '2026-11-02T09:00:00Z', applied_at: null }] });
    await openCode('AMICI-90');
    expect(screen.getByText('Non applicato')).toBeTruthy();
  });

  it('nessun iscritto', async () => {
    await open();
    server.detail = (id, page) => ({ success: true, code: UNUSED, page, per_page: 20, total: 0, pages: 1, uses: [] });
    await openCode('NUOVO-1');
    expect(screen.getByText('Nessun iscritto.')).toBeTruthy();
  });

  it('gli iscritti sono a pagine', async () => {
    await open();
    server.detail = (id, page) => ({ success: true, code: row(), page, per_page: 20, total: 30, pages: 2, uses: [{ username: `utente${page}`, account_deleted: false, status: 'applied', created_at: '2026-11-02T09:00:00Z', applied_at: '2026-11-02T09:30:00Z' }] });
    await openCode('AMICI-90');
    expect(screen.getByText('utente1')).toBeTruthy();
    expect(screen.getByText('Pagina 1 di 2')).toBeTruthy();
    await click('Pagina successiva');
    expect(calls().pop().url).toContain('id=1&page=2');
    expect(screen.getByText('utente2')).toBeTruthy();
  });

  it('«Torna all\'elenco» rilegge l\'elenco', async () => {
    await open();
    await openCode('AMICI-90');
    await click('Torna all\'elenco');
    expect(calls().pop().url).toContain('admin/signup_codes.php?page=1');
    expect(screen.getByText('Nuovo codice')).toBeTruthy();
  });

  it('«Copia link» copia l\'indirizzo di registrazione con il codice e lo dice', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await open();
    await openCode('AMICI-90');
    await click('Copia link');
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/register?code=AMICI-90`);
    expect(screen.getByText('Link copiato')).toBeTruthy();
  });

  it('se la copia non riesce mostra il link da copiare a mano', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(() => Promise.reject(new Error('no'))) }, configurable: true });
    await open();
    await openCode('AMICI-90');
    await click('Copia link');
    expect(screen.getByText(`${window.location.origin}/register?code=AMICI-90`)).toBeTruthy();
  });

  it('il testo del codice è codificato nel link', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    server.list = (page) => ({ success: true, codes: [row({ code: 'A-B_C' })], page, per_page: 20, total: 1, pages: 1 });
    server.detail = (id, page) => ({ success: true, code: row({ code: 'A-B_C' }), page, per_page: 20, total: 0, pages: 1, uses: [] });
    await open();
    await openCode('A-B_C');
    await click('Copia link');
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/register?code=A-B_C`);
  });
});

describe('modifica', () => {
  it('codice già usato: livello, durata e testo sono bloccati; posti, ultimo giorno, acceso e assegnatario no', async () => {
    await open();
    await openCode('AMICI-90');
    expect(screen.getByLabelText('Codice').disabled).toBe(true);
    expect(screen.getByLabelText('Livello').disabled).toBe(true);
    expect(screen.getByLabelText('Durata in giorni').disabled).toBe(true);
    expect(screen.getByLabelText('Posti').disabled).toBe(false);
    expect(screen.getByLabelText('Ultimo giorno d\'uso').disabled).toBe(false);
    expect(screen.getByLabelText('Assegnatario').disabled).toBe(false);
    expect(screen.getByRole('checkbox', { name: 'Acceso' }).disabled).toBe(false);
    expect(screen.getByText('Dopo il primo uso livello, durata e testo non si cambiano.')).toBeTruthy();
  });

  it('i campi partono dai valori del codice', async () => {
    await open();
    await openCode('AMICI-90');
    expect(screen.getByLabelText('Codice').value).toBe('AMICI-90');
    expect(screen.getByLabelText('Livello').value).toBe('plus');
    expect(screen.getByLabelText('Durata in giorni').value).toBe('90');
    expect(screen.getByLabelText('Posti').value).toBe('10');
    expect(screen.getByLabelText('Ultimo giorno d\'uso').value).toBe('2027-03-15');
    expect(screen.getByLabelText('Assegnatario').value).toBe('Luca');
  });

  it('salva solo i campi cambiati', async () => {
    server.post = (body) => ({ success: true, code: row({ max_uses: body.max_uses }) });
    await open();
    await openCode('AMICI-90');
    type('Posti', '12');
    await click('Salva');
    expect(lastPost()).toEqual({ action: 'update', id: 1, max_uses: 12 });
    expect(screen.getByText('Salvato.')).toBeTruthy();
    expect(screen.getByLabelText('Posti').value).toBe('12');
  });

  it('assegnatario e ultimo giorno svuotati: parte il valore vuoto', async () => {
    server.post = () => ({ success: true, code: row({ assignee: null, last_day: null }) });
    await open();
    await openCode('AMICI-90');
    type('Assegnatario', '');
    type('Ultimo giorno d\'uso', '');
    await click('Salva');
    expect(lastPost()).toEqual({ action: 'update', id: 1, last_day: '', assignee: '' });
  });

  it('niente cambiato: non manda nulla', async () => {
    await open();
    await openCode('AMICI-90');
    await click('Salva');
    expect(posts()).toHaveLength(0);
    expect(screen.getByText('Nessuna modifica.')).toBeTruthy();
  });

  it('posti sotto quelli occupati: il server rifiuta e il messaggio va sul campo', async () => {
    server.post = () => ({ status: 400, body: { success: false, code: 'max_uses_below_taken', message: 'I posti non possono essere meno di quelli occupati (3).' } });
    await open();
    await openCode('AMICI-90');
    type('Posti', '1');
    await click('Salva');
    expect(describedBy(screen.getByLabelText('Posti'))).toBe('I posti non possono essere meno di quelli occupati (3).');
    expect(screen.queryByText('Salvato.')).toBeNull();
  });

  it('l\'interruttore Acceso spegne il codice', async () => {
    server.post = () => ({ success: true, code: row({ enabled: false }) });
    await open();
    await openCode('AMICI-90');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Acceso' }));
    await click('Salva');
    expect(lastPost()).toEqual({ action: 'update', id: 1, enabled: false });
  });

  it('codice senza usi: livello, durata e testo si cambiano', async () => {
    server.post = (body) => ({ success: true, code: { ...UNUSED, ...body } });
    await open();
    await openCode('NUOVO-1');
    expect(screen.getByLabelText('Livello').disabled).toBe(false);
    expect(screen.getByLabelText('Durata in giorni').disabled).toBe(false);
    expect(screen.getByLabelText('Codice').disabled).toBe(false);
    type('Livello', 'plus');
    type('Durata in giorni', '60');
    type('Codice', 'Nuovo-2');
    await click('Salva');
    expect(lastPost()).toEqual({ action: 'update', id: 2, tier: 'plus', duration_days: 60, code: 'Nuovo-2' });
  });

  it('togliere la durata a un codice a tempo chiede la conferma «per sempre»', async () => {
    server.post = (body) => ({ success: true, code: { ...UNUSED, duration_days: null, forever: true } });
    await open();
    await openCode('NUOVO-1');
    type('Durata in giorni', '');
    await click('Salva');
    expect(posts()).toHaveLength(0);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Sì, per sempre' }));
    await flush();
    expect(lastPost()).toEqual({ action: 'update', id: 2, duration_days: null, confirm_forever: true });
  });

  it('un codice già per sempre salvato senza toccare la durata non chiede nulla', async () => {
    server.post = () => ({ success: true, code: FOREVER });
    await open();
    await openCode('TESTER');
    type('Assegnatario', 'Giulia');
    await click('Salva');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(lastPost()).toEqual({ action: 'update', id: 3, assignee: 'Giulia' });
  });
});

describe('eliminazione', () => {
  it('codice già usato: non si elimina, si spegne', async () => {
    await open();
    await openCode('AMICI-90');
    expect(screen.queryByRole('button', { name: 'Elimina codice' })).toBeNull();
    expect(screen.getByText('Un codice già usato non si elimina: spegnilo.')).toBeTruthy();
  });

  it('codice senza usi: chiede conferma, poi elimina e torna all\'elenco', async () => {
    server.post = () => ({ success: true });
    await open();
    await openCode('NUOVO-1');
    await click('Elimina codice');
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/NUOVO-1/)).toBeTruthy();
    expect(posts()).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Elimina' }));
    await flush();
    expect(lastPost()).toEqual({ action: 'delete', id: 2 });
    expect(screen.getByRole('button', { name: 'Nuovo codice' })).toBeTruthy();
    expect(screen.getByText('Codice eliminato.')).toBeTruthy();
  });

  it('annullando la conferma non elimina', async () => {
    await open();
    await openCode('NUOVO-1');
    await click('Elimina codice');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annulla' }));
    await flush();
    expect(posts()).toHaveLength(0);
  });

  it('il server rifiuta (usato nel frattempo): mostra il messaggio e resta sul dettaglio', async () => {
    server.post = () => ({ status: 409, body: { success: false, code: 'code_has_uses', message: 'Un codice già usato non si elimina: spegnilo.' } });
    await open();
    await openCode('NUOVO-1');
    await click('Elimina codice');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Elimina' }));
    await flush();
    expect(screen.getByRole('alert').textContent).toBe('Un codice già usato non si elimina: spegnilo.');
    expect(screen.getByLabelText('Codice')).toBeTruthy();
  });
});
