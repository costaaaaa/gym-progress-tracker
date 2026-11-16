import { describe, it, expect } from 'vitest';
import i18n from './index';
import { INTENSITY_TECHNIQUES, NO_TECHNIQUE, equipmentName } from './labels';

describe('INTENSITY_TECHNIQUES', () => {
  it('parte da "Nessuna (Normale)" e tiene l\'ordine del menu', () => {
    expect(NO_TECHNIQUE).toBe('Nessuna (Normale)');
    expect(INTENSITY_TECHNIQUES).toEqual([
      'Nessuna (Normale)', 'Drop Set (Stripping)', 'Rest Pause', 'Super Set', 'Jump Set',
      'Negative', 'Ripetizioni Forzate', 'Isometria', 'Peak Contraction', 'Myo-Reps',
    ]);
  });
});

describe('equipmentName', () => {
  it('traduce lo slug dell\'attrezzo nella lingua corrente', async () => {
    expect(equipmentName('corpo_libero')).toBe('Corpo libero');
    await i18n.changeLanguage('en');
    expect(equipmentName('corpo_libero')).toBe('Bodyweight');
    expect(equipmentName('multipower')).toBe('Smith machine');
  });
  it('senza slug dà stringa vuota, con uno slug sconosciuto resta lo slug', () => {
    expect(equipmentName('')).toBe('');
    expect(equipmentName(null)).toBe('');
    expect(equipmentName('elastici')).toBe('elastici');
  });
});
