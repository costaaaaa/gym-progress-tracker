// Storico, vista «Calendario» (/storico?vista=calendario): la scelta della vista e l'indirizzo, la griglia del mese, i nomi dei giorni,
// il giorno scelto e i suoi allenamenti, i limiti dei mesi, gli stati di caricamento, errore e vuoto, l'eliminazione in arrivo.
// Colori del tema chiaro scritti a mano: rosso del marchio #d50000. La fetch è il confine.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import History from './History';
import i18n from '../i18n';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { json, expectNoNestedContainer } from '../test/dom';
import { setBrowserTimeZone } from '../test/timeZone';
import { textBelow } from '../test/minText';
import { made, serve, deletions } from '../test/history';

const account = vi.hoisted(() => ({ isLoggedIn: true, loading: false, weightUnit: 'kg', user: undefined }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => account }));

// La finestra «Registra allenamento» ha le sue prove: qui basta sapere quando si apre
vi.mock('../components/RecordWorkoutDialog', async () => {
  const { Dialog, DialogTitle } = await import('@mui/material');
  return { default: ({ open }) => (open ? <Dialog open><DialogTitle>Registra allenamento</DialogTitle></Dialog> : null) };
});

const RED = 'rgb(213, 0, 0)';
const NESSUNO = 'Nessun allenamento registrato';
const ERRORE = 'Errore nel caricamento della cronologia';
const VUOTO = 'Nessun allenamento in questo giorno.';
const ZONE = ['UTC', 'Europe/Rome', 'America/Los_Angeles', 'Asia/Tokyo'];

// Oggi è venerdì 20 novembre 2026. Il 18 ci sono due allenamenti; il 3 uno alle 00:30 e il 31 ottobre uno alle 23:30
// (cadono nel loro giorno in ogni fuso); il più vecchio, il 12 ottobre, dà il mese più lontano del calendario.
const pullB = made({ id: 20, date: '2026-11-18 18:30:00', day_name: 'Pull B' });
const pushA = made({ id: 21, date: '2026-11-18 09:00:00', day_name: 'Push A' });
const gambe = made({ id: 22, date: '2026-11-03 00:30:00', day_name: 'Gambe' });
const notte = made({ id: 23, date: '2026-10-31 23:30:00', day_name: 'Notte' });
const primo = made({ id: 24, date: '2026-10-12 10:00:00', day_name: 'Primo' });
const TUTTI = [pullB, pushA, gambe, notte, primo];

