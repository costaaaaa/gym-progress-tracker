// Colori di Focus: bordo dei campi a 3:1 (1.4.11) e rosso come testo a 4.5:1 sul fondo reale (1.4.3)
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CssBaseline } from '@mui/material';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import { useFocusColors } from './useFocusColors';
import QuitDialog from './QuitDialog';

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

let colors;
const Probe = () => {
  ({ colors } = useFocusColors());
  return null;
};
const renderIn = (mode, ui) => {
  localStorage.setItem('themeMode', mode);
  return render(<ThemeModeProvider><CssBaseline />{ui}</ThemeModeProvider>);
};

afterEach(() => localStorage.clear());

describe.each(['light', 'dark'])('colori di Focus in tema %s', (mode) => {
  it('il bordo dei campi arriva a 3:1 su fondo pagina e su carta', () => {
    renderIn(mode, <Probe />);
    expect(contrast(colors.fieldBorder, colors.bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(colors.fieldBorder, colors.bgCard)).toBeGreaterThanOrEqual(3);
  });

  it('il rosso come testo arriva a 4.5:1 su fondo pagina e su carta', () => {
    renderIn(mode, <Probe />);
    expect(contrast(colors.primaryText, colors.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.primaryText, colors.bgCard)).toBeGreaterThanOrEqual(4.5);
  });

  it('il bottone distruttivo del dialogo di uscita ha il rosso da testo', () => {
    renderIn(mode, <><Probe /><QuitDialog open onClose={() => {}} onConfirm={() => {}} title="t" text="x" stayLabel="Resta" exitLabel="Esci" destructive /></>);
    const { color } = getComputedStyle(screen.getByRole('button', { name: 'Esci' }));
    expect(contrast(color, colors.bgCard)).toBeGreaterThanOrEqual(4.5);
  });
});
