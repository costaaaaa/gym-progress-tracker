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
});
