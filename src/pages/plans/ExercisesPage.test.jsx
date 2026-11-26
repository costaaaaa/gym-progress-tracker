// «Tutti gli esercizi» (/schede/esercizi) vista dall'utente: ricerca, filtro per gruppo muscolare, elenco in sola lettura
// di catalogo ed esercizi personali, e gli stati di caricamento, vuoto ed errore. La fetch è il confine.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ExercisesPage from './ExercisesPage';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import { json, expectNoNestedContainer, textsBelow16pxExceptActiveBadge, expectChipOn, expectChipOff } from '../../test/dom';
import i18n from '../../i18n';
import { unnamedControls } from '../../test/accessibleNames';

const rec = (id, name, muscle_group, equipment, over = {}) => ({
  id, name, name_it: name, name_en: null, muscle_group, equipment, is_mine: false, status: 'approved', ...over,
});
const RECORDS = [
  rec(1, 'Panca piana', 'petto', 'bilanciere', { name_en: 'Bench press' }),
  rec(2, 'Croci ai cavi', 'petto', 'cavi'),
  rec(3, 'Trazioni', 'schiena', 'corpo_libero'),
  rec(4, 'Squat', 'gambe', 'bilanciere'),
  rec(5, 'Zercher squat', 'gambe', 'bilanciere', { is_mine: true, status: 'pending' }),
  rec(6, 'Alzate laterali', 'spalle', null, { is_mine: true, status: 'approved' }),
];

let respond;
const calls = () => fetch.mock.calls.filter(([url]) => String(url).includes('exercise/read_all.php'));
const stub = (handler) => {
  respond = handler;
  vi.stubGlobal('fetch', vi.fn(() => respond()));
};
const ok = (records = RECORDS) => () => Promise.resolve(json({ records }));

