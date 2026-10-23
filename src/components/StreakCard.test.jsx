// Card Streak: i dati arrivano da gamification/streak.php, l'utente vede serie, progresso della settimana e record.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import StreakCard from './StreakCard';

const streak = {
  success: true,
  current_streak_weeks: 4,
  longest_streak_weeks: 6,
  this_week: { count: 2, goal: 3, completed: false },
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: async () => streak })));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('card Streak', () => {
  it('mostra la serie, il progresso della settimana e il record', async () => {
    render(<StreakCard />);
    expect(await screen.findByText('4')).toBeTruthy();
    expect(screen.getByText('2/3')).toBeTruthy();
    expect(screen.getByText('1 sessione al traguardo')).toBeTruthy();
    expect(screen.getByText('Record: 6 settimane')).toBeTruthy();
  });

  it('ha l\'intestazione "Streak"', async () => {
    render(<StreakCard />);
    expect(await screen.findByRole('heading', { name: 'Streak' })).toBeTruthy();
  });
});
