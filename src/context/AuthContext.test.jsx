// L'intercettore di fetch controlla l'indirizzo anche quando fetch riceve un Request o un URL, non solo una stringa.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import EmailGate from '../components/EmailVerification/EmailGate';

const original = window.fetch;
let backend;

beforeEach(() => {
  backend = vi.fn(() => Promise.resolve(new Response('{}', { status: 401 })));
  window.fetch = backend;
});
afterEach(() => {
  window.fetch = original;
  localStorage.clear();
});

describe('AuthProvider: intercettore di fetch', () => {
  it.each([
    ['Request', () => new Request('http://localhost/backend/api/user/login.php', { method: 'POST' })],
    ['URL', () => new URL('http://localhost/backend/api/user/login.php')],
  ])('accetta un %s senza lanciare e lascia passare il 401 del login', async (_name, make) => {
    render(<AuthProvider><div /></AuthProvider>);
    // Dopo il montaggio fetch è quella dell'intercettore, che avvolge il mock
    await waitFor(() => expect(window.fetch).not.toBe(backend));
    localStorage.setItem('isLoggedIn', 'true');

    const response = await window.fetch(make());

    expect(response.status).toBe(401);
    expect(backend).toHaveBeenCalledTimes(1); // nessun logout: il 401 di login.php è un errore di credenziali
  });

  it.each([
    ['stringa', (u) => u.pathname],
    ['URL', (u) => u],
    ['Request', (u) => new Request(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"a":1}' })],
  ])('aggiunge X-Locale alle chiamate al backend anche con %s, senza perdere metodo e corpo', async (_name, make) => {
    backend.mockImplementation(() => Promise.resolve(new Response('{}', { status: 200 })));
    render(<AuthProvider><div /></AuthProvider>);
    await waitFor(() => expect(window.fetch).not.toBe(backend));

    await window.fetch(make(new URL('/backend/api/workout/read.php', window.location.origin)));

    const [input, init] = backend.mock.calls[0];
    const req = input instanceof Request ? input : new Request(new URL(input, window.location.origin), init);
    expect(req.headers.get('X-Locale')).toBeTruthy();
    if (input instanceof Request) {
      expect(req.method).toBe('POST');
      expect(req.headers.get('Content-Type')).toBe('application/json');
      expect(await req.text()).toBe('{"a":1}');
    }
  });

  it('manda X-Timezone col fuso del dispositivo, così "oggi" e "questa settimana" seguono dove si trova l\'utente', async () => {
    backend.mockImplementation(() => Promise.resolve(new Response('{}', { status: 200 })));
    const spy = vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone: 'America/New_York' });
    render(<AuthProvider><div /></AuthProvider>);
    await waitFor(() => expect(window.fetch).not.toBe(backend));

    await window.fetch('/backend/api/workout/read.php');

    const [, init] = backend.mock.calls[0];
    expect(new Headers(init.headers).get('X-Timezone')).toBe('America/New_York');
    spy.mockRestore();
  });

  it('senza fuso leggibile dal browser non manda X-Timezone', async () => {
    backend.mockImplementation(() => Promise.resolve(new Response('{}', { status: 200 })));
    const spy = vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone: undefined });
    render(<AuthProvider><div /></AuthProvider>);
    await waitFor(() => expect(window.fetch).not.toBe(backend));

    await window.fetch('/backend/api/workout/read.php');

    const [, init] = backend.mock.calls[0];
    expect(new Headers(init.headers).has('X-Timezone')).toBe(false);
    spy.mockRestore();
  });

  it('non aggiunge X-Locale alle chiamate verso altri siti', async () => {
    backend.mockImplementation(() => Promise.resolve(new Response('{}', { status: 200 })));
    render(<AuthProvider><div /></AuthProvider>);
    await waitFor(() => expect(window.fetch).not.toBe(backend));

    await window.fetch(new Request('https://altro.example/backend/api/x.php'));

    expect(backend.mock.calls[0][0].headers.get('X-Locale')).toBeNull();
  });
});

