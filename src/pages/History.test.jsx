// Pagina Storico: titolo di pagina, cronologia di prima, rilettura a fine allenamento e finestra «Registra» aperta una volta dal ventaglio.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Link, useLocation } from 'react-router-dom';
import History from './History';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import { json, expectNoNestedContainer } from '../test/dom';

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ isLoggedIn: true, loading: false, weightUnit: 'kg' }) }));

const plan = { id: 5, name: 'Push Pull', is_active: true, days: [{ id: 1, name: 'Push', exercises: [] }] };
let plans;
let fetchMock;

beforeEach(() => {
  localStorage.setItem('themeMode', 'light');
  plans = [plan];
  fetchMock = vi.fn((url) => Promise.resolve(url.includes('read_plans.php') ? json({ records: plans }) : json({ records: [] })));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const historyCalls = () => fetchMock.mock.calls.filter(([url]) => url.includes('workout_history/read.php')).length;

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

const mount = async (entry = '/storico') => {
  render(
    <ThemeModeProvider>
      <MemoryRouter initialEntries={[entry]}><Probe /><History /></MemoryRouter>
    </ThemeModeProvider>,
  );
  await screen.findByText('Nessun allenamento registrato');
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

  it('il pulsante «Registra allenamento» della pagina c\'è con una scheda attiva', async () => {
    await mount();
    expect(screen.getAllByRole('button', { name: 'Registra allenamento' }).length).toBeGreaterThan(0);
  });
});

describe('rilettura a fine allenamento', () => {
  it('senza refreshHistory l\'elenco si legge una volta sola', async () => {
    await mount('/storico');
    expect(historyCalls()).toBe(1);
  });

  it('arrivando con refreshHistory l\'elenco viene riletto', async () => {
    await mount({ pathname: '/storico', state: { refreshHistory: 1730000000000 } });
    await waitFor(() => expect(historyCalls()).toBe(2));
    // Resta nello stato: lo consuma solo openRecord
    expect(screen.getByTestId('state').textContent).toBe('{"refreshHistory":1730000000000}');
  });
});

describe('«Registra allenamento passato» dal ventaglio', () => {
  it('con una scheda attiva apre la finestra e consuma lo stato: non si riapre tornando indietro', async () => {
    await mount({ pathname: '/storico', state: { openRecord: true } });
    await waitFor(() => expect(dialogTitle()).toBeTruthy());
    expect(screen.getByTestId('state').textContent).toBe('null');
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
    plans = [{ ...plan, is_active: false }];
    await mount({ pathname: '/storico', state: { openRecord: true } });
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('null'));
    expect(dialogTitle()).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    const avviso = await screen.findByText('Per registrare un allenamento serve una scheda attiva.');
    expect(avviso.closest('.MuiAlert-root').className).toContain('MuiAlert-colorInfo');
  });

  it('l\'avviso della mancanza di scheda attiva compare una volta per richiesta', async () => {
    plans = [{ ...plan, is_active: false }];
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
