// Il ventaglio del pulsante centrale: finestra modale con i tondi sopra il pulsante, su un velo scuro.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EditCalendarOutlinedIcon from '@mui/icons-material/EditCalendarOutlined';
import StraightenIcon from '@mui/icons-material/Straighten';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import CenterFan from './CenterFan';
import { fanLayout } from './fanLayout';
import { ThemeModeProvider } from '../../context/ThemeModeContext';

const start = { key: 'start', main: true, label: 'Inizia allenamento', shortLabel: 'Inizia', Icon: PlayArrowIcon, to: '/focus' };
const record = { key: 'record', label: 'Registra allenamento passato', shortLabel: 'Registra', Icon: EditCalendarOutlinedIcon, to: '/storico', state: { openRecord: true } };
const measure = { key: 'measure', label: 'Nuova misura', shortLabel: 'Misura', Icon: StraightenIcon, to: '/dashboard?tab=body' };
// Voci finte: il ventaglio le dispone senza conoscerle
const cardio = { key: 'cardio', label: 'Cardio', shortLabel: 'Cardio', Icon: DirectionsRunIcon, to: '/cardio' };
const coach = { key: 'coach', label: 'Chiedi al Coach', shortLabel: 'Coach', Icon: AutoAwesomeOutlinedIcon, to: '/coach' };

let reduceMotion = false;
beforeEach(() => {
  reduceMotion = false;
  window.matchMedia = (query) => ({
    matches: query.includes('prefers-reduced-motion') && reduceMotion, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  });
});

const mount = (items, onClose = vi.fn(), mode = 'light') => {
  localStorage.setItem('themeMode', mode);
  render(<MemoryRouter><ThemeModeProvider><CenterFan open onClose={onClose} items={items} /></ThemeModeProvider></MemoryRouter>);
  return onClose;
};
const positionOf = (name) => {
  const box = screen.getByRole('link', { name }).parentElement;
  return { x: parseFloat(box.style.marginLeft), y: parseFloat(box.style.bottom) };
};

