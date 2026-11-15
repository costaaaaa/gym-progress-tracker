// Barra di navigazione mobile: il rosso della voce attiva e dell'etichetta Focus è un testo, in scuro il rosso chiaro.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BottomNav from './BottomNav';
import { ThemeModeProvider } from '../../context/ThemeModeContext';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { username: 'atleta_demo' }, isLoggedIn: true, loading: false }),
}));

beforeEach(() => {
  window.matchMedia = (query) => ({
    matches: query.includes('max-width'), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  });
});

const renderNav = (mode) => {
  localStorage.setItem('themeMode', mode);
  render(<MemoryRouter initialEntries={['/']}><ThemeModeProvider><BottomNav /></ThemeModeProvider></MemoryRouter>);
};
const labelColor = (label) => getComputedStyle(screen.getByText(label)).color;

describe.each([
  ['light', 'rgb(213, 0, 0)'],
  ['dark', 'rgb(255, 82, 82)'],
])('barra mobile in %s', (mode, red) => {
  it('la voce attiva e l\'etichetta Focus hanno il rosso dei testi', () => {
    renderNav(mode);
    expect(labelColor('Home')).toBe(red);
    expect(labelColor('Focus')).toBe(red);
  });
});

// Ogni voce riempie la sua cella fino al bordo dello schermo: il contorno del focus sta dentro la cella, non fuori
describe('barra mobile: focus da tastiera', () => {
  it.each(['Home', 'Focus', 'Profilo'])('la voce %s ha il contorno del tema dentro la cella', (name) => {
    renderNav('light');
    const link = screen.getAllByRole('link').find((a) => a.textContent.includes(name));
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => link.focus());
    expect(getComputedStyle(link).outline).toBe('2px solid #1a1816');
    expect(getComputedStyle(link).outlineOffset).toBe('-4px');
  });
});
