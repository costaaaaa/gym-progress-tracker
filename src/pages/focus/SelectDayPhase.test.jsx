// Scelta del giorno: il gruppo resta raggiungibile da tastiera anche con un id scelto che non è fra i giorni
// Riga degli «Strumenti della serie» sotto «Inizia»: il conto, la finestra con i tre interruttori, il fuoco che torna
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import i18n from '../../i18n';
import SelectDayPhase from './SelectDayPhase';
import { json } from '../../test/dom';

const account = vi.hoisted(() => ({ user: undefined }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: account.user, updateUser: () => {} }) }));
beforeEach(() => { account.user = undefined; });

const noop = () => {};
const plan = { id: 1, name: 'Scheda', days: [{ id: 1, name: 'Push', exercises: [] }, { id: 2, name: 'Pull', exercises: [] }] };
const renderPhase = (selectedDayId) => render(
  <MemoryRouter><ThemeModeProvider>
    <SelectDayPhase activePlan={plan} selectedDayId={selectedDayId} selectedDay={null}
      onDayChange={noop} onStart={noop} onBack={noop} onGoToPlans={noop} />
  </ThemeModeProvider></MemoryRouter>,
);

describe('ordine di Tab sulle etichette dei giorni', () => {
  it('un id scelto che non è fra i giorni lascia la prima etichetta nell\'ordine di Tab', () => {
    renderPhase(99);
    expect(screen.getAllByRole('radio').map((r) => r.tabIndex)).toEqual([0, -1]);
  });

  it('con un giorno scelto è quello nell\'ordine di Tab', () => {
    renderPhase(2);
    expect(screen.getAllByRole('radio').map((r) => r.tabIndex)).toEqual([-1, 0]);
  });
});

describe('riga degli strumenti della serie', () => {
  const row = () => screen.getByRole('button', { name: /Strumenti della serie/ });

  it.each([
    ['tutti accesi', undefined, '3 accesi su 3'],
    ['due accesi', { focus_tools: { technique: false } }, '2 accesi su 3'],
    ['uno acceso', { rest_timer_enabled: false, focus_tools: { technique: false } }, '1 acceso su 3'],
    ['nessuno acceso', { rest_timer_enabled: false, focus_tools: { technique: false, suggested_weight: false } }, 'Nessuno acceso'],
  ])('%s: %s', (_name, user, text) => {
    account.user = user;
    renderPhase(1);
    expect(within(row()).getByText(text)).toBeTruthy();
  });

  describe('in inglese', () => {
    beforeEach(() => i18n.changeLanguage('en'));
    afterEach(() => i18n.changeLanguage('it'));

    it('il conto ha i plurali giusti', () => {
      account.user = { rest_timer_enabled: false, focus_tools: { technique: false } };
      renderPhase(1);
      expect(within(screen.getByRole('button', { name: /Set tools/ })).getByText('1 of 3 on')).toBeTruthy();
    });

    it('nessuno acceso', () => {
      account.user = { rest_timer_enabled: false, focus_tools: { technique: false, suggested_weight: false } };
      renderPhase(1);
      expect(within(screen.getByRole('button', { name: /Set tools/ })).getByText('None on')).toBeTruthy();
    });
  });

  it('c\'è anche quando il giorno non è ancora scelto, sotto «Inizia»', () => {
    renderPhase(99);
    const start = screen.getByRole('button', { name: 'Inizia allenamento' });
    expect(start.compareDocumentPosition(row()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('titolo e conteggio sono impilati (conteggio sotto) e il titolo ha il carattere dei chip, come le etichette dei giorni', () => {
    renderPhase(1);
    const title = within(row()).getByText('Strumenti della serie');
    const count = within(row()).getByText('3 accesi su 3');
    expect(title.compareDocumentPosition(count) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(title.parentElement).toBe(count.parentElement);
    expect(getComputedStyle(title.parentElement).flexDirection).toBe('column');
    expect(getComputedStyle(title).fontFamily).toBe(getComputedStyle(screen.getAllByRole('radio')[0]).fontFamily);
  });

  it('è un bottone che apre una finestra', () => {
    renderPhase(1);
    expect(row().tagName).toBe('BUTTON');
    expect(row().getAttribute('aria-haspopup')).toBe('dialog');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('la finestra ha il titolo e i tre interruttori; «Chiudi» la chiude e il fuoco torna alla riga', async () => {
    renderPhase(1);
    row().focus();
    fireEvent.click(row());
    const dialog = await screen.findByRole('dialog', { name: 'Strumenti della serie' });
    expect(within(dialog).getAllByRole('switch').map((s) => s.getAttribute('aria-label'))).toEqual(['Timer di recupero', 'Tecnica di intensità', 'Peso suggerito']);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Chiudi' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(row()));
  });

  it('Esc chiude la finestra e il fuoco torna alla riga', async () => {
    renderPhase(1);
    row().focus();
    fireEvent.click(row());
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(row()));
  });

  describe('esito dei cambi nella finestra', () => {
    afterEach(() => vi.unstubAllGlobals());
    const openDialog = async () => {
      renderPhase(1);
      fireEvent.click(row());
      return screen.findByRole('dialog');
    };

    it('l\'esito si legge dentro la finestra, in una regione «status»', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ success: true, rest_timer_enabled: true, focus_tools: { technique: false, suggested_weight: true } }))));
      const dialog = await openDialog();
      fireEvent.click(within(dialog).getByRole('switch', { name: 'Tecnica di intensità' }));
      await waitFor(() => expect(within(dialog).getByRole('status').textContent).toBe('Tecnica di intensità: spento'));
    });

    it('l\'errore si legge dentro la finestra, in una regione «alert»', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(json({ success: false }, 500))));
      const dialog = await openDialog();
      fireEvent.click(within(dialog).getByRole('switch', { name: 'Peso suggerito' }));
      await waitFor(() => expect(within(dialog).getByRole('alert').textContent).toBe('Errore nel salvataggio. Riprova.'));
    });
  });
});
