// L'intercettore di fetch controlla l'indirizzo anche quando fetch riceve un Request o un URL, non solo una stringa.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { AuthProvider } from './AuthContext';

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
