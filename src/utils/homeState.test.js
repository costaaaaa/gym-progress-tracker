import { describe, it, expect } from 'vitest';
import { homeState, isRedState, todayIndex } from './homeState';
import { setBrowserTimeZone } from '../test/timeZone';

const base = { hasDraft: false, trainedToday: false, weeklyWorkouts: 1, weeklyGoal: 3 };

describe('homeState', () => {
  it('senza bozza, allenamento di oggi né obiettivo raggiunto è «todo»', () => {
    expect(homeState(base)).toBe('todo');
  });
  it('una bozza aperta vince su tutto: «resume»', () => {
    expect(homeState({ ...base, hasDraft: true, trainedToday: true, weeklyWorkouts: 5 })).toBe('resume');
  });
  it('allenato oggi è «done», anche con l\'obiettivo raggiunto', () => {
    expect(homeState({ ...base, trainedToday: true })).toBe('done');
    expect(homeState({ ...base, trainedToday: true, weeklyWorkouts: 3 })).toBe('done');
  });
  it('obiettivo raggiunto o superato, non ancora allenato oggi: «goal»', () => {
    expect(homeState({ ...base, weeklyWorkouts: 3 })).toBe('goal');
    expect(homeState({ ...base, weeklyWorkouts: 5 })).toBe('goal');
  });
  it('senza obiettivo (0, mancante) non si può raggiungerlo: «todo»', () => {
    expect(homeState({ ...base, weeklyWorkouts: 0, weeklyGoal: 0 })).toBe('todo');
    expect(homeState({ ...base, weeklyWorkouts: 2, weeklyGoal: undefined })).toBe('todo');
    expect(homeState({ ...base, weeklyWorkouts: undefined, weeklyGoal: 3 })).toBe('todo');
  });
});

describe('isRedState', () => {
  it.each([['todo', true], ['resume', true], ['done', false], ['goal', false], [undefined, false]])('%s → %s', (state, red) => {
    expect(isRedState(state)).toBe(red);
  });
});

describe.each(['UTC', 'Europe/Rome', 'America/Los_Angeles', 'Asia/Tokyo'])('todayIndex con il fuso del dispositivo %s', (zone) => {
  it('0 = lunedì … 6 = domenica, dalla sola stringa', () => {
    setBrowserTimeZone(zone);
    expect(todayIndex('2026-11-16')).toBe(0); // lunedì
    expect(todayIndex('2026-11-19')).toBe(3);
    expect(todayIndex('2026-11-22')).toBe(6); // domenica
    expect(todayIndex('2026-11-23')).toBe(0);
    expect(todayIndex('2026-03-29')).toBe(6); // cambio dell'ora legale
  });
  it('stringa non valida: -1', () => {
    setBrowserTimeZone(zone);
    ['', 'boh', null, undefined, '2026-13-01', '2026-02-30', 20261116].forEach((v) => expect(todayIndex(v)).toBe(-1));
  });
});