// Il logout porta via la pagina con window.location: qui la si sostituisce con un oggetto che registra dove si va
const atPage = (path) => {
  const url = new URL(path, window.location.origin);
  vi.stubGlobal('location', { origin: url.origin, pathname: url.pathname, search: url.search, hash: url.hash, href: url.href });
};

// Il backend dice 401 alla sessione e alle altre chiamate; logout.php risponde sempre 200
const sessionExpired = () =>
  backend.mockImplementation((input) =>
    Promise.resolve(new Response('{}', { status: String(input).includes('logout.php') ? 200 : 401 })));

describe('AuthProvider: fine della sessione', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sessione scaduta durante una chiamata: login con next = pagina, parametri e ancora', async () => {
    backend.mockImplementation(() => Promise.resolve(new Response('{}', { status: 200 })));
    atPage('/profilo?tab=settings#sezione');
    render(<AuthProvider><div /></AuthProvider>);
    await waitFor(() => expect(window.fetch).not.toBe(backend));
    localStorage.setItem('isLoggedIn', 'true');
    sessionExpired();

    await window.fetch('/backend/api/workout/read.php');

    await waitFor(() => expect(window.location.href).toBe('/login?next=%2Fprofilo%3Ftab%3Dsettings%23sezione'));
  });

  it('sessione non più valida all\'apertura: login con next = pagina, parametri e ancora', async () => {
    sessionExpired();
    localStorage.setItem('isLoggedIn', 'true');
    atPage('/profilo?tab=settings#sezione');

    render(<AuthProvider><div /></AuthProvider>);

    await waitFor(() => expect(window.location.href).toBe('/login?next=%2Fprofilo%3Ftab%3Dsettings%23sezione'));
  });

  it.each(['/login?next=%2Fgruppi', '/en/register'])('sessione scaduta su %s: login senza next', async (path) => {
    sessionExpired();
    localStorage.setItem('isLoggedIn', 'true');
    atPage(path);

    render(<AuthProvider><div /></AuthProvider>);

    await waitFor(() => expect(window.location.href).toBe('/login'));
  });

  it('logout scelto dall\'utente: login senza next', async () => {
    backend.mockImplementation(() => Promise.resolve(new Response('{}', { status: 200 })));
    atPage('/profilo?tab=settings#sezione');
    const LogoutButton = () => <button onClick={useAuth().logout}>esci</button>;
    render(<AuthProvider><LogoutButton /></AuthProvider>);

    fireEvent.click(screen.getByText('esci'));

    await waitFor(() => expect(window.location.href).toBe('/login'));
  });
});

// Stato della conferma dell'email: viene da user/read.php, lo stesso che verifica la sessione
const readBody = (extra = {}) => ({
  success: true, id: 1, username: 'mario', email: 'mario@example.com', email_verified: true,
  email_verification: null, pending_email: null,
  tier: 'free', tier_until: null, tier_last_day: null, signup_code: null, ...extra,
});
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const Probe = () => {
  const { emailState, refreshEmailState } = useAuth();
  return (
    <div>
      <output data-testid="state">{JSON.stringify(emailState)}</output>
      <button onClick={refreshEmailState}>rileggi</button>
    </div>
  );
};
const stateOf = () => JSON.parse(screen.getByTestId('state').textContent);
const unverified = { email_verified: false, email_verification: { deadline: '2026-11-24T10:00:00Z', blocked: false, days_left: 5 } };

