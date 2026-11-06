// Controlli condivisi sulla forma B+ di un campo outlined (TextField, Select, DatePicker, Autocomplete):
// etichetta sopra il campo, sempre ridotta, bordo senza tacca e raggio del tema. Usato sia dai test
// delle pagine di accesso sia da quelli del tema.
import { screen, fireEvent } from '@testing-library/react';
import { expect } from 'vitest';

// La legend del fieldset è la tacca del bordo: 0.01px vuol dire chiusa
export const outlineIsNotched = (fieldset) => getComputedStyle(fieldset.querySelector('legend')).maxWidth !== '0.01px';

export const expectFieldAboveLabel = (id, labelText) => {
  const control = screen.getByLabelText(labelText);
  expect(control).toBeTruthy();

  const label = document.getElementById(`${id}-label`);
  expect(label).toBeTruthy();
  expect(label.getAttribute('data-shrink')).toBe('true');
  const labelStyle = getComputedStyle(label);
  expect(labelStyle.position).not.toBe('absolute');
  expect(labelStyle.transform === 'none' || labelStyle.transform === '').toBe(true);
  expect(labelStyle.maxWidth).toBe('100%');

  fireEvent.focus(control);
  const fieldset = control.closest('.MuiOutlinedInput-root')?.querySelector('fieldset');
  expect(fieldset).toBeTruthy();
  expect(outlineIsNotched(fieldset)).toBe(false);
  expect(getComputedStyle(fieldset).borderRadius).toBe('10px');
};
