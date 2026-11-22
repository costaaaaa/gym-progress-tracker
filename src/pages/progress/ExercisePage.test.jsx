// Pagina di un esercizio (/progressi/esercizi/:id): intestazione e ritorno, riquadri, grafico, cronologia, unità di peso,
// fuso e posizione nella seduta, id che non c'è, errore di lettura.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import i18n from '../../i18n';
import ExercisePage from './ExercisePage';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import { json } from '../../test/dom';
import { textBelow } from '../../test/minText';
import { setBrowserTimeZone } from '../../test/timeZone';

const account = vi.hoisted(() => ({ weightUnit: 'kg' }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ weightUnit: account.weightUnit }) }));

// Una sessione di «Squat»: 15 ripetizioni con `weight` kg valgono un 1RM stimato di weight × 1,5
const workout = (id, date, weight, over = {}) => ({
  id,
  date,
  started_at: `${date.replace(' ', 'T')}+02:00`,
  time_zone: null,
  exercises: [{ exercise_id: 1, name: 'Squat', sets: [{ weight, reps: 15 }] }],
  ...over,
});

// 7 sessioni, 1RM stimato 60 66 72 90 78 84 75: la migliore è la quarta, l'ultima vale 75; record alla 2ª, 3ª e 4ª
const WEIGHTS = [40, 44, 48, 60, 52, 56, 50];
const SEVEN = WEIGHTS.map((w, i) => workout(10 + i, `2026-10-${String(i + 1).padStart(2, '0')} 10:00:00`, w));

const catalog = [{ id: 1, name: 'Squat con bilanciere', muscle_group: 'Quadricipiti' }];

const stubFetch = (records = SEVEN, { exercises = () => json({ records: catalog }), history = () => json({ records }) } = {}) => {
  vi.stubGlobal('fetch', vi.fn((url) => Promise.resolve(url.includes('read_all.php') ? exercises() : history())));
};

const Where = () => {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
};

const open = (path = '/progressi/esercizi/1') => render(
  <ThemeModeProvider>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/progressi/esercizi/:id" element={<ExercisePage />} />
        <Route path="/progressi" element={<Where />} />
      </Routes>
    </MemoryRouter>
  </ThemeModeProvider>,
);
const mount = async (path) => {
  open(path);
  return screen.findByRole('heading', { level: 1, name: 'Squat con bilanciere' });
};

beforeEach(() => {
  account.weightUnit = 'kg';
  localStorage.setItem('themeMode', 'light');
  setBrowserTimeZone('Europe/Rome');
  stubFetch();
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); });

const section = (title) => screen.getByRole('heading', { level: 2, name: title }).closest('section');
const tile = (label) => screen.getByText(label, { selector: 'p' }).closest('.MuiCard-root');
// Le voci della cronologia, dalla più recente
const entries = () => within(section('Cronologia')).getAllByRole('listitem');
const entry = (date) => entries().find((li) => within(li).queryByText(date));

describe('intestazione', () => {
  it('h1 col nome dell\'esercizio, sotto il gruppo muscolare', async () => {
    const h1 = await mount();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(h1.parentElement.textContent).toContain('Quadricipiti');
    expect(textBelow(h1.parentElement, 16)).toEqual([]);
  });

  it('il ritorno è un collegamento a /progressi con un nome, da 44px', async () => {
    await mount();
    const back = screen.getByRole('link', { name: 'Torna ai progressi' });
    expect(back.getAttribute('href')).toBe('/progressi');
    expect(getComputedStyle(back).width).toBe('44px');
    expect(getComputedStyle(back).height).toBe('44px');
  });

  it('il titolo del documento è il nome dell\'esercizio', async () => {
    await mount();
    await waitFor(() => expect(document.title).toBe('Squat con bilanciere | LiftIndex'));
  });
});

