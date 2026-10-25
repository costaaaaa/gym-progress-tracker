// Il link di recupero porta il token nell'indirizzo: la pagina lo tiene in memoria e lo toglie da barra e cronologia.
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

describe('ResetPassword', () => {
  it('toglie il token dall\'indirizzo ma lo manda al server', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/reset-password?token=abc123']}><ResetPassword /></MemoryRouter>,
    );
    expect(window.location.search).toBe('');
    expect(window.location.pathname).toBe('/reset-password');

    fireEvent.change(container.querySelector('#password'), { target: { value: 'Nuova!Pass2026' } });
    fireEvent.change(container.querySelector('#confirm'), { target: { value: 'Nuova!Pass2026' } });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ token: 'abc123', new_password: 'Nuova!Pass2026' });
  });
});
