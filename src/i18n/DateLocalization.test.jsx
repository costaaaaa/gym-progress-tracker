// Testi dei selettori data in italiano: la localizzazione di MUI X ha una frase sbagliata («la vista dell'calendario»)
// nel nome del pulsante che cambia vista; qui si corregge solo l'italiano.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DateLocalization from './DateLocalization';
import LabeledDatePicker from '../components/LabeledDatePicker';
import i18n from '.';
import { mockPointer } from '../test/pointer';

afterEach(async () => { await i18n.changeLanguage('it'); });

const openPicker = (label) => {
  render(<DateLocalization><LabeledDatePicker label={label} value={new Date(2000, 0, 15)} onChange={() => {}} /></DateLocalization>);
  fireEvent.click(screen.getByRole('textbox', { name: new RegExp(`^${label}`) }));
};

describe('DateLocalization', () => {
  it('italiano: il pulsante che cambia vista dice la vista aperta e quella a cui si passa', () => {
    mockPointer(false);
    openPicker('Data di nascita');
    expect(screen.getByRole('button', { name: 'Vista calendario aperta, passa alla vista anno' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Vista calendario aperta, passa alla vista anno' }));
    expect(screen.getByRole('button', { name: 'Vista anno aperta, passa alla vista calendario' })).toBeTruthy();
  });

  it('inglese: resta la frase di MUI', async () => {
    await i18n.changeLanguage('en');
    mockPointer(false);
    openPicker('Date of birth');
    expect(screen.getByRole('button', { name: 'calendar view is open, switch to year view' })).toBeTruthy();
  });
});
