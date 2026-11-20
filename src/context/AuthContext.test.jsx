// L'intercettore di fetch controlla l'indirizzo anche quando fetch riceve un Request o un URL, non solo una stringa.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { isModuleActive } from '../hooks/useModule';
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
        <button onClick={() => refreshEmailState()}>rilettura semplice</button>
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
    fireEvent.click(screen.getByText('rilettura semplice')); // lettura vecchia, in volo
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

  it('conferma senza codice con una lettura semplice in volo: parte una lettura nuova e lo stato finale è confermato', async () => {
    await mountGate();
    const pending = [];
    backend.mockImplementation(() => new Promise((resolve) => pending.push(resolve)));
    fireEvent.click(screen.getByText('rilettura semplice')); // partita prima della conferma
    fireEvent.click(screen.getByText('conferma senza codice'));
    await waitFor(() => expect(pending.length).toBe(2));
    pending[0](json(readBody(unverified))); // letta prima del commit: non deve scrivere
    pending[1](json(readBody()));
    await waitFor(() => expect(stateOf().verified).toBe(true));
    expect(await screen.findByText('Email confermata.')).toBeTruthy();
  });
});

// Unità di peso dell'account: da user/read.php, kg finché non è letta e da sloggati
const Unit = () => {
  const { weightUnit } = useAuth();
  return <div data-testid="unit">{weightUnit}</div>;
};
const readReturns = (data) =>
  backend.mockImplementation((input) =>
    Promise.resolve(new Response(String(input).includes('read.php') ? JSON.stringify({ success: true, ...data }) : '{}', { status: 200 })));

describe('AuthProvider: unità di peso', () => {
  it('da sloggati è kg', () => {
    render(<AuthProvider><Unit /></AuthProvider>);
    expect(screen.getByTestId('unit').textContent).toBe('kg');
  });

  it('kg finché non è letta, poi quella dell\'account', async () => {
    readReturns({ id: 1, username: 'a', locale: 'en', weight_unit: 'lb' });
    localStorage.setItem('isLoggedIn', 'true');
    render(<AuthProvider><Unit /></AuthProvider>);
    expect(screen.getByTestId('unit').textContent).toBe('kg');
    await waitFor(() => expect(screen.getByTestId('unit').textContent).toBe('lb'));
  });

  it.each([
    ['senza il campo', {}],
    ['con un valore non valido', { weight_unit: 'st' }],
    ['con un valore di un altro tipo', { weight_unit: 5 }],
  ])('un server %s: la lettura è avvenuta (utente visibile) e l\'unità resta kg', async (_name, extra) => {
    readReturns({ id: 1, username: 'letto', locale: 'en', ...extra });
    localStorage.setItem('isLoggedIn', 'true');
    const Name = () => <div data-testid="name">{useAuth().user?.username ?? ''}</div>;
    render(<AuthProvider><Unit /><Name /></AuthProvider>);
    // Effetto certo della lettura: l'utente è nello stato. Solo allora si guarda l'unità (kg è anche lo stato iniziale)
    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('letto'));
    expect(screen.getByTestId('unit').textContent).toBe('kg');
  });

  it('una rilettura con un valore non valido non cancella l\'unità già letta', async () => {
    readReturns({ id: 1, username: 'a', weight_unit: 'lb' });
    localStorage.setItem('isLoggedIn', 'true');
    const Reread = () => <button onClick={() => useAuthRef.current.refreshEmailState()}>rileggi</button>;
    const useAuthRef = { current: null };
    const Grab = () => { useAuthRef.current = useAuth(); return null; };
    const Email = () => <div data-testid="email">{useAuth().emailState?.email ?? ''}</div>;
    render(<AuthProvider><Unit /><Email /><Grab /><Reread /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('unit').textContent).toBe('lb'));
    readReturns({ id: 1, username: 'a', email: 'riletta@example.com', weight_unit: 'st' });
    fireEvent.click(screen.getByText('rileggi'));
    // Effetto certo della rilettura: l'indirizzo nuovo è nello stato dell'email
    await waitFor(() => expect(screen.getByTestId('email').textContent).toBe('riletta@example.com'));
    expect(screen.getByTestId('unit').textContent).toBe('lb');
  });

  it('dopo il login (che risponde senza unità) la rilettura la porta', async () => {
    readReturns({ id: 1, username: 'a', locale: 'en', weight_unit: 'lb' });
    const Login = () => {
      const { login } = useAuth();
      return <button onClick={() => login({ id: 1, username: 'a', locale: 'en' })}>entra</button>;
    };
    render(<AuthProvider><Unit /><Login /></AuthProvider>);
    expect(screen.getByTestId('unit').textContent).toBe('kg');
    fireEvent.click(screen.getByText('entra'));
    await waitFor(() => expect(screen.getByTestId('unit').textContent).toBe('lb'));
  });

  it('updateUser({ weight_unit }) cambia l\'unità', async () => {
    readReturns({ id: 1, username: 'a', weight_unit: 'kg' });
    localStorage.setItem('isLoggedIn', 'true');
    const Change = () => {
      const { updateUser } = useAuth();
      return <button onClick={() => updateUser({ weight_unit: 'lb' })}>cambia</button>;
    };
    render(<AuthProvider><Unit /><Change /></AuthProvider>);
    await waitFor(() => expect(backend).toHaveBeenCalled());
    fireEvent.click(screen.getByText('cambia'));
    await waitFor(() => expect(screen.getByTestId('unit').textContent).toBe('lb'));
  });
});

