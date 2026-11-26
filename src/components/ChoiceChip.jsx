import { Chip } from '@mui/material';

// Chip che si sceglie (periodo, gruppo muscolare, «Preferiti»): scelto è pieno nel colore del testo e resta pieno anche
// con il mouse sopra o il fuoco; non scelto ha il contorno grigio e il testo normale. Altezza e corpo li dà chi lo usa con `sx`.
const ChoiceChip = ({ selected, sx, ...rest }) => (
  <Chip
    variant={selected ? 'filled' : 'outlined'}
    aria-pressed={selected}
    sx={[
      selected
        ? { bgcolor: 'text.primary', color: 'background.paper', '&:hover, &.Mui-focusVisible': { bgcolor: 'text.primary' } }
        : { borderColor: 'text.secondary', color: 'text.primary' },
      sx,
    ]}
    {...rest}
  />
);

export default ChoiceChip;
