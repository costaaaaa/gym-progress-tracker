// Volume, serie e record di ogni allenamento dell'elenco: gli stessi numeri della card da condividere, calcolati una volta per lettura.
import { describe, it, expect } from 'vitest';
import workoutSummaries from './workoutSummaries';
import { historyRecords } from '../../utils/shareCard';
import { exercise, workout, made } from '../../test/storico';

// Allenamenti finti ripetibili: pochi esercizi che tornano, carichi che salgono e scendono, qualche riscaldamento,
// più allenamenti nello stesso istante (si distinguono per id) e un esercizio a corpo libero.
const generate = (count) => Array.from({ length: count }, (_, i) => {
  const day = 1 + (i >> 1) % 28;
  const month = 1 + (i % 9);
  return made({
    id: 1000 + i,
    date: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} 18:00:00`,
    exercises: [1, 2, 3, 4].filter((id) => (i + id) % 3 !== 0).map((id) => exercise(id, `Esercizio ${id}`, [
      { set_number: 1, weight: 20, reps: 10, is_warmup: true },
      { set_number: 2, weight: id === 4 ? 0 : 40 + ((i * 7 + id * 3) % 11) * 5, reps: 5 + ((i + id) % 8) },
      { set_number: 3, weight: id === 4 ? 0 : 40 + ((i * 5 + id) % 13) * 5, reps: 4 + (i % 6) },
    ])),
  });
});
const withoutVolume = (records) => records.filter((r) => r.type !== 'volume');

describe('workoutSummaries', () => {
  it('volume in kg (arrotondato) e serie allenanti: il riscaldamento non conta', () => {
    const sets = [{ set_number: 1, weight: 20, reps: 10, is_warmup: true }, { set_number: 2, weight: 60.5, reps: 8 }];
    const summary = workoutSummaries([made({ exercises: [exercise(1, 'Panca piana', sets), exercise(2, 'Croci')] })])[7];
    expect(summary.volumeKg).toBe(Math.round(60.5 * 8 + 480));
    expect(summary.sets).toBe(2);
    expect(summary.records).toEqual([]);
  });

  it('un allenamento senza esercizi vale zero', () => {
    expect(workoutSummaries([made({ exercises: [] })])[7]).toEqual({ volumeKg: 0, sets: 0, records: [] });
  });

  it('i record sono quelli di historyRecords, senza il solo volume', () => {
    const prima = made({ id: 6, date: '2026-10-10 02:00:00', exercises: [exercise(1, 'Panca piana', [{ set_number: 1, weight: 100, reps: 1 }])] });
    const vero = made({ id: 8, exercises: [exercise(1, 'Panca piana', [{ set_number: 1, weight: 110, reps: 3 }])] });
    const solo = made({ id: 9, date: '2026-10-19 02:00:00', exercises: [exercise(1, 'Panca piana', [{ set_number: 1, weight: 60, reps: 8 }])] });
    const summaries = workoutSummaries([solo, vero, prima, workout]);
    expect(summaries[8].records).toEqual(withoutVolume(historyRecords([solo, vero, prima, workout], vero)));
    expect(summaries[8].records.map((r) => r.type)).toEqual(['weight']);
    expect(summaries[9].records).toEqual([]);
    expect(summaries[6].records).toEqual([]);
  });

  it('una data illeggibile: l\'allenamento non ha storico e non ne dà agli altri, come in historyRecords', () => {
    const rotto = made({ id: 3, date: 'non è una data', exercises: [exercise(1, 'Panca piana', [{ set_number: 1, weight: 500, reps: 1 }])] });
    const prima = made({ id: 6, date: '2026-10-10 02:00:00', exercises: [exercise(1, 'Panca piana', [{ set_number: 1, weight: 100, reps: 1 }])] });
    const vero = made({ id: 8, exercises: [exercise(1, 'Panca piana', [{ set_number: 1, weight: 110, reps: 3 }])] });
    const all = [vero, prima, rotto];
    const summaries = workoutSummaries(all);
    all.forEach((w) => expect(summaries[w.id].records).toEqual(withoutVolume(historyRecords(all, w))));
    expect(summaries[8].records).toHaveLength(1);
  });

  it.each([
    ['in ordine dal più recente', (list) => list],
    ['in ordine inverso', (list) => [...list].reverse()],
    ['mescolati', (list) => [...list].sort((a, b) => ((a.id * 7919) % 101) - ((b.id * 7919) % 101))],
  ])('stessi risultati di historyRecords su 60 allenamenti %s', (_, order) => {
    const all = order(generate(60));
    const summaries = workoutSummaries(all);
    expect(Object.keys(summaries)).toHaveLength(60);
    all.forEach((w) => {
      expect(summaries[w.id].records).toEqual(withoutVolume(historyRecords(all, w)));
    });
    expect(Object.values(summaries).some((s) => s.records.length > 0)).toBe(true);
  });
});
