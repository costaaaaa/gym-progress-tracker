// Forma B+ dei campi nel tema principale (regole in test/fieldStyle), per ogni tipo di campo outlined
// dell'app, e la voce vuota di un Select vuoto mostrata in grigio come un placeholder.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TextField, FormControl, InputLabel, Select, MenuItem, Autocomplete } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { ThemeModeProvider } from '../context/ThemeModeContext';
import DateLocalization from '../i18n/DateLocalization';
import { expectFieldAboveLabel } from '../test/fieldStyle';

const renderField = (field) => render(
  <ThemeModeProvider><DateLocalization>{field}</DateLocalization></ThemeModeProvider>,
);

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

describe('Campi nel tema: Autocomplete', () => {
  it('etichetta sopra, senza tacca, raggio 10', () => {
    renderField(
      <Autocomplete
        id="esercizio"
        options={['Panca piana', 'Squat']}
        renderInput={(params) => <TextField {...params} label="Esercizio" />}
      />,
    );
    expectFieldAboveLabel('esercizio', 'Esercizio');
  });
});

// L'altezza non si misura in jsdom: si controlla il padding verticale dell'input che la dà (44 col
// testo di 23px). Il multiline lo tiene a 0, come in MUI: il padding sta sulla radice.
describe('Campi nel tema: padding verticale dell\'input', () => {
  it.each([
    ['TextField', <TextField id="p1" label="Campo" />, '10.5px'],
    ['TextField size="small"', <TextField id="p2" label="Campo" size="small" />, '10.5px'],
    ['Autocomplete', <Autocomplete id="p3" options={['Squat']} renderInput={(params) => <TextField {...params} label="Campo" />} />, '10.5px'],
    ['TextField multiline', <TextField id="p4" label="Campo" multiline rows={3} />, '0px'],
  ])('%s', (_, field, padding) => {
    renderField(field);
    const style = getComputedStyle(screen.getByLabelText('Campo'));
    expect(style.paddingTop).toBe(padding);
    expect(style.paddingBottom).toBe(padding);
  });

  it('Autocomplete: la radice non aggiunge padding verticale', () => {
    renderField(<Autocomplete id="p5" options={['Squat']} renderInput={(params) => <TextField {...params} label="Campo" />} />);
    const root = getComputedStyle(screen.getByLabelText('Campo').closest('.MuiOutlinedInput-root'));
    expect(root.paddingTop).toBe('0px');
    expect(root.paddingBottom).toBe('0px');
  });
});

describe('Select vuoto con voce vuota', () => {
  it.each([
    ['chiaro', 'light', 'rgb(107, 102, 99)'],
    ['scuro', 'dark', 'rgb(160, 160, 162)'],
  ])('tema %s: mostra il testo della voce vuota, in grigio', (_, mode, grey) => {
    localStorage.setItem('themeMode', mode);
    renderField(
      <FormControl fullWidth>
        <InputLabel id="tecnica-vuota-label">Tecnica</InputLabel>
        <Select labelId="tecnica-vuota-label" id="tecnica-vuota" label="Tecnica" value="" onChange={() => {}}>
          <MenuItem value=""><em>Nessuna tecnica</em></MenuItem>
          <MenuItem value="dropset">Dropset</MenuItem>
        </Select>
      </FormControl>,
    );
    expect(getComputedStyle(screen.getByText('Nessuna tecnica')).color).toBe(grey);
  });
});
