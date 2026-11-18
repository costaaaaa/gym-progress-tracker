import { describe, it, expect } from 'vitest';
import i18n from './index';
import { INTENSITY_TECHNIQUES, NO_TECHNIQUE, equipmentName, achievementLabel } from './labels';

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

describe('achievementLabel', () => {
  it('dà il nome del traguardo nella lingua dell\'app, senza guardare il testo del server', async () => {
    await i18n.changeLanguage('it');
    expect(achievementLabel('sessions_100', 'Centurion')).toBe('Centurione');
    await i18n.changeLanguage('en');
    expect(achievementLabel('sessions_100', 'Centurione')).toBe('Centurion');
  });
  it('i traguardi di forza hanno la soglia in kg convertita nell\'unità dell\'utente, all\'intero più vicino', async () => {
    await i18n.changeLanguage('it');
    expect(achievementLabel('strength_100', 'x')).toBe('100 kg in un esercizio');
    expect(achievementLabel('strength_100', 'x', 'kg')).toBe('100 kg in un esercizio');
    expect(achievementLabel('strength_100', 'x', 'lb')).toBe('220 lb in un esercizio');
    expect(achievementLabel('strength_60', 'x', 'lb')).toBe('132 lb in un esercizio');
    expect(achievementLabel('strength_140', 'x', 'lb')).toBe('309 lb in un esercizio');
    await i18n.changeLanguage('en');
    expect(achievementLabel('strength_100', 'x', 'lb')).toBe('220 lb on one exercise');
  });
  it('per una chiave che il client non conosce usa il ripiego, e senza ripiego la chiave', () => {
    expect(achievementLabel('nuovo_1', 'Nome del server')).toBe('Nome del server');
    expect(achievementLabel('nuovo_1')).toBe('nuovo_1');
  });
});