const mount = async (handler = ok(), mode = 'light') => {
  stub(handler);
  localStorage.setItem('themeMode', mode);
  render(
    <ThemeModeProvider>
      <MemoryRouter initialEntries={['/schede/esercizi']}>
        <Routes>
          <Route path="/schede" element={<div>elenco schede</div>} />
          <Route path="/schede/esercizi" element={<ExercisesPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeModeProvider>,
  );
};
const mountLoaded = async (handler, mode) => {
  await mount(handler, mode);
  await screen.findByRole('list');
};
const nameOf = (li) => within(li).getByTestId('exercise-name');
const names = () => within(screen.getByRole('list')).getAllByRole('listitem').map((li) => nameOf(li).textContent);
const search = (text) => fireEvent.change(screen.getByRole('textbox', { name: 'Cerca un esercizio' }), { target: { value: text } });
const chip = (name) => screen.getByRole('button', { name });
// Colori del chip in chiaro e in scuro: text.primary, text.secondary e background.paper
const CHIP_COLORS = {
  light: { ink: 'rgb(26, 24, 22)', grey: 'rgb(107, 102, 99)', paper: 'rgb(255, 255, 255)' },
  dark: { ink: 'rgb(255, 255, 255)', grey: 'rgb(160, 160, 162)', paper: 'rgb(20, 20, 22)' },
};

afterEach(async () => {
  await i18n.changeLanguage('it');
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('intestazione', () => {
  it('un solo h1 «Tutti gli esercizi» e il ritorno a «Schede»', async () => {
    await mountLoaded();
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Tutti gli esercizi']);
    expect(screen.getByRole('link', { name: 'Schede' }).getAttribute('href')).toBe('/schede');
    fireEvent.click(screen.getByRole('link', { name: 'Schede' }));
    expect(await screen.findByText('elenco schede')).toBeTruthy();
  });

  it('il titolo del documento è «Tutti gli esercizi | LiftIndex»', async () => {
    await mountLoaded();
    expect(document.title).toBe('Tutti gli esercizi | LiftIndex');
  });

  it('la pagina non apre un secondo Container, non ha controlli senza nome né testi sotto i 16px', async () => {
    await mountLoaded();
    expectNoNestedContainer();
    expect(unnamedControls()).toEqual([]);
    expect(textsBelow16pxExceptActiveBadge()).toEqual([]);
  });

  it('nessun elemento con lo sfondo rosso del marchio', async () => {
    await mountLoaded();
    const rossi = [...document.body.querySelectorAll('*')].filter((el) => getComputedStyle(el).backgroundColor === 'rgb(213, 0, 0)');
    expect(rossi).toEqual([]);
  });
});

describe('caricamento', () => {
  it('finché la lettura non finisce c\'è un indicatore con nome e nessun elenco', async () => {
    await mount(() => new Promise(() => {}));
    expect(screen.getByRole('progressbar', { name: 'Caricamento' })).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByText('Nessun esercizio trovato')).toBeNull();
  });

  it('legge una volta sola i dati del catalogo, con la sessione', async () => {
    await mountLoaded();
    expect(calls()).toHaveLength(1);
    expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
  });
});

describe('elenco', () => {
  it('senza ricerca, in ordine alfabetico del nome mostrato, catalogo e personali insieme', async () => {
    await mountLoaded();
    expect(names()).toEqual(['Alzate laterali', 'Croci ai cavi', 'Panca piana', 'Squat', 'Trazioni', 'Zercher squat']);
  });

  it('sotto il nome: gruppo muscolare e attrezzo; l\'etichetta solo per un personale non ancora approvato', async () => {
    await mountLoaded();
    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    const byName = (name) => rows.find((li) => nameOf(li).textContent === name);
    expect(byName('Panca piana').textContent).toBe('Panca pianaPetto · Bilanciere');
    expect(byName('Trazioni').textContent).toBe('TrazioniSchiena · Corpo libero');
    expect(byName('Alzate laterali').textContent).toBe('Alzate lateraliSpalle');
    expect(byName('Zercher squat').textContent).toBe('Zercher squatGambe · Bilanciere · Personale · in revisione');
  });

  it('un personale non approvato e non in revisione ha l\'etichetta «Personale»', async () => {
    await mountLoaded(ok([rec(9, 'Mio esercizio', 'petto', 'manubri', { is_mine: true, status: 'rejected' })]));
    expect(within(screen.getByRole('list')).getByText(/Personale/).textContent).toBe('Petto · Manubri · Personale');
  });

  it('le righe non sono cliccabili: nessun collegamento né pulsante nell\'elenco', async () => {
    await mountLoaded();
    const list = screen.getByRole('list');
    expect(within(list).queryAllByRole('link')).toEqual([]);
    expect(within(list).queryAllByRole('button')).toEqual([]);
  });

  it('il nome secondario è in text.secondary (#6b6663), quello principale in text.primary (#1a1816)', async () => {
    await mountLoaded();
    const row = within(screen.getByRole('list')).getAllByRole('listitem')[2];
    expect(getComputedStyle(nameOf(row)).color).toBe('rgb(26, 24, 22)');
    expect(getComputedStyle(within(row).getByTestId('exercise-detail')).color).toBe('rgb(107, 102, 99)');
  });
});

describe('ricerca', () => {
  it('il campo ha l\'etichetta «Cerca un esercizio» ed è sopra l\'elenco', async () => {
    await mountLoaded();
    const field = screen.getByRole('textbox', { name: 'Cerca un esercizio' });
    expect(field.compareDocumentPosition(screen.getByRole('list')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('all\'inizio del campo c\'è l\'icona di ricerca, nascosta ai lettori di schermo', async () => {
    await mountLoaded();
    const icon = screen.getByRole('textbox', { name: 'Cerca un esercizio' }).closest('.MuiInputBase-root').querySelector('svg');
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    expect(icon.parentElement.className).toContain('MuiInputAdornment-positionStart');
  });

  it('trova per nome mostrato, ordinando per pertinenza (prima chi inizia con il testo)', async () => {
    await mountLoaded();
    search('squat');
    expect(names()).toEqual(['Squat', 'Zercher squat']);
  });

  it('trova anche dal nome inglese', async () => {
    await mountLoaded();
    search('bench');
    expect(names()).toEqual(['Panca piana']);
  });

  it('senza corrispondenze: «Nessun esercizio trovato» al posto dell\'elenco', async () => {
    await mountLoaded();
    search('xyz');
    expect(screen.getByText('Nessun esercizio trovato')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('cancellando il testo torna l\'elenco intero', async () => {
    await mountLoaded();
    search('squat');
    search('');
    expect(names()).toHaveLength(6);
  });
});

describe('filtro per gruppo muscolare', () => {
  it('«Tutti» e un chip per gruppo presente, con l\'etichetta tradotta, in ordine; «Tutti» è acceso', async () => {
    await mountLoaded();
    const group = screen.getByRole('group', { name: 'Gruppo muscolare' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Tutti', 'Gambe', 'Petto', 'Schiena', 'Spalle']);
    expect(chip('Tutti').getAttribute('aria-pressed')).toBe('true');
    expect(chip('Petto').getAttribute('aria-pressed')).toBe('false');
  });

  it.each(['light', 'dark'])('il chip scelto ha lo stesso stile degli altri chip che si scelgono, in %s', async (mode) => {
    await mountLoaded(ok(), mode);
    expectChipOn(chip('Tutti'), CHIP_COLORS[mode]);
    expectChipOff(chip('Petto'), CHIP_COLORS[mode]);
    fireEvent.click(chip('Petto'));
    expectChipOn(chip('Petto'), CHIP_COLORS[mode]);
    expectChipOff(chip('Tutti'), CHIP_COLORS[mode]);
  });

  it('in inglese i chip seguono l\'ordine alfabetico dell\'etichetta tradotta, non della chiave italiana', async () => {
    await i18n.changeLanguage('en');
    await mountLoaded();
    const group = screen.getByRole('group', { name: 'Muscle group' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['All', 'Back', 'Chest', 'Legs', 'Shoulders']);
  });

  it('gruppi che differiscono solo per le maiuscole sono un chip solo, e il filtro li prende insieme', async () => {
    await mountLoaded(ok([rec(1, 'Panca piana', 'petto', 'bilanciere'), rec(2, 'Croci', 'Petto', 'cavi'), rec(3, 'Squat', 'gambe', 'bilanciere')]));
    const group = screen.getByRole('group', { name: 'Gruppo muscolare' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Tutti', 'Gambe', 'Petto']);
    fireEvent.click(chip('Petto'));
    expect(names()).toEqual(['Croci', 'Panca piana']);
  });

  it('un gruppo senza esercizi non ha il chip', async () => {
    await mountLoaded(ok([rec(1, 'Panca piana', 'petto', 'bilanciere')]));
    expect(screen.queryByRole('button', { name: 'Gambe' })).toBeNull();
  });

  it('sceglie un gruppo: uno solo acceso alla volta, l\'elenco si restringe', async () => {
    await mountLoaded();
    fireEvent.click(chip('Petto'));
    expect(names()).toEqual(['Croci ai cavi', 'Panca piana']);
    expect(chip('Petto').getAttribute('aria-pressed')).toBe('true');
    expect(chip('Tutti').getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(chip('Gambe'));
    expect(names()).toEqual(['Squat', 'Zercher squat']);
    expect(chip('Petto').getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(chip('Tutti'));
    expect(names()).toHaveLength(6);
  });

  it('ricerca e filtro si sommano', async () => {
    await mountLoaded();
    fireEvent.click(chip('Gambe'));
    search('zercher');
    expect(names()).toEqual(['Zercher squat']);
    fireEvent.click(chip('Petto'));
    expect(screen.getByText('Nessun esercizio trovato')).toBeTruthy();
  });

  it('i chip hanno un\'area di almeno 44px', async () => {
    await mountLoaded();
    for (const b of within(screen.getByRole('group', { name: 'Gruppo muscolare' })).getAllByRole('button')) {
      expect(parseFloat(getComputedStyle(b).minHeight)).toBeGreaterThanOrEqual(44);
    }
  });
});

describe('numero dei risultati per i lettori di schermo', () => {
  const live = () => screen.getByRole('status');

  it('è in una regione educata e dice quanti esercizi ci sono', async () => {
    await mountLoaded();
    expect(live().getAttribute('aria-live')).toBe('polite');
    expect(live().textContent).toBe('6 esercizi');
  });

  it('cambia con la ricerca e con il filtro, con il singolare', async () => {
    await mountLoaded();
    fireEvent.click(chip('Petto'));
    expect(live().textContent).toBe('2 esercizi');
    search('panca');
    expect(live().textContent).toBe('1 esercizio');
    search('xyz');
    expect(live().textContent).toBe('0 esercizi');
  });
});

describe('errore di lettura', () => {
  it('risposta d\'errore: testo d\'errore e «Riprova», non «Nessun esercizio trovato», né elenco né chip', async () => {
    await mount(() => Promise.resolve(json({ message: 'Errore nel server' }, 500)));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Errore nel server');
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeTruthy();
    expect(screen.queryByText('Nessun esercizio trovato')).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Gruppo muscolare' })).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('connessione caduta: lo stesso avviso, senza messaggio del server', async () => {
    await mount(() => Promise.reject(new Error('rete')));
    expect((await screen.findByRole('alert')).textContent).toContain('Impossibile caricare gli esercizi');
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeTruthy();
  });

  it('«Riprova» rilegge e, riuscita, mostra l\'elenco', async () => {
    await mount(() => Promise.resolve(json({}, 500)));
    await screen.findByRole('alert');
    respond = ok();
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    await screen.findByRole('list');
    expect(calls()).toHaveLength(2);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(names()).toHaveLength(6);
  });

  it('il 404 del catalogo vuoto (messaggio del server, senza success) è un elenco vuoto, senza «Riprova»', async () => {
    await mount(() => Promise.resolve(json({ message: 'Nessun esercizio trovato.' }, 404)));
    expect(await screen.findByText('Nessun esercizio trovato')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Riprova' })).toBeNull();
  });

  it('un 404 che non è quello del catalogo vuoto (senza messaggio JSON) resta un errore', async () => {
    await mount(() => Promise.resolve({ ok: false, status: 404, json: async () => { throw new Error('html'); } }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeTruthy();
  });

  it('un 404 con `success: false` resta un errore', async () => {
    await mount(() => Promise.resolve(json({ message: 'Errore del server.', success: false }, 404)));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Riprova' })).toBeTruthy();
  });

  it('un errore senza messaggio del server non mostra «undefined»', async () => {
    await mount(() => Promise.resolve(json({}, 500)));
    expect((await screen.findByRole('alert')).textContent).not.toMatch(/undefined|null/);
  });
});
