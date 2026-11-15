// Testi con un numero: il singolare e il plurale devono essere due frasi diverse.
import { describe, it, expect, afterAll } from 'vitest';
import i18n from './index';

describe('focus.streak_new_longest', () => {
  afterAll(() => i18n.changeLanguage('it'));

  it('in italiano: "1 settimana consecutiva" e "3 settimane consecutive"', () => {
    expect(i18n.t('focus.streak_new_longest', { count: 1 })).toBe('Nuovo record! 🏆 1 settimana consecutiva');
    expect(i18n.t('focus.streak_new_longest', { count: 3 })).toBe('Nuovo record! 🏆 3 settimane consecutive');
  });

  it('in inglese: "1 week in a row" e "3 weeks in a row"', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('focus.streak_new_longest', { count: 1 })).toBe('New record! 🏆 1 week in a row');
    expect(i18n.t('focus.streak_new_longest', { count: 3 })).toBe('New record! 🏆 3 weeks in a row');
  });
});
