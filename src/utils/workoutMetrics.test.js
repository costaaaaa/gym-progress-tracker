import { describe, it, expect } from 'vitest';
import { summarizeSets, buildExerciseHistoryIndex, detectPersonalRecords } from './workoutMetrics';

describe('summarizeSets: le serie di riscaldamento non sono allenanti (#66)', () => {
  it('esclude dal volume e dai record le serie is_warmup, ma conta quelle allenanti', () => {
    const sets = [
      { weight: 20, reps: 10, is_warmup: true },
      { weight: 100, reps: 5 },
      { weight: 100, reps: 5 },
    ];
    const { bestWeight, sessionVolume } = summarizeSets(sets);
    expect(bestWeight).toBe(100);
    expect(sessionVolume).toBe(1000); // 100*5*2, non 100*5*2 + 20*10
  });

  it('con solo serie di riscaldamento il risultato è vuoto', () => {
    const { bestWeight, sessionVolume, bestOneRM, bestBodyweightReps } = summarizeSets([
      { weight: 20, reps: 10, is_warmup: true },
    ]);
    expect(bestWeight).toBe(0);
    expect(sessionVolume).toBe(0);
    expect(bestOneRM).toBe(0);
    expect(bestBodyweightReps).toBe(0);
  });
});

describe('buildExerciseHistoryIndex: lo storico ignora il riscaldamento nei record personali', () => {
  it('bestWeight/bestSessionVolume non considerano le serie is_warmup', () => {
    const index = buildExerciseHistoryIndex([
      {
        date: '2026-10-20',
        exercises: [{
          exercise_id: 1,
          sets: [
            { weight: 150, reps: 5, is_warmup: true },
            { weight: 100, reps: 5 },
          ],
        }],
      },
    ]);
    expect(index[1].bestWeight).toBe(100);
    expect(index[1].bestSessionVolume).toBe(500);
  });
});

describe('detectPersonalRecords: un peso di riscaldamento più alto non è un PR', () => {
  it('non segnala PR se solo la serie di riscaldamento batte il precedente', () => {
    const history = { bestWeight: 100, bestOneRM: 116.7, bestSessionVolume: 500, bestBodyweightReps: 0 };
    const result = detectPersonalRecords(
      [{ weight: 150, reps: 5, is_warmup: true }, { weight: 100, reps: 5 }],
      history
    );
    expect(result.isPR).toBe(false);
    expect(result.weight).toBeNull();
  });

  it('segnala il PR su una serie allenante anche se precede un riscaldamento più leggero', () => {
    const history = { bestWeight: 100, bestOneRM: 116.7, bestSessionVolume: 500, bestBodyweightReps: 0 };
    const result = detectPersonalRecords(
      [{ weight: 20, reps: 10, is_warmup: true }, { weight: 110, reps: 5 }],
      history
    );
    expect(result.isPR).toBe(true);
    expect(result.weight).toBe(110);
  });
});