describe('AuthProvider: stato della conferma email', () => {
  it('all\'apertura lo legge da read.php: confermata, scadenza, giorni rimasti, indirizzo in attesa', async () => {
    localStorage.setItem('isLoggedIn', 'true');
    backend.mockImplementation(() => Promise.resolve(json(readBody({ ...unverified, pending_email: null }))));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(stateOf()).toMatchObject({
      verified: false, blocked: false, daysLeft: 5, deadline: '2026-11-24T10:00:00Z', email: 'mario@example.com', pendingEmail: null,
    }));
  });

  it('un account confermato ha verified true e nessuna scadenza', async () => {
    localStorage.setItem('isLoggedIn', 'true');
    backend.mockImplementation(() => Promise.resolve(json(readBody({ pending_email: 'nuovo@example.com' }))));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(stateOf()).toMatchObject({ verified: true, blocked: false, daysLeft: null, pendingEmail: 'nuovo@example.com' }));
  });

  it('refreshEmailState rilegge lo stato', async () => {
    localStorage.setItem('isLoggedIn', 'true');
    backend.mockImplementation(() => Promise.resolve(json(readBody(unverified))));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(stateOf().verified).toBe(false));
    backend.mockImplementation(() => Promise.resolve(json(readBody())));

    fireEvent.click(screen.getByText('rileggi'));

    await waitFor(() => expect(stateOf().verified).toBe(true));
  });

  it('un 403 email_unverified da una chiamata qualunque fa rileggere lo stato, senza uscire', async () => {
    localStorage.setItem('isLoggedIn', 'true');
    backend.mockImplementation(() => Promise.resolve(json(readBody(unverified))));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(stateOf().blocked).toBe(false));
    backend.mockImplementation((input) => Promise.resolve(String(input).includes('user/read.php')
      ? json(readBody({ email_verified: false, email_verification: { deadline: '2026-11-17T10:00:00Z', blocked: true, days_left: 0 } }))
      : json({ success: false, code: 'email_unverified', message: 'Conferma la tua email' }, 403)));

    const response = await window.fetch('/backend/api/workout/read_plans.php');

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('email_unverified'); // il corpo resta leggibile da chi ha chiamato
    await waitFor(() => expect(stateOf().blocked).toBe(true));
    expect(localStorage.getItem('isLoggedIn')).toBe('true');
    expect(backend.mock.calls.some(([u]) => String(u).includes('logout.php'))).toBe(false);
  });

  it('un 403 con un altro codice non rilegge nulla', async () => {
    localStorage.setItem('isLoggedIn', 'true');
    backend.mockImplementation(() => Promise.resolve(json(readBody())));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(stateOf().verified).toBe(true));
    backend.mockClear();
    backend.mockImplementation(() => Promise.resolve(json({ success: false, code: 'consent_required' }, 403)));

    await window.fetch('/backend/api/user_stats/create.php');
    await new Promise((resolve) => { setTimeout(resolve, 20); }); // la rilettura, se partisse, parte in un giro successivo

    expect(backend).toHaveBeenCalledTimes(1);
  });

  it('un 403 email_unverified di un altro sito non rilegge nulla', async () => {
    localStorage.setItem('isLoggedIn', 'true');
    backend.mockImplementation(() => Promise.resolve(json(readBody())));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(stateOf().verified).toBe(true));
    backend.mockClear();
    backend.mockImplementation(() => Promise.resolve(json({ success: false, code: 'email_unverified' }, 403)));

    await window.fetch('https://altro-sito.example/api/qualcosa');
    await new Promise((resolve) => { setTimeout(resolve, 20); });

    expect(backend).toHaveBeenCalledTimes(1);
  });

  it('se la rilettura fallisce lo stato resta com\'era e l\'utente non esce', async () => {
    localStorage.setItem('isLoggedIn', 'true');
    backend.mockImplementation(() => Promise.resolve(json(readBody(unverified))));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(stateOf().verified).toBe(false));
    backend.mockClear();
    backend.mockImplementation(() => Promise.reject(new Error('rete')));

    fireEvent.click(screen.getByText('rileggi'));

    await waitFor(() => expect(backend).toHaveBeenCalled());
    expect(stateOf().verified).toBe(false);
    expect(localStorage.getItem('isLoggedIn')).toBe('true');
  });

  it('dopo il login lo legge, così striscia e finestra compaiono subito', async () => {
    backend.mockImplementation(() => Promise.resolve(json(readBody(unverified))));
    const LoginButton = () => {
      const { login } = useAuth();
      return <button onClick={() => login({ id: 1, username: 'mario', locale: 'it' })}>entra</button>;
    };
    render(<AuthProvider><LoginButton /><Probe /></AuthProvider>);

    fireEvent.click(screen.getByText('entra'));

    await waitFor(() => expect(stateOf()).toMatchObject({ verified: false, daysLeft: 5 }));
  });
});

