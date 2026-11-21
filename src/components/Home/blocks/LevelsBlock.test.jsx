import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within, fireEvent } from '@testing-library/react';
import LevelsBlock from './LevelsBlock';
import i18n from '../../../i18n';
import { renderBlock, stubFetch } from '../../../test/homeBlocks';

afterEach(() => vi.unstubAllGlobals());

const PROFILE = { success: true, level: 12, total_xp: 9000, xp_into_level: 12400, xp_for_next_level: 15000 };
const streak = (weeks) => ({ success: true, current_streak_weeks: weeks, longest_streak_weeks: 6, this_week: { count: 2, goal: 3, completed: false } });
const server = (weeks = 4) => ({ 'gamification/profile.php': PROFILE, 'gamification/streak.php': streak(weeks) });

describe('blocco «Livello e streak»', () => {
  it('piccola: livello e streak in una riga, fiamma a destra, link al profilo', async () => {
    stubFetch(server(4));
    renderBlock(<LevelsBlock />);
    const link = (await screen.findByText('Livello 12 · streak di 4 settimane')).closest('a');
    expect(link.getAttribute('href')).toBe('/profilo');
    expect(screen.getByRole('heading', { level: 2, name: 'Livello e streak' })).toBeTruthy();
    expect(within(link).getByTestId('LocalFireDepartmentIcon')).toBeTruthy();
    expect(screen.queryByText('settimane di fila')).toBeNull();
  });

  it('streak di una settimana: singolare', async () => {
    stubFetch(server(1));
    renderBlock(<LevelsBlock />);
    expect(await screen.findByText('Livello 12 · streak di 1 settimana')).toBeTruthy();
  });

  it('streak 0: solo il livello e niente fiamma', async () => {
    stubFetch(server(0));
    renderBlock(<LevelsBlock />);
    expect(await screen.findByText('Livello 12')).toBeTruthy();
    expect(screen.queryByTestId('LocalFireDepartmentIcon')).toBeNull();
  });

  it('grande: fiamma, settimane di fila, livello, punti con i separatori e barra con il suo nome', async () => {
    stubFetch(server(4));
    renderBlock(<LevelsBlock large />);
    expect(await screen.findByText('settimane di fila')).toBeTruthy();
    // la riga in testa non ripete quello che il contenuto dice in grande: una fiamma sola, il livello una volta
    expect(screen.getAllByTestId('LocalFireDepartmentIcon').length).toBe(1);
    expect(screen.queryByText('Livello 12 · streak di 4 settimane')).toBeNull();
    expect(screen.getAllByText('Livello 12').length).toBe(1);
    expect(screen.getByText('12.400 / 15.000 punti')).toBeTruthy();
    const bar = screen.getByRole('progressbar', { name: 'Avanzamento verso il livello 13' });
    expect(bar.getAttribute('aria-valuenow')).toBe('83');
    // niente anello della settimana: lo dice già l'apertura
    expect(document.querySelector('svg circle')).toBeNull();
  });

  it('grande con una settimana: «settimana di fila»; con streak 0 niente fiamma grande', async () => {
    stubFetch(server(1));
    const view = renderBlock(<LevelsBlock large />);
    expect(await screen.findByText('settimana di fila')).toBeTruthy();
    view.unmount();
    stubFetch(server(0));
    renderBlock(<LevelsBlock large />);
    expect(await screen.findByText('12.400 / 15.000 punti')).toBeTruthy();
    expect(screen.queryByTestId('LocalFireDepartmentIcon')).toBeNull();
    expect(screen.queryByText(/di fila/)).toBeNull();
    expect(screen.getAllByText('Livello 12').length).toBe(1);
  });

  it('in inglese i testi e il separatore delle migliaia sono della lingua', async () => {
    await i18n.changeLanguage('en');
    stubFetch(server(4));
    const small = renderBlock(<LevelsBlock />);
    expect(await screen.findByText('Level 12 · 4-week streak')).toBeTruthy();
    small.unmount();
    renderBlock(<LevelsBlock large />);
    expect(await screen.findByText('12,400 / 15,000 points')).toBeTruthy();
    expect(screen.getByText('weeks in a row')).toBeTruthy();
  });

  it('caricamento: titolo e segnaposto, nessun numero', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderBlock(<LevelsBlock />);
    expect(screen.getByRole('heading', { level: 2, name: 'Livello e streak' })).toBeTruthy();
    expect(screen.getByTestId('block-skeleton')).toBeTruthy();
    expect(screen.queryByText(/Livello 1/)).toBeNull();
  });

  it.each(['gamification/profile.php', 'gamification/streak.php'])('errore di %s: dati non disponibili, il link resta', async (part) => {
    stubFetch({ ...server(), [part]: { status: 500 } });
    renderBlock(<LevelsBlock />);
    expect(await screen.findByText('Dati non disponibili al momento.')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/profilo');
  });

  it('una risposta senza success vale errore', async () => {
    stubFetch({ ...server(), 'gamification/streak.php': { success: false } });
    renderBlock(<LevelsBlock />);
    expect(await screen.findByText('Dati non disponibili al momento.')).toBeTruthy();
  });

  it('una risposta arrivata dopo l\'uscita non scrive lo stato', async () => {
    let arrive;
    const slow = new Promise((resolve) => { arrive = resolve; });
    vi.stubGlobal('fetch', vi.fn(() => slow));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const view = renderBlock(<LevelsBlock />);
    view.unmount();
    arrive({ ok: true, json: async () => PROFILE });
    await Promise.resolve();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it('il tocco porta al profilo', async () => {
    stubFetch(server());
    renderBlock(<LevelsBlock />);
    fireEvent.click((await screen.findByText(/Livello 12/)).closest('a'));
    expect(screen.getByTestId('where').textContent).toBe('/profilo');
  });
});
