import { useId } from 'react';
import { FormControlLabel, Radio, RadioGroup, Typography } from '@mui/material';
import SettingOutcome from './SettingOutcome';

// Corpo della finestra di un'impostazione a scelta (unità di misura, lingua): i valori come radio, sotto l'aiuto e,
// se c'è, una riga d'esempio. `label` è il nome del gruppo. Salva appena si sceglie (`onChange(valore)`); mentre si salva
// i radio restano attivi (un controllo disabilitato perde il fuoco) e il gruppo è «occupato».
const ChoiceSettingBody = ({ label, options, value, onChange, saving, help, example, error }) => {
  const helpId = useId();

  return (
    <>
      <RadioGroup aria-label={label} aria-describedby={helpId} aria-busy={saving} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <FormControlLabel key={option.value} value={option.value} control={<Radio />} label={option.label} sx={{ minHeight: 44 }} />
        ))}
      </RadioGroup>
      <Typography id={helpId} sx={{ fontSize: 16, color: 'text.secondary', mt: 1 }}>{help}</Typography>
      {example && <Typography sx={{ fontSize: 16, color: 'text.secondary', mt: 1 }}>{example}</Typography>}
      <SettingOutcome alert={error} />
    </>
  );
};

export default ChoiceSettingBody;
