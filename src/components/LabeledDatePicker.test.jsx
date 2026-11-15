// Campo data: su telefono il nome accessibile comincia con l'etichetta visibile (2.5.3); su desktop il pulsante
// del calendario resta quello di MUI.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import DateLocalization from '../i18n/DateLocalization';
import LabeledDatePicker from './LabeledDatePicker';
import i18n from '../i18n';
import { mockPointer } from '../test/pointer';

let restorePointer;
const withPointer = (fine) => { restorePointer = mockPointer(fine); };
afterEach(async () => { restorePointer(); await i18n.changeLanguage('it'); });

const mount = (value = null, label = 'Data di nascita') => render(
  <DateLocalization><LabeledDatePicker label={label} value={value} onChange={() => {}} /></DateLocalization>,
);

describe('LabeledDatePicker', () => {
  it('telefono: il nome contiene l\'etichetta e dice la data scelta', () => {
    withPointer(false);
    mount(new Date(2000, 0, 15));
    expect(screen.getByRole('textbox', { name: /^Data di nascita, Scegli la data.*2000/ })).toBeTruthy();
  });

  it('telefono, senza data: etichetta e invito a sceglierla', () => {
    withPointer(false);
    mount();
    expect(screen.getByRole('textbox', { name: 'Data di nascita, Scegli la data' })).toBeTruthy();
  });

  it('telefono in inglese', async () => {
    await i18n.changeLanguage('en');
    withPointer(false);
    mount(null, 'Date of birth');
    expect(screen.getByRole('textbox', { name: 'Date of birth, Choose date' })).toBeTruthy();
  });

  it('desktop: il pulsante del calendario non cambia nome', () => {
    withPointer(true);
    mount();
    expect(screen.getByRole('button', { name: 'Scegli la data' })).toBeTruthy();
  });
});
