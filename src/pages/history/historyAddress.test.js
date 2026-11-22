// L'indirizzo dello Storico (?vista=calendario&mese=2026-11&giorno=2026-11-18): lettura dei parametri e costruzione di quelli del calendario.
import { describe, it, expect } from 'vitest';
import { calendarParams, listParams, readAddress } from './historyAddress';

const read = (search) => readAddress(new URLSearchParams(search));

describe('readAddress', () => {
  it('senza parametri: elenco, nessun mese e nessun giorno', () => {
    expect(read('')).toEqual({ view: 'list', month: null, day: null });
  });

  it('vista=calendario con mese e giorno validi', () => {
    expect(read('vista=calendario&mese=2026-10&giorno=2026-10-31')).toEqual({ view: 'calendar', month: '2026-10', day: '2026-10-31' });
  });

  it('una vista che non è «calendario» vale l\'elenco', () => {
    expect(read('vista=altro').view).toBe('list');
    expect(read('vista=Calendar').view).toBe('list');
  });

  it.each(['2026-13', '2026-00', 'boh', '2026-1', ''])('un mese non valido (%s) vale assente', (mese) => {
    expect(read(`vista=calendario&mese=${mese}`).month).toBeNull();
  });

  it.each(['2026-02-31', '2026-13-01', 'ieri', ''])('un giorno non valido (%s) vale assente', (giorno) => {
    expect(read(`vista=calendario&giorno=${giorno}`).day).toBeNull();
  });
});

describe('calendarParams', () => {
  it('sempre la vista, poi mese e giorno quando ci sono, nello stesso ordine', () => {
    expect(calendarParams().toString()).toBe('vista=calendario');
    expect(calendarParams('2026-10', '2026-10-31').toString()).toBe('vista=calendario&mese=2026-10&giorno=2026-10-31');
    expect(calendarParams(null, '2026-11-18').toString()).toBe('vista=calendario&giorno=2026-11-18');
    expect(calendarParams('2026-10', null).toString()).toBe('vista=calendario&mese=2026-10');
  });

  it('quello che si scrive si rilegge uguale', () => {
    expect(readAddress(calendarParams('2026-10', '2026-10-31'))).toEqual({ view: 'calendar', month: '2026-10', day: '2026-10-31' });
  });
});

describe('listParams', () => {
  it('l\'elenco non ha parametri', () => {
    expect(listParams().toString()).toBe('');
    expect(readAddress(listParams()).view).toBe('list');
  });
});
