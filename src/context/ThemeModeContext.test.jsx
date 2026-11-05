// Font dei chip, uguale all'app: Lexend 500 su quelli che si premono, i badge restano Inter.
// Titolo di pagina: Lexend 800 a 28px, un <h1>. Bottone pieno di errore: rosso del marchio #d50000 con testo bianco,
// anche in scuro; disabilitato resta grigio (scuro: fondo bianco al 12%, testo bianco al 30%).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useTheme } from '@mui/material/styles';
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

// Token nuovi del tema (issue #15): stessi valori letterali di oggi, fonte indipendente dal codice
// che li produce. I valori di partenza sono quelli già in WorkoutHistory, WorkoutPlans, Navbar,
// Account, LeaderboardTable, BodyStats/HealthAppHint e la chip "nuovo record" di SummaryPhase.
describe('tema: token nuovi', () => {
  afterEach(() => localStorage.clear());

  const palette = (mode) => {
    localStorage.setItem('themeMode', mode);
    let captured;
    const Probe = () => {
      captured = useTheme().palette;
      return null;
    };
    render(<ThemeModeProvider><Probe /></ThemeModeProvider>);
    return captured;
  };

  it('in chiaro ha i valori di oggi', () => {
    const p = palette('light');
    expect(p.background.subtle).toBe('#faf9f8');
    expect(p.success.muted).toBe('#e8f3ec');
    expect(p.success.title).toBe('#166534');
    expect(p.navToggle.bg).toBe('#f7f6f5');
    expect(p.navToggle.hover).toBe('#ececea');
    expect(p.ink).toBe('#1a1816');
    expect(p.onInk).toBe('#ffffff');
  });

  it('in scuro i valori coincidono con quelli scuri già in uso; ink/onInk si invertono', () => {
    const p = palette('dark');
    expect(p.background.subtle).toBe('rgba(255, 255, 255, 0.08)');
    expect(p.success.muted).toBe('rgba(34, 197, 94, 0.15)');
    expect(p.success.title).toBe('#86efac');
    expect(p.navToggle.bg).toBe('rgba(255, 255, 255, 0.06)');
    expect(p.navToggle.hover).toBe('rgba(255, 255, 255, 0.12)');
    // Decisione utente: in scuro l'avatar si inverte (fondo bianco, iniziale scura)
    expect(p.ink).toBe('#ffffff');
    expect(p.onInk).toBe('#0a0a0b');
  });

  it('medaglie, Salute e chip "nuovo record" sono uguali in chiaro e in scuro', () => {
    const light = palette('light');
    const dark = palette('dark');
    for (const p of [light, dark]) {
      expect(p.medal).toEqual({ gold: '#d4a017', silver: '#9e9e9e', bronze: '#b87333' });
      expect(p.health).toBe('#ff2d55');
      expect(p.warning.muted).toBe('rgba(255, 167, 38, 0.15)');
    }
  });
});
