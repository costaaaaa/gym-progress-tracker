// Gli avvisi stanno sopra la barra in basso del telefono, solo dove la barra c'è. jsdom non risolve env(): qui si
// controlla quello che dice davvero (il calc con l'area sicura e i px sopra l'altezza della barra); il valore
// reale sul telefono resta da guardare in un browser.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Snackbar } from '@mui/material';
import { BottomBarContext, useBottomBarVisible, useSnackbarAboveBar } from './useSnackbarAboveBar';
import { BAR_HEIGHT } from '../components/Layout/barMetrics';

const auth = vi.hoisted(() => ({ value: null }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth.value }));

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

const Notice = ({ stacked }) => <Snackbar open message="Fatto" sx={useSnackbarAboveBar(stacked)} />;
const bottomOf = (barVisible, stacked = false) => {
  const { container } = render(<BottomBarContext.Provider value={barVisible}><Notice stacked={stacked} /></BottomBarContext.Provider>);
  return getComputedStyle(container.querySelector('.MuiSnackbar-root')).bottom;
};
// Distanza dal bordo in px, senza l'area sicura
const px = (bottom) => parseFloat(/calc\(([\d.]+)px/.exec(bottom)[1]);
// Dove la barra non c'è l'avviso resta dov'è di default in MUI: nessuno stile in più
const MUI_DEFAULT = /^(8|24)px$/;

describe('avvisi sopra la barra in basso', () => {
  it('con la barra l\'avviso sta sopra la barra e l\'area sicura', () => {
    const bottom = bottomOf(true);
    expect(bottom).toContain('env(safe-area-inset-bottom)');
    expect(px(bottom)).toBeGreaterThan(BAR_HEIGHT);
    expect(px(bottom)).toBeLessThanOrEqual(BAR_HEIGHT + 24);
  });

  it('senza la barra l\'avviso non sale', () => {
    expect(bottomOf(false)).toMatch(MUI_DEFAULT);
  });

  it('fuori da un Layout (nessun provider) vale «nessuna barra»', () => {
    const { container } = render(<Notice />);
    expect(getComputedStyle(container.querySelector('.MuiSnackbar-root')).bottom).toMatch(MUI_DEFAULT);
  });

  it('il secondo avviso sta sopra il primo, con la barra e senza', () => {
    expect(px(bottomOf(true, true))).toBeGreaterThan(px(bottomOf(true)) + 48);
    expect(parseFloat(bottomOf(false, true))).toBeGreaterThan(24 + 48);
  });
});

describe('dove c\'è la barra in basso', () => {
  const Probe = () => <p>{useBottomBarVisible() ? 'barra' : 'niente barra'}</p>;
  const visibleAt = (path) => {
    render(<MemoryRouter initialEntries={[path]}><Probe /></MemoryRouter>);
    return screen.getByText(/barra/).textContent === 'barra';
  };

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
