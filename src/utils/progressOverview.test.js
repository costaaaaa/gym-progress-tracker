import { describe, it, expect } from 'vitest';
import { daysSince, buildExerciseSeries } from './progressOverview';

const rec = (id, date, extra = {}) => ({
  id, date, ...extra, exercises: [{ exercise_id: 1, name: 'Panca', sets: [{ weight: 80, reps: 5 }] }],
});

describe('daysSince: i giorni fra istanti, non fra orologi di fusi diversi', () => {
  it('con started_at conta dall\'istante vero, qualunque sia il fuso del browser', () => {
    // 02:00 a New York = 06:00 UTC; dopo 3 giorni esatti sono passati 3 giorni
    const workout = { date: '2026-10-18 02:00:00', started_at: '2026-10-18T02:00:00-04:00' };
    expect(daysSince(workout, Date.UTC(2026, 9, 21, 6, 0, 0))).toBe(3);
    expect(daysSince(workout, Date.UTC(2026, 9, 21, 5, 59, 0))).toBe(2);
  });
  it('senza started_at (backend vecchio) legge l\'orologio nel fuso del browser, come prima', () => {
    expect(daysSince({ date: '2026-10-18 02:00:00' }, new Date(2026, 9, 21, 2, 0, 0).getTime())).toBe(3);
  });
});

describe('buildExerciseSeries: le sessioni portano fuso e istante', () => {
  it('ogni sessione ha time_zone e started_at dell\'allenamento, per il badge e per i conti', () => {
    const series = buildExerciseSeries([
      rec(1, '2026-10-18 02:00:00', { time_zone: 'America/New_York', started_at: '2026-10-18T02:00:00-04:00' }),
    ]);
    expect(series['1'].sessions[0]).toMatchObject({ time_zone: 'America/New_York', started_at: '2026-10-18T02:00:00-04:00' });
  });
  it('l\'ordine segue l\'orologio scritto (date), a prescindere dal fuso del browser', () => {
    const series = buildExerciseSeries([
      rec(2, '2026-10-18 23:30:00'),
      rec(1, '2026-10-18 00:30:00'),
      rec(3, '2026-03-29 02:30:00'),
    ]);
    expect(series['1'].sessions.map((s) => s.id)).toEqual([3, 1, 2]);
  });
});
