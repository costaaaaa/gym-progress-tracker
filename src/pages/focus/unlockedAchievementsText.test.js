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
});
