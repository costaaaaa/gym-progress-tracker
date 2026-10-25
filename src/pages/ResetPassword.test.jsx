// Il link di recupero porta il token nell'indirizzo (nel fragment, o nella query dei vecchi link):
// la pagina lo tiene in memoria e lo toglie da barra e cronologia.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResetPassword from './ResetPassword';

beforeEach(() => {
  window.history.replaceState(null, '', '/reset-password?token=abc123');
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true }) })));
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

const NEW_PASSWORD = 'Nuova!Pass2026';

const submitNewPassword = async (container) => {
  fireEvent.change(container.querySelector('#password'), { target: { value: NEW_PASSWORD } });
  fireEvent.change(container.querySelector('#confirm'), { target: { value: NEW_PASSWORD } });
  fireEvent.submit(container.querySelector('form'));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  return JSON.parse(fetch.mock.calls[0][1].body);
};

describe('ResetPassword', () => {
  it.each([
    ['nel fragment', '/reset-password#token=abc123'],
    ['nella query (vecchi link)', '/reset-password?token=abc123'],
  ])('legge il token %s, lo toglie dall\'indirizzo e lo manda al server', async (_name, url) => {
    window.history.replaceState(null, '', url);
    const { container } = render(
      <MemoryRouter initialEntries={[url]}><ResetPassword /></MemoryRouter>,
    );
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/reset-password');

    expect(await submitNewPassword(container)).toEqual({ token: 'abc123', new_password: NEW_PASSWORD });
  });
});
