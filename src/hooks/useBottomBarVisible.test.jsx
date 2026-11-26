// Dove c'è la barra in basso: la regola che usano la barra e, attraverso il Layout, gli avvisi delle pagine
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useBottomBarVisible } from './useBottomBarVisible';

const auth = vi.hoisted(() => ({ value: null }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.value }));

const realMatchMedia = window.matchMedia;
let mobile = true;
beforeEach(() => {
  mobile = true;
  auth.value = { isLoggedIn: true, emailState: null };
  window.matchMedia = (query) => ({
    matches: query.includes('max-width') && mobile,
    media: query,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {},
  });
});
afterEach(() => { window.matchMedia = realMatchMedia; });

const Probe = () => <p>{useBottomBarVisible() ? 'barra' : 'niente barra'}</p>;
const visibleAt = (path) => {
  render(<MemoryRouter initialEntries={[path]}><Probe /></MemoryRouter>);
  return screen.getByText(/barra/).textContent === 'barra';
};

describe('dove c\'è la barra in basso', () => {
  it('sul telefono, con l\'accesso fatto', () => {
    expect(visibleAt('/storico')).toBe(true);
  });

  it.each([
    ['da md in su', () => { mobile = false; }, '/storico'],
    ['senza accesso', () => { auth.value = { isLoggedIn: false }; }, '/storico'],
    ['con l\'email bloccata', () => { auth.value = { isLoggedIn: true, emailState: { blocked: true } }; }, '/storico'],
    ['in Focus', () => {}, '/focus'],
  ])('non c\'è %s', (_, setup, path) => {
    setup();
    expect(visibleAt(path)).toBe(false);
  });
});
