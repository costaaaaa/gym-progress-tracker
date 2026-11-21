import { describe, it, expect } from 'vitest';
import { FOCUS_TOOLS, isToolOn, toolValue, toolSettingsBody, accountPatch, toolsOnCount } from './focusTools';

describe('FOCUS_TOOLS', () => {
  it('sono tre, nell\'ordine timer di recupero, tecnica, peso suggerito', () => {
    expect(FOCUS_TOOLS).toEqual(['rest_timer', 'technique', 'suggested_weight']);
  });
});

describe('isToolOn: acceso se l\'account non dice il contrario', () => {
  it.each([
    ['account non ancora letto', undefined],
    ['account senza i campi (risposta vecchia)', { id: 1 }],
    ['focus_tools rovinato', { focus_tools: 'no', rest_timer_enabled: 'no' }],
  ])('%s: tutto acceso', (_name, account) => {
    FOCUS_TOOLS.forEach((tool) => expect(isToolOn(account, tool)).toBe(true));
  });

  it('il timer si spegne solo con rest_timer_enabled false', () => {
    expect(isToolOn({ rest_timer_enabled: false }, 'rest_timer')).toBe(false);
    expect(isToolOn({ rest_timer_enabled: true }, 'rest_timer')).toBe(true);
    expect(isToolOn({ rest_timer_enabled: 0 }, 'rest_timer')).toBe(true);
  });

  it('tecnica e peso suggerito si spengono solo con false nella loro chiave', () => {
    const account = { focus_tools: { technique: false, suggested_weight: true } };
    expect(isToolOn(account, 'technique')).toBe(false);
    expect(isToolOn(account, 'suggested_weight')).toBe(true);
    expect(isToolOn({ focus_tools: { technique: null } }, 'technique')).toBe(true);
    expect(isToolOn({ focus_tools: {} }, 'suggested_weight')).toBe(true);
  });

  it('gli strumenti non si influenzano fra loro', () => {
    const account = { rest_timer_enabled: false, focus_tools: { technique: false } };
    expect(isToolOn(account, 'suggested_weight')).toBe(true);
  });
});

describe('toolSettingsBody: il corpo per update_settings.php', () => {
  it('il timer di recupero resta rest_timer_enabled', () => {
    expect(toolSettingsBody('rest_timer', false)).toEqual({ rest_timer_enabled: false });
    expect(toolSettingsBody('rest_timer', true)).toEqual({ rest_timer_enabled: true });
  });

  it('gli altri due stanno in focus_tools con la sola loro chiave', () => {
    expect(toolSettingsBody('technique', false)).toEqual({ focus_tools: { technique: false } });
    expect(toolSettingsBody('suggested_weight', true)).toEqual({ focus_tools: { suggested_weight: true } });
  });
});

describe('toolsOnCount', () => {
  it('conta gli strumenti accesi', () => {
    expect(toolsOnCount(undefined)).toBe(3);
    expect(toolsOnCount({ focus_tools: { technique: false } })).toBe(2);
    expect(toolsOnCount({ rest_timer_enabled: false, focus_tools: { technique: false } })).toBe(1);
    expect(toolsOnCount({ rest_timer_enabled: false, focus_tools: { technique: false, suggested_weight: false } })).toBe(0);
  });
});

describe('toolValue: il valore scritto di uno strumento, in un account o in una risposta del server', () => {
  it('legge il booleano dove vive ciascuno strumento', () => {
    const data = { rest_timer_enabled: false, focus_tools: { technique: true, suggested_weight: false } };
    expect(toolValue(data, 'rest_timer')).toBe(false);
    expect(toolValue(data, 'technique')).toBe(true);
    expect(toolValue(data, 'suggested_weight')).toBe(false);
  });

  it.each([undefined, null, {}, { rest_timer_enabled: 0, focus_tools: 'no' }, { focus_tools: { technique: null } }])('senza un booleano: undefined (%j)', (data) => {
    FOCUS_TOOLS.forEach((tool) => expect(toolValue(data, tool)).toBeUndefined());
  });
});

describe('accountPatch: la modifica dell\'account dopo un salvataggio', () => {
  const server = { rest_timer_enabled: false, focus_tools: { technique: false, suggested_weight: true } };

  it('il timer porta solo il suo valore', () => {
    expect(accountPatch({ focus_tools: { technique: true, suggested_weight: true } }, 'rest_timer', server)).toEqual({ rest_timer_enabled: false });
  });

  it('un altro strumento porta l\'elenco dell\'account con solo la sua chiave cambiata', () => {
    expect(accountPatch({ focus_tools: { technique: true, suggested_weight: false } }, 'technique', server))
      .toEqual({ focus_tools: { technique: false, suggested_weight: false } });
  });

  it('un account senza elenco riceve l\'elenco intero del server', () => {
    expect(accountPatch({ id: 1 }, 'suggested_weight', server)).toEqual({ focus_tools: server.focus_tools });
    expect(accountPatch(undefined, 'technique', server)).toEqual({ focus_tools: server.focus_tools });
  });
});
