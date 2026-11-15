// Campioni di sfondo: con il focus da tastiera si vedono insieme "selezionato" e "a fuoco"
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BackgroundSwatch from './BackgroundSwatch';
import { ThemeModeProvider } from '../context/ThemeModeContext';

const STOPS = ['#ff5131', '#7a0000'];

// jsdom non valuta :focus-visible: si leggono le dichiarazioni della regola :focus-visible dell'elemento
const focusRule = (el) => {
  const classes = [...el.classList];
  const found = {};
  for (const sheet of document.styleSheets) {
    for (const rule of sheet.cssRules) {
      if (classes.some((c) => rule.selectorText?.includes(`.${c}`) && rule.selectorText.includes(':focus-visible'))) {
        for (const prop of rule.style) found[prop] = rule.style.getPropertyValue(prop);
      }
    }
  }
  return found;
};

const renderSwatch = (selected, name) => {
  render(<ThemeModeProvider><BackgroundSwatch stops={STOPS} selected={selected} label={name} onClick={() => {}} /></ThemeModeProvider>);
  return screen.getByRole('button', { name });
};

describe('campione di sfondo', () => {
  it('senza focus il selezionato ha l\'anello rosso, quello non selezionato il divisore', () => {
    const on = renderSwatch(true, 'Rosso');
    expect(getComputedStyle(on).outlineColor).toBe('rgb(213, 0, 0)');
    const off = renderSwatch(false, 'Blu');
    expect(getComputedStyle(off).outlineColor).not.toBe('rgb(213, 0, 0)');
  });

  it('a fuoco aggiunge un secondo anello nel colore del testo e tiene quello della selezione', () => {
    const on = renderSwatch(true, 'Rosso');
    const onFocus = focusRule(on);
    expect(onFocus['box-shadow']).toContain('#1a1816');
    expect(onFocus['outline-color']).toBe('rgb(213, 0, 0)');
    const off = renderSwatch(false, 'Blu');
    const offFocus = focusRule(off);
    expect(offFocus['box-shadow']).toBe(onFocus['box-shadow']);
    expect(offFocus['outline-color']).not.toBe('rgb(213, 0, 0)');
  });
});
