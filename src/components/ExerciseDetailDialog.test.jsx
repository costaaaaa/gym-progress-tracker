// Dettaglio esercizio: la cronologia mostra il giorno scritto e il badge del fuso per le sessioni fatte altrove.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ExerciseDetailDialog from './ExerciseDetailDialog';
import { setBrowserTimeZone } from '../test/timeZone';

const session = (id, date, extra = {}) => ({ id, date, value: 100, volume: 800, bestSet: { weight: 100, reps: 8 }, isPR: false, ...extra });
const item = (sessions) => ({
  id: 'squat', name: 'Squat', muscle: 'legs', mode: 'e1rm', best: 100, last: { value: 100 }, skipped: 0, sessions,
});

beforeEach(() => setBrowserTimeZone('Europe/Rome'));

describe('ExerciseDetailDialog: fuso nella cronologia', () => {
  it('una sessione fatta a New York mostra il giorno scritto e il badge', () => {
    render(<ExerciseDetailDialog item={item([
      session(1, '2026-10-18 02:00:00', { started_at: '2026-10-18T02:00:00-04:00', time_zone: 'America/New_York' }),
    ])} onClose={() => {}} />);
    const row = screen.getByText('18/10/2026', { selector: 'td' }).closest('tr');
    expect(within(row).getByText('New York · UTC−4')).toBeTruthy();
  });
  it('una sessione nel fuso del dispositivo non ha il badge', () => {
    render(<ExerciseDetailDialog item={item([
      session(1, '2026-10-18 02:00:00', { started_at: '2026-10-18T02:00:00+02:00', time_zone: 'Europe/Rome' }),
    ])} onClose={() => {}} />);
    expect(screen.queryByText(/UTC/)).toBeNull();
  });
});
