// Sezione «Livello utente»: ricerca per nome o email, assegnazione del livello con ultimo giorno
// valido facoltativo (disattivato per Gratis), errore del server mostrato.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import AdminTiers from './AdminTiers';
import { json } from '../../test/dom';

const MARIO = { id: 7, username: 'mario', email: 'mario@example.com', tier: 'free', last_day: null, effective_tier: 'free' };

let fetchMock;
let searchResult;
let postResponse;
beforeEach(() => {
  searchResult = [MARIO];
  postResponse = () => json({ success: true, user: { ...MARIO, tier: 'plus', last_day: '2026-12-31', effective_tier: 'plus' } });
  fetchMock = vi.fn((url, opts) => {
    if (opts?.method === 'POST') return Promise.resolve(postResponse(JSON.parse(opts.body)));
    return Promise.resolve(json({ success: true, users: searchResult }));
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllGlobals(); });

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

const cerca = async (q = 'mar') => {
  render(<AdminTiers />);
  fireEvent.change(screen.getByPlaceholderText('Nome o email'), { target: { value: q } });
  fireEvent.click(screen.getByRole('button', { name: 'Cerca' }));
  await flush();
};

const salva = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
  await flush();
};

const ultimaPost = () => JSON.parse(fetchMock.mock.calls.filter(([, o]) => o?.method === 'POST').pop()[1].body);

describe('AdminTiers', () => {
  it('cerca per testo e mostra nome, email e livello attuale', async () => {
    await cerca('mar');
    expect(fetchMock.mock.calls[0][0]).toContain('admin/tiers.php?q=mar');
    expect(screen.getByText('mario')).toBeTruthy();
    expect(screen.getByText('#7 · mario@example.com · Gratis')).toBeTruthy();
  });

  it('nessun risultato: lo dice', async () => {
    searchResult = [];
    await cerca('zzz');
    expect(screen.getByText('Nessun utente trovato.')).toBeTruthy();
  });

  it('la ricerca resta disattivata sotto i 2 caratteri', () => {
    render(<AdminTiers />);
    fireEvent.change(screen.getByPlaceholderText('Nome o email'), { target: { value: 'm' } });
    expect(screen.getByRole('button', { name: 'Cerca' }).disabled).toBe(true);
  });

  it('mostra scadenza o "senza scadenza" del livello attivo', async () => {
    searchResult = [
      { ...MARIO, id: 1, username: 'ana', tier: 'plus', last_day: '2026-12-31', effective_tier: 'plus' },
      { ...MARIO, id: 2, username: 'bob', tier: 'pro', last_day: null, effective_tier: 'pro' },
    ];
    await cerca();
    expect(screen.getByText(/Plus fino al 31\/12\/2026 compreso/)).toBeTruthy();
    expect(screen.getByText(/Pro, senza scadenza/)).toBeTruthy();
  });

  it('livello salvato scaduto: dice quando è scaduto e che di fatto è Gratis', async () => {
    searchResult = [{ ...MARIO, tier: 'plus', last_day: '2026-10-31', effective_tier: 'free' }];
    await cerca();
    expect(screen.getByText(/Plus, scaduto il 31\/10\/2026 \(di fatto Gratis\)/)).toBeTruthy();
  });

  it('salva Plus con ultimo giorno valido e mostra la conferma con il livello aggiornato', async () => {
    await cerca();
    fireEvent.change(screen.getByLabelText('Livello'), { target: { value: 'plus' } });
    fireEvent.change(screen.getByLabelText('Ultimo giorno valido'), { target: { value: '2026-12-31' } });
    await salva();
    expect(ultimaPost()).toEqual({ action: 'set_tier', id: 7, tier: 'plus', last_day: '2026-12-31' });
    expect(screen.getByText('Livello salvato.')).toBeTruthy();
    expect(screen.getByText(/Plus fino al 31\/12\/2026 compreso/)).toBeTruthy();
  });

  it('salva Pro senza data: last_day null', async () => {
    postResponse = () => json({ success: true, user: { ...MARIO, tier: 'pro', last_day: null, effective_tier: 'pro' } });
    await cerca();
    fireEvent.change(screen.getByLabelText('Livello'), { target: { value: 'pro' } });
    await salva();
    expect(ultimaPost()).toEqual({ action: 'set_tier', id: 7, tier: 'pro', last_day: null });
    expect(screen.getByText(/Pro, senza scadenza/)).toBeTruthy();
  });

  it('mostra l\'errore del server e non cambia la riga', async () => {
    postResponse = () => json({ success: false, code: 'invalid_date', message: 'La data 2020-01-01 è già passata (UTC).' }, 400);
    await cerca();
    fireEvent.change(screen.getByLabelText('Livello'), { target: { value: 'plus' } });
    fireEvent.change(screen.getByLabelText('Ultimo giorno valido'), { target: { value: '2020-01-01' } });
    await salva();
    expect(screen.getByText('La data 2020-01-01 è già passata (UTC).')).toBeTruthy();
    expect(screen.queryByText('Livello salvato.')).toBeNull();
    expect(screen.getByText('#7 · mario@example.com · Gratis')).toBeTruthy();
  });

  it('livello scaduto: il campo data parte vuoto, il riepilogo dice ancora "scaduto il"', async () => {
    searchResult = [{ ...MARIO, tier: 'plus', last_day: '2026-10-31', effective_tier: 'free' }];
    await cerca();
    expect(screen.getByLabelText('Ultimo giorno valido').value).toBe('');
    expect(screen.getByText(/Plus, scaduto il 31\/10\/2026/)).toBeTruthy();
  });

  it('nuova ricerca: la riga riparte dai valori del server e senza avviso vecchio', async () => {
    await cerca();
    fireEvent.change(screen.getByLabelText('Livello'), { target: { value: 'plus' } });
    fireEvent.change(screen.getByLabelText('Ultimo giorno valido'), { target: { value: '2026-12-31' } });
    await salva();
    expect(screen.getByText('Livello salvato.')).toBeTruthy();
    searchResult = [{ ...MARIO, tier: 'plus', last_day: '2026-12-31', effective_tier: 'plus' }];
    fireEvent.change(screen.getByLabelText('Livello'), { target: { value: 'pro' } });
    fireEvent.change(screen.getByLabelText('Ultimo giorno valido'), { target: { value: '2027-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cerca' }));
    await flush();
    expect(screen.getByLabelText('Livello').value).toBe('plus');
    expect(screen.getByLabelText('Ultimo giorno valido').value).toBe('2026-12-31');
    expect(screen.queryByText('Livello salvato.')).toBeNull();
  });

  it('con Gratis la data è disattivata e si svuota', async () => {
    searchResult = [{ ...MARIO, tier: 'plus', last_day: '2026-12-31', effective_tier: 'plus' }];
    await cerca();
    const data = screen.getByLabelText('Ultimo giorno valido');
    expect(data.disabled).toBe(false);
    fireEvent.change(screen.getByLabelText('Livello'), { target: { value: 'free' } });
    expect(data.disabled).toBe(true);
    expect(data.value).toBe('');
    await salva();
    expect(ultimaPost()).toEqual({ action: 'set_tier', id: 7, tier: 'free', last_day: null });
  });
});
