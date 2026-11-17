import { describe, it, expect } from 'vitest';
import { DRAFT_STORAGE_KEY, hasFocusSessionInProgress, savedDraftDayId } from './focusDraft';

const save = (draft) => localStorage.setItem(DRAFT_STORAGE_KEY, typeof draft === 'string' ? draft : JSON.stringify(draft));

describe('bozza Focus', () => {
  it('senza bozza non c\'è nessun allenamento in corso', () => {
    expect(hasFocusSessionInProgress()).toBe(false);
    expect(savedDraftDayId()).toBeNull();
  });

  it('una bozza con giorno e ora di inizio è un allenamento in corso', () => {
    save({ selectedDayId: 7, selectedDay: { id: 7 }, startTime: 1000 });
    expect(hasFocusSessionInProgress()).toBe(true);
    expect(savedDraftDayId()).toBe(7);
  });

  it('una bozza senza ora di inizio, o rovinata, non lo è', () => {
    save({ selectedDay: { id: 7 } });
    expect(hasFocusSessionInProgress()).toBe(false);
    save('{non json');
    expect(hasFocusSessionInProgress()).toBe(false);
    expect(savedDraftDayId()).toBeNull();
  });
});
