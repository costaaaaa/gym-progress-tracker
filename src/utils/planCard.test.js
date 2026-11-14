import { describe, it, expect } from 'vitest';
import { isDefaultDayName, splitDayNames, planCardSummary, workingSetsOfDay } from './planCard';
import { plannedSets, times } from '../test/plannedSets';

const ex = (warmups, n) => ({ planned_sets: plannedSets(warmups, times(n, { min: 8, max: 10 })) });
const day = (name, exercises = []) => ({ name, exercises });

describe('isDefaultDayName', () => {
  it('riconosce i nomi che crea l\'app', () => {
    for (const name of ['Giorno 1', 'giorno 12', 'Giorno A', ' Day 3 ']) expect(isDefaultDayName(name)).toBe(true);
  });
  it('non confonde i nomi scelti dall\'utente', () => {
    for (const name of ['Push', 'Giorno gambe', 'Giorno 1 petto', '', null]) expect(isDefaultDayName(name)).toBe(false);
  });
});

describe('splitDayNames', () => {
  it('da 2 a 4 giorni con almeno un nome proprio', () => {
    expect(splitDayNames([day('Push'), day('Pull')])).toEqual(['Push', 'Pull']);
    expect(splitDayNames([day('Giorno 1'), day('Gambe')])).toEqual(['Giorno 1', 'Gambe']);
    expect(splitDayNames([day('A'), day('B'), day('C'), day('D')])).toHaveLength(4);
  });
  it('null con un giorno, con più di 4, o se tutti i nomi sono quelli di base', () => {
    expect(splitDayNames([day('Push')])).toBeNull();
    expect(splitDayNames([1, 2, 3, 4, 5].map((n) => day(`Giorno ${n}`)))).toBeNull();
    expect(splitDayNames(['a', 'b', 'c', 'd', 'e'].map((n) => day(`Push ${n}`)))).toBeNull();
    expect(splitDayNames([day('Giorno 1'), day('Giorno 2')])).toBeNull();
    expect(splitDayNames([])).toBeNull();
  });
});

describe('planCardSummary: conteggi', () => {
  it('le serie sono le allenanti pianificate, senza il riscaldamento', () => {
    const d = day('Push', [ex(2, 3), ex(0, 4)]);
    expect(workingSetsOfDay(d)).toBe(7);
  });
  it('somma giorni, esercizi e serie; con nomi propri c\'è la riga divisa', () => {
    const plan = { days: [day('Push', [ex(1, 3), ex(0, 2)]), day('Pull', [ex(0, 4)])] };
    expect(planCardSummary(plan)).toEqual({ days: 2, exercises: 3, sets: 9, splitNames: ['Push', 'Pull'] });
  });
  it('un esercizio senza serie vale 0 serie; una scheda senza giorni è tutta a zero', () => {
    expect(planCardSummary({ days: [day('Giorno 1', [{ planned_sets: [] }, {}])] }))
      .toEqual({ days: 1, exercises: 2, sets: 0, splitNames: null });
    expect(planCardSummary({})).toEqual({ days: 0, exercises: 0, sets: 0, splitNames: null });
  });
});
