// Il testo della durata nello Storico: minuti, anche sopra l'ora, mai «0 min» quando la durata c'è.
import { describe, it, expect } from 'vitest';
import { durationText } from './workoutText';

describe('durationText', () => {
  it.each([[null], [undefined], [0]])('senza durata (%s) non c\'è testo', (seconds) => {
    expect(durationText(seconds)).toBeNull();
  });

  it.each([[1, '1 min'], [29, '1 min'], [30, '1 min'], [59, '1 min'], [60, '1 min'], [89, '1 min'], [90, '2 min'], [3600, '60 min'], [3720, '62 min'], [5700, '95 min']])('%i secondi sono «%s»', (seconds, testo) => {
    expect(durationText(seconds)).toBe(testo);
  });
});
