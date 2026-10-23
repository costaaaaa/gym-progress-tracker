// Card Livello: i dati arrivano da gamification/profile.php, l'utente vede livello, XP e il link al profilo.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LevelCard from './LevelCard';

const profile = { success: true, level: 5, xp_into_level: 120, xp_for_next_level: 300, total_xp: 1500 };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => profile })));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const renderCard = () => render(<MemoryRouter><LevelCard /></MemoryRouter>);

describe('card Livello', () => {
  it('mostra livello, XP e XP totali', async () => {
    renderCard();
    const card = await screen.findByRole('link');
    expect(screen.getByText('5')).toBeTruthy();
    expect(card.textContent).toContain('120 XP');
    expect(card.textContent).toContain('300 XP');
    expect(card.textContent).toContain('1500 XP totali');
  });

  it('è un link al profilo', async () => {
    renderCard();
    const card = await screen.findByRole('link');
    expect(card.getAttribute('href')).toBe('/profilo');
    expect(card.textContent).toContain('Vedi profilo →');
  });

  it('ha l\'intestazione "Livello"', async () => {
    renderCard();
    expect(await screen.findByRole('heading', { name: 'Livello' })).toBeTruthy();
  });
});
