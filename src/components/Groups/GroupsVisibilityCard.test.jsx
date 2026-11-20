// Card «Visibilità nei gruppi» dell'Account: senza gruppi il collegamento a /gruppi c'è solo se il modulo Gruppi è attivo.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GroupsVisibilityCard from './GroupsVisibilityCard';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import { json } from '../../test/dom';

const auth = vi.hoisted(() => ({ value: null }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth.value }));

beforeEach(() => {
  localStorage.setItem('themeMode', 'light');
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ success: true, groups: [] }))));
});
afterEach(() => vi.unstubAllGlobals());

const mount = (modules) => {
  auth.value = { user: { id: 1, modules } };
  render(<MemoryRouter><ThemeModeProvider><GroupsVisibilityCard /></ThemeModeProvider></MemoryRouter>);
};

describe('senza gruppi', () => {
  it('con Gruppi attivo il testo ha il collegamento a /gruppi', async () => {
    mount({ groups: true });
    const link = await screen.findByRole('link');
    expect(link.getAttribute('href')).toBe('/gruppi');
  });

  it('con Gruppi non attivo il testo resta e il collegamento no', async () => {
    mount({ groups: false });
    await screen.findByText(/Non sei in nessun gruppo/);
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('fuoco', () => {
  it('il contorno del fuoco non è tolto: nessuna regola outline: none sulla card', async () => {
    mount({ groups: true });
    await screen.findByRole('link');
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent + [...(s.sheet?.cssRules ?? [])].map((r) => r.cssText).join('')).join('');
    expect(css).not.toMatch(/:focus\s*\{[^}]*outline:\s*none/);
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline/);
  });
});
