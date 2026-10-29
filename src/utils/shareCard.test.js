import { describe, it, expect } from 'vitest';
import { toDate, muscleGroupsTitle, buildShareStats, sessionRecords } from './shareCard';
import { setBrowserTimeZone } from '../test/timeZone';

describe('toDate: la data di un allenamento', () => {
  it('un orologio "YYYY-MM-DD HH:MM:SS" è quel giorno e quell\'ora, nel fuso del browser', () => {
    const d = toDate('2026-10-18 02:30:15');
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([2026, 10, 18, 2, 30, 15]);
  });
  it('una sola data è mezzanotte di quel giorno, non il giorno prima a ovest di UTC', () => {
    setBrowserTimeZone('America/New_York');
    const d = toDate('2026-10-18');
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours()]).toEqual([2026, 10, 18, 0]);
  });
  it('un istante ISO e una Date restano quelli', () => {
    expect(toDate('2026-10-18T02:00:00-04:00').getTime()).toBe(Date.UTC(2026, 9, 18, 6));
    const now = new Date();
    expect(toDate(now)).toBe(now);
  });
});

describe('Il riscaldamento non è allenante (#66): escluso dalla card condivisa', () => {
  it('muscleGroupsTitle non conta le serie di riscaldamento: schiena (2 allenanti) prima di petto (0, solo riscaldamento)', () => {
    const title = muscleGroupsTitle([
      { muscle_group: 'petto', sets: [{ is_warmup: true }, { is_warmup: true }, { is_warmup: true }] },
      { muscle_group: 'schiena', sets: [{}, {}] },
    ]);
    expect(title).toBe('Schiena · Petto');
  });

  it('buildShareStats esclude il riscaldamento da serie, volume ed esercizi', () => {
    const stats = buildShareStats({
      exercises: [{
        name: 'Panca', muscle_group: 'petto',
        sets: [{ weight: 20, reps: 10, is_warmup: true }, { weight: 80, reps: 5 }],
      }],
      date: '2026-10-18', durationSec: 0, title: '', records: [], streakWeeks: 0,
    });
    expect(stats.sets).toBe(1);
    expect(stats.volumeKg).toBe(400);
    expect(stats.exerciseList).toEqual([expect.objectContaining({ name: 'Panca', sets: 1 })]);
    expect(stats.muscles).toEqual([expect.objectContaining({ group: 'Petto', pct: 100 })]);
  });

  it('un esercizio con solo serie di riscaldamento non conta come fatto', () => {
    const stats = buildShareStats({
      exercises: [{ name: 'Panca', muscle_group: 'petto', sets: [{ weight: 20, reps: 10, is_warmup: true }] }],
      date: '2026-10-18', durationSec: 0, title: '', records: [], streakWeeks: 0,
    });
    expect(stats.exercises).toBe(0);
    expect(stats.exerciseList).toEqual([]);
    expect(stats.muscles).toEqual([]);
  });

  it('sessionRecords non segnala record su un esercizio con solo serie di riscaldamento', () => {
    const records = sessionRecords(
      [{ exercise_id: 1, name: 'Panca', sets: [{ weight: 999, reps: 5, is_warmup: true }] }],
      { 1: { bestWeight: 100, bestOneRM: 116.7, bestSessionVolume: 500, bestBodyweightReps: 0 } }
    );
    expect(records).toEqual([]);
  });
});
