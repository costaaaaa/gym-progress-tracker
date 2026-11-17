import { describe, it, expect } from 'vitest';
import i18n from './index';
import { INTENSITY_TECHNIQUES, NO_TECHNIQUE, equipmentName, achievementLabel, unlockedAchievementNames } from './labels';

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
  it('per una chiave che il client non conosce usa il ripiego, e senza ripiego la chiave', () => {
    expect(achievementLabel('nuovo_1', 'Nome del server')).toBe('Nome del server');
    expect(achievementLabel('nuovo_1')).toBe('nuovo_1');
  });
});

describe('unlockedAchievementNames', () => {
  const unlocked = [{ key: 'sessions_100', label: 'Centurione' }, { key: 'nuovo_1', label: 'Nome del server' }];
  it('app in inglese, label italiano dal server: nome inglese; chiave sconosciuta: label del server', async () => {
    await i18n.changeLanguage('en');
    expect(unlockedAchievementNames(unlocked)).toBe('Centurion, Nome del server');
  });
  it('app in italiano: nomi italiani', async () => {
    await i18n.changeLanguage('it');
    expect(unlockedAchievementNames([{ key: 'sessions_100', label: 'Centurion' }])).toBe('Centurione');
  });
});