// Moduli facoltativi: da user/read.php dentro `user`; chi non li ha (login, server vecchio) li ha tutti attivi
describe('AuthProvider: moduli', () => {
  const Modules = () => {
    const { user } = useAuth();
    return <div data-testid="modules">{user ? JSON.stringify(user.modules ?? null) : 'nessun utente'}</div>;
  };
  const MODULES = { body: true, recovery: false, levels: true, groups: false, ai: true };

  it('user.modules arriva da user/read.php', async () => {
    readReturns({ id: 1, username: 'a', modules: MODULES, modules_chosen: true });
    localStorage.setItem('isLoggedIn', 'true');
    render(<AuthProvider><Modules /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('modules').textContent).toBe(JSON.stringify(MODULES)));
  });

  it('dopo il login (che risponde senza moduli) la rilettura li porta', async () => {
    readReturns({ id: 1, username: 'a', modules: MODULES });
    const Login = () => {
      const { login } = useAuth();
      return <button onClick={() => login({ id: 1, username: 'a' })}>entra</button>;
    };
    render(<AuthProvider><Modules /><Login /></AuthProvider>);
    fireEvent.click(screen.getByText('entra'));
    await waitFor(() => expect(screen.getByTestId('modules').textContent).toBe(JSON.stringify(MODULES)));
  });

  it('la rilettura scrive moduli e unità anche nella copia in localStorage', async () => {
    readReturns({ id: 1, username: 'a', modules: MODULES, weight_unit: 'lb' });
    const Login = () => {
      const { login } = useAuth();
      return <button onClick={() => login({ id: 1, username: 'a' })}>entra</button>;
    };
    render(<AuthProvider><Modules /><Login /></AuthProvider>);
    fireEvent.click(screen.getByText('entra'));
    await waitFor(() => expect(screen.getByTestId('modules').textContent).toBe(JSON.stringify(MODULES)));
    expect(JSON.parse(localStorage.getItem('user'))).toMatchObject({ modules: MODULES, weight_unit: 'lb' });
  });

  it('il login porta già i moduli: un modulo non attivo lo è subito, senza aspettare la rilettura', async () => {
    backend.mockImplementation(() => new Promise(() => {})); // la rilettura non arriva
    const Login = () => {
      const { login, user } = useAuth();
      return (
        <>
          <button onClick={() => login({ id: 1, username: 'a', modules: MODULES })}>entra</button>
          <div data-testid="groups">{String(isModuleActive(user, 'groups'))}</div>
        </>
      );
    };
    render(<AuthProvider><Login /></AuthProvider>);
    fireEvent.click(screen.getByText('entra'));
    await waitFor(() => expect(screen.getByTestId('groups').textContent).toBe('false'));
  });

  it('un server senza moduli lascia user senza modules (e il resto dell\'app li legge tutti attivi)', async () => {
    readReturns({ id: 1, username: 'a' });
    localStorage.setItem('isLoggedIn', 'true');
    render(<AuthProvider><Modules /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('modules').textContent).toBe('null'));
  });

  it('updateUser({ modules }) cambia i moduli e li scrive nella copia in localStorage', async () => {
    readReturns({ id: 1, username: 'a', modules: MODULES });
    localStorage.setItem('isLoggedIn', 'true');
    const Change = () => {
      const { updateUser } = useAuth();
      return <button onClick={() => updateUser({ modules: { ...MODULES, groups: true } })}>cambia</button>;
    };
    render(<AuthProvider><Modules /><Change /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('modules').textContent).toBe(JSON.stringify(MODULES)));
    fireEvent.click(screen.getByText('cambia'));
    await waitFor(() => expect(screen.getByTestId('modules').textContent).toBe(JSON.stringify({ ...MODULES, groups: true })));
    expect(JSON.parse(localStorage.getItem('user')).modules.groups).toBe(true);
  });

  it('una rilettura con moduli non validi non cancella quelli già letti', async () => {
    readReturns({ id: 1, username: 'a', modules: MODULES });
    localStorage.setItem('isLoggedIn', 'true');
    const Reread = () => {
      const { refreshEmailState } = useAuth();
      return <button onClick={refreshEmailState}>rileggi</button>;
    };
    const Email = () => <div data-testid="email">{useAuth().emailState?.email ?? ''}</div>;
    render(<AuthProvider><Modules /><Email /><Reread /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('modules').textContent).toBe(JSON.stringify(MODULES)));
    readReturns({ id: 1, username: 'a', email: 'riletta@example.com', modules: 'tutti' });
    fireEvent.click(screen.getByText('rileggi'));
    await waitFor(() => expect(screen.getByTestId('email').textContent).toBe('riletta@example.com'));
    expect(screen.getByTestId('modules').textContent).toBe(JSON.stringify(MODULES));
  });

  it('una rilettura partita prima del salvataggio e arrivata dopo non riporta indietro modules e modules_chosen', async () => {
    const OLD = { body: false, recovery: false, levels: false, groups: false, ai: false };
    const NEW = { ...OLD, body: true };
    readReturns({ id: 1, username: 'a', modules: OLD, modules_chosen: false });
    localStorage.setItem('isLoggedIn', 'true');
    const Tools = () => {
      const { refreshEmailState, updateUser, user } = useAuth();
      return (
        <>
          <button onClick={refreshEmailState}>rileggi</button>
          <button onClick={() => updateUser({ modules: NEW, modules_chosen: true })}>salva</button>
          <div data-testid="chosen">{String(user?.modules_chosen)}</div>
        </>
      );
    };
    render(<AuthProvider><Modules /><Tools /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('modules').textContent).toBe(JSON.stringify(OLD)));
    // Una lettura che resta in volo
    let release;
    backend.mockImplementation(() => new Promise((resolve) => {
      release = () => resolve(new Response(JSON.stringify({ success: true, id: 1, username: 'a', modules: OLD, modules_chosen: false }), { status: 200 }));
    }));
    fireEvent.click(screen.getByText('rileggi'));
    fireEvent.click(screen.getByText('salva'));
    await waitFor(() => expect(screen.getByTestId('chosen').textContent).toBe('true'));
    await act(async () => { release(); });
    // La lettura vecchia ha finito: il suo risultato (e la rilettura dell'email) è già nel contesto
    await waitFor(() => expect(backend).toHaveBeenCalledTimes(2));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('modules').textContent).toBe(JSON.stringify(NEW));
    expect(screen.getByTestId('chosen').textContent).toBe('true');
    expect(JSON.parse(localStorage.getItem('user'))).toMatchObject({ modules: NEW, modules_chosen: true });
  });

  it('una rilettura partita dopo il salvataggio vale', async () => {
    const OLD = { body: false, recovery: false, levels: false, groups: false, ai: false };
    readReturns({ id: 1, username: 'a', modules: OLD, modules_chosen: false });
    localStorage.setItem('isLoggedIn', 'true');
    const Tools = () => {
      const { refreshEmailState, updateUser } = useAuth();
      return (<><button onClick={refreshEmailState}>rileggi</button><button onClick={() => updateUser({ modules_chosen: true })}>salva</button></>);
    };
    render(<AuthProvider><Modules /><Tools /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('modules').textContent).toBe(JSON.stringify(OLD)));
    fireEvent.click(screen.getByText('salva'));
    readReturns({ id: 1, username: 'a', modules: { ...OLD, groups: true }, modules_chosen: true });
    fireEvent.click(screen.getByText('rileggi'));
    await waitFor(() => expect(screen.getByTestId('modules').textContent).toBe(JSON.stringify({ ...OLD, groups: true })));
  });
});

