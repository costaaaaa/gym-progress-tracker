// Font dei chip, uguale all'app: Lexend 500 su quelli che si premono, i badge restano Inter.
// Titolo di pagina: Lexend 800 a 28px, un <h1>. Bottone pieno di errore: rosso del marchio #d50000 con testo bianco,
// anche in scuro; disabilitato resta grigio (scuro: fondo bianco al 12%, testo bianco al 30%).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { useTheme } from '@mui/material/styles';
import { Button, CardActionArea, Chip, CssBaseline, IconButton, Link, MenuItem, Slider, Switch, Tab, Tabs, TextField, Typography } from '@mui/material';
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

// Token nuovi del tema (issue #15): stessi valori letterali, fonte indipendente dal codice che li
// produce. I valori di partenza sono quelli già in WorkoutHistory, WorkoutPlans, Navbar, Account,
// LeaderboardTable, BodyStats/HealthAppHint e la chip "nuovo record" di SummaryPhase.
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

  it('in chiaro ha i valori attesi', () => {
    const p = palette('light');
    expect(p.background.subtle).toBe('#faf9f8');
    expect(p.success.muted).toBe('#e8f3ec');
    expect(p.success.title).toBe('#166534');
    expect(p.navToggle.bg).toBe('#f7f6f5');
    expect(p.navToggle.hover).toBe('#ececea');
    expect(p.ink).toBe('#1a1816');
    expect(p.onInk).toBe('#ffffff');
  });

  it('in scuro ha i valori attesi, ink e onInk compresi', () => {
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

// Rapporto di contrasto WCAG 2.1 tra due colori rgb()/#rrggbb opachi
const channels = (css) => (css.startsWith('#')
  ? [1, 3, 5].map((i) => parseInt(css.slice(i, i + 2), 16))
  : css.match(/[\d.]+/g).slice(0, 3).map(Number));
const luminance = (css) => {
  const [r, g, b] = channels(css).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const PAPER = { light: '#ffffff', dark: '#141416' };

const renderThemed = (mode, ui) => {
  localStorage.setItem('themeMode', mode);
  return render(<ThemeModeProvider><CssBaseline />{ui}</ThemeModeProvider>);
};

// Tastiera: il focus arriva dopo un tasto, come con Tab; col mouse no.
const focusByKeyboard = (el) => {
  fireEvent.keyDown(document.body, { key: 'Tab' });
  act(() => el.focus());
};
const focusByMouse = (el) => {
  fireEvent.mouseDown(el);
  act(() => el.focus());
};

describe('tema: bordo dei campi (1.4.11)', () => {
  afterEach(() => localStorage.clear());
  const outline = (mode, props = {}) => {
    const { container } = renderThemed(mode, <TextField label="Peso" {...props} />);
    return getComputedStyle(container.querySelector('.MuiOutlinedInput-notchedOutline')).borderTopColor;
  };

  it.each(['light', 'dark'])('in %s il bordo a riposo ha almeno 3:1 sullo sfondo della card, senza arrivare al testo secondario', (mode) => {
    const ratio = contrast(outline(mode), PAPER[mode]);
    expect(ratio).toBeGreaterThanOrEqual(3.2);
    expect(ratio).toBeLessThanOrEqual(3.8);
  });

  it('in chiaro ha almeno 3:1 anche sullo sfondo della pagina (#f7f6f5)', () => {
    expect(contrast(outline('light'), '#f7f6f5')).toBeGreaterThanOrEqual(3);
  });

  it.each(['light', 'dark'])('in %s il campo disabilitato non prende il nuovo bordo', (mode) => {
    expect(outline(mode, { disabled: true })).not.toBe(outline(mode));
  });
});

describe('tema: rosso come testo in scuro (1.4.3)', () => {
  afterEach(() => localStorage.clear());
  const colorOfButton = (mode, ui, name) => {
    renderThemed(mode, ui);
    return getComputedStyle(screen.getByRole('button', { name })).color;
  };

  it('il token primary.text è il rosso del marchio in chiaro e il rosso chiaro in scuro', () => {
    let captured;
    const Probe = () => { captured = useTheme().palette.primary; return null; };
    localStorage.setItem('themeMode', 'light');
    const { unmount } = render(<ThemeModeProvider><Probe /></ThemeModeProvider>);
    expect(captured.text).toBe('#d50000');
    unmount();
    localStorage.setItem('themeMode', 'dark');
    render(<ThemeModeProvider><Probe /></ThemeModeProvider>);
    expect(captured.text).toBe('#ff5252');
  });

  it('l\'etichetta del campo a fuoco in scuro ha almeno 4,5:1; in chiaro resta rossa', () => {
    const labelColor = (mode) => {
      renderThemed(mode, <TextField label="Utente" focused />);
      const color = getComputedStyle(screen.getByText('Utente', { selector: 'label' })).color;
      cleanup();
      return color;
    };
    expect(contrast(labelColor('dark'), PAPER.dark)).toBeGreaterThanOrEqual(4.5);
    expect(labelColor('light')).toBe(RED);
  });

  it('in scuro l\'etichetta del campo in errore e a fuoco ha almeno 4,5:1 di contrasto', () => {
    renderThemed('dark', <TextField label="Utente" focused error />);
    const { color } = getComputedStyle(screen.getByText('Utente', { selector: 'label' }));
    expect(contrast(color, PAPER.dark)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['bottone di testo', <Button color="primary">Annulla</Button>],
    ['bottone con bordo', <Button variant="outlined" color="primary">Annulla</Button>],
    ['icona', <IconButton color="primary" aria-label="Annulla" />],
    ['chip con bordo', <Chip variant="outlined" color="primary" label="Annulla" onClick={() => {}} />],
  ])('in scuro: %s primario ha almeno 4,5:1; in chiaro resta rosso', (_, ui) => {
    const color = (mode) => {
      const value = colorOfButton(mode, ui, 'Annulla');
      cleanup();
      return value;
    };
    expect(contrast(color('dark'), PAPER.dark)).toBeGreaterThanOrEqual(4.5);
    expect(color('light')).toBe(RED);
  });

  it('in scuro il bottone pieno resta rosso del marchio con testo bianco', () => {
    renderThemed('dark', <Button variant="contained">Salva</Button>);
    const { backgroundColor, color } = getComputedStyle(screen.getByRole('button', { name: 'Salva' }));
    expect({ backgroundColor, color }).toEqual({ backgroundColor: RED, color: WHITE });
  });
});

describe('tema: focus visibile da tastiera (2.4.7)', () => {
  afterEach(() => localStorage.clear());
  const outlineOf = (el) => {
    const { outline, outlineOffset } = getComputedStyle(el);
    return { outline, outlineOffset };
  };
  const INK = { light: '#1a1816', dark: '#ffffff' };
  const controls = [
    ['bottone', () => <Button>Vai</Button>, () => screen.getByRole('button', { name: 'Vai' })],
    ['bottone senza ripple', () => <Button disableRipple>Vai</Button>, () => screen.getByRole('button', { name: 'Vai' })],
    ['icona', () => <IconButton aria-label="Vai" />, () => screen.getByRole('button', { name: 'Vai' })],
    ['chip che si preme', () => <Chip label="Vai" onClick={() => {}} />, () => screen.getByRole('button', { name: 'Vai' })],
    ['scheda', () => <Tabs value={0}><Tab label="Vai" /></Tabs>, () => screen.getByRole('tab', { name: 'Vai' }), '-2px'],
    ['voce di menu', () => <MenuItem>Vai</MenuItem>, () => screen.getByRole('menuitem', { name: 'Vai' }), '-2px'],
    ['link MUI', () => <Link href="/x">Vai</Link>, () => screen.getByRole('link', { name: 'Vai' })],
    ['area cliccabile di una card', () => <CardActionArea>Vai</CardActionArea>, () => screen.getByRole('button', { name: 'Vai' }), '-2px'],
  ];

  it('interruttore: il contorno resta dentro il suo contenitore che taglia', () => {
    renderThemed('light', <Switch inputProps={{ 'aria-label': 'Vai' }} />);
    const input = screen.getByRole('checkbox', { name: 'Vai' });
    focusByKeyboard(input);
    expect(outlineOf(input.parentElement)).toEqual({ outline: `2px solid ${INK.light}`, outlineOffset: '-2px' });
  });

  it('cursore dello slider: contorno pieno da tastiera, sul cursore', () => {
    renderThemed('dark', <Slider aria-label="Zoom" />);
    const input = screen.getByRole('slider', { name: 'Zoom' });
    focusByKeyboard(input);
    expect(outlineOf(input.parentElement)).toEqual({ outline: `2px solid ${INK.dark}`, outlineOffset: '2px' });
  });

  // Schede e voci di menu stanno in contenitori che tagliano: il contorno resta dentro la voce
  it.each(controls)('%s: con la tastiera ha un contorno pieno di 2px nel colore del testo', (_, ui, find, offset = '2px') => {
    for (const mode of ['light', 'dark']) {
      renderThemed(mode, ui());
      focusByKeyboard(find());
      expect(outlineOf(find())).toEqual({ outline: `2px solid ${INK[mode]}`, outlineOffset: offset });
      cleanup();
    }
  });

  it.each(controls.slice(0, 6))('%s: col mouse non compare alcun contorno', (_, ui, find) => {
    renderThemed('light', ui());
    focusByMouse(find());
    expect(outlineOf(find()).outline).not.toMatch(/solid/);
  });

  it('il link semplice <a> ha lo stesso contorno su :focus-visible (jsdom non lo valuta: si legge la regola)', () => {
    renderThemed('dark', <a href="/x">Vai</a>);
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('');
    expect(css).toMatch(/a:focus-visible\{[^}]*outline:2px solid #ffffff;[^}]*outline-offset:2px/);
  });

  it('il <button> nativo ha lo stesso contorno su :focus-visible, i bottoni MUI no (lo hanno con .Mui-focusVisible)', () => {
    renderThemed('light', <button type="button">Vai</button>);
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('');
    expect(css).toMatch(/button:not\(\.MuiButtonBase-root\):focus-visible\{[^}]*outline:2px solid #1a1816;[^}]*outline-offset:2px/);
    expect(css).not.toMatch(/(^|[,}])button:focus-visible/);
  });
});
