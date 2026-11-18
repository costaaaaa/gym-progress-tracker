import { describe, it, expect } from 'vitest';
import i18n from '../../i18n';
import { unlockedAchievementsText } from './unlockedAchievementsText';

describe('unlockedAchievementsText', () => {
  const unlocked = [{ key: 'sessions_100', label: 'Centurione' }, { key: 'nuovo_1', label: 'Nome del server' }];
  it('app in inglese, label italiano dal server: nome inglese; chiave sconosciuta: label del server', async () => {
    await i18n.changeLanguage('en');
    expect(unlockedAchievementsText(unlocked)).toBe('Centurion, Nome del server');
  });
  it('app in italiano: nomi italiani', async () => {
    await i18n.changeLanguage('it');
    expect(unlockedAchievementsText([{ key: 'sessions_100', label: 'Centurion' }])).toBe('Centurione');
  });
  it('un traguardo di forza ha la soglia nell\'unità dell\'utente', async () => {
    await i18n.changeLanguage('it');
    expect(unlockedAchievementsText([{ key: 'strength_100', label: '100 kg' }], 'lb')).toBe('220 lb in un esercizio');
    expect(unlockedAchievementsText([{ key: 'strength_100', label: '100 kg' }])).toBe('100 kg in un esercizio');
  });
});