describe('riquadri', () => {
  it('Attuale, Migliore e Sessioni, con il valore su una riga', async () => {
    await mount();
    expect(within(tile('Attuale')).getByText('75 kg')).toBeTruthy();
    expect(within(tile('Migliore')).getByText('90 kg')).toBeTruthy();
    expect(within(tile('Sessioni')).getByText('7')).toBeTruthy();
    const value = within(tile('Attuale')).getByText('75 kg');
    expect(getComputedStyle(value).whiteSpace).toBe('nowrap');
    expect(parseFloat(getComputedStyle(value).fontSize)).toBeGreaterThanOrEqual(16);
    expect(getComputedStyle(tile('Attuale').parentElement).display).toBe('grid');
  });
});

describe('grafico', () => {
  it('sta in una card col tipo di valore come titolo, e ha un nome che dice cosa mostra', async () => {
    await mount();
    const card = section('1RM stimato');
    expect(card.classList.contains('MuiCard-root')).toBe(true);
    expect(within(card).getByRole('img', { name: 'Grafico: 1RM stimato di Squat con bilanciere nel tempo. I valori sono nella cronologia.' })).toBeTruthy();
  });

  it('a corpo libero il tipo è «Max ripetizioni»', async () => {
    const bodyweight = [1, 2, 3].map((i) => workout(20 + i, `2026-10-0${i} 10:00:00`, 0, { exercises: [{ exercise_id: 1, name: 'Squat', sets: [{ weight: 0, reps: 10 + i }] }] }));
    stubFetch(bodyweight);
    await mount();
    expect(section('Max ripetizioni')).toBeTruthy();
    expect(within(tile('Attuale')).getByText('13 rip.')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Grafico: Max ripetizioni di Squat con bilanciere nel tempo. I valori sono nella cronologia.' })).toBeTruthy();
  });

  it('dice quante sessioni di tipo diverso sono escluse, solo quando ce ne sono', async () => {
    const mixed = [workout(30, '2026-09-20 10:00:00', 0, { exercises: [{ exercise_id: 1, name: 'Squat', sets: [{ weight: 0, reps: 12 }] }] }), ...SEVEN];
    stubFetch(mixed);
    await mount();
    expect(within(section('1RM stimato')).getByText('1 sessione di tipo diverso (con peso o a corpo libero) non è nel grafico e nella cronologia')).toBeTruthy();
  });

  it('senza sessioni escluse non c\'è la nota', async () => {
    await mount();
    expect(screen.queryByText(/di tipo diverso/)).toBeNull();
  });
});

describe('cronologia', () => {
  it('è un elenco dalla sessione più recente, con data, miglior serie, valore e volume', async () => {
    await mount();
    const first = entries()[0];
    expect(within(first).getByText('07/10/2026')).toBeTruthy();
    expect(within(first).getByText('Miglior serie').nextElementSibling.textContent).toBe('50 × 15');
    expect(within(first).getByText('1RM stimato').nextElementSibling.textContent).toBe('75\u00a0kg');
    expect(within(first).getByText('Volume totale (kg)').nextElementSibling.textContent).toBe('750');
    // la prima riga di ogni voce è la data (qui senza badge)
    expect(entries().map((li) => li.firstElementChild.textContent)).toEqual(['07/10/2026', '06/10/2026', '05/10/2026', '04/10/2026', '03/10/2026']);
  });

  it('i record hanno il segno PR accanto al valore, le altre sessioni no', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Mostra tutti (7)' }));
    expect(within(entry('04/10/2026')).getByText('90 kg · PR')).toBeTruthy();
    expect(within(entry('07/10/2026')).queryByText(/PR/)).toBeNull();
    expect(within(entry('01/10/2026')).queryByText(/PR/)).toBeNull();
  });

  it('mostra le ultime 5 sessioni; «Mostra tutti» le mostra tutte, «Mostra meno» torna a 5', async () => {
    await mount();
    expect(entries()).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Mostra tutti (7)' }));
    expect(entries()).toHaveLength(7);
    fireEvent.click(screen.getByRole('button', { name: 'Mostra meno' }));
    expect(entries()).toHaveLength(5);
  });

  it('con 5 sessioni o meno non c\'è «Mostra tutti»', async () => {
    stubFetch(SEVEN.slice(0, 5));
    await mount();
    expect(entries()).toHaveLength(5);
    expect(screen.queryByRole('button', { name: /Mostra/ })).toBeNull();
  });

  it('non è una tabella e non scorre in orizzontale: ogni sessione va a capo da sola', async () => {
    await mount();
    expect(document.querySelector('table')).toBeNull();
    const scrolling = [...document.querySelectorAll('*')].filter((el) => ['auto', 'scroll'].includes(getComputedStyle(el).overflowX));
    expect(scrolling).toEqual([]);
    const list = within(entries()[0]).getByText('Miglior serie').closest('dl');
    expect(getComputedStyle(list).flexWrap).toBe('wrap');
  });

  it('il pulsante «Mostra tutti» è un\'area da 44px', async () => {
    await mount();
    expect(getComputedStyle(screen.getByRole('button', { name: 'Mostra tutti (7)' })).minHeight).toBe('44px');
  });
});

