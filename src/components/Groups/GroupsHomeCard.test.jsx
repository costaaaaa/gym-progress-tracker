// Card «I tuoi gruppi» della home: a 320 px il nome del gruppo non si perde dietro i puntini (1.4.10, 1.4.12)
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GroupsHomeCard from './GroupsHomeCard';
import { ThemeModeProvider } from '../../context/ThemeModeContext';
import { mediaStyle } from '../../test/mediaStyle';

vi.mock('../../api/groups', () => ({
  listGroups: () => Promise.resolve({ ok: true, data: { groups: [{ id: 1, name: 'Palestra Esempio', members_count: 4 }] } }),
}));

describe('card gruppi della home', () => {
  it('da 390 px il nome ha i puntini se è lungo; sotto va a capo', async () => {
    render(<MemoryRouter><ThemeModeProvider><GroupsHomeCard /></ThemeModeProvider></MemoryRouter>);
    const name = await screen.findByText('Palestra Esempio');
    expect(getComputedStyle(name)).toMatchObject({ whiteSpace: 'nowrap', textOverflow: 'ellipsis' });
    expect(mediaStyle(name, 389.95, 'max')).toMatchObject({ 'white-space': 'normal', 'text-overflow': 'clip', overflow: 'visible' });
  });
});
