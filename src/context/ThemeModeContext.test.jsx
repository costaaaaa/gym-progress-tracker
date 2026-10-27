// Font dei chip, uguale all'app: Lexend 500 su quelli che si premono, i badge restano Inter.
// Titolo di pagina: Lexend 800 a 28px, un <h1>. Bottone pieno di errore: rosso del marchio #d50000 con testo bianco,
// anche in scuro; disabilitato resta grigio (scuro: fondo bianco al 12%, testo bianco al 30%).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button, Chip, Typography } from '@mui/material';
import { ThemeModeProvider } from './ThemeModeContext';

const RED = 'rgb(213, 0, 0)';
const WHITE = 'rgb(255, 255, 255)';
const DISABLED_BG_DARK = 'rgba(255, 255, 255, 0.12)';
const DISABLED_TEXT_DARK = 'rgba(255, 255, 255, 0.3)';

const font = (label) => {
  const { fontFamily, fontWeight } = getComputedStyle(screen.getByText(label).closest('.MuiChip-root'));
  return { fontFamily, fontWeight };
};

describe('tema: chip', () => {
  it('un chip che si preme è in Lexend 500', () => {
    render(<ThemeModeProvider><Chip label="3M" onClick={() => {}} /></ThemeModeProvider>);
    expect(font('3M')).toEqual({ fontFamily: '"Lexend", sans-serif', fontWeight: '500' });
  });

  it('un badge resta Inter', () => {
    render(<ThemeModeProvider><Chip label="PR" /></ThemeModeProvider>);
    expect(font('PR').fontFamily).toMatch(/^"Inter"/);
  });
});

describe('tema: titolo di pagina', () => {
  it('la variante pageTitle è un <h1> in Lexend 800 a 28px', () => {
    render(<ThemeModeProvider><Typography variant="pageTitle">Le mie schede</Typography></ThemeModeProvider>);
    const { fontFamily, fontWeight, fontSize, letterSpacing } = getComputedStyle(
      screen.getByRole('heading', { level: 1, name: 'Le mie schede' }),
    );
    expect({ fontFamily, fontWeight, fontSize, letterSpacing }).toEqual({
      fontFamily: '"Lexend", sans-serif',
      fontWeight: '800',
      fontSize: '28px',
      letterSpacing: '-0.56px', // -0.02em di 28px, già risolto da jsdom
    });
  });
});

describe('tema: numero grande', () => {
  it('la variante statNumber è un <p> in Lexend 700 a 22px con cifre tabulari', () => {
    render(<ThemeModeProvider><Typography variant="statNumber">184.250</Typography></ThemeModeProvider>);
    const el = screen.getByText('184.250');
    const { fontFamily, fontWeight, fontSize, fontVariantNumeric } = getComputedStyle(el);
    expect(el.tagName).toBe('P');
    expect({ fontFamily, fontWeight, fontSize, fontVariantNumeric }).toEqual({
      fontFamily: '"Lexend", sans-serif',
      fontWeight: '700',
      fontSize: '22px',
      fontVariantNumeric: 'tabular-nums',
    });
  });
});

describe('tema: bottone pieno di errore', () => {
  afterEach(() => localStorage.clear());
  const style = (mode, disabled = false) => {
    localStorage.setItem('themeMode', mode);
    render(<ThemeModeProvider><Button variant="contained" color="error" disabled={disabled}>Elimina</Button></ThemeModeProvider>);
    const { backgroundColor, color } = getComputedStyle(screen.getByRole('button', { name: 'Elimina' }));
    return { backgroundColor, color };
  };

  it('in chiaro è il rosso del marchio con testo bianco', () => {
    expect(style('light')).toEqual({ backgroundColor: RED, color: WHITE });
  });

  it('in scuro è lo stesso rosso del marchio con testo bianco, non il #ff5252 dei testi', () => {
    expect(style('dark')).toEqual({ backgroundColor: RED, color: WHITE });
  });

  it('in scuro, disabilitato (conferma in corso) resta grigio e non diventa rosso del marchio', () => {
    const { backgroundColor, color } = style('dark', true);
    expect(backgroundColor).toBe(DISABLED_BG_DARK);
    expect(color).toBe(DISABLED_TEXT_DARK);
  });
});
