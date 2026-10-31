import { describe, it, expect } from 'vitest';
import i18n from '../i18n';
import { parseTarget, parseRowTarget, targetLabel, compactForm, fromCompact, buildPlannedSets, planSummary, plannedSetsError, samePlannedSets } from './plannedSets';

describe('parseTarget: da testo a { reps_min, reps_max }', () => {
  it('un numero vale min = max', () => {
    expect(parseTarget('8')).toEqual({ reps_min: 8, reps_max: 8 });
  });

  it('un intervallo, anche con spazi attorno al trattino', () => {
    expect(parseTarget('8-10')).toEqual({ reps_min: 8, reps_max: 10 });
    expect(parseTarget(' 8 - 10 ')).toEqual({ reps_min: 8, reps_max: 10 });
  });

  it('"8-8" vale come "8"', () => {
    expect(parseTarget('8-8')).toEqual(parseTarget('8'));
  });

  it('accetta i limiti 1 e 250 e rifiuta 0 e 251', () => {
    expect(parseTarget('1')).toEqual({ reps_min: 1, reps_max: 1 });
    expect(parseTarget('250')).toEqual({ reps_min: 250, reps_max: 250 });
    expect(parseTarget('1-250')).toEqual({ reps_min: 1, reps_max: 250 });
    expect(parseTarget('0')).toBeNull();
    expect(parseTarget('251')).toBeNull();
    expect(parseTarget('8-251')).toBeNull();
    expect(parseTarget('0-8')).toBeNull();
  });

  it('rifiuta min > max, testo vuoto e testo non numerico', () => {
    expect(parseTarget('10-8')).toBeNull();
    expect(parseTarget('')).toBeNull();
    expect(parseTarget('   ')).toBeNull();
    expect(parseTarget('abc')).toBeNull();
    expect(parseTarget('8-')).toBeNull();
    expect(parseTarget('8-10-12')).toBeNull();
    expect(parseTarget('8.5')).toBeNull();
    expect(parseTarget('-8')).toBeNull();
    expect(parseTarget('Max')).toBeNull();
  });

  it('non accetta null né numeri al posto del testo vuoto', () => {
    expect(parseTarget(null)).toBeNull();
    expect(parseTarget(undefined)).toBeNull();
  });
});

describe('parseRowTarget: il target di una riga, normale o a cedimento', () => {
  it('normale: come parseTarget, con to_failure false', () => {
    expect(parseRowTarget('8-10', false)).toEqual({ reps_min: 8, reps_max: 10, to_failure: false });
    expect(parseRowTarget('x', false)).toBeNull();
  });

  it('a cedimento: il testo è il solo minimo, facoltativo', () => {
    expect(parseRowTarget('', true)).toEqual({ reps_min: null, reps_max: null, to_failure: true });
    expect(parseRowTarget(' 6 ', true)).toEqual({ reps_min: 6, reps_max: null, to_failure: true });
    expect(parseRowTarget('250', true)).toEqual({ reps_min: 250, reps_max: null, to_failure: true });
  });

  it('a cedimento: rifiuta intervalli, 0 e 251', () => {
    expect(parseRowTarget('6-8', true)).toBeNull();
    expect(parseRowTarget('0', true)).toBeNull();
    expect(parseRowTarget('251', true)).toBeNull();
    expect(parseRowTarget('abc', true)).toBeNull();
  });
});

describe('targetLabel: il target di una serie a parole', () => {
  const set = (reps_min, reps_max, to_failure = false) => ({ kind: 'working', reps_min, reps_max, to_failure });

  it('numero e intervallo', () => {
    expect(targetLabel(set(8, 8))).toBe('8');
    expect(targetLabel(set(8, 10))).toBe('8-10');
  });

  it('a cedimento, per esteso, con e senza minimo', () => {
    expect(targetLabel(set(null, null, true))).toBe('a cedimento');
    expect(targetLabel(set(8, null, true))).toBe('a cedimento (min. 8)');
  });

  it('in inglese', async () => {
    await i18n.changeLanguage('en');
    expect(targetLabel(set(null, null, true))).toBe('to failure');
    expect(targetLabel(set(8, null, true))).toBe('to failure (min 8)');
    expect(targetLabel(set(8, 10))).toBe('8-10');
  });
});

const warm = (n) => ({ set_number: n, kind: 'warmup', reps_min: null, reps_max: null, to_failure: false, intensity_technique: null });
const work = (n, min, max, technique = null, to_failure = false) => ({
  set_number: n, kind: 'working', reps_min: min, reps_max: max, to_failure, intensity_technique: technique,
});
const DROP = 'Drop Set (Stripping)';

