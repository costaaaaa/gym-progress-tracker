// Calcolatore 1RM del blog (blog/assets/calcolatore-1rm.js): messaggi d'errore sotto il campo (WCAG 3.3.1, 4.1.3).
// Lo script gira sul markup delle due pagine PHP; qui un frammento con gli stessi attributi data-calc-*
// (tests/blog_calculator_test.php controlla che le pagine veri li abbiano).
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fireEvent } from '@testing-library/react';

const script = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'blog', 'assets', 'calcolatore-1rm.js'), 'utf8');

const MSG_WEIGHT = 'Enter a weight above 0 and up to {max} {unit}.';
const MSG_REPS = 'Enter between 1 and {max} reps.';

const mount = () => {
  document.body.innerHTML = `
    <form data-calc-form data-calc-decimal="." data-calc-msg-weight="${MSG_WEIGHT}" data-calc-msg-reps="${MSG_REPS}">
      <div class="calc-field">
        <label for="calc-weight">Weight lifted</label>
        <input id="calc-weight" name="weight" data-calc-weight type="number" min="1" max="500" step="any" value="100" required aria-describedby="calc-weight-error">
        <p class="calc-error" id="calc-weight-error" data-calc-error="weight" role="alert" hidden></p>
      </div>
      <div class="calc-field">
        <label for="calc-unit">Unit</label>
        <select id="calc-unit" name="unit" data-calc-unit><option value="kg" selected>kg</option><option value="lb">lb</option></select>
      </div>
      <div class="calc-field">
        <label for="calc-reps">Reps</label>
        <input id="calc-reps" name="reps" data-calc-reps type="number" min="1" max="20" step="1" value="5" required aria-describedby="calc-reps-error">
        <p class="calc-error" id="calc-reps-error" data-calc-error="reps" role="alert" hidden></p>
      </div>
      <button type="submit">Calculate</button>
    </form>
    <div aria-live="polite"><span data-calc-one-rm>116.7</span> <span data-calc-unit-label>kg</span><p data-calc-warning hidden></p></div>
    <table><tbody><tr data-calc-percent="80"><td><span data-calc-load>92.5</span> <span data-calc-unit-label>kg</span></td></tr></tbody></table>`;
  (0, eval)(script);
};
const weight = () => document.getElementById('calc-weight');
const reps = () => document.getElementById('calc-reps');
const weightError = () => document.getElementById('calc-weight-error');
const repsError = () => document.getElementById('calc-reps-error');
const type = (input, value) => fireEvent.input(input, { target: { value } });
const oneRm = () => document.querySelector('[data-calc-one-rm]').textContent;

beforeEach(mount);

describe('valori non validi', () => {
  it('un peso oltre il massimo mostra il messaggio sotto il campo, collegato e annunciato', () => {
    type(weight(), '600');
    expect(weightError().hidden).toBe(false);
    expect(weightError().textContent).toBe('Enter a weight above 0 and up to 500 kg.');
    expect(weightError().getAttribute('role')).toBe('alert');
    expect(weight().getAttribute('aria-invalid')).toBe('true');
    expect(weight().getAttribute('aria-describedby')).toBe('calc-weight-error');
    expect(weightError().parentElement).toBe(weight().parentElement);
    expect(repsError().hidden).toBe(true);
  });

  it('con un valore non valido il risultato precedente resta com\'era', () => {
    type(weight(), '600');
    expect(oneRm()).toBe('116.7');
  });

  it('le ripetizioni fuori da 1-20 hanno il loro messaggio, anche per zero e negativi', () => {
    ['0', '21', '-3'].forEach((value) => {
      type(reps(), value);
      expect(repsError().textContent).toBe('Enter between 1 and 20 reps.');
      expect(reps().getAttribute('aria-invalid')).toBe('true');
    });
  });

  it('correggere il valore toglie messaggio e aria-invalid e il risultato si aggiorna', () => {
    type(weight(), '600');
    type(weight(), '80');
    expect(weightError().hidden).toBe(true);
    expect(weightError().textContent).toBe('');
    expect(weight().hasAttribute('aria-invalid')).toBe(false);
    expect(oneRm()).toBe('93.3');
  });

  it('cambiando unità il limite cambia: 600 è troppo in kg, va bene in lb', () => {
    type(weight(), '600');
    expect(weightError().hidden).toBe(false);
    fireEvent.change(document.getElementById('calc-unit'), { target: { value: 'lb' } });
    expect(weightError().hidden).toBe(true);
    type(weight(), '1200');
    expect(weightError().textContent).toBe('Enter a weight above 0 and up to 1100 lb.');
  });

  it('mentre si riscrive il campo vuoto non compare nulla; all\'invio sì', () => {
    type(weight(), '');
    expect(weightError().hidden).toBe(true);
    fireEvent.submit(document.querySelector('[data-calc-form]'));
    expect(weightError().hidden).toBe(false);
    expect(weightError().textContent).toBe('Enter a weight above 0 and up to 500 kg.');
  });

  it('uscendo da un campo vuoto (change) il messaggio compare', () => {
    type(reps(), '');
    expect(repsError().hidden).toBe(true);
    fireEvent.change(reps());
    expect(repsError().hidden).toBe(false);
  });

  it('lo stesso messaggio non viene riscritto a ogni tasto (non si riannuncia)', () => {
    type(weight(), '600');
    const node = weightError().firstChild;
    type(weight(), '6000');
    expect(weightError().firstChild).toBe(node);
  });

  it('lo script spegne la validazione del browser: i messaggi sono i nostri', () => {
    expect(document.querySelector('[data-calc-form]').noValidate).toBe(true);
  });

  it('un valore valido non mostra nulla', () => {
    type(weight(), '82.5');
    expect(weightError().hidden).toBe(true);
    expect(oneRm()).toBe('96.3');
  });
});
