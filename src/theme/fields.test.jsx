// Forma B+ dei campi nel tema principale: l'etichetta sta sopra il campo, in flusso normale (non
// absolute né con la transform che la porta nel bordo), è sempre ridotta (anche a campo vuoto e senza
// focus), il bordo non ha la tacca per l'etichetta e il raggio è 10px. Vale per ogni campo outlined
// dell'app (non solo per l'accesso): TextField, size="small", multiline, Select, DatePicker.
//
// "Niente tacca" non si legge dal testo della legend: MUI ci scrive sempre il testo dell'etichetta,
// nascosto, e la tacca è la larghezza di quella legend. Senza tacca resta larga 0.01px; con la tacca
// diventa larga quanto il testo, e MUI la apre quando il campo ha il focus o un valore.
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import DateLocalization from '../i18n/DateLocalization';

const renderField = (field) => render(
  <ThemeModeProvider><DateLocalization>{field}</DateLocalization></ThemeModeProvider>,
);

// La legend del fieldset è la tacca del bordo: 0.01px vuol dire chiusa
const outlineIsNotched = (fieldset) => getComputedStyle(fieldset.querySelector('legend')).maxWidth !== '0.01px';

const expectFieldAboveLabel = (id, labelText) => {
  const control = screen.getByLabelText(labelText);
  expect(control).toBeTruthy();

  const label = document.getElementById(`${id}-label`);
  expect(label).toBeTruthy();
  expect(label.getAttribute('data-shrink')).toBe('true');
  const labelStyle = getComputedStyle(label);
  expect(labelStyle.position).not.toBe('absolute');
  expect(labelStyle.transform === 'none' || labelStyle.transform === '').toBe(true);

  fireEvent.focus(control);
  const fieldset = control.closest('.MuiOutlinedInput-root')?.querySelector('fieldset');
  expect(fieldset).toBeTruthy();
  expect(outlineIsNotched(fieldset)).toBe(false);
  expect(getComputedStyle(fieldset).borderRadius).toBe('10px');
};

describe('Campi nel tema: TextField outlined', () => {
  it('etichetta sopra, senza tacca, raggio 10', () => {
    renderField(<TextField id="peso" label="Peso" />);
    expectFieldAboveLabel('peso', 'Peso');
  });
});

describe('Campi nel tema: TextField size="small"', () => {
  it('etichetta sopra, senza tacca, raggio 10', () => {
    renderField(<TextField id="ricerca" label="Ricerca" size="small" />);
    expectFieldAboveLabel('ricerca', 'Ricerca');
  });
});

describe('Campi nel tema: TextField multiline', () => {
  it('etichetta sopra, senza tacca, raggio 10', () => {
    renderField(<TextField id="note" label="Note" multiline rows={3} />);
    expectFieldAboveLabel('note', 'Note');
  });
});

describe('Campi nel tema: Select con InputLabel', () => {
  it('etichetta sopra, senza tacca, raggio 10', () => {
    renderField(
      <FormControl fullWidth>
        <InputLabel id="tecnica-label">Tecnica</InputLabel>
        <Select labelId="tecnica-label" id="tecnica" label="Tecnica" value="dropset" onChange={() => {}}>
          <MenuItem value="dropset">Dropset</MenuItem>
        </Select>
      </FormControl>,
    );
    expectFieldAboveLabel('tecnica', 'Tecnica');
  });
});

describe('Campi nel tema: DatePicker', () => {
  it('etichetta sopra, senza tacca, raggio 10', () => {
    renderField(
      <DatePicker label="Data" value={null} onChange={() => {}} slotProps={{ textField: { id: 'data' } }} />,
    );
    expectFieldAboveLabel('data', 'Data');
  });
});

describe('Select vuoto con voce vuota', () => {
  it('mostra il testo della voce vuota, in grigio', () => {
    renderField(
      <FormControl fullWidth>
        <InputLabel id="tecnica2-label">Tecnica</InputLabel>
        <Select labelId="tecnica2-label" id="tecnica2" label="Tecnica" value="" onChange={() => {}}>
          <MenuItem value=""><em>Nessuna tecnica</em></MenuItem>
          <MenuItem value="dropset">Dropset</MenuItem>
        </Select>
      </FormControl>,
    );
    const display = screen.getByText('Nessuna tecnica');
    expect(display).toBeTruthy();
    expect(getComputedStyle(display.closest('em') || display).color).toBe('rgb(107, 102, 99)');
  });
});