describe('compactForm: le serie nella forma compatta, o null', () => {
  it('serie tutte uguali, riscaldamento e tecnica sull\'ultima', () => {
    const sets = [warm(1), warm(2), work(3, 8, 10), work(4, 8, 10), work(5, 8, 10, DROP)];
    expect(compactForm(sets)).toEqual({
      warmups: 2, sets: 3, target: { reps_min: 8, reps_max: 10, to_failure: false }, technique: DROP,
    });
  });

  it('senza riscaldamento né tecnica', () => {
    expect(compactForm([work(1, 12, 12), work(2, 12, 12)])).toEqual({
      warmups: 0, sets: 2, target: { reps_min: 12, reps_max: 12, to_failure: false }, technique: null,
    });
  });

  it('una sola allenante con tecnica', () => {
    expect(compactForm([work(1, 5, 5, DROP)])).toMatchObject({ sets: 1, technique: DROP });
  });

  it('a cedimento con e senza minimo', () => {
    expect(compactForm([work(1, null, null, null, true), work(2, null, null, null, true)]).target)
      .toEqual({ reps_min: null, reps_max: null, to_failure: true });
    expect(compactForm([work(1, 6, null, null, true)]).target)
      .toEqual({ reps_min: 6, reps_max: null, to_failure: true });
  });

  it('target diversi: non compattabile', () => {
    expect(compactForm([work(1, 12, 12), work(2, 10, 10), work(3, 8, 8)])).toBeNull();
    expect(compactForm([work(1, 8, 10), work(2, 8, 12)])).toBeNull();
    expect(compactForm([work(1, 8, 8), work(2, null, null, null, true)])).toBeNull();
    expect(compactForm([work(1, null, null, null, true), work(2, 6, null, null, true)])).toBeNull();
  });

  it('tecnica non sull\'ultima, o su più serie: non compattabile', () => {
    expect(compactForm([work(1, 8, 8, DROP), work(2, 8, 8)])).toBeNull();
    expect(compactForm([work(1, 8, 8, DROP), work(2, 8, 8, DROP)])).toBeNull();
    expect(compactForm([work(1, 8, 8), work(2, 8, 8, DROP), work(3, 8, 8)])).toBeNull();
  });
});

describe('fromCompact: dalla forma compatta alle serie', () => {
  const target = { reps_min: 8, reps_max: 10, to_failure: false };

  it('riscaldamenti in testa, set_number da 1, tecnica solo sull\'ultima allenante', () => {
    expect(fromCompact({ warmups: 1, sets: 3, target, technique: DROP })).toEqual([
      warm(1), work(2, 8, 10), work(3, 8, 10), work(4, 8, 10, DROP),
    ]);
  });

  it('tecnica vuota o "Nessuna (Normale)" diventa null', () => {
    const none = [work(1, 8, 10), work(2, 8, 10)];
    expect(fromCompact({ warmups: 0, sets: 2, target, technique: '' })).toEqual(none);
    expect(fromCompact({ warmups: 0, sets: 2, target, technique: 'Nessuna (Normale)' })).toEqual(none);
    expect(fromCompact({ warmups: 0, sets: 2, target, technique: null })).toEqual(none);
  });

  it('a cedimento con minimo', () => {
    expect(fromCompact({ warmups: 0, sets: 1, target: { reps_min: 6, reps_max: null, to_failure: true }, technique: '' }))
      .toEqual([work(1, 6, null, null, true)]);
  });

  it('andata e ritorno con compactForm', () => {
    const forms = [
      { warmups: 0, sets: 1, target, technique: null },
      { warmups: 10, sets: 20, target: { reps_min: 1, reps_max: 250, to_failure: false }, technique: DROP },
      { warmups: 2, sets: 4, target: { reps_min: null, reps_max: null, to_failure: true }, technique: 'Rest Pause' },
    ];
    forms.forEach((form) => expect(compactForm(fromCompact(form))).toEqual(form));
  });
});

describe('buildPlannedSets: dalla lista per serie', () => {
  it('riscaldamenti, poi una riga per serie con la sua tecnica', () => {
    const rows = [
      { reps_min: 12, reps_max: 12, to_failure: false, technique: '' },
      { reps_min: 10, reps_max: 10, to_failure: false, technique: null },
      { reps_min: 6, reps_max: null, to_failure: true, technique: 'Nessuna (Normale)' },
      { reps_min: 8, reps_max: 8, to_failure: false, technique: DROP },
    ];
    expect(buildPlannedSets(2, rows)).toEqual([
      warm(1), warm(2), work(3, 12, 12), work(4, 10, 10), work(5, 6, null, null, true), work(6, 8, 8, DROP),
    ]);
  });
});

