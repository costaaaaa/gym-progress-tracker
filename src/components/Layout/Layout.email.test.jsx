// Conferma dell'email nel layout: striscia, schermata di blocco al posto delle pagine, ripartenza dopo la conferma.
// Qui il contesto è quello vero e il confine è la fetch.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Snackbar } from '@mui/material';
import Layout from './Layout';
import { AuthProvider } from '../../context/AuthContext';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import { DRAFT_STORAGE_KEY } from '../../utils/focusDraft';
import { useSnackbarAboveBar } from '../../hooks/useSnackbarAboveBar';
import { expectNoticeAboveBar, expectNoticeInPlace } from '../../test/dom';

const original = window.fetch;
let server;

const unverified = { email_verified: false, email_verification: { deadline: '2026-11-24T10:00:00Z', blocked: false, days_left: 5 } };
const blockedState = { email_verified: false, email_verification: { deadline: '2026-11-17T10:00:00Z', blocked: true, days_left: 0 } };
const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  localStorage.setItem('isLoggedIn', 'true');
  server = { read: { success: true, id: 7, username: 'mario', email: 'mario@example.com', pending_email: null, email_verified: true, email_verification: null, tier: 'free', tier_until: null, tier_last_day: null, signup_code: null } };
  window.fetch = vi.fn((input) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('user/read.php')) return json(server.read);
    if (url.includes('confirm_email.php')) {
      server.read = { ...server.read, email_verified: true, email_verification: null };
      return json(server.confirmBody ?? { success: true, email_verified: true, email: 'mario@example.com' });
    }
    if (url.includes('page.php')) return json({ success: false, code: 'email_unverified', message: 'Conferma la tua email' }, 403);
    return json({ success: true });
  });
});
afterEach(() => {
  window.fetch = original;
  localStorage.clear();
});

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const Page = () => <h1>Pagina dell'app</h1>;
const LoginPage = () => <h1>Accesso</h1>;
const CallsServer = () => (
  <button onClick={() => window.fetch('/backend/api/page.php')}>carica</button>
);
// Una pagina dell'app con un suo avviso di esito
const PageWithNotice = () => <Snackbar open message="Fatto" sx={useSnackbarAboveBar()} />;

const mount = (path = '/schede') => render(
  <MemoryRouter initialEntries={[path]}>
    <ThemeModeProvider>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/schede" element={<><Page /><CallsServer /></>} />
            <Route path="/storico" element={<PageWithNotice />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/en/login" element={<LoginPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ThemeModeProvider>
  </MemoryRouter>,
);

describe('email non ancora confermata, entro i 7 giorni', () => {
  beforeEach(() => { server.read = { ...server.read, ...unverified }; localStorage.setItem('lx_email_reminder_7', today()); }); // promemoria di oggi già mostrato

  it('la pagina c\'è e sotto la barra in alto compare la striscia con i giorni rimasti', async () => {
    mount();
    expect(await screen.findByText('Conferma la tua email: ti restano 5 giorni.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Pagina dell\'app' })).toBeTruthy();
  });

  it('il comando della striscia apre la finestra e il codice giusto la chiude con l\'avviso e senza striscia', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Scrivi il codice' }));
    const dialog = await screen.findByRole('dialog', { name: 'Conferma la tua email' });
    fireEvent.change(within(dialog).getByLabelText(/^Codice di 6 cifre/), { target: { value: '123456' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Conferma' }));
    expect(await screen.findByText('Email confermata.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Conferma dell\'email' })).toBeNull());
  });

  it('un 403 email_unverified a pagina aperta (scadenza passata) porta alla schermata di blocco senza uscire', async () => {
    mount();
    await screen.findByText(/ti restano 5 giorni/);
    server.read = { ...server.read, ...blockedState };
    fireEvent.click(screen.getByText('carica'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Conferma la tua email per continuare' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Pagina dell\'app' })).toBeNull();
    expect(localStorage.getItem('isLoggedIn')).toBe('true');
  });
});