describe('testi', () => {
  it('nessun testo della pagina è sotto i 16px (le etichette degli assi del grafico sono dentro l\'SVG di Recharts, che qui non disegna)', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Mostra tutti (7)' }));
    expect(textBelow(document.body, 16)).toEqual([]);
  });
});

describe('fuso nella cronologia', () => {
  const ny = workout(40, '2026-10-18 02:00:00', 60, { started_at: '2026-10-18T02:00:00-04:00', time_zone: 'America/New_York' });
  const rome = workout(41, '2026-10-20 02:00:00', 60, { started_at: '2026-10-20T02:00:00+02:00', time_zone: 'Europe/Rome' });

  it('una sessione fatta a New York mostra il giorno scritto e il badge, da 16px', async () => {
    stubFetch([ny, rome]);
    await mount();
    const li = entry('18/10/2026');
    const badge = within(li).getByText('New York · UTC−4').closest('.MuiChip-root');
    expect(getComputedStyle(badge).fontSize).toBe('16px');
  });

  it('una sessione nel fuso del dispositivo non ha il badge', async () => {
    stubFetch([rome, workout(42, '2026-10-22 02:00:00', 60, { started_at: '2026-10-22T02:00:00+02:00', time_zone: 'Europe/Rome' })]);
    await mount();
    expect(screen.queryByText(/UTC/)).toBeNull();
  });
});

