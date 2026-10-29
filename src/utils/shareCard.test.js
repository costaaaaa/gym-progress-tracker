import { describe, it, expect } from 'vitest';
import { toDate } from './shareCard';

describe('toDate: la data di un allenamento', () => {
  it('un orologio "YYYY-MM-DD HH:MM:SS" è quel giorno e quell\'ora, nel fuso del browser', () => {
    const d = toDate('2026-10-18 02:30:15');
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([2026, 10, 18, 2, 30, 15]);
  });
  it('una sola data è mezzanotte di quel giorno, non il giorno prima a ovest di UTC', () => {
    const d = toDate('2026-10-18');
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours()]).toEqual([2026, 10, 18, 0]);
  });
  it('un istante ISO e una Date restano quelli', () => {
    expect(toDate('2026-10-18T02:00:00-04:00').getTime()).toBe(Date.UTC(2026, 9, 18, 6));
    const now = new Date();
    expect(toDate(now)).toBe(now);
  });
});
