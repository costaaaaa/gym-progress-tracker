// Pagina di un allenamento (/storico/:id): intestazione, riquadri, record, dettaglio, azioni (Condividi, Cambia data, Elimina),
// ritorno all'elenco dopo l'eliminazione, id che non esiste, errore di lettura. La fetch è il confine.
// Colori del tema chiaro scritti a mano: text.secondary #6b6663, rosso del marchio #d50000.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act, waitForElementToBeRemoved } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import WorkoutPage from './WorkoutPage';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import { json, expectNoNestedContainer, colorOf } from '../../test/dom';
import { setBrowserTimeZone } from '../../test/timeZone';
import { textBelow } from '../../test/minText';
import { unnamedControls } from '../../test/accessibleNames';
import { exercise, workout, made, serve, deletions, historyReads } from '../../test/storico';

// La card da condividere si disegna su canvas: qui basta sapere con quali dati si apre
vi.mock('../../components/ShareCardDialog', () => ({
  default: ({ open, stats }) => (open ? <div role="dialog" aria-label="Card">{`${stats.title}|${stats.volumeKg}|${stats.sets}|${stats.record?.name ?? '-'}`}</div> : null),
}));
const account = vi.hoisted(() => ({ isLoggedIn: true, loading: false, weightUnit: 'kg', user: undefined }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => account }));

const GREY = 'rgb(107, 102, 99)';
const RED = 'rgb(213, 0, 0)';
const ERRORE = 'Errore nel caricamento della cronologia';

