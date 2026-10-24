// Font dei chip, uguale all'app: Lexend 500 su quelli che si premono, i badge restano Inter.
// Titolo di pagina: Lexend 800 a 28px, un <h1>.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Chip, Typography } from '@mui/material';
import { ThemeModeProvider } from './ThemeModeContext';

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
