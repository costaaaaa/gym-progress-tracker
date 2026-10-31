// Serie pianificate di prova, comuni ai test di utilità, editor e pagine.
export const DROP = 'Drop Set (Stripping)';

// Righe allenanti per buildPlannedSets: { reps_min, reps_max, to_failure, technique }
export const normal = (min, max, technique = null) => ({ reps_min: min, reps_max: max, to_failure: false, technique });
export const failure = (min = null, technique = null) => ({ reps_min: min, reps_max: null, to_failure: true, technique });

// Singole serie come le restituisce il server, con il loro set_number
export const warm = (n) => ({ set_number: n, kind: 'warmup', reps_min: null, reps_max: null, to_failure: false, intensity_technique: null });
export const work = (n, min, max, technique = null, to_failure = false) => ({
  set_number: n, kind: 'working', reps_min: min, reps_max: max, to_failure, intensity_technique: technique,
});

// `warmups` di riscaldamento, poi le allenanti { min, max, failure, technique }, numerate da 1
export const plannedSets = (warmups, rows) => [
  ...Array.from({ length: warmups }, (_, i) => warm(i + 1)),
  ...rows.map(({ min = null, max = null, failure: toFailure = false, technique = null }, i) => (
    work(warmups + i + 1, min, toFailure ? null : max, technique, toFailure)
  )),
];
export const times = (n, row) => Array.from({ length: n }, () => row);
