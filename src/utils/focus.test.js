import { describe, it, expect, afterEach } from 'vitest';
import { focusedElement, isKeyboardFocus } from './focus';

afterEach(() => { document.body.innerHTML = ''; });

describe('focusedElement', () => {
  it('nessun elemento ha il fuoco (sta sul body): null', () => {
    document.body.innerHTML = '<button>ok</button>';
    expect(document.activeElement).toBe(document.body);
    expect(focusedElement()).toBeNull();
  });

  it('un elemento ha il fuoco: è quello', () => {
    document.body.innerHTML = '<button id="b">ok</button>';
    const button = document.getElementById('b');
    button.focus();
    expect(focusedElement()).toBe(button);
  });
});

describe('isKeyboardFocus', () => {
  it('senza elemento: sì (il caso prudente)', () => {
    expect(isKeyboardFocus(null)).toBe(true);
  });

  it('se il browser non conosce :focus-visible: sì', () => {
    expect(isKeyboardFocus({ matches: () => { throw new SyntaxError('selettore'); } })).toBe(true);
  });

  it('risponde quello che dice :focus-visible', () => {
    expect(isKeyboardFocus({ matches: (q) => q === ':focus-visible' })).toBe(true);
    expect(isKeyboardFocus({ matches: () => false })).toBe(false);
  });
});
