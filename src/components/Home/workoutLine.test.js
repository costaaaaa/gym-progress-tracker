import { describe, it, expect } from 'vitest';
import { workoutLine } from './workoutLine';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);
const record = (extra = {}) => ({
  duration_seconds: 3480,
  exercises: [
    { name: 'Panca piana', sets: [{ weight: 20, reps: 10, is_warmup: true }, { weight: 100, reps: 5 }, { weight: 100, reps: 5 }] },
    { name: 'Squat', sets: [{ weight: '80.5', reps: '8-10' }] },
  ],
  ...extra,
});

describe('workoutLine: durata e volume di un allenamento', () => {
  it('«58 min · 1805 kg di volume»: il riscaldamento non conta, le ripetizioni come nello Storico', () => {
    expect(workoutLine(record(), 'kg', t)).toBe('58 min · 1805 kg di volume');
  });
  it('senza durata c\'è solo il volume', () => {
    expect(workoutLine(record({ duration_seconds: null }), 'kg', t)).toBe('1805 kg di volume');
  });
  it('un\'ora e oltre: ore e minuti', () => {
    expect(workoutLine(record({ duration_seconds: 4500 }), 'kg', t)).toBe('1 h 15 min · 1805 kg di volume');
  });
  it('a corpo libero (volume 0) resta la sola durata', () => {
    const r = record({ exercises: [{ name: 'Trazioni', sets: [{ weight: 0, reps: 8 }] }] });
    expect(workoutLine(r, 'kg', t)).toBe('58 min');
  });
  it('nell\'unità dell\'account: in lb il totale è convertito e arrotondato', () => {
    expect(workoutLine(record(), 'lb', t)).toBe('58 min · 3979 lb di volume');
  });
  it('senza durata né volume la riga è vuota', () => {
    expect(workoutLine({ exercises: [] }, 'kg', t)).toBe('');
    expect(workoutLine(undefined, 'kg', t)).toBe('');
  });
});
