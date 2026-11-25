// La riga che dice quanti strumenti della serie sono accesi: la stessa prima dell'allenamento e in Account.
import { describe, it, expect, beforeEach } from 'vitest';
import i18n from '../i18n';
import { focusToolsSummary } from './focusToolsSummary';

const NONE = { rest_timer_enabled: false, focus_tools: { technique: false, suggested_weight: false } };
const ONE = { rest_timer_enabled: false, focus_tools: { technique: false } };
const TWO = { focus_tools: { technique: false } };

describe('focusToolsSummary', () => {
  beforeEach(() => i18n.changeLanguage('it'));

  it.each([
    ['nessuno acceso', NONE, 'Nessuno acceso'],
    ['uno acceso', ONE, '1 acceso su 3'],
    ['due accesi', TWO, '2 accesi su 3'],
    ['tutti accesi', { id: 1 }, '3 accesi su 3'],
    ['account non ancora letto', undefined, '3 accesi su 3'],
  ])('%s: «%s»', (_name, user, expected) => {
    expect(focusToolsSummary(i18n.t, user)).toBe(expected);
  });

  it('in inglese usa i testi inglesi', async () => {
    await i18n.changeLanguage('en');
    expect(focusToolsSummary(i18n.t, NONE)).toBe('None on');
    expect(focusToolsSummary(i18n.t, TWO)).toBe('2 of 3 on');
  });
});
