// Font dei chip, uguale all'app: Lexend 500 su quelli che si premono, i badge restano Inter.
// Titolo di pagina: Lexend 800 a 28px, un <h1>. Bottone pieno di errore: rosso del marchio #d50000 con testo bianco,
// anche in scuro; disabilitato resta grigio (scuro: fondo bianco al 12%, testo bianco al 30%).
import { describe, it, expect, afterEach, vi } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { useTheme } from '@mui/material/styles';
import { BottomNavigation, BottomNavigationAction, Button, CardActionArea, Chip, CircularProgress, CssBaseline, Dialog, DialogActions, DialogContent, IconButton, Link, MenuItem, Slider, Switch, Tab, Tabs, TextField, Typography } from '@mui/material';
import { ThemeModeProvider, useThemeMode } from './ThemeModeContext';

const RED = 'rgb(213, 0, 0)';
const WHITE = 'rgb(255, 255, 255)';
const INK_LIGHT = 'rgb(26, 24, 22)';
const ERROR_DARK = 'rgb(255, 82, 82)';
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

describe('tema: piede delle finestre', () => {
  it('ha lo stesso margine laterale del contenuto e 16 px sotto, senza che la finestra lo imposti', () => {
    render(
      <ThemeModeProvider>
        <Dialog open>
          <DialogContent>Testo</DialogContent>
          <DialogActions><Button>Annulla</Button><Button variant="contained">Salva</Button></DialogActions>
        </Dialog>
      </ThemeModeProvider>,
    );
    const content = getComputedStyle(screen.getByText('Testo'));
    const footer = getComputedStyle(screen.getByRole('button', { name: 'Salva' }).parentElement);
    expect(content.paddingLeft).toBe('24px');
    expect(footer.paddingLeft).toBe(content.paddingLeft);
    expect(footer.paddingRight).toBe(content.paddingLeft);
    expect(footer.paddingBottom).toBe('16px');
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

  it('la voce selezionata di BottomNavigationAction è rossa come testo: in scuro ha almeno 4,5:1', () => {
    const selectedColor = (mode) => {
      renderThemed(mode, <BottomNavigation value={0}><BottomNavigationAction label="Home" /></BottomNavigation>);
      const color = getComputedStyle(screen.getByRole('button', { name: 'Home' })).color;
      cleanup();
      return color;
    };
    expect(contrast(selectedColor('dark'), PAPER.dark)).toBeGreaterThanOrEqual(4.5);
    expect(selectedColor('light')).toBe(RED);
  });

  it('l\'etichetta del campo a fuoco è del colore del testo principale, con almeno 4,5:1 di contrasto', () => {
    const labelColor = (mode) => {
      renderThemed(mode, <TextField label="Utente" focused />);
      const color = getComputedStyle(screen.getByText('Utente', { selector: 'label' })).color;
      cleanup();
      return color;
    };
    expect(labelColor('light')).toBe(INK_LIGHT);
    expect(labelColor('dark')).toBe(WHITE);
    expect(contrast(labelColor('light'), PAPER.light)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(labelColor('dark'), PAPER.dark)).toBeGreaterThanOrEqual(4.5);
  });

  it('in scuro l\'etichetta del campo in errore e a fuoco ha almeno 4,5:1 di contrasto', () => {
    renderThemed('dark', <TextField label="Utente" focused error />);
    const { color } = getComputedStyle(screen.getByText('Utente', { selector: 'label' }));
    expect(contrast(color, PAPER.dark)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['light', '#1a1816'],
    ['dark', '#ffffff'],
  ])('il bordo a fuoco è del colore del testo principale, escluso il campo in errore (%s)', (mode, text) => {
    renderThemed(mode, <TextField label="Utente" focused />);
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('');
    expect(css).toMatch(new RegExp(`\\.Mui-focused:not\\(\\.Mui-error\\) \\.MuiOutlinedInput-notchedOutline\\{[^}]*border-color:${text}`));
    expect(css).toMatch(new RegExp(`\\.Mui-focused:not\\(\\.Mui-error\\)\\{[^}]*color:${text}`));
  });

  it.each([
    ['light', RED],
    ['dark', ERROR_DARK],
  ])('a fuoco e in errore etichetta e bordo restano esattamente del colore dell\'errore (%s)', (mode, error) => {
    renderThemed(mode, <TextField label="Utente" focused error />);
    expect(getComputedStyle(screen.getByText('Utente', { selector: 'label' })).color).toBe(error);
    const outline = document.querySelector('.MuiOutlinedInput-notchedOutline');
    expect(getComputedStyle(outline).borderTopColor).toBe(error);
  });

  it('la regola del bordo a fuoco ha sempre la guardia :not(.Mui-error)', () => {
    renderThemed('light', <TextField label="Utente" focused />);
    const css = [...document.querySelectorAll('style')].map((s) => s.textContent).join('');
    const focusedBorderRules = [...css.matchAll(/([^{}]*\.Mui-focused[^{}]*\.MuiOutlinedInput-notchedOutline)\{[^}]*border-color:#1a1816/g)];
    expect(focusedBorderRules.length).toBeGreaterThan(0);
    focusedBorderRules.forEach(([, selector]) => expect(selector).toContain(':not(.Mui-error)'));
  });

  it.each([
    ['light', RED],
    ['dark', ERROR_DARK],
  ])('il cursore di scrittura di input e textarea è il rosso del marchio (%s), anche in errore', (mode, red) => {
    renderThemed(mode, <>
      <TextField label="A" />
      <TextField label="B" multiline rows={2} error />
    </>);
    const [input] = screen.getAllByRole('textbox', { name: 'A' });
    expect(getComputedStyle(input).caretColor).toBe(red);
    const area = document.querySelector('textarea:not([aria-hidden])');
    expect(getComputedStyle(area).caretColor).toBe(red);
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

describe('tema: indicatori di caricamento', () => {
  it('un CircularProgress senza nome si chiama «Caricamento»', () => {
    render(<ThemeModeProvider><CircularProgress /></ThemeModeProvider>);
    expect(screen.getByRole('progressbar', { name: 'Caricamento' })).toBeTruthy();
  });

  it('il nome scelto dal componente prevale su quello del tema', () => {
    render(<ThemeModeProvider><CircularProgress aria-label="Avanzamento" /></ThemeModeProvider>);
    expect(screen.getByRole('progressbar', { name: 'Avanzamento' })).toBeTruthy();
  });
});

// Modo iniziale: la scelta salvata (themeMode) vince; senza scelta vale la preferenza del sistema, letta una volta sola.
describe('tema: modo iniziale', () => {
  const realMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = realMatchMedia;
    vi.restoreAllMocks();
  });
  const system = (dark) => {
    window.matchMedia = (query) => ({ ...realMatchMedia(query), matches: dark && query === '(prefers-color-scheme: dark)' });
  };
  const Probe = () => {
    const { mode, toggleThemeMode } = useThemeMode();
    return <button type="button" onClick={toggleThemeMode}>{mode}</button>;
  };
  const mount = () => render(<ThemeModeProvider><Probe /></ThemeModeProvider>);

  it('senza scelta salvata e sistema scuro parte scuro', () => {
    system(true);
    mount();
    expect(screen.getByRole('button').textContent).toBe('dark');
  });

  it('senza scelta salvata e sistema chiaro parte chiaro', () => {
    system(false);
    mount();
    expect(screen.getByRole('button').textContent).toBe('light');
  });

  it('la scelta salvata vince sul sistema', () => {
    system(true);
    localStorage.setItem('themeMode', 'light');
    mount();
    expect(screen.getByRole('button').textContent).toBe('light');
  });

  it('<html> segue il tema (data-theme), anche dopo il bottone: lo sfondo prima di React non resta indietro', () => {
    system(true);
    mount();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    fireEvent.click(screen.getByRole('button'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('con lo storage bloccato segue il sistema', () => {
    system(true);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloccato'); });
    mount();
    expect(screen.getByRole('button').textContent).toBe('dark');
  });

  it('senza matchMedia parte chiaro', () => {
    window.matchMedia = undefined;
    mount();
    expect(screen.getByRole('button').textContent).toBe('light');
  });

  it('il bottone funziona anche con lo storage che rifiuta le scritture', () => {
    system(false);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('pieno'); });
    mount();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toBe('dark');
  });

  it('in StrictMode il caricamento non scrive themeMode e un clic lo scrive una volta sola', () => {
    system(true);
    const set = vi.spyOn(Storage.prototype, 'setItem');
    render(<StrictMode><ThemeModeProvider><Probe /></ThemeModeProvider></StrictMode>);
    expect(set).not.toHaveBeenCalledWith('themeMode', expect.anything());
    fireEvent.click(screen.getByRole('button'));
    expect(set.mock.calls.filter(([key]) => key === 'themeMode')).toEqual([['themeMode', 'light']]);
  });

  it('il bottone salva la scelta, il solo caricamento no', () => {
    system(true);
    mount();
    expect(localStorage.getItem('themeMode')).toBeNull();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').textContent).toBe('light');
    expect(localStorage.getItem('themeMode')).toBe('light');
  });
});

// Preferenza del tema (Sistema, Chiaro, Scuro): senza scelta salvata vale «system» e il tema segue il sistema anche a
// pagina aperta; «light» e «dark» si salvano in themeMode, «system» toglie la chiave (public/tema.js la legge uguale).
describe('tema: preferenza', () => {
  const DARK_QUERY = '(prefers-color-scheme: dark)';
  const realMatchMedia = window.matchMedia;
  afterEach(() => {
    window.matchMedia = realMatchMedia;
    vi.restoreAllMocks();
  });

  // Un sistema finto: `set(dark)` cambia l'aspetto e avvisa chi ascolta; `listeners()` dice quanti ascolti sono aperti
  const fakeSystem = (dark) => {
    const state = { dark };
    const listeners = new Set();
    window.matchMedia = (query) => ({
      get matches() { return query === DARK_QUERY && state.dark; },
      media: query,
      addEventListener: (type, listener) => { if (query === DARK_QUERY && type === 'change') listeners.add(listener); },
      removeEventListener: (type, listener) => { if (query === DARK_QUERY && type === 'change') listeners.delete(listener); },
    });
    return {
      set: (next) => { state.dark = next; act(() => [...listeners].forEach((listener) => listener())); },
      listeners: () => listeners.size,
    };
  };
  const Probe = () => {
    const { mode, themePreference, setThemePreference, toggleThemeMode } = useThemeMode();
    return (
      <>
        <p>{`${themePreference}/${mode}`}</p>
        {['system', 'light', 'dark'].map((choice) => (
          <button key={choice} type="button" onClick={() => setThemePreference(choice)}>{choice}</button>
        ))}
        <button type="button" onClick={toggleThemeMode}>toggle</button>
      </>
    );
  };
  const mount = () => render(<ThemeModeProvider><Probe /></ThemeModeProvider>);
  const choose = (name) => fireEvent.click(screen.getByRole('button', { name }));
  const stored = () => localStorage.getItem('themeMode');

  it.each([
    [true, 'system/dark'],
    [false, 'system/light'],
  ])('senza scelta salvata la preferenza è «system» e il tema è quello del sistema (scuro: %s)', (dark, state) => {
    fakeSystem(dark);
    mount();
    expect(screen.getByText(state)).toBeTruthy();
  });

  it('con «system» il cambio del sistema a pagina aperta cambia il tema, e <html> lo segue', () => {
    const system = fakeSystem(false);
    mount();
    expect(screen.getByText('system/light')).toBeTruthy();
    system.set(true);
    expect(screen.getByText('system/dark')).toBeTruthy();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    system.set(false);
    expect(screen.getByText('system/light')).toBeTruthy();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it.each(['light', 'dark'])('scegliere «%s» salva la chiave, cambia il tema e smette di seguire il sistema', (choice) => {
    const system = fakeSystem(choice === 'light');
    mount();
    choose(choice);
    expect(screen.getByText(`${choice}/${choice}`)).toBeTruthy();
    expect(stored()).toBe(choice);
    system.set(choice !== 'light');
    system.set(choice === 'light');
    expect(screen.getByText(`${choice}/${choice}`)).toBeTruthy();
  });

  it('scegliere «system» toglie la chiave e riprende a seguire il sistema', () => {
    const system = fakeSystem(true);
    localStorage.setItem('themeMode', 'light');
    mount();
    expect(screen.getByText('light/light')).toBeTruthy();
    choose('system');
    expect(screen.getByText('system/dark')).toBeTruthy();
    expect(stored()).toBeNull();
    system.set(false);
    expect(screen.getByText('system/light')).toBeTruthy();
  });

  it('tornando a «system» vale l\'aspetto che il sistema ha adesso, anche se è cambiato mentre la scelta era fissa', () => {
    const system = fakeSystem(true);
    localStorage.setItem('themeMode', 'dark');
    mount();
    system.set(false);
    expect(screen.getByText('dark/dark')).toBeTruthy();
    choose('system');
    expect(screen.getByText('system/light')).toBeTruthy();
  });

  it('tornando a «system» nessun disegno usa l\'aspetto che il sistema aveva al caricamento', () => {
    const system = fakeSystem(true);
    localStorage.setItem('themeMode', 'light');
    const drawn = [];
    const Recorder = () => { drawn.push(useThemeMode().mode); return null; };
    render(<ThemeModeProvider><Probe /><Recorder /></ThemeModeProvider>);
    system.set(false);
    choose('system');
    expect(screen.getByText('system/light')).toBeTruthy();
    expect(new Set(drawn)).toEqual(new Set(['light']));
  });

  it('il caricamento non scrive e non toglie niente, nemmeno in StrictMode', () => {
    fakeSystem(true);
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    render(<StrictMode><ThemeModeProvider><Probe /></ThemeModeProvider></StrictMode>);
    expect(screen.getByText('system/dark')).toBeTruthy();
    expect(set).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('un valore sconosciuto nella chiave vale «system»', () => {
    fakeSystem(true);
    localStorage.setItem('themeMode', 'blu');
    mount();
    expect(screen.getByText('system/dark')).toBeTruthy();
  });

  it('con lo storage bloccato (lettura e scrittura) vale «system» e la scelta vale per la visita', () => {
    fakeSystem(true);
    for (const method of ['getItem', 'setItem', 'removeItem']) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error('bloccato'); });
    }
    mount();
    expect(screen.getByText('system/dark')).toBeTruthy();
    choose('light');
    expect(screen.getByText('light/light')).toBeTruthy();
    choose('system');
    expect(screen.getByText('system/dark')).toBeTruthy();
  });

  it.each([
    [true, 'light'],
    [false, 'dark'],
  ])('il bottone della barra da «system» (sistema scuro: %s) salva il tema opposto a quello in vigore: «%s»', (dark, saved) => {
    fakeSystem(dark);
    mount();
    choose('toggle');
    expect(screen.getByText(`${saved}/${saved}`)).toBeTruthy();
    expect(stored()).toBe(saved);
  });

  it('l\'ascolto del sistema c\'è solo con «system» e si toglie quando si lascia e allo smontaggio', () => {
    const system = fakeSystem(false);
    const { unmount } = mount();
    expect(system.listeners()).toBe(1);
    choose('dark');
    expect(system.listeners()).toBe(0);
    choose('system');
    expect(system.listeners()).toBe(1);
    unmount();
    expect(system.listeners()).toBe(0);
  });

  it('senza matchMedia vale il chiaro e scegliere «system» non rompe', () => {
    window.matchMedia = undefined;
    mount();
    expect(screen.getByText('system/light')).toBeTruthy();
    choose('dark');
    choose('system');
    expect(screen.getByText('system/light')).toBeTruthy();
  });
});
