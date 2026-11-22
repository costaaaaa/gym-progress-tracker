// Pagina Storico (/storico): l'elenco compatto a mesi (una riga-collegamento per allenamento), «Registra allenamento passato»,
// rilettura a fine allenamento, eliminazione con «Annulla» di un allenamento tolto dalla sua pagina, errore di lettura.
// Colori del tema chiaro scritti a mano: text.secondary #6b6663, rosso del marchio #d50000. La fetch è il confine.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import History from './History';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { json, expectNoNestedContainer, colorOf } from '../test/dom';
import { setBrowserTimeZone } from '../test/timeZone';
import { textBelow } from '../test/minText';
import { strayListChildren } from '../test/accessibleNames';
import { exercise, workout, made, plan, serve, deletions, historyReads } from '../test/storico';
import { isKeyboardFocus } from '../utils/focus';

// jsdom dà :focus-visible a ogni focus: la distinzione tastiera/mouse si sostituisce (il resto del modulo resta vero)
vi.mock('../utils/focus', async (importOriginal) => ({ ...(await importOriginal()), isKeyboardFocus: vi.fn(() => true) }));
// Unità di peso dell'utente: kg salvo i test che la cambiano
const account = vi.hoisted(() => ({ isLoggedIn: true, loading: false, weightUnit: 'kg', user: undefined }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => account }));

const GREY = 'rgb(107, 102, 99)';
const RED = 'rgb(213, 0, 0)';
const NESSUNO = 'Nessun allenamento registrato';
const ERRORE = 'Errore nel caricamento della cronologia';