describe('planSummary: la riga riassuntiva della scheda', () => {
  it('tutte uguali: N × target', () => {
    expect(planSummary([work(1, 8, 10), work(2, 8, 10), work(3, 8, 10)])).toBe('3 × 8-10');
  });

  it('il riscaldamento è un prefisso', () => {
    expect(planSummary([warm(1), warm(2), work(3, 12, 12)])).toBe('2 risc. + 1 × 12');
  });

  it('raggruppa le allenanti consecutive con lo stesso target', () => {
    expect(planSummary([work(1, 8, 10), work(2, 8, 10), work(3, 12, 15)])).toBe('2 × 8-10 + 1 × 12-15');
  });

  it('i gruppi non consecutivi uguali restano separati', () => {
    expect(planSummary([work(1, 8, 8), work(2, 10, 10), work(3, 8, 8)])).toBe('1 × 8 + 1 × 10 + 1 × 8');
  });

  it('a cedimento, per esteso', () => {
    expect(planSummary([work(1, null, null, null, true), work(2, null, null, null, true)])).toBe('2 × a cedimento');
    expect(planSummary([work(1, 8, 8), work(2, 6, null, null, true)])).toBe('1 × 8 + 1 × a cedimento (min. 6)');
  });

  it('tecnica, forma compatta su più serie: sull\'ultima', () => {
    expect(planSummary([work(1, 8, 10), work(2, 8, 10), work(3, 8, 10, DROP)]))
      .toBe('3 × 8-10 · Drop set (stripping) sull\'ultima');
  });

  it('tecnica, una sola serie allenante: solo il nome', () => {
    expect(planSummary([warm(1), work(2, 5, 5, DROP)])).toBe('1 risc. + 1 × 5 · Drop set (stripping)');
  });

  it('tecnica, forma per serie: il numero conta solo le allenanti, da 1', () => {
    expect(planSummary([warm(1), work(2, 8, 10), work(3, 8, 10), work(4, 12, 15, DROP)]))
      .toBe('1 risc. + 2 × 8-10 + 1 × 12-15 · Drop set (stripping) (serie 3)');
  });

  it('tecnica, forma per serie: più serie con la stessa tecnica', () => {
    expect(planSummary([work(1, 8, 8), work(2, 8, 8, DROP), work(3, 10, 10, DROP)]))
      .toBe('2 × 8 + 1 × 10 · Drop set (stripping) (serie 2, 3)');
  });

  it('tecnica non sull\'ultima: (serie N) anche se i target sono uguali', () => {
    expect(planSummary([work(1, 8, 8, DROP), work(2, 8, 8)])).toBe('2 × 8 · Drop set (stripping) (serie 1)');
  });

  it('più tecniche, nell\'ordine di prima comparsa', () => {
    expect(planSummary([work(1, 8, 8, 'Rest Pause'), work(2, 8, 8, DROP), work(3, 10, 10, 'Rest Pause')]))
      .toBe('2 × 8 + 1 × 10 · Rest pause (serie 1, 3) · Drop set (stripping) (serie 2)');
  });

  it('in inglese', async () => {
    await i18n.changeLanguage('en');
    expect(planSummary([warm(1), warm(2), work(3, 8, 10), work(4, 8, 10, DROP)]))
      .toBe('2 warm-up + 2 × 8-10 · Drop set (stripping) on the last set');
    expect(planSummary([work(1, 8, 10), work(2, null, null, DROP, true), work(3, 8, 10, DROP)]))
      .toBe('1 × 8-10 + 1 × to failure + 1 × 8-10 · Drop set (stripping) (sets 2, 3)');
  });

  it('senza serie: stringa vuota', () => {
    expect(planSummary([])).toBe('');
    expect(planSummary(undefined)).toBe('');
  });
});