describe('email non confermata dal giorno 8', () => {
  beforeEach(() => { server.read = { ...server.read, ...blockedState }; });

  it('al posto della pagina c\'è la schermata di conferma, senza striscia né finestra', async () => {
    mount();
    expect(await screen.findByRole('heading', { level: 1, name: 'Conferma la tua email per continuare' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Pagina dell\'app' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Conferma dell\'email' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('non ci sono voci di navigazione verso pagine che darebbero 403', async () => {
    mount();
    await screen.findByRole('heading', { level: 1, name: 'Conferma la tua email per continuare' });
    expect(screen.queryByRole('link', { name: 'Schede' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Progressi' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Profilo' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Navigazione principale' })).toBeNull();
  });

  it('dopo la conferma l\'app riparte senza ricaricare: torna la pagina', async () => {
    mount();
    await screen.findByRole('heading', { level: 1, name: 'Conferma la tua email per continuare' });
    fireEvent.change(screen.getByLabelText(/^Codice di 6 cifre/), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }));
    expect(await screen.findByRole('heading', { name: 'Pagina dell\'app' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: 'Conferma la tua email per continuare' })).toBeNull();
    expect(await screen.findByText('Email confermata.')).toBeTruthy();
  });

  it('con un codice di registrazione, la conferma da bloccati mostra il messaggio del server', async () => {
    const message = 'Email confermata. Plus attivo fino al 15 febbraio 2027.';
    server.confirmBody = { success: true, message, email_verified: true, email: 'mario@example.com', signup_code: { status: 'applied', tier: 'plus', tier_last_day: '2027-02-15' } };
    mount();
    await screen.findByRole('heading', { level: 1, name: 'Conferma la tua email per continuare' });
    fireEvent.change(screen.getByLabelText(/^Codice di 6 cifre/), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }));
    expect(await screen.findByRole('heading', { name: 'Pagina dell\'app' })).toBeTruthy();
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByText('Email confermata.')).toBeNull();
  });

  it.each(['/login', '/en/login'])('le pagine di accesso restano raggiungibili (%s)', async (path) => {
    mount(path);
    expect(await screen.findByRole('heading', { name: 'Accesso' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: 'Conferma la tua email per continuare' })).toBeNull();
  });
});

describe('email confermata o non ancora letta', () => {
  it('confermata: nessuna striscia, nessuna finestra, la pagina c\'è', async () => {
    mount();
    expect(await screen.findByRole('heading', { name: 'Pagina dell\'app' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Conferma dell\'email' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('non confermata con un allenamento Focus in corso: niente finestra da sola, la striscia c\'è', async () => {
    server.read = { ...server.read, ...unverified };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ selectedDay: { id: 3 }, selectedDayId: 3, startTime: 1000 }));
    mount();
    expect(await screen.findByText(/ti restano 5 giorni/)).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('non confermata, primo giorno senza finestra mostrata: all\'apertura la finestra compare da sola, con «Più tardi»', async () => {
    server.read = { ...server.read, ...unverified };
    mount();
    const dialog = await screen.findByRole('dialog', { name: 'Conferma la tua email' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Più tardi' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText(/ti restano 5 giorni/)).toBeTruthy();
  });
});

// «Cosa ti interessa?» arriva dopo la conferma dell'email e dopo l'avviso di esito, mai sotto l'avviso
describe('schermata «Cosa ti interessa?» dopo la conferma', () => {
  const choice = () => screen.queryByRole('dialog', { name: 'Cosa ti interessa?' });

  it('subito dopo la conferma non compare nemmeno per un render; chiuso l\'avviso, compare', async () => {
    server.read = { ...server.read, ...unverified, modules_chosen: false };
    localStorage.setItem('lx_email_reminder_7', today());
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Scrivi il codice' }));
    const dialog = await screen.findByRole('dialog', { name: 'Conferma la tua email' });
    fireEvent.change(within(dialog).getByLabelText(/^Codice di 6 cifre/), { target: { value: '123456' } });
    // Da qui fino alla chiusura dell'avviso la finestra dei moduli non deve mai essere nel documento, nemmeno per un render
    let seenWithNotice = false;
    const observer = new MutationObserver(() => {
      if (choice()) seenWithNotice = true;
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Conferma' }));
    expect(await screen.findByText('Email confermata.')).toBeTruthy();
    await new Promise((resolve) => { setTimeout(resolve, 50); });
    observer.disconnect();
    expect(seenWithNotice).toBe(false);
    expect(choice()).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: /chiudi|close/i }));
    expect(await screen.findByRole('dialog', { name: 'Cosa ti interessa?' })).toBeTruthy();
  });

  it('senza nessun avviso in corso (pagina ricaricata) si apre subito', async () => {
    server.read = { ...server.read, modules_chosen: false };
    mount();
    expect(await screen.findByRole('dialog', { name: 'Cosa ti interessa?' })).toBeTruthy();
  });
});


// Gli avvisi delle pagine stanno sopra la barra in basso del telefono, dove la barra c'è
describe('avvisi e barra in basso', () => {
  const realMatchMedia = window.matchMedia;
  const phone = (isPhone) => {
    window.matchMedia = (query) => ({
      matches: isPhone && query.includes('max-width'),
      media: query,
      addEventListener: () => {}, removeEventListener: () => {},
      addListener: () => {}, removeListener: () => {},
    });
  };
  afterEach(() => { window.matchMedia = realMatchMedia; });

  const confirmWithCode = async () => {
    server.read = { ...server.read, ...unverified };
    localStorage.setItem('lx_email_reminder_7', today());
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Scrivi il codice' }));
    const dialog = await screen.findByRole('dialog', { name: 'Conferma la tua email' });
    fireEvent.change(within(dialog).getByLabelText(/^Codice di 6 cifre/), { target: { value: '123456' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Conferma' }));
    const notice = await screen.findByRole('alert');
    expect(notice.textContent).toContain('Email confermata.');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    return notice;
  };

  it('sul telefono l\'avviso di una pagina sta sopra la barra, che c\'è', async () => {
    phone(true);
    mount('/storico');
    await screen.findByRole('navigation', { name: 'Navigazione principale' });
    expectNoticeAboveBar(screen.getByText('Fatto'));
  });

  it('da md in su, senza barra, l\'avviso di una pagina resta dov\'è', async () => {
    phone(false);
    mount('/storico');
    await screen.findByText('Fatto');
    expect(screen.queryByRole('navigation', { name: 'Navigazione principale' })).toBeNull();
    expectNoticeInPlace(screen.getByText('Fatto'));
  });

  it('sul telefono l\'avviso di esito dell\'email sta sopra la barra, che c\'è', async () => {
    phone(true);
    const notice = await confirmWithCode();
    expect(screen.getByRole('navigation', { name: 'Navigazione principale' })).toBeTruthy();
    expectNoticeAboveBar(notice);
  });

  it('da md in su, senza barra, l\'avviso resta dov\'è', async () => {
    phone(false);
    const notice = await confirmWithCode();
    expect(screen.queryByRole('navigation', { name: 'Navigazione principale' })).toBeNull();
    expectNoticeInPlace(notice);
  });

  it('con l\'email bloccata, senza barra, l\'avviso della schermata di conferma non sale', async () => {
    phone(true);
    server.read = { ...server.read, ...blockedState };
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Esporta i miei dati' }));
    expect(screen.queryByRole('navigation', { name: 'Navigazione principale' })).toBeNull();
    const notice = await screen.findByRole('alert');
    expect(notice.textContent).toContain('Download completato con successo');
    expectNoticeInPlace(notice);
  });
});
