// Forma B+ dei campi nel tema principale: l'etichetta sta sopra il campo, in flusso normale (non
// absolute né con la transform che la porta nel bordo), è sempre ridotta (anche a campo vuoto e senza
// focus), il bordo non ha la tacca per l'etichetta e il raggio è 10px. Vale per ogni campo outlined
// dell'app (non solo per l'accesso): TextField, size="small", multiline, Select, DatePicker, Autocomplete.
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
    expect(getComputedStyle(display.closest('em')).color).toBe('rgb(107, 102, 99)');
  });
});

describe('Select vuoto con voce vuota, tema scuro', () => {
  it('mostra il testo della voce vuota, in grigio chiaro', () => {
    localStorage.setItem('themeMode', 'dark');
    renderField(
      <FormControl fullWidth>
        <InputLabel id="tecnica3-label">Tecnica</InputLabel>
        <Select labelId="tecnica3-label" id="tecnica3" label="Tecnica" value="" onChange={() => {}}>
          <MenuItem value=""><em>Nessuna tecnica</em></MenuItem>
          <MenuItem value="dropset">Dropset</MenuItem>
        </Select>
      </FormControl>,
    );
    const display = screen.getByText('Nessuna tecnica');
    expect(getComputedStyle(display.closest('em')).color).toBe('rgb(160, 160, 162)');
  });
});