describe('plannedSetsError: le stesse regole di planned_sets_error() del backend', () => {
  const numbered = (sets) => sets.map((set, i) => ({ ...set, set_number: i + 1 }));
  const many = (warmups, workings) => numbered([
    ...Array.from({ length: warmups }, () => warm(1)),
    ...Array.from({ length: workings }, () => work(1, 8, 10)),
  ]);

  it('serie valide: null', () => {
    expect(plannedSetsError([warm(1), work(2, 8, 10), work(3, null, null, DROP, true)])).toBeNull();
    expect(plannedSetsError([work(1, 6, null, null, true)])).toBeNull();
  });

  it('limiti: da 1 a 20 allenanti, da 0 a 10 riscaldamenti', () => {
    expect(plannedSetsError(many(0, 20))).toBeNull();
    expect(plannedSetsError(many(10, 1))).toBeNull();
    expect(plannedSetsError(many(0, 21))).toBe('plan_editor.error_count');
    expect(plannedSetsError(many(11, 1))).toBe('plan_editor.error_count');
    expect(plannedSetsError(many(2, 0))).toBe('plan_editor.error_count');
    expect(plannedSetsError([])).toBe('plan_editor.error_count');
  });

  it('i riscaldamenti vengono prima delle allenanti', () => {
    expect(plannedSetsError([work(1, 8, 10), warm(2), work(3, 8, 10)])).toBe('plan_editor.error_order');
  });

  it('set_number consecutivi da 1', () => {
    expect(plannedSetsError([work(2, 8, 10)])).toBe('plan_editor.error_invalid');
    expect(plannedSetsError([work(1, 8, 10), work(3, 8, 10)])).toBe('plan_editor.error_invalid');
  });

  it('il riscaldamento ha target vuoto e nessuna tecnica', () => {
    expect(plannedSetsError([{ ...warm(1), reps_min: 8, reps_max: 8 }, work(2, 8, 10)])).toBe('plan_editor.error_target');
    expect(plannedSetsError([{ ...warm(1), to_failure: true }, work(2, 8, 10)])).toBe('plan_editor.error_target');
    expect(plannedSetsError([{ ...warm(1), intensity_technique: DROP }, work(2, 8, 10)])).toBe('plan_editor.error_target');
    expect(plannedSetsError([{ ...warm(1), intensity_technique: 'Nessuna (Normale)' }, work(2, 8, 10)])).toBeNull();
  });

  it('allenante normale: interi 1-250 con min <= max', () => {
    expect(plannedSetsError([work(1, 1, 250)])).toBeNull();
    expect(plannedSetsError([work(1, 0, 8)])).toBe('plan_editor.error_target');
    expect(plannedSetsError([work(1, 8, 251)])).toBe('plan_editor.error_target');
    expect(plannedSetsError([work(1, 10, 8)])).toBe('plan_editor.error_target');
    expect(plannedSetsError([work(1, null, null)])).toBe('plan_editor.error_target');
    expect(plannedSetsError([work(1, 8, null)])).toBe('plan_editor.error_target');
    expect(plannedSetsError([work(1, 8.5, 9)])).toBe('plan_editor.error_target');
  });

  it('a cedimento: reps_max null, minimo facoltativo 1-250', () => {
    expect(plannedSetsError([work(1, 250, null, null, true)])).toBeNull();
    expect(plannedSetsError([work(1, null, 10, null, true)])).toBe('plan_editor.error_target');
    expect(plannedSetsError([work(1, 251, null, null, true)])).toBe('plan_editor.error_target');
    expect(plannedSetsError([work(1, 0, null, null, true)])).toBe('plan_editor.error_target');
  });

  it('tecnica: testo di al massimo 100 caratteri', () => {
    expect(plannedSetsError([work(1, 8, 8, 'x'.repeat(100))])).toBeNull();
    expect(plannedSetsError([work(1, 8, 8, 'x'.repeat(101))])).toBe('plan_editor.error_technique');
    expect(plannedSetsError([work(1, 8, 8, 5)])).toBe('plan_editor.error_technique');
  });
});

describe('samePlannedSets: confronto tra quanto inviato e quanto restituito dal server', () => {
  const sent = buildPlannedSets(1, [
    { reps_min: 8, reps_max: 10, to_failure: false, technique: null },
    { reps_min: 6, reps_max: null, to_failure: true, technique: 'Rest Pause' },
  ]);

  it('uguali anche se il server restituisce 0/1 per il cedimento, numeri come testo e tecnica vuota', () => {
    const received = [
      { set_number: '1', kind: 'warmup', reps_min: null, reps_max: null, to_failure: 0, intensity_technique: '' },
      { set_number: 2, kind: 'working', reps_min: '8', reps_max: '10', to_failure: 0, intensity_technique: null },
      { set_number: 3, kind: 'working', reps_min: 6, reps_max: null, to_failure: 1, intensity_technique: 'Rest Pause' },
    ];
    expect(samePlannedSets(sent, received)).toBe(true);
  });

  it('diverse se cambia un target, una tecnica o il numero di serie', () => {
    const changed = (patch) => sent.map((set, i) => (i === 1 ? { ...set, ...patch } : set));
    expect(samePlannedSets(sent, changed({ reps_max: 12 }))).toBe(false);
    expect(samePlannedSets(sent, changed({ intensity_technique: 'Myo-Reps' }))).toBe(false);
    expect(samePlannedSets(sent, sent.slice(0, 2))).toBe(false);
  });

  it('un server che non restituisce serie non coincide con quelle inviate', () => {
    expect(samePlannedSets(sent, undefined)).toBe(false);
    expect(samePlannedSets(sent, [])).toBe(false);
  });
});