// Visibilità nei gruppi: da user/read.php dentro `user`; chi non la ha (login, server vecchio) mostra tutto
describe('AuthProvider: visibilità nei gruppi', () => {
  const Vis = () => {
    const { user } = useAuth();
    return <div data-testid="vis">{user ? JSON.stringify(user.group_visibility ?? null) : 'nessun utente'}</div>;
  };
  const OLD = { workouts: true, volume: true, streak: true, level: true };
  const NEW = { ...OLD, volume: false };

  it('user.group_visibility arriva da user/read.php e finisce nella copia locale', async () => {
    readReturns({ id: 1, username: 'a', group_visibility: NEW });
    localStorage.setItem('isLoggedIn', 'true');
    render(<AuthProvider><Vis /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe(JSON.stringify(NEW)));
    expect(JSON.parse(localStorage.getItem('user')).group_visibility).toEqual(NEW);
  });

  it('dopo il login (che risponde senza) la rilettura la porta', async () => {
    readReturns({ id: 1, username: 'a', group_visibility: NEW });
    const Login = () => {
      const { login } = useAuth();
      return <button onClick={() => login({ id: 1, username: 'a' })}>entra</button>;
    };
    render(<AuthProvider><Vis /><Login /></AuthProvider>);
    fireEvent.click(screen.getByText('entra'));
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe(JSON.stringify(NEW)));
  });

  it('un server senza il campo lascia user senza group_visibility', async () => {
    readReturns({ id: 1, username: 'a' });
    localStorage.setItem('isLoggedIn', 'true');
    render(<AuthProvider><Vis /></AuthProvider>);
    await waitFor(() => expect(backend).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe('null'));
  });

  it('una rilettura partita prima del salvataggio e arrivata dopo non riporta indietro group_visibility', async () => {
    readReturns({ id: 1, username: 'a', group_visibility: OLD });
    localStorage.setItem('isLoggedIn', 'true');
    const Tools = () => {
      const { refreshEmailState, updateUser } = useAuth();
      return (
        <>
          <button onClick={refreshEmailState}>rileggi</button>
          <button onClick={() => updateUser({ group_visibility: NEW })}>salva</button>
        </>
      );
    };
    render(<AuthProvider><Vis /><Tools /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe(JSON.stringify(OLD)));
    let release;
    backend.mockImplementation(() => new Promise((resolve) => {
      release = () => resolve(new Response(JSON.stringify({ success: true, id: 1, username: 'a', group_visibility: OLD }), { status: 200 }));
    }));
    fireEvent.click(screen.getByText('rileggi'));
    fireEvent.click(screen.getByText('salva'));
    await waitFor(() => expect(screen.getByTestId('vis').textContent).toBe(JSON.stringify(NEW)));
    await act(async () => { release(); });
    await waitFor(() => expect(backend).toHaveBeenCalledTimes(2));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('vis').textContent).toBe(JSON.stringify(NEW));
    expect(JSON.parse(localStorage.getItem('user')).group_visibility).toEqual(NEW);
  });
});