describe('ventaglio: finestra', () => {
  it('chiuso non mostra nulla', () => {
    render(<MemoryRouter><ThemeModeProvider><CenterFan open={false} onClose={() => {}} items={[start, record]} /></ThemeModeProvider></MemoryRouter>);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('aperto è una finestra modale con nome «Cosa vuoi fare»', () => {
    mount([start, record]);
    const dialog = screen.getByRole('dialog', { name: 'Cosa vuoi fare' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('ogni voce è un collegamento con il nome completo e il testo corto sotto il tondo', () => {
    mount([start, record, measure]);
    const dialog = screen.getByRole('dialog');
    for (const item of [start, record, measure]) {
      const link = within(dialog).getByRole('link', { name: item.label });
      expect(link.getAttribute('href')).toBe(item.to);
      expect(link.textContent).toBe(item.shortLabel);
      // Label in Name (2.5.3): il testo visibile è dentro il nome accessibile
      expect(item.label.toLowerCase()).toContain(link.textContent.toLowerCase());
    }
  });

  it('il fuoco va su «Inizia» e l\'ordine di lettura è Inizia, le altre voci, la chiusura', () => {
    mount([start, record, measure]);
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Inizia allenamento' }));
    const controls = [...screen.getByRole('dialog').querySelectorAll('a, button')].map((el) => el.getAttribute('aria-label'));
    expect(controls).toEqual(['Inizia allenamento', 'Registra allenamento passato', 'Nuova misura', 'Chiudi']);
  });

  it('Esc, il tocco sul velo, il pulsante di chiusura e la scelta di una voce chiudono', () => {
    const onClose = mount([start, record]);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('fan-veil'));
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi' }));
    expect(onClose).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getByRole('link', { name: 'Registra allenamento passato' }));
    expect(onClose).toHaveBeenCalledTimes(4);
  });

  // Il Tab vero lo gestisce la trappola del fuoco del Modal di MUI: dall'ultimo controllo il Tab arriva al segnaposto di
  // fondo (e dal primo, con Maiusc, a quello d'inizio), che rimanda al capo opposto. jsdom non sposta il fuoco col Tab,
  // quindi qui il fuoco si porta sui segnaposto, come farebbe il browser.
  it('la trappola del fuoco del Modal fa girare il Tab: dal segnaposto di fondo a «Inizia», da quello d\'inizio a «Chiudi»', () => {
    mount([start, record, measure]);
    const first = screen.getByRole('link', { name: 'Inizia allenamento' });
    const close = screen.getByRole('button', { name: 'Chiudi' });
    act(() => screen.getByTestId('sentinelEnd').focus());
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    act(() => screen.getByTestId('sentinelStart').focus());
    expect(document.activeElement).toBe(close);
  });

  it('il resto della pagina non scorre mentre il ventaglio è aperto', () => {
    mount([start, record]);
    expect(document.body.style.overflow).toBe('hidden');
  });
});

describe('ventaglio: con 4 e 5 voci finte', () => {
  it.each([
    ['4', [start, record, cardio, measure]],
    ['5', [start, record, cardio, measure, coach]],
  ])('con %s voci: fuoco su «Inizia» e ordine di lettura come l\'elenco, poi la chiusura', (_, items) => {
    mount(items);
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Inizia allenamento' }));
    const controls = [...screen.getByRole('dialog').querySelectorAll('a, button')].map((el) => el.getAttribute('aria-label'));
    expect(controls).toEqual([...items.map((item) => item.label), 'Chiudi']);
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual(items.map((item) => item.shortLabel));
  });
});

describe('ventaglio: posizioni', () => {
  it.each([
    ['2 voci', [start, record]],
    ['3 voci', [start, record, measure]],
    ['4 voci', [start, record, cardio, measure]],
    ['5 voci', [start, record, cardio, measure, coach]],
  ])('con %s i tondi stanno dove le mette fanLayout e «Inizia» sempre in alto al centro', (_, items) => {
    mount(items);
    const expected = fanLayout(items);
    items.forEach((item, i) => expect(positionOf(item.label)).toEqual({ x: expected[i].x, y: expected[i].y }));
    expect(positionOf('Inizia allenamento')).toEqual({ x: 0, y: 146 });
  });

  it('«Inizia» è più grande (56 px) e nel colore primario, gli altri tondi da 44 px', () => {
    mount([start, record]);
    const circle = (name) => screen.getByRole('link', { name }).firstChild;
    expect(getComputedStyle(circle('Inizia allenamento')).width).toBe('56px');
    expect(getComputedStyle(circle('Inizia allenamento')).backgroundColor).toBe('rgb(213, 0, 0)');
    expect(getComputedStyle(circle('Registra allenamento passato')).width).toBe('44px');
  });

  it('ogni voce è un bersaglio di almeno 44 px', () => {
    mount([start, record, cardio, measure, coach]);
    for (const link of screen.getAllByRole('link')) {
      const style = getComputedStyle(link);
      expect(parseFloat(style.width)).toBeGreaterThanOrEqual(44);
      expect(parseFloat(style.height)).toBeGreaterThanOrEqual(44);
    }
  });

  it('in tema scuro i tondi sono scuri, non chiari', () => {
    mount([start, record], vi.fn(), 'dark');
    expect(getComputedStyle(screen.getByRole('link', { name: 'Registra allenamento passato' }).firstChild).backgroundColor).toBe('rgb(46, 46, 48)');
  });
});

describe('ventaglio: movimento', () => {
  it('con l\'animazione i tondi partono dal pulsante e arrivano al loro posto', () => {
    mount([start, record]);
    expect(screen.getByRole('link', { name: 'Inizia allenamento' }).parentElement.style.transition).toContain('transform');
  });

  it('con «riduci movimento» nessuna animazione: i tondi sono subito al loro posto', () => {
    reduceMotion = true;
    mount([start, record]);
    const box = screen.getByRole('link', { name: 'Inizia allenamento' }).parentElement;
    expect(box.style.transition).toBe('none');
    expect(box.style.opacity).toBe('1');
  });
});

describe('ventaglio: voce che non naviga (onSelect)', () => {
  it('è un pulsante, non un collegamento, con lo stesso nome e testo; la scelta chiude e chiama onSelect una volta', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const calls = [];
    onClose.mockImplementation(() => calls.push('close'));
    onSelect.mockImplementation(() => calls.push('select'));
    const action = { key: 'cardio', label: 'Cardio', shortLabel: 'Cardio', Icon: DirectionsRunIcon, onSelect };
    mount([start, record, measure, action], onClose);
    expect(screen.queryByRole('link', { name: 'Cardio' })).toBeNull();
    const button = screen.getByRole('button', { name: 'Cardio' });
    expect(button.textContent).toBe('Cardio');
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['close', 'select']);
  });

  it('con una voce onSelect il fuoco parte da «Inizia» e l\'ordine di lettura è quello dell\'elenco', () => {
    const action = { key: 'cardio', label: 'Cardio', shortLabel: 'Cardio', Icon: DirectionsRunIcon, onSelect: () => {} };
    const items = [start, record, measure, action];
    mount(items);
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Inizia allenamento' }));
    const controls = [...screen.getByRole('dialog').querySelectorAll('a, button')].map((el) => el.getAttribute('aria-label'));
    expect(controls).toEqual([...items.map((item) => item.label), 'Chiudi']);
  });
});