beforeEach(() => {
  setBrowserTimeZone('Europe/Rome');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 12, 0));
  localStorage.setItem('themeMode', 'light');
  serve({ workouts: [] });
});
afterEach(() => {
  account.weightUnit = 'kg';
  account.user = undefined;
  isKeyboardFocus.mockReset(); // un valore rimasto in coda non passa al test dopo
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// Mostra lo stato di navigazione corrente e offre un collegamento verso la pagina stessa, come fa il ventaglio
const Probe = () => {
  const { state } = useLocation();
  return (
    <>
      <p data-testid="state">{JSON.stringify(state)}</p>
      <Link to="/storico" state={{ openRecord: true }}>Registra dal ventaglio</Link>
    </>
  );
};

let navigate;
const Nav = () => { navigate = useNavigate(); return null; };

const mount = async (entry = '/storico', wait = NESSUNO) => {
  render(
    <ThemeModeProvider>
      <MemoryRouter initialEntries={[entry]}>
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
  await screen.findAllByText(wait);
};
// Elenco con degli allenamenti; `wait` = un testo che compare a lettura finita
const mountWith = async (workouts, wait = 'Push A') => {
  serve({ workouts });
  await mount('/storico', wait);
};
const dialogTitle = () => screen.queryByRole('heading', { name: 'Registra allenamento', level: 2 }) || screen.queryByText('Registra allenamento', { selector: '.MuiDialogTitle-root' });

describe('pagina Storico', () => {
  it('un solo h1 «Storico» nello stile titolo di pagina, senza il titolo «Cronologia allenamenti» e senza schede interne', async () => {
    await mount();
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Storico']);
    expect(getComputedStyle(screen.getByRole('heading', { level: 1 })).fontSize).toBe('28px');
    expect(screen.queryByText('Cronologia allenamenti')).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
    expectNoNestedContainer();
  });

  it('il titolo del documento è «Storico | LiftIndex»', async () => {
    await mount();
    expect(document.title).toBe('Storico | LiftIndex');
  });

  it('«Registra allenamento passato» sta nella riga del titolo, con una scheda attiva: pulsante di testo da 44 px, non rosso', async () => {
    await mount();
    const bottone = screen.getByRole('button', { name: 'Registra allenamento passato' });
    expect(bottone.parentElement).toBe(screen.getByRole('heading', { level: 1 }).parentElement);
    const style = getComputedStyle(bottone);
    expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(44);
    expect(style.backgroundColor).not.toBe(RED);
    expect(style.color).not.toBe(RED);
    expect(style.fontSize).toBe('16px');
  });

  it('senza una scheda attiva il comando non c\'è', async () => {
    serve({ workouts: [], plans: [{ ...plan, is_active: false }] });
    await mount();
    expect(screen.queryByRole('button', { name: 'Registra allenamento passato' })).toBeNull();
  });

  it('il comando apre la finestra «Registra allenamento»', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Registra allenamento passato' }));
    await waitFor(() => expect(dialogTitle()).toBeTruthy());
  });

  it('senza allenamenti: il testo di prima e «Registra il primo» che apre la finestra', async () => {
    await mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Registra il primo' }));
    await waitFor(() => expect(dialogTitle()).toBeTruthy());
  });
});

describe('rilettura a fine allenamento', () => {
  it('senza refreshHistory l\'elenco si legge una volta sola', async () => {
    await mount('/storico');
    expect(historyReads()).toBe(1);
  });

  it('arrivando con refreshHistory l\'elenco viene riletto', async () => {
    await mount({ pathname: '/storico', state: { refreshHistory: 1730000000000 } });
    await waitFor(() => expect(historyReads()).toBe(2));
    // Resta nello stato: lo consuma solo openRecord
    expect(screen.getByTestId('state').textContent).toBe('{"refreshHistory":1730000000000}');
  });
});

describe('«Registra allenamento passato» dal ventaglio', () => {
  it('con una scheda attiva apre la finestra e consuma lo stato', async () => {
    await mount({ pathname: '/storico', state: { openRecord: true } });
    await waitFor(() => expect(dialogTitle()).toBeTruthy());
    expect(screen.getByTestId('state').textContent).toBe('null');
  });

  it('giro vero: aperta la finestra, si va in un\'altra pagina e si torna indietro, e la finestra non si riapre', async () => {
    await mount({ pathname: '/storico', state: { openRecord: true } });
    await waitFor(() => expect(dialogTitle()).toBeTruthy());
    act(() => navigate('/altrove'));
    await screen.findByText('Altra pagina');
    act(() => navigate(-1));
    await screen.findByText(NESSUNO);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(dialogTitle()).toBeNull();
  });

  it('chiusa la finestra non si riapre da sola', async () => {
    await mount({ pathname: '/storico', state: { openRecord: true } });
    await waitFor(() => expect(dialogTitle()).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    await waitFor(() => expect(dialogTitle()).toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(dialogTitle()).toBeNull();
  });

  it('senza scheda attiva non si apre la finestra, lo stato è consumato e un avviso spiega perché', async () => {
    serve({ workouts: [], plans: [{ ...plan, is_active: false }] });
    await mount({ pathname: '/storico', state: { openRecord: true } });
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('null'));
    expect(dialogTitle()).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    const avviso = await screen.findByText('Per registrare un allenamento serve una scheda attiva.');
    expect(avviso.closest('.MuiAlert-root').className).toContain('MuiAlert-colorInfo');
  });

  it.each([
    ['la rete è giù', () => Promise.reject(new Error('rete'))],
    ['la risposta non è valida', () => Promise.resolve(json({ success: false }))],
  ])('se la lettura delle schede fallisce (%s) non dice «serve una scheda attiva» e non apre nulla', async (_, failure) => {
    const errore = vi.spyOn(console, 'error').mockImplementation(() => {});
    serve({ workouts: [], on: { 'read_plans.php': failure } });
    await mount({ pathname: '/storico', state: { openRecord: true } });
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('null'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText('Per registrare un allenamento serve una scheda attiva.')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    errore.mockRestore();
  });

  it('l\'avviso della mancanza di scheda attiva compare una volta per richiesta', async () => {
    serve({ workouts: [], plans: [{ ...plan, is_active: false }] });
    await mount({ pathname: '/storico', state: { openRecord: true } });
    const testo = 'Per registrare un allenamento serve una scheda attiva.';
    const avviso = await screen.findByText(testo);
    fireEvent.click(avviso.closest('.MuiAlert-root').querySelector('button'));
    await waitFor(() => expect(screen.queryByText(testo)).toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText(testo)).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Registra dal ventaglio' }));
    expect(await screen.findByText(testo)).toBeTruthy();
  });

  it('senza lo stato la finestra non si apre', async () => {
    await mount('/storico');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('con la pagina già aperta la finestra si apre di nuovo a ogni richiesta', async () => {
    await mount('/storico');
    fireEvent.click(screen.getByRole('link', { name: 'Registra dal ventaglio' }));
    await waitFor(() => expect(dialogTitle()).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));
    await waitFor(() => expect(dialogTitle()).toBeNull());
    fireEvent.click(screen.getByRole('link', { name: 'Registra dal ventaglio' }));
    await waitFor(() => expect(dialogTitle()).toBeTruthy());
  });
});

describe('elenco a mesi', () => {
  const novembre = made({ id: 9, date: '2026-11-03 18:30:00', day_name: 'Pull B' });
  const ottobre = made({ id: 7 });
  const settembre = made({ id: 5, date: '2026-09-28 09:00:00', day_name: 'Gambe' });

  it('un mese per card, dal più recente, con il suo h2: tutti aperti, senza comandi per aprire o chiudere', async () => {
    await mountWith([novembre, ottobre, settembre], 'Pull B');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['novembre 2026', 'ottobre 2026', 'settembre 2026']);
    expect(screen.getAllByRole('link', { name: /^(Pull B|Push A|Gambe)/ }).map((a) => a.getAttribute('href'))).toEqual(['/storico/9', '/storico/7', '/storico/5']);
    expect(document.querySelector('[aria-expanded]')).toBeNull();
    expect(screen.getAllByRole('list')).toHaveLength(3);
  });

  it('l\'elenco ha solo voci <li> senza ruolo: nessun separatore né pannello come figlio diretto', async () => {
    await mountWith([ottobre, made({ id: 8, date: '2026-10-17 10:00:00' })]);
    const list = screen.getByRole('list');
    expect(list.children).toHaveLength(2);
    expect(strayListChildren(list)).toEqual([]);
  });

  it('la riga è un collegamento a /storico/<id>: titolo = giorno della scheda; sotto data, durata e volume', async () => {
    await mountWith([ottobre]);
    const riga = screen.getByRole('link', { name: /^Push A/ });
    expect(riga.getAttribute('href')).toBe('/storico/7');
    expect(within(riga).getByText('Push A')).toBeTruthy();
    const sotto = within(riga).getByText('dom 18 ott · 1h 00m · 1440 kg');
    expect(colorOf(sotto)).toBe(GREY);
    expect(getComputedStyle(sotto).fontVariantNumeric).toBe('tabular-nums');
  });

  it('niente dettaglio in riga: né esercizi né serie né comandi di azione', async () => {
    await mountWith([ottobre]);
    expect(screen.queryByText('Panca piana')).toBeNull();
    expect(screen.queryByText(/× 8/)).toBeNull();
    expect(screen.queryByRole('menu')).toBeNull();
    ['Condividi', 'Modifica data', 'Cambia data', 'Elimina', 'Altre azioni'].forEach((nome) => {
      expect(screen.queryByRole('button', { name: new RegExp(nome) })).toBeNull();
    });
  });

  it('senza giorno della scheda il titolo è la data e sotto c\'è l\'ora', async () => {
    await mountWith([made({ day_name: null })], 'domenica 18 ottobre');
    const riga = screen.getByRole('link', { name: /^domenica 18 ottobre/ });
    expect(within(riga).getByText('02:00 · 1h 00m · 1440 kg')).toBeTruthy();
  });

  it('senza durata e senza volume la riga ha solo ciò che c\'è', async () => {
    const senzaDurata = made({ duration_seconds: null });
    const senzaVolume = made({ id: 8, date: '2026-10-17 10:00:00', exercises: [exercise(1, 'Corpo libero', [{ set_number: 1, weight: 0, reps: 0 }])] });
    await mountWith([senzaDurata, senzaVolume]);
    expect(screen.getByText('dom 18 ott · 1440 kg')).toBeTruthy();
    expect(screen.getByText('sab 17 ott · 1h 00m')).toBeTruthy();
  });

  it('il volume è nell\'unità dell\'utente: in lb 1440 kg sono 3175 lb', async () => {
    account.weightUnit = 'lb';
    await mountWith([ottobre]);
    expect(screen.getByText('dom 18 ott · 1h 00m · 3175 lb')).toBeTruthy();
    expect(screen.queryByText(/kg/)).toBeNull();
  });

  it('un allenamento che batte un record ha il segno «Record»; uno senza, o con solo il volume migliore, no', async () => {
    const prima = made({ id: 6, date: '2026-10-10 02:00:00', day_name: 'Prima', exercises: [exercise(1, 'Panca piana', [{ set_number: 1, weight: 100, reps: 1 }])] });
    const volume = made({ id: 7, date: '2026-10-12 02:00:00', day_name: 'Solo volume', exercises: [exercise(1, 'Panca piana', [{ set_number: 1, weight: 60, reps: 8 }])] });
    const vero = made({ id: 8, date: '2026-10-18 02:00:00', day_name: 'Con record', exercises: [exercise(1, 'Panca piana', [{ set_number: 1, weight: 110, reps: 3 }])] });
    await mountWith([vero, volume, prima], 'Con record');
    const riga = (titolo) => screen.getByRole('link', { name: new RegExp(`^${titolo}`) });
    expect(within(riga('Con record')).getByRole('img', { name: 'Record' })).toBeTruthy();
    expect(within(riga('Solo volume')).queryByRole('img', { name: 'Record' })).toBeNull();
    expect(within(riga('Prima')).queryByRole('img', { name: 'Record' })).toBeNull();
  });

  it('i mesi sono quelli scritti nella data', async () => {
    await mountWith([made({ id: 2, date: '2026-04-01 00:30:00' }), made({ id: 1, date: '2026-03-31 23:30:00' })]);
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['aprile 2026', 'marzo 2026']);
  });

  it.each(['UTC', 'Europe/Rome', 'America/Los_Angeles', 'Asia/Tokyo'])('con il browser a %s data e ora restano quelle scritte, anche un\'ora che nel suo fuso non esiste (02:30 del cambio ora)', async (zona) => {
    setBrowserTimeZone(zona);
    await mountWith([made({ id: 1, date: '2026-03-29 02:30:00', day_name: null }), made({ id: 2, date: '2026-03-08 02:30:00', day_name: null })], 'domenica 29 marzo');
    expect(screen.getAllByText(/^02:30 · /)).toHaveLength(2);
    expect(screen.getByText('domenica 8 marzo')).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['marzo 2026']);
  });

  it('nessun testo sotto i 16px, il titolo lungo va a capo dentro la card e non c\'è un Container annidato', async () => {
    const lungo = 'Un nome di giorno molto lungo che a 320 pixel deve andare a capo senza uscire dalla card';
    await mountWith([made({ day_name: lungo })], lungo);
    expect(textBelow(document.body, 16, '.nessuno')).toEqual([]);
    expect(getComputedStyle(screen.getByText(lungo)).overflowWrap).toBe('anywhere');
    expectNoNestedContainer();
  });

  it('le righe sono aree da almeno 60 px e di rosso non c\'è niente', async () => {
    await mountWith([ottobre, settembre]);
    screen.getAllByRole('link', { name: /^(Push A|Gambe)/ }).forEach((riga) => {
      expect(parseFloat(getComputedStyle(riga).minHeight)).toBeGreaterThanOrEqual(60);
    });
    const rossi = [...document.body.querySelectorAll('*')].filter((el) => {
      const s = getComputedStyle(el);
      return [s.color, s.backgroundColor, s.borderTopColor, s.borderBottomColor, s.borderLeftColor, s.borderRightColor].includes(RED);
    });
    expect(rossi.map((el) => el.textContent)).toEqual([]);
  });

  it('il clic sulla riga porta alla pagina dell\'allenamento', async () => {
    await mountWith([ottobre]);
    fireEvent.click(screen.getByRole('link', { name: /^Push A/ }));
    expect(await screen.findByText('Pagina allenamento')).toBeTruthy();
  });
});

describe('errore di lettura', () => {
  // Legge male finché `ripara()` non viene chiamata
  const fallisce = (risposta) => {
    let guasto = true;
    serve({ workouts: [workout], on: { 'workout_history/read.php': () => (guasto ? risposta() : json({ records: [workout] })) } });
    return () => { guasto = false; };
  };
  let errore;
  beforeEach(() => { errore = vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => errore.mockRestore());

  it.each([
    ['il server risponde 500', () => json({ message: 'Guasto' }, 500)],
    ['la rete è giù', () => Promise.reject(new Error('rete'))],
  ])('se %s si dice l\'errore con «Riprova», non «nessun allenamento»', async (_, risposta) => {
    fallisce(risposta);
    await mount('/storico', ERRORE);
    expect(screen.queryByText(NESSUNO)).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Registra il primo' })).toBeNull();
  });

  it('«Riprova» (da 44 px) rilegge: a lettura riuscita compare l\'elenco', async () => {
    const ripara = fallisce(() => json({ message: 'Guasto' }, 500));
    await mount('/storico', ERRORE);
    expect(parseFloat(getComputedStyle(screen.getByRole('button', { name: 'Riprova' })).minHeight)).toBeGreaterThanOrEqual(44);
    ripara();
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByText('Push A')).toBeTruthy();
    expect(screen.queryByText(ERRORE)).toBeNull();
    expect(historyReads()).toBe(2);
  });

  it('404 vuol dire nessun allenamento registrato, non un errore', async () => {
    serve({ on: { 'workout_history/read.php': () => json({ message: 'Nessuno' }, 404) } });
    await mount('/storico', NESSUNO);
    expect(screen.queryByText(ERRORE)).toBeNull();
  });
});

describe('eliminazione fatta dalla pagina dell\'allenamento', () => {
  const altro = made({ id: 8, date: '2026-10-17 02:00:00', day_name: 'Pull B' });
  const annulla = () => within(screen.getByRole('alert')).getByRole('button', { name: 'Annulla' });
  const passano = (ms) => act(async () => { vi.advanceTimersByTime(ms); });
  const arriva = async (state = { deleted: 7 }) => {
    serve({ workouts: [workout, altro] });
    await mount({ pathname: '/storico', state }, 'Allenamento eliminato');
  };
  // Dopo l'arrivo i timer dell'app (il conto dei 10 secondi) si fanno finti, così il test li fa scorrere. Il fuoco sta su
  // «Annulla» e ferma il conto: chi vuole lo scadere lo lascia prima.
  const conTimerFinti = () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(new Date(2026, 9, 20, 12, 0));
  };
  const rilasciaFuoco = () => act(() => document.activeElement.blur());

  it('la riga sparisce subito, compare «Allenamento eliminato» con «Annulla» sul quale va il fuoco, e il server non è ancora chiamato', async () => {
    await arriva();
    expect(screen.queryByRole('link', { name: /^Push A/ })).toBeNull();
    expect(screen.getByRole('link', { name: /^Pull B/ })).toBeTruthy();
    expect(document.activeElement).toBe(annulla());
    expect(deletions()).toHaveLength(0);
  });

  it('l\'indicazione è letta una volta sola e tolta dall\'indirizzo', async () => {
    await arriva();
    expect(screen.getByTestId('state').textContent).toBe('null');
  });

  it('arrivando senza l\'indicazione non c\'è nessun messaggio', async () => {
    await mountWith([workout, altro]);
    expect(screen.queryByText('Allenamento eliminato')).toBeNull();
    expect(screen.getByRole('link', { name: /^Push A/ })).toBeTruthy();
  });

  it('«Annulla» riporta la riga in lista, il fuoco va alla riga e il server non viene mai chiamato', async () => {
    await arriva();
    fireEvent.click(annulla());
    const riga = screen.getByRole('link', { name: /^Push A/ });
    await waitFor(() => expect(document.activeElement).toBe(riga));
    conTimerFinti();
    await passano(20000);
    expect(deletions()).toHaveLength(0);
  });

  it('allo scadere dei 10 secondi parte la richiesta di eliminazione per quell\'id', async () => {
    await arriva();
    conTimerFinti();
    rilasciaFuoco();
    await passano(9999);
    expect(deletions()).toHaveLength(0);
    await passano(1);
    expect(deletions()).toHaveLength(1);
    expect(JSON.parse(deletions()[0][1].body)).toEqual({ id: 7 });
    expect(screen.queryByRole('link', { name: /^Push A/ })).toBeNull();
  });

  it('uscendo dall\'elenco durante i 10 secondi la richiesta parte subito, come prima', async () => {
    await arriva();
    act(() => navigate('/altrove'));
    await screen.findByText('Altra pagina');
    await waitFor(() => expect(deletions()).toHaveLength(1));
    expect(JSON.parse(deletions()[0][1].body)).toEqual({ id: 7 });
  });

  it('con «indietro» l\'eliminazione non si ripete: la riga annullata resta, niente messaggio, niente richiesta', async () => {
    await arriva();
    fireEvent.click(annulla());
    act(() => navigate('/altrove'));
    await screen.findByText('Altra pagina');
    act(() => navigate(-1));
    expect(await screen.findByRole('link', { name: /^Push A/ })).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText('Allenamento eliminato')).toBeNull();
    expect(deletions()).toHaveLength(0);
  });

  it('se il server rifiuta, la riga torna in lista e compare l\'errore', async () => {
    serve({ workouts: [workout, altro], on: { 'workout_history/delete.php': () => json({ message: 'Allenamento bloccato' }, 400) } });
    await mount({ pathname: '/storico', state: { deleted: 7 } }, 'Allenamento eliminato');
    conTimerFinti();
    rilasciaFuoco();
    await passano(10000);
    expect(screen.getByRole('link', { name: /^Push A/ })).toBeTruthy();
    expect(screen.getByText('Allenamento bloccato')).toBeTruthy();
  });

  it('un altro avviso mentre «Annulla» aspetta sta sopra, senza coprirlo', async () => {
    serve({ workouts: [workout, altro], plans: [{ ...plan, is_active: false }] });
    await mount({ pathname: '/storico', state: { deleted: 7 } }, 'Allenamento eliminato');
    fireEvent.click(screen.getByRole('link', { name: 'Registra dal ventaglio' }));
    const avviso = (await screen.findByText('Per registrare un allenamento serve una scheda attiva.')).closest('.MuiSnackbar-root');
    const attesa = screen.getByText('Allenamento eliminato').closest('.MuiSnackbar-root');
    expect(getComputedStyle(avviso).bottom).not.toBe(getComputedStyle(attesa).bottom);
  });

  // 2.4.3 e 2.2.1: la tastiera arriva subito a «Annulla», il conto si ferma finché lo si usa, il fuoco non finisce su body
  describe('tastiera e fuoco', () => {
    it('con il fuoco da tastiera su «Annulla» i 10 secondi non scadono: la richiesta non parte', async () => {
      await arriva();
      conTimerFinti();
      await passano(30000);
      expect(deletions()).toHaveLength(0);
      expect(screen.getByText('Allenamento eliminato')).toBeTruthy();
    });

    it('se il fuoco su «Annulla» non viene dalla tastiera (mouse, tocco) il conto parte e la richiesta parte', async () => {
      await arriva();
      conTimerFinti();
      isKeyboardFocus.mockReturnValue(false);
      act(() => annulla().blur());
      act(() => annulla().focus());
      await passano(10000);
      expect(deletions()).toHaveLength(1);
    });

    it('con il puntatore sul messaggio il conto si ferma, e quando esce riparte', async () => {
      await arriva();
      conTimerFinti();
      act(() => annulla().blur());
      const messaggio = screen.getByText('Allenamento eliminato').closest('.MuiSnackbar-root');
      fireEvent.mouseEnter(messaggio);
      await passano(30000);
      expect(deletions()).toHaveLength(0);
      fireEvent.mouseLeave(messaggio);
      await passano(10000);
      expect(deletions()).toHaveLength(1);
    });

    it('allo scadere il fuoco resta nella pagina, non su body', async () => {
      await arriva();
      conTimerFinti();
      rilasciaFuoco();
      await passano(10000);
      await passano(1000);
      expect(document.activeElement).not.toBe(document.body);
      expect(document.body.contains(document.activeElement)).toBe(true);
    });

    it('se l\'utente ha spostato il fuoco altrove, la scadenza non glielo porta via', async () => {
      await arriva();
      conTimerFinti();
      const riga = screen.getByRole('link', { name: /^Pull B/ });
      act(() => riga.focus());
      await passano(10000);
      await passano(1000);
      expect(document.activeElement).toBe(riga);
    });
  });
});
