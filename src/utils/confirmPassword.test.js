// Stato della riga sotto «Conferma password»: grigio, verde o rosso. `checked` = l'utente è uscito dal
// campo o ha premuto «Avanti» dopo l'ultima modifica.
import { describe, it, expect } from 'vitest';
import { confirmState } from './confirmPassword';

describe('confirmState', () => {
  it('conferma vuota: suggerimento, anche dopo un controllo', () => {
    expect(confirmState({ password: 'Segreta!2026', confirm: '', checked: false })).toBe('hint');
    expect(confirmState({ password: 'Segreta!2026', confirm: '', checked: true })).toBe('hint');
  });

  it('uguali: spunta subito, controllata o no', () => {
    expect(confirmState({ password: 'Segreta!2026', confirm: 'Segreta!2026', checked: false })).toBe('match');
    expect(confirmState({ password: 'Segreta!2026', confirm: 'Segreta!2026', checked: true })).toBe('match');
  });

  it('diverse mentre si scrive: mai rosso, nemmeno se più lunga della password', () => {
    expect(confirmState({ password: 'abc', confirm: 'ab', checked: false })).toBe('hint');
    expect(confirmState({ password: 'abc', confirm: 'xyz', checked: false })).toBe('hint');
    expect(confirmState({ password: 'abc', confirm: 'abcdef', checked: false })).toBe('hint');
  });

  it('diverse dopo l\'uscita dal campo o «Avanti»: rosso', () => {
    expect(confirmState({ password: 'abc', confirm: 'ab', checked: true })).toBe('mismatch');
    expect(confirmState({ password: 'abc', confirm: 'xyz', checked: true })).toBe('mismatch');
  });

  it('maiuscole e spazi contano', () => {
    expect(confirmState({ password: 'Abc', confirm: 'abc', checked: true })).toBe('mismatch');
    expect(confirmState({ password: 'abc', confirm: 'abc ', checked: true })).toBe('mismatch');
  });
});
