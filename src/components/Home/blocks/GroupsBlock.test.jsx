import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within, fireEvent } from '@testing-library/react';
import GroupsBlock from './GroupsBlock';
import i18n from '../../../i18n';
import { renderBlock, stubFetch } from '../../../test/homeBlocks';

afterEach(() => vi.unstubAllGlobals());

const GROUPS = { success: true, groups: [{ id: 5, name: 'Palestra Rossi', members_count: 6 }, { id: 9, name: 'Amici', members_count: 3 }] };
const row = (rank, username, over = {}) => ({ rank, username, is_me: false, workouts: 3, goal: 4, volume_kg: 1000, adherence: 0.75, ...over });
const read = (board, visibility = { workouts: true, volume: true, streak: true, level: true }) => ({ success: true, group: { id: 5, name: 'Palestra Rossi' }, board, visibility });
const BOARD = [row(1, 'marta'), row(2, 'luca'), row(3, 'anna'), row(4, 'io', { is_me: true, workouts: 2 }), row(5, 'zeno')];
const server = (over = {}) => ({ 'groups/list.php': GROUPS, 'groups/read.php': read(BOARD), ...over });

describe('blocco «Gruppi»', () => {
  it('piccola: il primo gruppo e la propria posizione; link ai gruppi; la classifica è quella della settimana del primo gruppo', async () => {
    const fake = stubFetch(server());
    renderBlock(<GroupsBlock />);
    const link = (await screen.findByText('Palestra Rossi · sei 4° questa settimana')).closest('a');
    expect(link.getAttribute('href')).toBe('/gruppi');
    expect(screen.getByRole('heading', { level: 2, name: 'Gruppi' })).toBeTruthy();
    const readCall = fake.mock.calls.map(([url]) => String(url)).find((url) => url.includes('groups/read.php'));
    expect(readCall).toContain('group_id=5');
    expect(readCall).toContain('board=week');
    expect(screen.queryByText('marta')).toBeNull();
  });

  it('la classifica non si vede (visibilità di chi guarda): nome e membri, senza posizione', async () => {
    stubFetch(server({ 'groups/read.php': read([], { workouts: false, volume: true, streak: true, level: true }) }));
    renderBlock(<GroupsBlock />);
    expect(await screen.findByText('Palestra Rossi · 6 membri')).toBeTruthy();
  });

  it('classifica vuota con la visibilità vera, o senza la propria riga: nome e membri', async () => {
    stubFetch(server({ 'groups/read.php': read([row(1, 'marta')]) }));
    renderBlock(<GroupsBlock />);
    expect(await screen.findByText('Palestra Rossi · 6 membri')).toBeTruthy();
  });

  it('la lettura della classifica fallisce: nome e membri, non un errore (l\'elenco c\'è)', async () => {
    stubFetch(server({ 'groups/read.php': { status: 500 } }));
    renderBlock(<GroupsBlock />);
    expect(await screen.findByText('Palestra Rossi · 6 membri')).toBeTruthy();
  });

  it('un gruppo con un solo membro: singolare', async () => {
    stubFetch(server({ 'groups/list.php': { success: true, groups: [{ id: 5, name: 'Solo', members_count: 1 }] }, 'groups/read.php': read([], { workouts: false }) }));
    renderBlock(<GroupsBlock />);
    expect(await screen.findByText('Solo · 1 membro')).toBeTruthy();
  });

  it('senza gruppi: invito a crearne uno, e la classifica non si legge', async () => {
    const fake = stubFetch(server({ 'groups/list.php': { success: true, groups: [] } }));
    renderBlock(<GroupsBlock large />);
    const text = await screen.findByText('Crea un gruppo o entra con un codice');
    expect(text.closest('a').getAttribute('href')).toBe('/gruppi');
    expect(fake.mock.calls.some(([url]) => String(url).includes('groups/read.php'))).toBe(false);
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('grande: i primi tre e la propria riga (evidenziata) se non è tra i tre', async () => {
    stubFetch(server());
    renderBlock(<GroupsBlock large />);
    const list = await screen.findByRole('list');
    const names = within(list).getAllByRole('listitem').map((li) => li.textContent);
    expect(names.length).toBe(4);
    expect(names[0]).toContain('marta');
    expect(names[2]).toContain('anna');
    expect(names[3]).toContain('io');
    expect(names[3]).toContain('tu');
    expect(within(list).queryByText('zeno')).toBeNull();
    expect(getComputedStyle(within(list).getAllByRole('listitem')[3]).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  it('grande, account in lb: il volume della classifica è in lb (il server manda kg)', async () => {
    stubFetch(server({ 'groups/read.php': read([row(1, 'marta', { volume_kg: 5200 }), row(2, 'io', { is_me: true, volume_kg: 4820 })]) }));
    renderBlock(<GroupsBlock large weightUnit="lb" />);
    const list = await screen.findByRole('list');
    expect(within(list).getByText('11.464 lb')).toBeTruthy(); // 5200 kg
    expect(within(list).getByText('10.626 lb')).toBeTruthy(); // 4820 kg
    expect(list.textContent).not.toMatch(/kg/);
  });

  it('grande con la propria riga tra i primi tre: solo i tre', async () => {
    stubFetch(server({ 'groups/read.php': read([row(1, 'marta'), row(2, 'io', { is_me: true }), row(3, 'anna'), row(4, 'luca')]) }));
    renderBlock(<GroupsBlock large />);
    const items = within(await screen.findByRole('list')).getAllByRole('listitem');
    expect(items.map((li) => li.textContent.includes('luca'))).toEqual([false, false, false]);
    expect(items.length).toBe(3);
  });

  it('grande senza classifica visibile: resta la riga piccola', async () => {
    stubFetch(server({ 'groups/read.php': read([], { workouts: false }) }));
    renderBlock(<GroupsBlock large />);
    expect(await screen.findByText('Palestra Rossi · 6 membri')).toBeTruthy();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('posizioni a pari merito: vale il rank del server', async () => {
    stubFetch(server({ 'groups/read.php': read([row(1, 'marta'), row(2, 'luca'), row(2, 'io', { is_me: true })]) }));
    renderBlock(<GroupsBlock />);
    expect(await screen.findByText('Palestra Rossi · sei 2° questa settimana')).toBeTruthy();
  });

  it('in inglese: ordinali e membri', async () => {
    await i18n.changeLanguage('en');
    for (const [rank, text] of [[1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th']]) {
      stubFetch(server({ 'groups/read.php': read([row(rank, 'io', { is_me: true })]) }));
      const v = renderBlock(<GroupsBlock />);
      expect(await screen.findByText(`Palestra Rossi · you're ${text} this week`)).toBeTruthy();
      v.unmount();
    }
    stubFetch(server({ 'groups/read.php': read([], { workouts: false }) }));
    renderBlock(<GroupsBlock />);
    expect(await screen.findByText('Palestra Rossi · 6 members')).toBeTruthy();
  });

  it('caricamento: titolo e segnaposto', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderBlock(<GroupsBlock />);
    expect(screen.getByTestId('block-skeleton')).toBeTruthy();
    expect(screen.queryByText(/Palestra/)).toBeNull();
  });

  it('errore dell\'elenco: dati non disponibili, il link resta', async () => {
    stubFetch(server({ 'groups/list.php': { status: 500 } }));
    renderBlock(<GroupsBlock />);
    expect(await screen.findByText('Dati non disponibili al momento.')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/gruppi');
  });

  it('il tocco porta ai gruppi', async () => {
    stubFetch(server());
    renderBlock(<GroupsBlock />);
    fireEvent.click((await screen.findByText(/Palestra Rossi/)).closest('a'));
    expect(screen.getByTestId('where').textContent).toBe('/gruppi');
  });
});
