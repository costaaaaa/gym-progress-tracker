// Il volume della settimana come testo: unità dell'utente, migliaia sempre separate, lingua dell'utente.
import { describe, it, expect } from 'vitest';
import i18n from '../../i18n';
import { formatVolume } from './volumeText';

describe('formatVolume', () => {
  it('in kg il totale com\'è, con le migliaia separate anche a quattro cifre (in italiano di norma non lo sono)', () => {
    expect(formatVolume(4820.5, 'kg')).toBe('4.820,5 kg');
    expect(formatVolume(184250, 'kg')).toBe('184.250 kg');
    expect(formatVolume(950, 'kg')).toBe('950 kg');
  });

  it('in lb il totale convertito e arrotondato all\'intero, mai la somma di pesi già convertiti', () => {
    expect(formatVolume(4820.5, 'lb')).toBe('10.627 lb');
    expect(formatVolume(100, 'lb')).toBe('220 lb');
  });

  it('una settimana senza volume, o un valore mancante, è zero', () => {
    expect(formatVolume(0, 'kg')).toBe('0 kg');
    expect(formatVolume(undefined, 'lb')).toBe('0 lb');
  });

  it('un valore non valido per l\'unità vale kg', () => {
    expect(formatVolume(1200, undefined)).toBe('1.200 kg');
  });

  it('in inglese separatore e decimali sono quelli inglesi', async () => {
    await i18n.changeLanguage('en');
    expect(formatVolume(4820.5, 'kg')).toBe('4,820.5 kg');
  });
});