// Esito della conferma con un codice di registrazione: con il provider vero, non con report/take finti
describe('AuthProvider: esito della conferma', () => {
  const Confirm = () => {
    const { refreshEmailState, login, logout } = useAuth();
    return (
      <div>
        <button onClick={() => refreshEmailState('Email confermata. Plus attivo fino al 15 febbraio 2027.')}>conferma con codice</button>
        <button onClick={() => refreshEmailState('')}>conferma senza codice</button>
        <button onClick={() => login({ id: 2, username: 'luca', locale: 'it' })}>entra</button>
        <button onClick={logout}>esci</button>
      </div>
    );
  };
  const mountGate = () => {
    localStorage.setItem('isLoggedIn', 'true');
    backend.mockImplementation(() => Promise.resolve(json(readBody(unverified))));
    render(<AuthProvider><EmailGate /><Confirm /><Probe /></AuthProvider>);
    return waitFor(() => expect(stateOf().verified).toBe(false));
  };

  it('conferma con codice: l\'avviso dice il messaggio del server', async () => {
    await mountGate();
    backend.mockImplementation(() => Promise.resolve(json(readBody())));
    fireEvent.click(screen.getByText('conferma con codice'));
    expect(await screen.findByText('Email confermata. Plus attivo fino al 15 febbraio 2027.')).toBeTruthy();
  });

  it('conferma senza codice: il testo di sempre', async () => {
    await mountGate();
    backend.mockImplementation(() => Promise.resolve(json(readBody())));
    fireEvent.click(screen.getByText('conferma senza codice'));
    expect(await screen.findByText('Email confermata.')).toBeTruthy();
  });

  it('l\'esito sta solo nello stato letto con la conferma: una rilettura successiva lo toglie', async () => {
    await mountGate();
    backend.mockImplementation(() => Promise.resolve(json(readBody())));
    fireEvent.click(screen.getByText('conferma con codice'));
    await waitFor(() => expect(stateOf().outcome).toBe('Email confermata. Plus attivo fino al 15 febbraio 2027.'));
    fireEvent.click(screen.getByText('rileggi'));
    await waitFor(() => expect(stateOf().outcome).toBe(''));
  });

  it('uscita e nuovo accesso: nessun messaggio vecchio per l\'altro account', async () => {
    await mountGate();
    backend.mockImplementation(() => Promise.resolve(json(readBody())));
    fireEvent.click(screen.getByText('conferma con codice'));
    await screen.findByText('Email confermata. Plus attivo fino al 15 febbraio 2027.');
    fireEvent.click(screen.getByText('esci'));
    await waitFor(() => expect(stateOf()).toBeNull());
    backend.mockImplementation(() => Promise.resolve(json(readBody(unverified))));
    fireEvent.click(screen.getByText('entra'));
    await waitFor(() => expect(stateOf()).toMatchObject({ verified: false, outcome: '' }));
    backend.mockImplementation(() => Promise.resolve(json(readBody())));
    fireEvent.click(screen.getByText('conferma senza codice'));
    await waitFor(() => expect(stateOf().verified).toBe(true));
    expect(screen.queryByText(/Plus attivo/)).toBeNull();
  });

  it('una lettura semplice partita prima della conferma, risolta dopo il commit, non copre il messaggio del server', async () => {
    await mountGate();
    const pending = [];
    backend.mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    fireEvent.click(screen.getByText('conferma senza codice')); // lettura vecchia, in volo
    fireEvent.click(screen.getByText('conferma con codice')); // lettura nuova, col messaggio
    await waitFor(() => expect(pending.length).toBeGreaterThanOrEqual(2));
    // la vecchia risponde per prima, con l'email già confermata
    pending[0](json(readBody()));
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText('Email confermata.')).toBeNull();
    pending[1](json(readBody()));
    expect(await screen.findByText('Email confermata. Plus attivo fino al 15 febbraio 2027.')).toBeTruthy();
    expect(screen.queryByText('Email confermata.')).toBeNull();
  });
});