beforeEach(() => {
  setBrowserTimeZone('Europe/Rome');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 20, 12, 0));
  localStorage.setItem('themeMode', 'light');
});
afterEach(() => {
  account.weightUnit = 'kg';
  account.user = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// Lo stato di navigazione della schermata in corso: dopo l'eliminazione l'elenco lo riceve
const StateProbe = () => <p data-testid="stato">{JSON.stringify(useLocation().state)}</p>;

const mount = async (workouts = [workout], { path = '/storico/7', wait = 'Push A', on } = {}) => {
  serve({ workouts, on });
  render(
    <ThemeModeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/storico" element={<div>ELENCO<StateProbe /></div>} />
          <Route path="/storico/:id" element={<WorkoutPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeModeProvider>,
  );
  await screen.findByText(wait);
};
const riquadro = (nome) => within(screen.getByText(nome).parentElement);
const azione = (nome) => screen.getByRole('button', { name: nome });

describe('intestazione', () => {
  it('h1 = giorno della scheda, sotto data completa e ora; il titolo del documento è lo stesso', async () => {
    await mount();
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Push A']);
    expect(getComputedStyle(screen.getByRole('heading', { level: 1 })).fontSize).toBe('28px');
    const sotto = screen.getByText('domenica 18 ottobre 2026 · 02:00');
    expect(colorOf(sotto)).toBe(GREY);
    expect(document.title).toBe('Push A | LiftIndex');
    expectNoNestedContainer();
  });

  it('senza giorno della scheda l\'h1 è la data', async () => {
    await mount([made({ day_name: null })], { wait: 'domenica 18 ottobre' });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('domenica 18 ottobre');
  });

  it('il ritorno «Storico» porta all\'elenco ed è un\'area da 44 px', async () => {
    await mount();
    const indietro = screen.getByRole('link', { name: 'Storico' });
    expect(indietro.getAttribute('href')).toBe('/storico');
    expect(parseFloat(getComputedStyle(indietro).width)).toBeGreaterThanOrEqual(44);
    expect(parseFloat(getComputedStyle(indietro).height)).toBeGreaterThanOrEqual(44);
  });

  it('un titolo lungo va a capo', async () => {
    const lungo = 'Un nome di giorno molto lungo che a 320 pixel deve andare a capo';
    await mount([made({ day_name: lungo })], { wait: lungo });
    expect(getComputedStyle(screen.getByRole('heading', { level: 1 })).overflowWrap).toBe('anywhere');
  });
});

describe('riquadri', () => {
  it('Durata, Volume (nell\'unità dell\'utente) e Serie allenanti', async () => {
    await mount();
    expect(riquadro('Durata').getByText('1h 00m')).toBeTruthy();
    expect(riquadro('Volume').getByText('1440 kg')).toBeTruthy();
    expect(riquadro('Serie').getByText('3')).toBeTruthy();
  });

  it('senza durata c\'è «–»', async () => {
    await mount([made({ duration_seconds: null })]);
    expect(riquadro('Durata').getByText('–')).toBeTruthy();
  });

  it('le serie di riscaldamento non contano nel volume né nelle serie', async () => {
    const sets = [{ set_number: 1, weight: 20, reps: 10, is_warmup: true }, { set_number: 2, weight: 60, reps: 8 }];
    await mount([made({ exercises: [exercise(1, 'Panca piana', sets)] })]);
    expect(riquadro('Volume').getByText('480 kg')).toBeTruthy();
    expect(riquadro('Serie').getByText('1')).toBeTruthy();
  });

  it('in lb il volume è convertito sul totale: 1440 kg = 3175 lb', async () => {
    account.weightUnit = 'lb';
    await mount();
    expect(riquadro('Volume').getByText('3175 lb')).toBeTruthy();
  });
});

describe('record', () => {
  const prima = made({ id: 6, date: '2026-10-10 02:00:00', day_name: 'Prima', exercises: [exercise(1, 'Panca piana', [{ set_number: 1, weight: 100, reps: 1 }]), exercise(4, 'Flessioni', [{ set_number: 1, weight: 0, reps: 10 }])] });
  const vero = made({ id: 8, exercises: [exercise(1, 'Panca piana', [{ set_number: 1, weight: 110, reps: 3 }]), exercise(4, 'Flessioni', [{ set_number: 1, weight: 0, reps: 15 }])] });

  it('una card «Record» con esercizio e quale record', async () => {
    await mount([vero, prima], { path: '/storico/8' });
    expect(screen.getByRole('heading', { level: 2, name: 'Record' })).toBeTruthy();
    const card = within(screen.getByRole('heading', { level: 2, name: 'Record' }).closest('section'));
    expect(card.getAllByRole('listitem')).toHaveLength(2);
    ['Panca piana', 'Peso massimo · 110 kg × 3', 'Flessioni', 'Più ripetizioni · 15'].forEach((testo) => expect(card.getByText(testo)).toBeTruthy());
  });

  it('in lb il peso del record è in libbre', async () => {
    account.weightUnit = 'lb';
    await mount([vero, prima], { path: '/storico/8' });
    expect(screen.getByText('Peso massimo · 242,5 lb × 3')).toBeTruthy();
  });

  it('senza record, o con solo il volume migliore, la card non c\'è', async () => {
    const volume = made({ id: 8, exercises: [exercise(1, 'Panca piana', [{ set_number: 1, weight: 60, reps: 8 }])] });
    await mount([volume, prima], { path: '/storico/8' });
    expect(screen.queryByRole('heading', { level: 2, name: 'Record' })).toBeNull();
  });
});

describe('dettaglio', () => {
  it('note, esercizi e serie nell\'unità dell\'utente, in una card; in kg come prima', async () => {
    await mount([made({ notes: 'Spalla a posto' })]);
    expect(screen.getByText('Spalla a posto')).toBeTruthy();
    ['Panca piana', 'Croci', 'Dip'].forEach((nome) => expect(screen.getByText(nome)).toBeTruthy());
    expect(screen.getAllByText('60 kg × 8')).toHaveLength(3);
  });

  it('in lb le serie sono mostrate in libbre (60 kg = 132,25 lb), i dati restano in kg', async () => {
    account.weightUnit = 'lb';
    await mount();
    expect(screen.getAllByText('132,25 lb × 8')).toHaveLength(3);
    expect(screen.queryByText(/kg/)).toBeNull();
  });

  it('un allenamento senza esercizi dice che non c\'è dettaglio', async () => {
    await mount([made({ exercises: [] })]);
    expect(screen.getByText('Nessun dettaglio disponibile per questo allenamento')).toBeTruthy();
  });

  it('marca la serie di riscaldamento e conta solo le allenanti nel badge «serie» (#66)', async () => {
    const sets = [{ set_number: 1, weight: 20, reps: 10, is_warmup: true }, { set_number: 2, weight: 60, reps: 8 }];
    await mount([made({ exercises: [exercise(1, 'Panca piana', sets), exercise(2, 'Croci')] })]);
    const pancaBox = screen.getByText('Panca piana').closest('div').parentElement;
    expect(within(pancaBox).getByText('Risc.')).toBeTruthy();
    expect(within(pancaBox).getByText('1 serie')).toBeTruthy();
  });
});

describe('aspetto', () => {
  // Una pagina con tutto: note, riscaldamento, tecnica, note dell'esercizio, record e fuso diverso da quello del dispositivo
  const ricca = made({
    notes: 'Spalla a posto',
    time_zone: 'America/New_York',
    started_at: '2026-10-18T02:00:00-04:00',
    exercises: [{ ...exercise(1, 'Panca piana', [
      { set_number: 1, weight: 20, reps: 10, is_warmup: true },
      { set_number: 2, weight: 110, reps: 3, intensity_technique: 'dropset' },
    ]), notes: 'Pausa al petto' }],
  });
  const prima = made({ id: 6, date: '2026-10-10 02:00:00', exercises: [exercise(1, 'Panca piana', [{ set_number: 1, weight: 100, reps: 1 }])] });

  it('nessun testo sotto i 16px', async () => {
    await mount([ricca, prima]);
    expect(screen.getByText('Risc.')).toBeTruthy();
    expect(screen.getByText('Record', { selector: 'h2' })).toBeTruthy();
    expect(textBelow(document.body, 16, '.nessuno')).toEqual([]);
  });

  it('di rosso resta solo «Elimina»; Condividi e Cambia data sono di contorno e le tre azioni sono aree da 44 px', async () => {
    await mount();
    const rossi = [...document.body.querySelectorAll('*')].filter((el) => el.textContent).filter((el) => {
      const s = getComputedStyle(el);
      return [s.color, s.backgroundColor, s.borderTopColor, s.borderBottomColor, s.borderLeftColor, s.borderRightColor].includes(RED);
    });
    expect(rossi.map((el) => el.textContent)).toEqual(['Elimina']);
    ['Condividi', 'Cambia data'].forEach((nome) => expect(azione(nome).className).toContain('MuiButton-outlined'));
    expect(azione('Elimina').className).toContain('MuiButton-text');
    ['Condividi', 'Cambia data', 'Elimina'].forEach((nome) => {
      expect(parseFloat(getComputedStyle(azione(nome)).minHeight)).toBeGreaterThanOrEqual(44);
    });
  });

  it('ogni comando ha un nome', async () => {
    await mount([ricca, prima]);
    expect(unnamedControls()).toEqual([]);
  });
});

describe('Condividi', () => {
  it('apre la card con i dati dell\'allenamento e i suoi record', async () => {
    const prima = made({ id: 6, date: '2026-10-10 02:00:00', exercises: [exercise(1, 'Panca piana', [{ set_number: 1, weight: 100, reps: 1 }])] });
    const vero = made({ id: 8, exercises: [exercise(1, 'Panca piana', [{ set_number: 1, weight: 110, reps: 3 }])] });
    await mount([vero, prima], { path: '/storico/8' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(azione('Condividi'));
    expect(screen.getByRole('dialog', { name: 'Card' }).textContent).toBe('Petto|330|1|Panca piana');
  });
});

describe('Cambia data', () => {
  const sposta = () => ({ 'update_date.php': () => json({ success: true, new_date: '2026-10-16T02:00:00+02:00', started_at: '2026-10-16T02:00:00+02:00', time_zone: null }) });

  it('apre la finestra; spostata, si resta sulla pagina con la data nuova e l\'avviso', async () => {
    await mount([workout], { on: sposta() });
    fireEvent.click(azione('Cambia data'));
    fireEvent.change(await screen.findByLabelText('Nuova data'), { target: { value: '2026-10-16' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
    expect(await screen.findByText('Data aggiornata con successo')).toBeTruthy();
    expect(screen.getByText('venerdì 16 ottobre 2026 · 02:00')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Push A');
    expect(screen.queryByText('ELENCO')).toBeNull();
  });

  it('con un allenamento troppo vecchio il comando è spento e la spiegazione si legge accanto', async () => {
    await mount([made({ date: '2026-08-01 02:00:00' })]);
    const bottone = azione('Cambia data');
    expect(bottone.disabled).toBe(true);
    const spiegazione = screen.getByText('Si possono spostare solo gli allenamenti degli ultimi 30 giorni');
    expect(bottone.getAttribute('aria-describedby')).toBe(spiegazione.id);
    expect(colorOf(spiegazione)).toBe(GREY);
  });

  it('entro i 30 giorni il comando è acceso e non c\'è nessuna spiegazione', async () => {
    await mount();
    expect(azione('Cambia data').disabled).toBe(false);
    expect(screen.queryByText('Si possono spostare solo gli allenamenti degli ultimi 30 giorni')).toBeNull();
  });
});

describe('Elimina', () => {
  const anteprima = { success: true, xp_removed: 30, streak_before: 3, streak_after: 2, achievements_removed: ['strength_100'] };
  const conAnteprima = { 'workout_history/delete.php': (init) => (JSON.parse(init.body).preview ? json(anteprima) : json({ success: true })) };
  const apri = async (workouts, opzioni) => {
    await mount(workouts, opzioni);
    fireEvent.click(azione('Elimina'));
    await screen.findByText('Conferma eliminazione');
    await act(async () => {});
  };
  const confermaNelDialog = () => within(screen.getByRole('dialog')).getByRole('button', { name: 'Elimina' });

  it('apre la conferma; confermata si torna all\'elenco con l\'id nello stato, e la richiesta non parte da qui', async () => {
    await apri();
    expect(screen.getByText('Sei sicuro di voler eliminare questo allenamento?')).toBeTruthy();
    fireEvent.click(confermaNelDialog());
    expect(await screen.findByText('ELENCO')).toBeTruthy();
    expect(screen.getByTestId('stato').textContent).toBe('{"deleted":7}');
    expect(deletions()).toHaveLength(0);
  });

  it('«Annulla» nella conferma lascia la pagina com\'è', async () => {
    await apri();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annulla' }));
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
    expect(screen.queryByText('ELENCO')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Push A');
  });

  it('l\'anteprima ha l\'id dell\'allenamento e alla riapertura non resta quella di prima', async () => {
    await mount([workout], { on: conAnteprima });
    fireEvent.click(azione('Elimina'));
    await screen.findByText('Conferma eliminazione');
    expect(await screen.findByText('Perderai 30 XP.')).toBeTruthy();
    const anteprime = fetch.mock.calls.filter(([url, init]) => url.includes('delete.php') && init.body.includes('preview'));
    expect(JSON.parse(anteprime[0][1].body)).toEqual({ id: 7, preview: true });

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Annulla' }));
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
    serveSenzaAnteprima();
    fireEvent.click(azione('Elimina'));
    await screen.findByText('Conferma eliminazione');
    await act(async () => {});
    expect(screen.queryByText('Perderai 30 XP.')).toBeNull();
  });

  // Il secondo clic arriva mentre il dialog si chiude
  it('due clic di fila su «Elimina» non danno errori e lasciano un solo ritorno all\'elenco', async () => {
    await apri();
    const errori = [];
    const annota = (evento) => { errori.push(evento.error); evento.preventDefault(); };
    window.addEventListener('error', annota);
    try {
      const conferma = confermaNelDialog();
      fireEvent.click(conferma);
      fireEvent.click(conferma);
      expect(errori).toEqual([]);
      expect(await screen.findByText('ELENCO')).toBeTruthy();
      expect(screen.getByTestId('stato').textContent).toBe('{"deleted":7}');
    } finally {
      window.removeEventListener('error', annota);
    }
  });

  it('con modulo Livelli attivo: punti, streak e traguardi che si perdono', async () => {
    await apri([workout], { on: conAnteprima });
    expect(screen.getByText('Perderai 30 XP.')).toBeTruthy();
    expect(screen.getByText(/Lo streak passa da 3 a 2/)).toBeTruthy();
  });

  it('con modulo Livelli non attivo niente di tutto questo', async () => {
    account.user = { modules: { body: true, recovery: true, levels: false, groups: true, ai: true } };
    await apri([workout], { on: conAnteprima });
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText(/XP/)).toBeNull();
    expect(within(dialog).queryByText(/streak/i)).toBeNull();
    expect(within(dialog).queryByText(/100 kg/)).toBeNull();
  });

  describe('avvisi su Salute del telefono', () => {
    const AVVISO = 'Questo allenamento è anche nell\'app Salute del telefono e lì resta. Per toglierlo anche da lì, eliminalo dall\'app LiftIndex sul telefono.';

    it('un allenamento che è in Salute: la conferma lo dice', async () => {
      await apri([made({ health_written: true })]);
      expect(screen.getByText(AVVISO)).toBeTruthy();
    });

    it('uno che non è in Salute: la conferma non ne parla', async () => {
      await apri([made({ health_written: false })]);
      expect(screen.queryByText(AVVISO)).toBeNull();
    });
  });
});

// Dopo la prima anteprima il server non ne manda altre: la riapertura non deve mostrare quella vecchia
const serveSenzaAnteprima = () => {
  const base = fetch.getMockImplementation();
  fetch.mockImplementation((url, init) => (url.includes('delete.php') ? new Promise(() => {}) : base(url, init)));
};

describe('id che non c\'è, caricamento ed errore di lettura', () => {
  it('un id che non esiste riporta all\'elenco, ma solo a lettura finita', async () => {
    await mount([workout], { path: '/storico/99', wait: 'ELENCO' });
    expect(historyReads()).toBe(1);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('mentre legge c\'è il caricamento e non si va via', async () => {
    serve();
    render(
      <ThemeModeProvider>
        <MemoryRouter initialEntries={['/storico/99']}>
          <Routes>
            <Route path="/storico" element={<div>ELENCO</div>} />
            <Route path="/storico/:id" element={<WorkoutPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeModeProvider>,
    );
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByText('ELENCO')).toBeNull();
    await screen.findByText('ELENCO');
  });

  describe('errore di lettura', () => {
    let errore;
    beforeEach(() => { errore = vi.spyOn(console, 'error').mockImplementation(() => {}); });
    afterEach(() => errore.mockRestore());
    const guasta = () => {
      let guasto = true;
      return { on: { 'workout_history/read.php': () => (guasto ? json({ message: 'Guasto' }, 500) : json({ records: [workout] })) }, ripara: () => { guasto = false; } };
    };

    it('si dice l\'errore con «Riprova»: non si va via e non è «allenamento non trovato»', async () => {
      const { on } = guasta();
      await mount([workout], { wait: ERRORE, on });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.queryByText('ELENCO')).toBeNull();
      expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
      expect(parseFloat(getComputedStyle(screen.getByRole('button', { name: 'Riprova' })).minHeight)).toBeGreaterThanOrEqual(44);
    });

    it('«Riprova» rilegge: a lettura riuscita compare l\'allenamento', async () => {
      const { on, ripara } = guasta();
      await mount([workout], { wait: ERRORE, on });
      ripara();
      fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
      expect(await screen.findByRole('heading', { level: 1, name: 'Push A' })).toBeTruthy();
      expect(screen.queryByText(ERRORE)).toBeNull();
    });

    it('anche con la rete giù', async () => {
      await mount([workout], { wait: ERRORE, on: { 'workout_history/read.php': () => Promise.reject(new Error('rete')) } });
      expect(screen.queryByText('ELENCO')).toBeNull();
    });
  });
});

describe('data e ora: l\'orologio del luogo, non quello del browser', () => {
  it.each(['UTC', 'Europe/Rome', 'America/Los_Angeles', 'Asia/Tokyo'])('con il browser a %s un\'ora che nel suo fuso non esiste (02:30 del cambio ora) resta quella scritta', async (zona) => {
    setBrowserTimeZone(zona);
    await mount([made({ date: '2026-03-29 02:30:00', started_at: '2026-03-29T02:30:00+00:00' })]);
    expect(screen.getByText('domenica 29 marzo 2026 · 02:30')).toBeTruthy();
  });

  it('fatto a New York mentre il dispositivo è a Roma: badge accanto all\'orario, a 16px', async () => {
    await mount([made({ time_zone: 'America/New_York', started_at: '2026-10-18T02:00:00-04:00' })]);
    expect(screen.getByLabelText('Fuso orario: New York · UTC−4')).toBeTruthy();
    expect(getComputedStyle(screen.getByText('New York · UTC−4')).fontSize).toBe('16px');
  });

  it('stesso fuso del dispositivo o allenamento senza fuso: nessun badge', async () => {
    setBrowserTimeZone('America/New_York');
    await mount([made({ time_zone: 'America/New_York', started_at: '2026-10-18T02:00:00-04:00' })]);
    expect(screen.queryByLabelText(/Fuso orario/)).toBeNull();
  });
});