describe('posizione dell\'esercizio nella seduta', () => {
  // La posizione c'è solo se ogni serie della seduta ha l'orario: lo Squat viene dopo la Panca nella seconda
  const withClock = (id, date, benchAt, squatAt) => workout(id, date, 60, {
    exercises: [
      { exercise_id: 1, name: 'Squat', sets: [{ weight: 60, reps: 15, seconds_from_start: squatAt }] },
      { exercise_id: 2, name: 'Panca', sets: [{ weight: 40, reps: 10, seconds_from_start: benchAt }] },
    ],
  });

  it('le sessioni con la posizione mostrano «1° esercizio» sotto la data, le altre niente', async () => {
    stubFetch([workout(50, '2026-10-18 10:00:00', 60), withClock(51, '2026-10-20 10:00:00', 600, 0), withClock(52, '2026-10-22 10:00:00', 0, 600)]);
    await mount();
    expect(within(entry('20/10/2026')).getByText('1° esercizio')).toBeTruthy();
    expect(within(entry('22/10/2026')).getByText('2° esercizio')).toBeTruthy();
    expect(within(entry('18/10/2026')).queryByText(/esercizio/)).toBeNull();
  });

  it('senza nessuna posizione non c\'è nessuna etichetta', async () => {
    await mount();
    expect(within(section('Cronologia')).queryByText(/° esercizio/)).toBeNull();
  });

  it('sta accanto al badge del fuso, non al posto suo', async () => {
    const both = withClock(53, '2026-10-18 02:00:00', 600, 0);
    stubFetch([{ ...both, started_at: '2026-10-18T02:00:00-04:00', time_zone: 'America/New_York' }]);
    await mount();
    const li = entry('18/10/2026');
    expect(within(li).getByText('New York · UTC−4')).toBeTruthy();
    expect(within(li).getByText('1° esercizio')).toBeTruthy();
  });

  it('in inglese gli ordinali sono 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st', async () => {
    const positions = [1, 2, 3, 4, 11, 12, 13, 21];
    // la posizione n è n−1 esercizi iniziati prima: servono n−1 altri esercizi nella seduta
    const records = positions.map((position, i) => workout(60 + i, `2026-10-${10 + i} 10:00:00`, 60, {
      exercises: [
        { exercise_id: 1, name: 'Squat', sets: [{ weight: 60, reps: 15, seconds_from_start: 1000 }] },
        ...Array.from({ length: position - 1 }, (_, k) => ({ exercise_id: 100 + k, name: `Altro ${k}`, sets: [{ weight: 20, reps: 10, seconds_from_start: k }] })),
      ],
    }));
    stubFetch(records);
    await i18n.changeLanguage('en');
    open();
    await screen.findByRole('heading', { level: 1 });
    fireEvent.click(await screen.findByRole('button', { name: /Show all/ }));
    ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st'].forEach((label) => {
      expect(screen.getAllByText(`${label} exercise`).length).toBeGreaterThan(0);
    });
  });
});

describe('unità di peso', () => {
  // 50 kg × 30 = 1RM stimato di 100 kg; volume 1500 kg
  const heavy = [workout(70, '2026-10-18 10:00:00', 50, { exercises: [{ exercise_id: 1, name: 'Squat', sets: [{ weight: 50, reps: 30 }] }] })];

  it('in kg niente cambia: valori, miglior serie, volume e intestazione', async () => {
    stubFetch(heavy);
    await mount();
    expect(within(tile('Attuale')).getByText('100 kg')).toBeTruthy();
    expect(screen.getByText('50 × 30')).toBeTruthy();
    expect(screen.getByText('1500')).toBeTruthy();
    expect(screen.getByText('Volume totale (kg)')).toBeTruthy();
  });

  it('in lb il 1RM e la miglior serie sono al quarto di libbra, il volume è il totale convertito', async () => {
    account.weightUnit = 'lb';
    stubFetch(heavy);
    await mount();
    expect(within(tile('Attuale')).getByText('220,5 lb')).toBeTruthy();
    expect(within(tile('Migliore')).getByText('220,5 lb')).toBeTruthy();
    expect(screen.getByText('110,25 × 30')).toBeTruthy();
    expect(screen.getByText('3307')).toBeTruthy(); // 1500 kg
    expect(screen.getByText('Volume totale (lb)')).toBeTruthy();
    expect(screen.queryByText(/kg/)).toBeNull();
  });
});

describe('stati', () => {
  it('in caricamento mostra l\'indicatore e non lascia la pagina', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    open();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(screen.queryByTestId('where')).toBeNull();
  });

  it('un id che non c\'è tra gli esercizi allenati riporta a /progressi, a dati caricati', async () => {
    open('/progressi/esercizi/999');
    expect((await screen.findByTestId('where')).textContent).toBe('/progressi');
  });

  it('errore di lettura: testo d\'errore con «Riprova» e il ritorno, senza lasciare la pagina; Riprova rilegge', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let up = false;
    stubFetch(SEVEN, { history: () => (up ? json({ records: SEVEN }) : json({}, 500)) });
    open();
    expect(await screen.findByText('Errore nel caricamento della cronologia: problema di connessione')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Tracciamento progressi' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Torna ai progressi' }).getAttribute('href')).toBe('/progressi');
    expect(screen.queryByTestId('where')).toBeNull();
    up = true;
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Squat con bilanciere' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