const setToday = (zone = 'Europe/Rome') => {
  setBrowserTimeZone(zone);
  vi.setSystemTime(new Date(2026, 10, 20, 12, 0));
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  setToday();
  localStorage.setItem('themeMode', 'light');
  serve({ workouts: TUTTI });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// Mostra indirizzo e stato di navigazione correnti; sulla pagina di un allenamento mostra lo stato che ha ricevuto
const Probe = () => {
  const { pathname, search, state } = useLocation();
  return (
    <>
      <p data-testid="indirizzo">{pathname + search}</p>
      <p data-testid="stato">{JSON.stringify(state)}</p>
    </>
  );
};
let navigate;
const Nav = () => { navigate = useNavigate(); return null; };
const indirizzo = () => screen.getByTestId('indirizzo').textContent;

const renderPage = (entries) => {
  render(
    <ThemeModeProvider>
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <Nav />
        <Probe />
        <Routes>
          <Route path="/storico" element={<History />} />
          <Route path="/storico/:id" element={<p>Pagina allenamento</p>} />
          <Route path="/altrove" element={<p>Altra pagina</p>} />
        </Routes>
      </MemoryRouter>
    </ThemeModeProvider>,
  );
};
// Apre la pagina all'indirizzo dato e aspetta un h2 (il mese del calendario, o quello dell'elenco)
const mount = async (entry = '/storico?vista=calendario', wait = 'novembre 2026') => {
  renderPage([entry]);
  await screen.findByRole('heading', { level: 2, name: wait });
};
const giorno = (nome) => screen.getByRole('button', { name: nome });
const giorni = () => screen.getAllByRole('button', { name: /^\d+ novembre/ });
const mese = (nome) => screen.getByRole('heading', { level: 2, name: nome });
const prec = () => screen.getByRole('button', { name: 'Mese precedente' });
const succ = () => screen.getByRole('button', { name: 'Mese successivo' });
const cardDelGiorno = () => within(screen.getByRole('heading', { level: 2, name: /^\S+ \d+ \S+ 2026$/ }).closest('.MuiCard-root'));

describe('scelta della vista', () => {
  it('di base c\'è l\'elenco; sotto il titolo il gruppo «Vista» ha «Elenco» e «Calendario», con la scelta segnata e aree da 44 px', async () => {
    await mount('/storico', 'novembre 2026');
    const gruppo = screen.getByRole('group', { name: 'Vista' });
    const elenco = within(gruppo).getByRole('button', { name: 'Elenco' });
    const calendario = within(gruppo).getByRole('button', { name: 'Calendario' });
    expect(elenco.getAttribute('aria-pressed')).toBe('true');
    expect(calendario.getAttribute('aria-pressed')).toBe('false');
    [elenco, calendario].forEach((bottone) => expect(parseFloat(getComputedStyle(bottone).minHeight)).toBeGreaterThanOrEqual(44));
    expect(screen.queryByRole('button', { name: 'Mese precedente' })).toBeNull();
    expect(screen.getAllByRole('link', { name: /^Pull B/ })).toHaveLength(1);
  });

  it('?vista=calendario apre il calendario e segna «Calendario»', async () => {
    await mount();
    expect(screen.getByRole('button', { name: 'Calendario' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Elenco' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('un valore che non è «calendario» vale l\'elenco', async () => {
    await mount('/storico?vista=altro');
    expect(screen.getByRole('button', { name: 'Elenco' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('button', { name: 'Mese precedente' })).toBeNull();
  });

  it('scegliere «Calendario» mette la vista nell\'indirizzo; «Elenco» la toglie', async () => {
    await mount('/storico');
    fireEvent.click(screen.getByRole('button', { name: 'Calendario' }));
    await screen.findByRole('button', { name: 'Mese precedente' });
    expect(indirizzo()).toBe('/storico?vista=calendario');
    fireEvent.click(screen.getByRole('button', { name: 'Elenco' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Mese precedente' })).toBeNull());
    expect(indirizzo()).toBe('/storico');
  });

  it('cambiare vista sostituisce la voce di cronologia: «indietro» non passa dalla vista di prima', async () => {
    renderPage(['/altrove', '/storico']);
    await screen.findByRole('heading', { level: 2, name: 'novembre 2026' });
    fireEvent.click(screen.getByRole('button', { name: 'Calendario' }));
    await screen.findByRole('button', { name: 'Mese precedente' });
    fireEvent.click(screen.getByRole('button', { name: 'Elenco' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Mese precedente' })).toBeNull());
    act(() => navigate(-1));
    expect(await screen.findByText('Altra pagina')).toBeTruthy();
  });

  it('mese e giorno scelti stanno nell\'indirizzo e cambiarli sostituisce la voce di cronologia', async () => {
    renderPage(['/altrove', '/storico?vista=calendario']);
    await screen.findByRole('heading', { level: 2, name: 'novembre 2026' });
    fireEvent.click(giorno('18 novembre, 2 allenamenti'));
    expect(indirizzo()).toBe('/storico?vista=calendario&giorno=2026-11-18');
    fireEvent.click(prec());
    expect(indirizzo()).toBe('/storico?vista=calendario&mese=2026-10&giorno=2026-10-31');
    act(() => navigate(-1));
    expect(await screen.findByText('Altra pagina')).toBeTruthy();
  });

  it('dalla pagina di un allenamento «indietro» torna allo stesso mese e allo stesso giorno', async () => {
    await mount('/storico?vista=calendario&mese=2026-10&giorno=2026-10-31', 'ottobre 2026');
    fireEvent.click(screen.getByRole('link', { name: /^Notte/ }));
    expect(await screen.findByText('Pagina allenamento')).toBeTruthy();
    act(() => navigate(-1));
    expect(await screen.findByRole('heading', { level: 2, name: 'sabato 31 ottobre 2026' })).toBeTruthy();
    expect(indirizzo()).toBe('/storico?vista=calendario&mese=2026-10&giorno=2026-10-31');
  });

  it('il collegamento di un allenamento porta con sé l\'indirizzo del calendario, perché la sua pagina possa tornarci', async () => {
    await mount('/storico?vista=calendario&giorno=2026-11-18');
    fireEvent.click(screen.getByRole('link', { name: /^Pull B/ }));
    await screen.findByText('Pagina allenamento');
    expect(screen.getByTestId('stato').textContent).toBe('{"historySearch":"?vista=calendario&giorno=2026-11-18"}');
  });
});

describe('apertura e indirizzo', () => {
  it('all\'apertura: mese corrente, oggi scelto e segnato come oggi', async () => {
    await mount();
    const oggi = giorno('20 novembre');
    expect(oggi.getAttribute('aria-pressed')).toBe('true');
    expect(oggi.getAttribute('aria-current')).toBe('date');
    expect(document.querySelectorAll('[aria-current="date"]')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 2, name: 'venerdì 20 novembre 2026' })).toBeTruthy();
    expect(screen.getByText(VUOTO)).toBeTruthy();
  });

  it('?giorno= sceglie quel giorno e porta al suo mese', async () => {
    await mount('/storico?vista=calendario&giorno=2026-10-12', 'ottobre 2026');
    expect(giorno('12 ottobre, 1 allenamento').getAttribute('aria-pressed')).toBe('true');
    expect(within(screen.getByRole('heading', { level: 2, name: 'lunedì 12 ottobre 2026' }).closest('.MuiCard-root')).getByRole('link', { name: /^Primo/ })).toBeTruthy();
  });

  it('?mese= senza giorno mostra quel mese senza nessun giorno scelto e senza la card del giorno', async () => {
    await mount('/storico?vista=calendario&mese=2026-10', 'ottobre 2026');
    expect(document.querySelectorAll('[aria-pressed="true"][data-day]')).toHaveLength(0);
    expect(screen.queryByText(VUOTO)).toBeNull();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['ottobre 2026']);
  });

  it('un mese nel futuro vale il mese corrente', async () => {
    await mount('/storico?vista=calendario&mese=2027-03');
    expect(giorno('20 novembre').getAttribute('aria-current')).toBe('date');
  });

  it('un mese prima del primo allenamento vale il mese del primo', async () => {
    await mount('/storico?vista=calendario&mese=2025-05', 'ottobre 2026');
    expect(prec().hasAttribute('disabled')).toBe(true);
  });

  it('un indirizzo illeggibile non rompe nulla: mese corrente e oggi', async () => {
    await mount('/storico?vista=calendario&mese=boh&giorno=ieri');
    expect(giorno('20 novembre').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('griglia del mese', () => {
  it('mese e anno in un h2, le iniziali da lunedì a domenica, e i giorni di novembre cominciano di domenica', async () => {
    await mount();
    const card = mese('novembre 2026').closest('.MuiCard-root');
    expect(within(card).getAllByText(/^[LMGVSD]$/).map((el) => el.textContent)).toEqual(['L', 'M', 'M', 'G', 'V', 'S', 'D']);
    expect(giorni()).toHaveLength(30);
    const griglia = giorno('1 novembre').parentElement;
    expect(griglia.children).toHaveLength(6 + 30); // sei celle vuote (da lunedì a sabato), poi il primo
    expect([...griglia.children].indexOf(giorno('1 novembre'))).toBe(6);
  });

  it('a 320 px la griglia è di sette colonne uguali che non spingono la card', async () => {
    await mount();
    const griglia = giorno('1 novembre').parentElement;
    expect(getComputedStyle(griglia).gridTemplateColumns).toBe('repeat(7, minmax(0, 1fr))');
  });

  // In larghezza i giorni riempiono la colonna: a 320 px sette colonne da 44 px non ci stanno nella card, e la griglia non scorre
  it('i giorni sono pulsanti alti 44 px almeno; «Mese precedente» e «Mese successivo» sono aree da 44 × 44', async () => {
    await mount();
    giorni().forEach((bottone) => expect(parseFloat(getComputedStyle(bottone).minHeight)).toBeGreaterThanOrEqual(44));
    [prec(), succ()].forEach((bottone) => {
      const stile = getComputedStyle(bottone);
      expect(parseFloat(stile.width)).toBeGreaterThanOrEqual(44);
      expect(parseFloat(stile.height)).toBeGreaterThanOrEqual(44);
    });
  });

  it('i pallini sono uno per allenamento, al massimo tre; il nome dice il numero vero', async () => {
    const quattro = [30, 31, 32, 33].map((id) => made({ id, date: '2026-11-10 0' + (id - 29) + ':00:00' }));
    serve({ workouts: [pullB, pushA, gambe, ...quattro] });
    await mount();
    const pallini = (nome) => giorno(nome).querySelectorAll('[data-day-dot]').length;
    expect(pallini('3 novembre, 1 allenamento')).toBe(1);
    expect(pallini('18 novembre, 2 allenamenti')).toBe(2);
    expect(pallini('10 novembre, 4 allenamenti')).toBe(3);
    expect(pallini('5 novembre')).toBe(0);
  });

  it('il nome accessibile è la data, con il numero di allenamenti al singolare o al plurale; senza allenamenti solo la data', async () => {
    await mount();
    expect(giorno('18 novembre, 2 allenamenti')).toBeTruthy();
    expect(giorno('3 novembre, 1 allenamento')).toBeTruthy();
    expect(giorno('5 novembre')).toBeTruthy();
  });

  it('in inglese mese, giorni della settimana e nomi seguono la lingua, singolare e plurale compresi', async () => {
    await i18n.changeLanguage('en');
    try {
      await mount('/storico?vista=calendario', 'November 2026');
      const card = mese('November 2026').closest('.MuiCard-root');
      expect(within(card).getAllByText(/^[MTWFS]$/).map((el) => el.textContent)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
      expect(screen.getByRole('button', { name: 'November 18, 2 workouts' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'November 3, 1 workout' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'November 5' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Previous month' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Next month' })).toBeTruthy();
      expect(screen.getByRole('group', { name: 'View' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'List' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Calendar' })).toBeTruthy();
      expect(screen.getByText('No workouts on this day.')).toBeTruthy();
    } finally {
      await i18n.changeLanguage('it');
    }
  });

  it.each(ZONE)('con il browser a %s un allenamento alle 00:30 e uno alle 23:30 cadono nel loro giorno, e oggi è oggi', async (zona) => {
    setToday(zona);
    await mount();
    expect(giorno('3 novembre, 1 allenamento')).toBeTruthy();
    expect(giorno('18 novembre, 2 allenamenti')).toBeTruthy();
    expect(giorno('20 novembre').getAttribute('aria-current')).toBe('date');
    fireEvent.click(prec());
    expect(await screen.findByRole('heading', { level: 2, name: 'sabato 31 ottobre 2026' })).toBeTruthy();
    expect(giorno('31 ottobre, 1 allenamento').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('giorno scelto e allenamenti del giorno', () => {
  it('scegliere un giorno segna lui solo con aria-pressed e un bordo più marcato, e mostra la data per esteso con le sue righe', async () => {
    await mount();
    const diciotto = giorno('18 novembre, 2 allenamenti');
    fireEvent.click(diciotto);
    expect(diciotto.getAttribute('aria-pressed')).toBe('true');
    expect(giorno('20 novembre').getAttribute('aria-pressed')).toBe('false');
    expect(document.querySelectorAll('[aria-pressed="true"][data-day]')).toHaveLength(1);
    expect(getComputedStyle(diciotto).borderTopColor).not.toBe(getComputedStyle(giorno('20 novembre')).borderTopColor);
    expect(parseFloat(getComputedStyle(diciotto).borderTopWidth)).toBeGreaterThanOrEqual(2);
    const card = cardDelGiorno();
    expect(screen.getByRole('heading', { level: 2, name: 'mercoledì 18 novembre 2026' })).toBeTruthy();
    expect(card.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/storico/20', '/storico/21']);
  });

  it('le righe del giorno sono quelle dell\'elenco: titolo, data, durata e volume', async () => {
    await mount('/storico?vista=calendario&giorno=2026-11-18');
    const riga = screen.getByRole('link', { name: /^Pull B/ });
    expect(within(riga).getByText('mer 18 nov · 60 min · 1440 kg')).toBeTruthy();
    expect(parseFloat(getComputedStyle(riga).minHeight)).toBeGreaterThanOrEqual(60);
  });

  it('un giorno senza allenamenti dice «Nessun allenamento in questo giorno.»', async () => {
    await mount();
    fireEvent.click(giorno('5 novembre'));
    expect(screen.getByRole('heading', { level: 2, name: 'giovedì 5 novembre 2026' })).toBeTruthy();
    expect(screen.getByText(VUOTO)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /^Pull B/ })).toBeNull();
  });

  it('i giorni futuri sono spenti e non si scelgono', async () => {
    await mount();
    const domani = giorno('21 novembre');
    expect(domani.hasAttribute('disabled')).toBe(true);
    expect(giorno('30 novembre').hasAttribute('disabled')).toBe(true);
    expect(giorno('20 novembre').hasAttribute('disabled')).toBe(false);
    fireEvent.click(domani);
    expect(giorno('20 novembre').getAttribute('aria-pressed')).toBe('true');
    expect(indirizzo()).toBe('/storico?vista=calendario');
  });
});

describe('mesi', () => {
  it('«Mese precedente» porta al mese prima e sceglie il suo ultimo giorno allenato; «Mese successivo» fa il contrario', async () => {
    await mount();
    fireEvent.click(prec());
    expect(await screen.findByRole('heading', { level: 2, name: 'ottobre 2026' })).toBeTruthy();
    expect(giorno('31 ottobre, 1 allenamento').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('link', { name: /^Notte/ })).toBeTruthy();
    fireEvent.click(succ());
    expect(await screen.findByRole('heading', { level: 2, name: 'novembre 2026' })).toBeTruthy();
    expect(giorno('18 novembre, 2 allenamenti').getAttribute('aria-pressed')).toBe('true');
    expect(giorno('20 novembre').getAttribute('aria-current')).toBe('date');
  });

  it('in un mese senza allenamenti non c\'è nessun giorno scelto e la card del giorno non compare', async () => {
    serve({ workouts: [made({ id: 1, date: '2026-08-10 10:00:00' }), pullB] });
    await mount();
    fireEvent.click(prec());
    await screen.findByRole('heading', { level: 2, name: 'ottobre 2026' });
    expect(document.querySelectorAll('[aria-pressed="true"][data-day]')).toHaveLength(0);
    expect(screen.queryByText(VUOTO)).toBeNull();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['ottobre 2026']);
  });

  it('«Mese successivo» è spento sul mese corrente e «Mese precedente» sul mese del primo allenamento', async () => {
    await mount();
    expect(succ().hasAttribute('disabled')).toBe(true);
    expect(prec().hasAttribute('disabled')).toBe(false);
    fireEvent.click(prec());
    await screen.findByRole('heading', { level: 2, name: 'ottobre 2026' });
    expect(prec().hasAttribute('disabled')).toBe(true);
    expect(succ().hasAttribute('disabled')).toBe(false);
  });

  it('il cambio d\'anno: da gennaio 2027 si torna a dicembre 2026', async () => {
    vi.setSystemTime(new Date(2027, 0, 5, 12, 0));
    await mount('/storico?vista=calendario', 'gennaio 2027');
    fireEvent.click(prec());
    expect(await screen.findByRole('heading', { level: 2, name: 'dicembre 2026' })).toBeTruthy();
  });
});

describe('stati della pagina', () => {
  it('il caricamento mostra l\'indicatore e non il calendario', async () => {
    serve({ on: { 'workout_history/read.php': () => new Promise(() => {}) } });
    renderPage(['/storico?vista=calendario']);
    expect(await screen.findByRole('progressbar')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Vista' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mese precedente' })).toBeNull();
  });

  it('l\'errore di lettura è quello dell\'elenco, con «Riprova» che rilegge', async () => {
    const errore = vi.spyOn(console, 'error').mockImplementation(() => {});
    let guasto = true;
    serve({ on: { 'workout_history/read.php': () => (guasto ? json({ message: 'Guasto' }, 500) : json({ records: TUTTI })) } });
    renderPage(['/storico?vista=calendario']);
    await screen.findByText(ERRORE);
    expect(screen.queryByRole('button', { name: 'Mese precedente' })).toBeNull();
    guasto = false;
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'novembre 2026' })).toBeTruthy();
    expect(screen.queryByText(ERRORE)).toBeNull();
    errore.mockRestore();
  });

  it('senza allenamenti c\'è il testo dell\'elenco con «Registra il primo», non un calendario vuoto', async () => {
    serve({ workouts: [] });
    renderPage(['/storico?vista=calendario']);
    await screen.findByText(NESSUNO);
    expect(screen.getByRole('button', { name: 'Registra il primo' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mese precedente' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Vista' })).toBeNull();
  });

  it('«Registra allenamento passato» c\'è e apre la finestra anche nel calendario', async () => {
    await mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Registra allenamento passato' }));
    expect(await screen.findByText('Registra allenamento', { selector: '.MuiDialogTitle-root' })).toBeTruthy();
  });
});

describe('aspetto', () => {
  it('nessun testo sotto i 16 px (iniziali e numeri compresi), nessun Container annidato', async () => {
    await mount('/storico?vista=calendario&giorno=2026-11-18');
    expect(textBelow(document.body, 16, '.nessuno')).toEqual([]);
    expectNoNestedContainer();
  });

  it('di rosso, se c\'è, restano solo i pallini', async () => {
    await mount('/storico?vista=calendario&giorno=2026-11-18');
    const rossi = [...document.body.querySelectorAll('*')].filter((el) => {
      const s = getComputedStyle(el);
      return [s.color, s.backgroundColor, s.borderTopColor, s.borderBottomColor, s.borderLeftColor, s.borderRightColor].includes(RED);
    });
    expect(rossi.filter((el) => !el.hasAttribute('data-day-dot')).map((el) => el.outerHTML.slice(0, 80))).toEqual([]);
  });
});

describe('eliminazione fatta dalla pagina dell\'allenamento, con il calendario', () => {
  // Qui i timer sono finti (anche setTimeout): niente findBy/waitFor; il tempo scorre solo con `passano`
  beforeEach(() => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    setToday();
  });
  const passano = (ms) => act(() => vi.advanceTimersByTimeAsync(ms));
  const assesta = async () => { await passano(50); await passano(50); };
  const arriva = async () => {
    serve({ workouts: TUTTI });
    renderPage([{ pathname: '/storico', search: '?vista=calendario&giorno=2026-11-18', state: { deleted: 20 } }]);
    await assesta();
  };
  const annulla = () => within(screen.getByRole('alert')).getByRole('button', { name: 'Annulla' });

  it('la riga sparisce dal giorno, il giorno ne conta uno in meno, si resta nel calendario e la richiesta non è ancora partita', async () => {
    await arriva();
    expect(screen.queryByRole('link', { name: /^Pull B/ })).toBeNull();
    expect(screen.getByRole('link', { name: /^Push A/ })).toBeTruthy();
    expect(giorno('18 novembre, 1 allenamento')).toBeTruthy();
    expect(indirizzo()).toBe('/storico?vista=calendario&giorno=2026-11-18');
    expect(screen.getByTestId('stato').textContent).toBe('null');
    expect(deletions()).toHaveLength(0);
  });

  it('«Annulla» riporta la riga e il conto dei due allenamenti, e la richiesta non parte mai', async () => {
    await arriva();
    fireEvent.click(annulla());
    await assesta();
    expect(screen.getByRole('link', { name: /^Pull B/ })).toBeTruthy();
    expect(giorno('18 novembre, 2 allenamenti')).toBeTruthy();
    await passano(20000);
    expect(deletions()).toHaveLength(0);
  });

  it('allo scadere dei 10 secondi parte la richiesta per quell\'id', async () => {
    await arriva();
    act(() => document.activeElement.blur());
    await passano(10000);
    expect(deletions()).toHaveLength(1);
    expect(JSON.parse(deletions()[0][1].body)).toEqual({ id: 20 });
    expect(giorno('18 novembre, 1 allenamento')).toBeTruthy();
  });
});
