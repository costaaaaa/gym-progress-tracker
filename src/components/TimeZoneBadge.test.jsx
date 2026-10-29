// Badge del fuso: compare solo per un allenamento fatto in un fuso diverso da quello del dispositivo.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TimeZoneBadge from './TimeZoneBadge';
import { currentTimeZone } from '../utils/workoutTime';

vi.mock('../utils/workoutTime', async (importOriginal) => ({ ...(await importOriginal()), currentTimeZone: vi.fn() }));

const ny = { time_zone: 'America/New_York', started_at: '2026-10-18T02:00:00-04:00' };

beforeEach(() => currentTimeZone.mockReturnValue('Europe/Rome'));

describe('TimeZoneBadge', () => {
  it('fuso diverso: città e offset, con l\'etichetta per i lettori di schermo', () => {
    render(<TimeZoneBadge workout={ny} />);
    expect(screen.getByText('New York · UTC−4')).toBeTruthy();
    expect(screen.getByLabelText('Fuso orario: New York · UTC−4')).toBeTruthy();
  });
  it('stesso fuso del dispositivo: niente', () => {
    currentTimeZone.mockReturnValue('America/New_York');
    const { container } = render(<TimeZoneBadge workout={ny} />);
    expect(container.firstChild).toBeNull();
  });
  it('allenamento senza fuso (backend vecchio): niente', () => {
    const { container } = render(<TimeZoneBadge workout={{ date: '2026-10-18 02:00:00' }} />);
    expect(container.firstChild).toBeNull();
  });
});
