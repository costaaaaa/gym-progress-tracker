// Le rotte delle Schede: «esercizi» è una pagina a sé, non l'id di una scheda.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import { json } from './test/dom';
import { ThemeModeProvider } from './context/ThemeModeContext';

const reply = (body, status = 200) => Promise.resolve(json(body, status));

beforeEach(() => {
  localStorage.setItem('isLoggedIn', 'true');
  localStorage.setItem('themeMode', 'light');
  vi.stubGlobal('fetch', vi.fn((input) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes('exercise/read_all.php')) {
      return reply({ records: [{ id: 1, name: 'Panca piana', name_it: 'Panca piana', name_en: null, muscle_group: 'petto', equipment: 'bilanciere', is_mine: false, status: 'approved' }] });
    }
    if (url.includes('workout/read_plans.php')) return reply({ records: [{ id: 5, name: 'Push Pull', is_active: 1, days: [] }] });
    if (url.includes('user/read.php')) {
      return reply({ success: true, id: 7, username: 'mario', email: 'mario@example.com', pending_email: null, email_verified: true, email_verification: null, tier: 'free', tier_until: null, tier_last_day: null, signup_code: null });
    }
    return reply({ success: true });
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  window.history.pushState({}, '', '/');
});

describe('rotte delle Schede', () => {
  it('/schede/esercizi apre «Tutti gli esercizi» e non viene letta come la scheda «esercizi»', async () => {
    window.history.pushState({}, '', '/schede/esercizi');
    render(<ThemeModeProvider><App /></ThemeModeProvider>);
    expect(await screen.findByRole('heading', { level: 1, name: 'Tutti gli esercizi' }, { timeout: 3000 })).toBeTruthy();
    await screen.findByText('Panca piana');
    // Una scheda che non c'è riporta a /schede: qui l'indirizzo deve restare quello
    expect(window.location.pathname).toBe('/schede/esercizi');
  }, 10000);

  it('/schede/5 resta la pagina della scheda', async () => {
    window.history.pushState({}, '', '/schede/5');
    render(<ThemeModeProvider><App /></ThemeModeProvider>);
    expect(await screen.findByRole('heading', { level: 1, name: 'Push Pull' }, { timeout: 3000 })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Tutti gli esercizi' })).toBeNull();
  }, 10000);
});
