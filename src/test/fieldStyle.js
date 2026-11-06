// Controlli sulla forma B+ di un campo outlined (TextField, Select, DatePicker, Autocomplete): etichetta
// sopra il campo, in flusso normale (non absolute né con la transform che la porta nel bordo), sempre
// ridotta anche a campo vuoto e senza focus, bordo senza tacca e raggio del tema.
//
// "Niente tacca" non si legge dal testo della legend: MUI ci scrive sempre il testo dell'etichetta,
// nascosto, e la tacca è la larghezza di quella legend. Senza tacca resta larga 0.01px; con la tacca
// diventa larga quanto il testo, e MUI la apre quando il campo ha il focus o un valore.
import { screen, fireEvent } from '@testing-library/react';
import { expect } from 'vitest';
import { radius } from '../theme/radius';

// La legend del fieldset è la tacca del bordo: 0.01px vuol dire chiusa
export const outlineIsNotched = (fieldset) => getComputedStyle(fieldset.querySelector('legend')).maxWidth !== '0.01px';

// Trova il controllo con l'id dato e la sua etichetta (TextField, Select, DatePicker e Autocomplete
// usano la stessa convenzione "<id>-label"), poi controlla le regole della forma B+. La tacca si
// controlla con il campo a fuoco, perché MUI la apre al focus.
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
  expect(getComputedStyle(fieldset).borderRadius).toBe(radius.md);
};
